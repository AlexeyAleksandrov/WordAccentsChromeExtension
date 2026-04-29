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
  
  // Обработчик кнопки экспорта
  document.getElementById('exportBtn').addEventListener('click', () => {
    exportDictionary();
  });
  
  // Обработчик кнопки импорта
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  
  // Обработчик выбора файла для импорта
  document.getElementById('importFileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      importDictionary(file);
      // Сбрасываем input для возможности повторного импорта того же файла
      event.target.value = '';
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
  const exportBtn = document.getElementById('exportBtn');
  
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
    exportBtn.disabled = true;
  } else {
    wordList.innerHTML = '';
    clearAllBtn.disabled = false;
    exportBtn.disabled = false;
    
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

// Экспортируем словарь
function exportDictionary() {
  chrome.storage.local.get(['accentDictionary'], (result) => {
    const dictionary = result.accentDictionary || {};
    
    // Создаём версионированный формат экспорта
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      wordCount: Object.keys(dictionary).length,
      dictionary: dictionary
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `accent-dictionary-${dateStr}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
}

// Импортируем словарь
function importDictionary(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      
      // Проверяем версию файла
      let importedDict = {};
      
      if (importedData.version) {
        // Новый версионированный формат
        if (importedData.version !== '1.0') {
          alert(`Предупреждение: файл создан в версии ${importedData.version}. Текущая версия: 1.0. Возможны проблемы совместимости.`);
        }
        importedDict = importedData.dictionary || {};
      } else {
        // Старый формат (просто словарь)
        importedDict = importedData;
      }
      
      // Валидация импортированных данных
      if (!validateDictionary(importedDict)) {
        alert('Ошибка: файл содержит некорректные данные.');
        return;
      }
      
      // Загружаем текущий словарь для проверки конфликтов
      chrome.storage.local.get(['accentDictionary'], (result) => {
        const currentDict = result.accentDictionary || {};
        const conflicts = findConflicts(currentDict, importedDict);
        
        if (conflicts.length > 0) {
          // Есть конфликты - показываем диалог выбора режима
          showImportModeDialog(currentDict, importedDict, conflicts);
        } else if (Object.keys(currentDict).length > 0) {
          // Нет конфликтов, но словарь не пустой - спрашиваем режим
          showImportModeDialog(currentDict, importedDict, []);
        } else {
          // Словарь пустой - просто импортируем
          performImport(importedDict, 'replace');
        }
      });
      
    } catch (error) {
      console.error('Ошибка импорта словаря:', error);
      alert('Ошибка: не удалось прочитать файл. Убедитесь, что это правильный JSON файл.');
    }
  };
  reader.readAsText(file);
}

// Проверяем корректность словаря
function validateDictionary(dict) {
  if (typeof dict !== 'object' || dict === null) {
    return false;
  }
  
  for (const [word, positions] of Object.entries(dict)) {
    if (typeof word !== 'string' || !Array.isArray(positions)) {
      return false;
    }
    
    // Проверяем, что позиции - это числа в пределах длины слова
    for (const pos of positions) {
      if (typeof pos !== 'number' || pos < 0 || pos >= word.length) {
        return false;
      }
    }
  }
  
  return true;
}

// Находим конфликты между текущим и импортируемым словарями
function findConflicts(currentDict, importedDict) {
  const conflicts = [];
  
  for (const word in importedDict) {
    if (word in currentDict) {
      const currentPositions = currentDict[word];
      const importedPositions = importedDict[word];
      
      // Проверяем, отличаются ли позиции ударений
      if (JSON.stringify(currentPositions.sort()) !== JSON.stringify(importedPositions.sort())) {
        conflicts.push({
          word: word,
          current: currentPositions,
          imported: importedPositions
        });
      }
    }
  }
  
  return conflicts;
}

// Показываем диалог выбора режима импорта
function showImportModeDialog(currentDict, importedDict, conflicts) {
  const modal = document.getElementById('importModal');
  const currentWordCountEl = document.getElementById('currentWordCount');
  const importedWordCountEl = document.getElementById('importedWordCount');
  const conflictsRow = document.getElementById('conflictsRow');
  const conflictsCountEl = document.getElementById('conflictsCount');
  const conflictsList = document.getElementById('conflictsList');
  
  // Заполняем информацию
  currentWordCountEl.textContent = `${Object.keys(currentDict).length} слов`;
  importedWordCountEl.textContent = `${Object.keys(importedDict).length} слов`;
  
  // Показываем конфликты, если есть
  if (conflicts.length > 0) {
    conflictsRow.style.display = 'flex';
    conflictsCountEl.textContent = conflicts.length;
    
    conflictsList.style.display = 'block';
    const maxShow = 5;
    const conflictsToShow = conflicts.slice(0, maxShow);
    const hasMore = conflicts.length > maxShow;
    
    conflictsList.innerHTML = `
      <div class="conflicts-list-title">Конфликтующие слова:</div>
      ${conflictsToShow.map(c => `<div class="conflict-item">${c.word}</div>`).join('')}
      ${hasMore ? `<div class="conflict-item">...ещё ${conflicts.length - maxShow}</div>` : ''}
    `;
  } else {
    conflictsRow.style.display = 'none';
    conflictsList.style.display = 'none';
  }
  
  // Показываем модальное окно
  modal.style.display = 'flex';
  
  // Обработчики кнопок
  const importMergeBtn = document.getElementById('importMergeBtn');
  const importReplaceBtn = document.getElementById('importReplaceBtn');
  const importCancelBtn = document.getElementById('importCancelBtn');
  
  // Создаём новые обработчики (удаляем старые, если есть)
  const newMergeBtn = importMergeBtn.cloneNode(true);
  const newReplaceBtn = importReplaceBtn.cloneNode(true);
  const newCancelBtn = importCancelBtn.cloneNode(true);
  
  importMergeBtn.parentNode.replaceChild(newMergeBtn, importMergeBtn);
  importReplaceBtn.parentNode.replaceChild(newReplaceBtn, importReplaceBtn);
  importCancelBtn.parentNode.replaceChild(newCancelBtn, importCancelBtn);
  
  // Добавление к существующим
  newMergeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    performImport(importedDict, 'merge');
  });
  
  // Полная замена
  newReplaceBtn.addEventListener('click', () => {
    if (confirm('Вы уверены? Все текущие слова будут удалены и заменены импортированными.')) {
      modal.style.display = 'none';
      performImport(importedDict, 'replace');
    }
  });
  
  // Отмена
  newCancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Закрытие по клику вне модального окна
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Выполняем импорт
function performImport(importedDict, mode) {
  if (mode === 'replace') {
    // Полная замена
    chrome.storage.local.set({ accentDictionary: importedDict }, () => {
      loadAndDisplayDictionary();
      notifyAllTabs();
      alert(`Импорт завершён! Импортировано слов: ${Object.keys(importedDict).length}`);
    });
  } else if (mode === 'merge') {
    // Объединение с существующим словарём
    chrome.storage.local.get(['accentDictionary'], (result) => {
      const currentDict = result.accentDictionary || {};
      const mergedDict = { ...currentDict, ...importedDict };
      
      chrome.storage.local.set({ accentDictionary: mergedDict }, () => {
        loadAndDisplayDictionary();
        notifyAllTabs();
        
        const added = Object.keys(importedDict).length;
        const total = Object.keys(mergedDict).length;
        alert(`Импорт завершён! Добавлено: ${added}, Всего слов: ${total}`);
      });
    });
  }
}

// Уведомляем все вкладки об обновлении словаря
function notifyAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'updateDictionary'
      }).catch(() => {});
    });
  });
}
