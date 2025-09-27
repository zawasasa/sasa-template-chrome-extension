chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('Extension reload required:', chrome.runtime.lastError.message);
        }
    });
});