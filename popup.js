// Загружаем и отображаем словарь при открытии popup
document.addEventListener('DOMContentLoaded', () => {
  loadAndDisplayDictionary();
  
  // Обработчик кнопки очистки словаря
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите удалить все слова из словаря?')) {
      chrome.storage.local.set({ accentDictionary: {} }, () => {
        loadAndDisplayDictionary();
        // Обновляем все вкладки
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateDictionary'
            }).catch(() => {});
          });
        });
      });
    }
  });
});

// Загружаем и отображаем словарь
function loadAndDisplayDictionary() {
  chrome.storage.local.get(['accentDictionary'], (result) => {
    const dictionary = result.accentDictionary || {};
    displayDictionary(dictionary);
  });
}

// Отображаем словарь в popup
function displayDictionary(dictionary) {
  const wordList = document.getElementById('wordList');
  const wordCount = document.getElementById('wordCount');
  const clearAllBtn = document.getElementById('clearAllBtn');
  
  const words = Object.keys(dictionary);
  wordCount.textContent = words.length;
  
  if (words.length === 0) {
    wordList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <div class="empty-state-text">
          Словарь пуст.<br>
          Выделите слово на странице и добавьте его через контекстное меню.
        </div>
      </div>
    `;
    clearAllBtn.disabled = true;
  } else {
    wordList.innerHTML = '';
    clearAllBtn.disabled = false;
    
    // Сортируем слова по алфавиту
    words.sort((a, b) => a.localeCompare(b, 'ru'));
    
    words.forEach(word => {
      const positions = dictionary[word];
      const wordItem = createWordItem(word, positions);
      wordList.appendChild(wordItem);
    });
  }
}

// Создаём элемент списка для слова
function createWordItem(word, positions) {
  const div = document.createElement('div');
  div.className = 'word-item';
  
  const wordText = document.createElement('div');
  wordText.className = 'word-text';
  
  // Отображаем слово с ударением
  const letters = word.split('');
  letters.forEach((letter, index) => {
    if (positions.includes(index)) {
      const span = document.createElement('span');
      span.className = 'accent-mark';
      span.textContent = letter;
      wordText.appendChild(span);
    } else {
      wordText.appendChild(document.createTextNode(letter));
    }
  });
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Удалить';
  deleteBtn.addEventListener('click', () => {
    deleteWord(word);
  });
  
  div.appendChild(wordText);
  div.appendChild(deleteBtn);
  
  return div;
}

// Удаляем слово из словаря
function deleteWord(word) {
  chrome.storage.local.get(['accentDictionary'], (result) => {
    const dictionary = result.accentDictionary || {};
    delete dictionary[word.toLowerCase()];
    
    chrome.storage.local.set({ accentDictionary: dictionary }, () => {
      loadAndDisplayDictionary();
      
      // Уведомляем все вкладки об обновлении словаря
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateDictionary'
          }).catch(() => {});
        });
      });
    });
  });
}
