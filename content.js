// Словарь ударений (загружается из storage)
let accentDictionary = {};

// Загружаем словарь при загрузке страницы
loadDictionary();

// Функция загрузки словаря
function loadDictionary() {
  chrome.runtime.sendMessage({ action: 'getDictionary' }, (response) => {
    if (response && response.dictionary) {
      accentDictionary = response.dictionary;
      applyAccents();
    }
  });
}

// Обработчик сообщений от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showAccentSelector') {
    showAccentSelectorModal(request.word);
  }
  
  if (request.action === 'updateDictionary') {
    loadDictionary();
  }
});

// Показываем модальное окно для выбора буквы ударения
function showAccentSelectorModal(word) {
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
    return;
  }
  
  // Рекурсивная функция обработки текстовых узлов
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) return;
      
      let modified = false;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      // Ищем все слова в словаре
      for (const [word, positions] of Object.entries(accentDictionary)) {
        const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
        let match;
        const matches = [];
        
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            index: match.index,
            word: match[0],
            positions: positions
          });
        }
        
        // Обрабатываем найденные совпадения
        matches.forEach(matchInfo => {
          if (matchInfo.index >= lastIndex) {
            // Добавляем текст до слова
            if (matchInfo.index > lastIndex) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchInfo.index)));
            }
            
            // Создаём span с ударением
            const span = createAccentedWord(matchInfo.word, matchInfo.positions);
            fragment.appendChild(span);
            
            lastIndex = matchInfo.index + matchInfo.word.length;
            modified = true;
          }
        });
      }
      
      if (modified) {
        // Добавляем оставшийся текст
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        
        node.parentNode.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Пропускаем script, style и уже обработанные элементы
      if (!['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName) && 
          !node.classList.contains('accent-word')) {
        Array.from(node.childNodes).forEach(child => processNode(child));
      }
    }
  }
  
  processNode(document.body);
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
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('accent-modal')) {
        applyAccents();
      }
    });
  });
});

// Запускаем наблюдение
observer.observe(document.body, {
  childList: true,
  subtree: true
});
