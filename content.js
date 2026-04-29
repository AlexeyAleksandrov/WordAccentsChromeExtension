// Словарь ударений (загружается из storage)
let accentDictionary = {};

// Флаг активности выделения текста пользователем
let isUserSelecting = false;
let selectionTimeout = null;

// Отслеживаем изменения выделения
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  
  if (selection && selection.toString().trim().length > 0) {
    // Пользователь выделяет текст
    isUserSelecting = true;
    
    // Очищаем предыдущий таймаут
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    
    // Через 2 секунды после последнего изменения выделения разрешаем обновления
    selectionTimeout = setTimeout(() => {
      isUserSelecting = false;
    }, 2000);
  } else {
    // Выделение снято, но даём небольшую задержку на случай двойного клика
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    selectionTimeout = setTimeout(() => {
      isUserSelecting = false;
    }, 300);
  }
});

// Загружаем словарь при загрузке страницы
loadDictionary();

// Функция загрузки словаря
function loadDictionary() {
  console.log('[Accent Extension] Загружаем словарь...');
  chrome.runtime.sendMessage({ action: 'getDictionary' }, (response) => {
    if (response && response.dictionary) {
      accentDictionary = response.dictionary;
      console.log('[Accent Extension] Словарь загружен:', accentDictionary);
      applyAccents();
    } else {
      console.log('[Accent Extension] Словарь не получен или пуст');
    }
  });
}

// Обработчик сообщений от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Accent Extension] Получено сообщение:', request);
  
  if (request.action === 'showAccentSelector') {
    showAccentSelectorModal(request.word);
  }
  
  if (request.action === 'updateDictionary') {
    console.log('[Accent Extension] Получен запрос на обновление словаря');
    loadDictionary();
  }
});

