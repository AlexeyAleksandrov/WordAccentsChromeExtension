// Словарь ударений (загружается из storage)
let accentDictionary = {};

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
  
  // Создаём модальное окно
  const modal = document.createElement('div');
  modal.id = 'accent-selector-modal';
  modal.className = 'accent-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'accent-modal-content';
  
  const title = document.createElement('h3');
  title.textContent = 'Выберите букву(ы) для ударения:';
  modalContent.appendChild(title);
  
  const wordContainer = document.createElement('div');
  wordContainer.className = 'accent-word-container';
  
  // Создаём кнопки для каждой буквы
  const letters = word.split('');
  const selectedPositions = [];
  
  letters.forEach((letter, index) => {
    const letterBtn = document.createElement('button');
    letterBtn.className = 'accent-letter-btn';
    letterBtn.textContent = letter;
    letterBtn.dataset.index = index;
    
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
      chrome.runtime.sendMessage({
        action: 'saveWord',
        word: word,
        accentPositions: selectedPositions
      }, (response) => {
        if (response && response.success) {
          modal.remove();
          loadDictionary(); // Перезагружаем словарь
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

// Функция применения ударений на странице
function applyAccents() {
  if (Object.keys(accentDictionary).length === 0) {
    console.log('[Accent Extension] Словарь пуст, пропускаем обработку');
    return;
  }
  
  console.log('[Accent Extension] Применяем ударения. Словарь:', accentDictionary);
  console.log('[Accent Extension] Ищем слова:', Object.keys(accentDictionary));
  
  // ТЕСТ: проверяем regex с разными регистрами
  console.log('[Accent Extension] === ТЕСТ REGEX ===');
  for (const word of Object.keys(accentDictionary)) {
    const pattern = `(?<![а-яёА-ЯЁa-zA-Z])${escapeRegex(word)}(?![а-яёА-ЯЁa-zA-Z])`;
    const regex = new RegExp(pattern, 'gi');
    
    // Тестовые строки
    const testStrings = [
      word,                              // слово
      word.charAt(0).toUpperCase() + word.slice(1), // Слово
      word.toUpperCase(),                // СЛОВО
      `Это ${word} тест`,                // с контекстом
      `${word.charAt(0).toUpperCase() + word.slice(1)} Иванович` // начало строки
    ];
    
    testStrings.forEach(testStr => {
      const match = testStr.match(regex);
      console.log(`[Accent Extension] Regex (новый) находит "${testStr}": ${match ? '✓' : '✗'}`);
    });
  }
  console.log('[Accent Extension] === КОНЕЦ ТЕСТА ===');
  
  // ДИАГНОСТИКА: проверяем, есть ли искомые слова на странице вообще
  const pageText = document.body.innerText;
  const pageTextLower = pageText.toLowerCase();
  
  for (const word of Object.keys(accentDictionary)) {
    const found = pageTextLower.includes(word);
    console.log(`[Accent Extension] Слово "${word}" ${found ? '✓ ЕСТЬ' : '✗ НЕТ'} на странице (innerText)`);
    if (found) {
      // Найдём контекст
      const index = pageTextLower.indexOf(word);
      const context = pageText.substring(Math.max(0, index - 30), Math.min(pageText.length, index + word.length + 30));
      console.log(`[Accent Extension] Контекст: "...${context}..."`);
      
      // Проверяем, есть ли это слово как отдельный текстовый узел
      console.log(`[Accent Extension] ⚠️ ВНИМАНИЕ: Слово может быть разбито на несколько текстовых узлов!`);
    }
  }
  
  let processedNodes = 0;
  let checkedTextNodes = 0;
  let totalMatches = 0;
  let sampleTexts = []; // Собираем примеры текста для отладки
  
  // Рекурсивная функция обработки текстовых узлов
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) return;
      
      checkedTextNodes++;
      
      // Сохраняем первые 20 примеров текста для отладки
      if (sampleTexts.length < 20 && text.trim().length > 5) {
        sampleTexts.push(text.trim().substring(0, 80));
      }
      
      // СПЕЦИАЛЬНАЯ ДИАГНОСТИКА: проверяем, содержит ли этот узел искомые слова
      const textLower = text.toLowerCase();
      for (const word of Object.keys(accentDictionary)) {
        if (textLower.includes(word)) {
          console.log(`[Accent Extension] 🔍 Узел содержит "${word}": "${text.trim()}"`);
          console.log(`[Accent Extension] 🔍 Длина текста: ${text.length}, Есть пробелы в начале/конце:`, text !== text.trim());
          
          // ТЕСТ: проверяем НОВЫЙ regex прямо на этом тексте
          const pattern = `(?<![а-яёА-ЯЁa-zA-Z])${escapeRegex(word)}(?![а-яёА-ЯЁa-zA-Z])`;
          const regex = new RegExp(pattern, 'gi');
          const match = text.match(regex);
          console.log(`[Accent Extension] 🧪 Regex НОВЫЙ "${pattern}" на этом тексте:`, match ? `✓ НАХОДИТ: ${match}` : '✗ НЕ НАХОДИТ');
          
          // Дополнительный тест без границ слова
          const regexNoBoundary = new RegExp(escapeRegex(word), 'gi');
          const matchNoBoundary = text.match(regexNoBoundary);
          console.log(`[Accent Extension] 🧪 Regex без границ "${escapeRegex(word)}":`, matchNoBoundary ? `✓ НАХОДИТ: ${matchNoBoundary}` : '✗ НЕ НАХОДИТ');
        }
      }

      // Собираем ВСЕ совпадения из всех слов словаря
      const allMatches = [];
      
      for (const [word, positions] of Object.entries(accentDictionary)) {
        // Используем lookahead и lookbehind для проверки границ слова
        // (?<![а-яёА-ЯЁa-zA-Z]) - до слова нет букв
        // (?![а-яёА-ЯЁa-zA-Z]) - после слова нет букв
        const pattern = `(?<![а-яёА-ЯЁa-zA-Z])${escapeRegex(word)}(?![а-яёА-ЯЁa-zA-Z])`;
        const regex = new RegExp(pattern, 'gi');
        
        // Отладка: логируем поиск для первых нескольких узлов
        if (checkedTextNodes <= 3 && text.length > 0) {
          console.log(`[Accent Extension] Ищем слово "${word}" (паттерн: ${pattern}) в тексте:`, text.substring(0, 100));
        }
        
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          allMatches.push({
            index: match.index,
            endIndex: match.index + match[0].length,
            word: match[0],
            positions: positions
          });
          totalMatches++;
          console.log('[Accent Extension] ✓ Найдено совпадение:', match[0], 'в позиции', match.index);
        }
      }
      
      // Если нет совпадений, выходим
      if (allMatches.length === 0) return;
      
      console.log('[Accent Extension] Найдено совпадений в узле:', allMatches.length, 'Текст:', text.substring(0, 100));
      
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
  
  console.log('[Accent Extension] Проверено текстовых узлов:', checkedTextNodes);
  console.log('[Accent Extension] Примеры текста из узлов (первые 20):', sampleTexts);
  console.log('[Accent Extension] Найдено всего совпадений:', totalMatches);
  console.log('[Accent Extension] Обработано текстовых узлов с заменами:', processedNodes);
}

// Создаём слово с ударением
function createAccentedWord(word, positions) {
  const span = document.createElement('span');
  span.className = 'accent-word';
  
  const letters = word.split('');
  letters.forEach((letter, index) => {
    if (positions.includes(index)) {
      const accentLetter = document.createElement('span');
      accentLetter.className = 'accent-letter';
      accentLetter.textContent = letter;
      span.appendChild(accentLetter);
    } else {
      span.appendChild(document.createTextNode(letter));
    }
  });
  
  return span;
}

// Экранирование спецсимволов для регулярных выражений
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Наблюдаем за изменениями DOM для динамического контента
let applyAccentsTimeout = null;

const observer = new MutationObserver((mutations) => {
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
observer.observe(document.body, {
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
