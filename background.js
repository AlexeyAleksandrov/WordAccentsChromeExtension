// Создаём контекстное меню при установке расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToAccentDictionary',
    title: 'Добавить в словарь',
    contexts: ['selection']
  });
});

// Обработчик клика по контекстному меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToAccentDictionary' && info.selectionText) {
    const selectedWord = info.selectionText.trim();
    
    // Отправляем сообщение в content script для показа popup
    chrome.tabs.sendMessage(tab.id, {
      action: 'showAccentSelector',
      word: selectedWord
    });
  }
});

// Обработчик сообщений от content script и popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveWord') {
    // Сохраняем слово с ударением в storage
    chrome.storage.local.get(['accentDictionary'], (result) => {
      const dictionary = result.accentDictionary || {};
      dictionary[request.word.toLowerCase()] = request.accentPositions;
      
      chrome.storage.local.set({ accentDictionary: dictionary }, () => {
        sendResponse({ success: true });
        
        // Уведомляем все вкладки об обновлении словаря
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateDictionary'
            }).catch(() => {
              // Игнорируем ошибки для вкладок, которые не поддерживают content script
            });
          });
        });
      });
    });
    return true; // Указываем, что ответ будет асинхронным
  }
  
  if (request.action === 'getDictionary') {
    chrome.storage.local.get(['accentDictionary'], (result) => {
      sendResponse({ dictionary: result.accentDictionary || {} });
    });
    return true;
  }
});