// Показываем модальное окно для выбора буквы ударения
function showAccentSelectorModal(word) {
  console.log('[Accent Extension] Показываем модальное окно для выбора буквы ударения:', word);
  // Удаляем предыдущее модальное окно, если оно есть
  const existingModal = document.getElementById('accent-selector-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Проверяем, есть ли слово уже в словаре
  const wordLower = word.toLowerCase();
  const existingAccents = accentDictionary[wordLower] || [];
  const isEditing = existingAccents.length > 0;
  
  // Создаём модальное окно
  const modal = document.createElement('div');
  modal.id = 'accent-selector-modal';
  modal.className = 'accent-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'accent-modal-content';
  
  const title = document.createElement('h3');
  title.textContent = isEditing 
    ? 'Редактирование ударения:' 
    : 'Выберите букву(ы) для ударения:';
  modalContent.appendChild(title);
  
  // Если редактируем, показываем подсказку
  if (isEditing) {
    const hint = document.createElement('p');
    hint.style.margin = '0 0 12px 0';
    hint.style.fontSize = '13px';
    hint.style.color = '#8c8c8c';
    hint.textContent = 'Текущие ударения выделены. Нажмите для изменения.';
    modalContent.appendChild(hint);
  }
  
  const wordContainer = document.createElement('div');
  wordContainer.className = 'accent-word-container';
  
  // Создаём кнопки для каждой буквы
  const letters = word.split('');
  const selectedPositions = [...existingAccents]; // Копируем существующие ударения
  
  letters.forEach((letter, index) => {
    const letterBtn = document.createElement('button');
    letterBtn.className = 'accent-letter-btn';
    letterBtn.textContent = letter;
    letterBtn.dataset.index = index;
    
    // Если буква уже имеет ударение, предвыделяем её
    if (existingAccents.includes(index)) {
      letterBtn.classList.add('selected');
    }
    
    letterBtn.addEventListener('click', () => {
      letterBtn.classList.toggle('selected');
      const pos = parseInt(letterBtn.dataset.index);
      const posIndex = selectedPositions.indexOf(pos);
      
      if (posIndex > -1) {
        selectedPositions.splice(posIndex, 1);
      } else {
        selectedPositions.push(pos);
      }
    });
    
    wordContainer.appendChild(letterBtn);
  });
  
  modalContent.appendChild(wordContainer);
  
  // Кнопки действий
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'accent-button-container';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'accent-save-btn';
  saveBtn.textContent = 'Сохранить';
  saveBtn.addEventListener('click', () => {
    if (selectedPositions.length > 0) {
      // МГНОВЕННОЕ ПРИМЕНЕНИЕ: обновляем локальный словарь сразу
      const wordLower = word.toLowerCase();
      accentDictionary[wordLower] = selectedPositions;
      console.log('[Accent Extension] ✓ Слово добавлено локально:', wordLower, selectedPositions);
      
      // Закрываем модальное окно
      modal.remove();
      
      // МГНОВЕННО применяем ударения на текущей странице
      console.log('[Accent Extension] Применяем ударения для нового слова...');
      applyAccents();
      
      // Параллельно сохраняем в storage для других вкладок
      chrome.runtime.sendMessage({
        action: 'saveWord',
        word: word,
        accentPositions: selectedPositions
      }, (response) => {
        if (response && response.success) {
          console.log('[Accent Extension] ✓ Слово сохранено в storage');
        }
      });
    } else {
      alert('Пожалуйста, выберите хотя бы одну букву для ударения');
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'accent-cancel-btn';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  buttonContainer.appendChild(saveBtn);
  buttonContainer.appendChild(cancelBtn);
  
  // Если это редактирование существующего слова, добавляем кнопку удаления
  if (isEditing) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'accent-delete-btn';
    deleteBtn.textContent = 'Удалить из словаря';
    deleteBtn.style.marginRight = 'auto'; // Выравниваем влево
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Удалить слово "${word}" из словаря?`)) {
        // Удаляем из локального словаря
        const wordLower = word.toLowerCase();
        delete accentDictionary[wordLower];
        
        // Закрываем модальное окно
        modal.remove();
        
        // Обновляем страницу (убираем ударения)
        applyAccents();
        
        // Удаляем из storage
        chrome.runtime.sendMessage({
          action: 'deleteWord',
          word: word
        });
      }
    });
    buttonContainer.insertBefore(deleteBtn, buttonContainer.firstChild);
  }
  
  modalContent.appendChild(buttonContainer);
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Закрытие по клику вне модального окна
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Функция удаления всех ударений со страницы
function removeAllAccents() {
  console.log('[Accent Extension] Удаляем все существующие ударения...');
  
  // Находим все элементы с классом accent-word
  const accentedElements = document.querySelectorAll('.accent-word');
  
  if (accentedElements.length === 0) {
    console.log('[Accent Extension] Нет элементов для удаления');
    return;
  }
  
  // Собираем уникальных родителей для нормализации
  const parents = new Set();
  
  accentedElements.forEach(element => {
    // Получаем текст без combining accents
    const cleanText = element.textContent.replace(/\u0301/g, '');
    
    // Создаём текстовый узел с чистым текстом
    const textNode = document.createTextNode(cleanText);
    
    // Сохраняем родителя для последующей нормализации
    const parent = element.parentNode;
    if (parent) {
      parents.add(parent);
      // Заменяем span на текстовый узел
      parent.replaceChild(textNode, element);
    }
  });
  
  // Нормализуем всех родителей (объединяем соседние текстовые узлы)
  parents.forEach(parent => {
    if (parent && parent.normalize) {
      parent.normalize();
    }
  });
  
  console.log('[Accent Extension] Удалено элементов:', accentedElements.length);
}

// Функция применения ударений на странице
function applyAccents() {
  // Блокируем обновления, если пользователь активно выделяет текст
  if (isUserSelecting) {
    console.log('[Accent Extension] Пользователь работает с выделением, откладываем обновление');
    return;
  }
  
  // Временно отключаем observer, чтобы он не реагировал на наши изменения
  if (window.accentObserver) {
    window.accentObserver.disconnect();
  }
  
  removeAllAccents();
  
  if (Object.keys(accentDictionary).length === 0) {
    console.log('[Accent Extension] Словарь пуст, пропускаем обработку');
    // Восстанавливаем observer даже если словарь пуст
    if (window.accentObserver) {
      window.accentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    return;
  }
  
  console.log('[Accent Extension] Применяем ударения. Слов в словаре:', Object.keys(accentDictionary).length);
  
  let processedNodes = 0;
  let checkedTextNodes = 0;
  let totalMatches = 0;
  
  // Рекурсивная функция обработки текстовых узлов
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) return;
      
      checkedTextNodes++;
      
      // Собираем ВСЕ совпадения из всех слов словаря
      const allMatches = [];
      
      for (const [word, positions] of Object.entries(accentDictionary)) {
        // Используем lookahead и lookbehind для проверки границ слова
        // (?<![а-яёА-ЯЁa-zA-Z]) - до слова нет букв
        // (?![а-яёА-ЯЁa-zA-Z]) - после слова нет букв
        const pattern = `(?<![а-яёА-ЯЁa-zA-Z])${escapeRegex(word)}(?![а-яёА-ЯЁa-zA-Z])`;
        const regex = new RegExp(pattern, 'gi');
        
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          allMatches.push({
            index: match.index,
            endIndex: match.index + match[0].length,
            word: match[0],
            positions: positions
          });
          totalMatches++;
        }
      }
      
      // Если нет совпадений, выходим
      if (allMatches.length === 0) return;
      
      // Сортируем совпадения по позиции в тексте
      allMatches.sort((a, b) => a.index - b.index);
      
      // Убираем перекрывающиеся совпадения
      const nonOverlappingMatches = [];
      let lastEndIndex = 0;
      
      for (const match of allMatches) {
        if (match.index >= lastEndIndex) {
          nonOverlappingMatches.push(match);
          lastEndIndex = match.endIndex;
        }
      }
      
      if (nonOverlappingMatches.length === 0) return;
      
      // Создаём фрагмент с заменами
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      nonOverlappingMatches.forEach(matchInfo => {
        // Добавляем текст до слова
        if (matchInfo.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchInfo.index)));
        }
        
        // Создаём span с ударением
        const span = createAccentedWord(matchInfo.word, matchInfo.positions);
        fragment.appendChild(span);
        
        lastIndex = matchInfo.endIndex;
      });
      
      // Добавляем оставшийся текст
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Заменяем узел
      node.parentNode.replaceChild(fragment, node);
      processedNodes++;
      
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Пропускаем script, style, уже обработанные элементы и модальные окна
      if (!['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(node.tagName) && 
          !node.classList.contains('accent-word') &&
          !node.classList.contains('accent-modal')) {
        Array.from(node.childNodes).forEach(child => processNode(child));
      }
    }
  }
  
  processNode(document.body);
  
  if (totalMatches > 0) {
    console.log('[Accent Extension] ✓ Применено ударений:', totalMatches, '| Обработано узлов:', processedNodes);
  }
  
  // Восстанавливаем observer
  if (window.accentObserver) {
    window.accentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}

// Создаём слово с ударением
function createAccentedWord(word, positions) {
  const span = document.createElement('span');
  span.className = 'accent-word';
  
  const letters = word.split('');
  let result = '';
  
  letters.forEach((letter, index) => {
    result += letter;
    // Если это ударная буква, добавляем combining acute accent после неё
    if (positions.includes(index)) {
      result += '\u0301'; // Combining acute accent
    }
  });
  
  span.textContent = result;
  return span;
}

// Экранирование спецсимволов для регулярных выражений
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Наблюдаем за изменениями DOM для динамического контента
let applyAccentsTimeout = null;

window.accentObserver = new MutationObserver((mutations) => {
  // Блокируем обновления, если пользователь работает с выделением
  if (isUserSelecting) {
    console.log('[Accent Extension] Пользователь работает с выделением, пропускаем обновление DOM');
    return;
  }
  
  // Проверяем, есть ли значимые изменения
  let hasSignificantChanges = false;
  
  for (const mutation of mutations) {
    // Игнорируем изменения в наших собственных элементах
    if (mutation.target.classList && 
        (mutation.target.classList.contains('accent-modal') || 
         mutation.target.classList.contains('accent-word'))) {
      continue;
    }
    
    // Проверяем добавленные узлы
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && 
          !node.classList?.contains('accent-modal') &&
          !node.classList?.contains('accent-word')) {
        hasSignificantChanges = true;
        break;
      }
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        hasSignificantChanges = true;
        break;
      }
    }
    
    if (hasSignificantChanges) break;
  }
  
  if (hasSignificantChanges) {
    console.log('[Accent Extension] Обнаружены изменения DOM, применяем ударения через debounce');
    
    // Используем debounce, чтобы не запускать функцию слишком часто
    if (applyAccentsTimeout) {
      clearTimeout(applyAccentsTimeout);
    }
    
    applyAccentsTimeout = setTimeout(() => {
      applyAccents();
    }, 500); // Ждём 500мс после последнего изменения
  }
});

// Запускаем наблюдение
window.accentObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Принудительно применяем ударения через 2 секунды после загрузки
// (для случаев, когда контент загружается динамически)
setTimeout(() => {
  console.log('[Accent Extension] Принудительная проверка через 2 секунды после загрузки');
  applyAccents();
}, 2000);

// Также применяем при полной загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Accent Extension] DOMContentLoaded - применяем ударения');
    setTimeout(() => applyAccents(), 1000);
  });
}

console.log('[Accent Extension] Content script инициализирован');
