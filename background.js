// Side Panel をツールバーアイコンクリックで開く
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[ささっとテンプレ] Side panel setup error:', error));

// 初回インストール時にデフォルトデータを設定
chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.local.get(['templates']);
    if (!data.templates) {
        await chrome.storage.local.set({ templates: {} });
    }
});

// メッセージルーティング
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSidePanel') {
        (async () => {
            try {
                await chrome.sidePanel.open({ tabId: sender.tab.id });
                sendResponse({ success: true });
            } catch (error) {
                console.error('[ささっとテンプレ] Open side panel error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (message.action === 'closeSidePanel') {
        (async () => {
            try {
                await chrome.storage.local.set({
                    sidePanelOpen: false,
                    shouldCloseSidePanel: Date.now()
                });
                sendResponse({ success: true });
            } catch (error) {
                console.error('[ささっとテンプレ] Close side panel error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (message.action === 'insertTemplate') {
        (async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'insertTemplate',
                        content: message.content
                    });
                }
                sendResponse({ success: true });
            } catch (error) {
                console.error('[ささっとテンプレ] Insert template error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});
