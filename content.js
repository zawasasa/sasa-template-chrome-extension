let sidebarIframe = null;
let currentActiveElement = null;

function createSidebar() {
    if (sidebarIframe) return;

    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = 'sasatto-template-sidebar';
    sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
    sidebarIframe.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        right: -350px !important;
        width: 350px !important;
        height: 100vh !important;
        border: none !important;
        z-index: 999999 !important;
        transition: right 0.3s ease !important;
        background: white !important;
        box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1) !important;
    `;

    document.body.appendChild(sidebarIframe);

    sidebarIframe.onload = function() {
        setupMessageListener();
    };
}

function showSidebar() {
    if (!sidebarIframe) {
        createSidebar();
        setTimeout(() => {
            sidebarIframe.style.right = '0px';
        }, 10);
    } else {
        sidebarIframe.style.right = '0px';
    }
}

function hideSidebar() {
    if (sidebarIframe) {
        sidebarIframe.style.right = '-350px';
    }
}

function setupMessageListener() {
    window.addEventListener('message', function(event) {
        if (!sidebarIframe || event.source !== sidebarIframe.contentWindow) return;

        try {
            switch (event.data.type) {
                case 'CLOSE_SIDEBAR':
                    hideSidebar();
                    break;
                case 'INSERT_TEMPLATE':
                    insertTemplate(event.data.content);
                    break;
                case 'GET_STORAGE':
                    getStorageData(event.data.callback);
                    break;
                case 'SET_STORAGE':
                    setStorageData(event.data.data, event.data.callback);
                    break;
            }
        } catch (error) {
            console.error('Message handling error:', error);
        }
    });
}

function insertTemplate(content) {
    const activeElement = document.activeElement;

    // 現在フォーカスされている要素に挿入を試みる
    if (activeElement && isTextInput(activeElement)) {
        insertIntoElement(activeElement, content);
        return;
    }

    // 直前にフォーカスされた要素に挿入を試みる
    if (currentActiveElement && isTextInput(currentActiveElement)) {
        currentActiveElement.focus();
        setTimeout(() => insertIntoElement(currentActiveElement, content), 10);
        return;
    }

    // ページ内の入力欄を探して挿入
    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input[type="url"], input[type="tel"], input[type="password"], input:not([type]), textarea, [contenteditable="true"]');
    if (textInputs.length > 0) {
        const visibleInputs = Array.from(textInputs).filter(input => {
            const style = window.getComputedStyle(input);
            return style.display !== 'none' && style.visibility !== 'hidden' && input.offsetParent !== null;
        });

        if (visibleInputs.length > 0) {
            const targetInput = visibleInputs[visibleInputs.length - 1];
            targetInput.focus();
            setTimeout(() => insertIntoElement(targetInput, content), 50);
            return;
        }
    }

    // フォールバック: クリップボードにコピー
    navigator.clipboard.writeText(content).then(() => {
        console.log('テンプレートをクリップボードにコピーしました:', content);
    }).catch(() => {
        console.log('テンプレートの挿入に失敗しました');
    });
}

function isTextInput(element) {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName === 'input') {
        const type = element.type.toLowerCase();
        return ['text', 'email', 'search', 'url', 'tel', 'password'].includes(type) || !element.type;
    }
    if (element.contentEditable === 'true') return true;

    return false;
}

function insertIntoElement(element, content) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;
        const value = element.value || '';

        element.value = value.substring(0, start) + content + value.substring(end);
        element.selectionStart = element.selectionEnd = start + content.length;

        // イベントを発火して変更を通知
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('テンプレートを挿入しました:', content);
    } else if (element.contentEditable === 'true') {
        element.focus();
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(content));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            element.appendChild(document.createTextNode(content));
        }

        console.log('テンプレートを挿入しました:', content);
    }
}

function getStorageData(callback) {
    try {
        chrome.storage.local.get(['templates'], function(result) {
            if (chrome.runtime.lastError) {
                console.error('Storage get error:', chrome.runtime.lastError);
                return;
            }
            if (sidebarIframe && sidebarIframe.contentWindow) {
                sidebarIframe.contentWindow.postMessage({
                    type: 'STORAGE_RESPONSE',
                    data: result.templates || {},
                    callback: callback
                }, '*');
            }
        });
    } catch (error) {
        console.error('Storage access error:', error);
    }
}

function setStorageData(data, callback) {
    try {
        chrome.storage.local.set({ templates: data }, function() {
            if (chrome.runtime.lastError) {
                console.error('Storage set error:', chrome.runtime.lastError);
                return;
            }
            if (sidebarIframe && sidebarIframe.contentWindow && callback) {
                sidebarIframe.contentWindow.postMessage({
                    type: 'STORAGE_SET_RESPONSE',
                    callback: callback
                }, '*');
            }
        });
    } catch (error) {
        console.error('Storage save error:', error);
    }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    try {
        if (request.action === 'toggleSidebar') {
            if (sidebarIframe && sidebarIframe.style.right === '0px') {
                hideSidebar();
            } else {
                showSidebar();
            }
            sendResponse({success: true});
        }
    } catch (error) {
        console.error('Content script error:', error);
        sendResponse({success: false, error: error.message});
    }
    return true;
});

document.addEventListener('click', function(event) {
    if (event.target.matches('input, textarea, [contenteditable="true"]')) {
        currentActiveElement = event.target;
    }
});

document.addEventListener('focus', function(event) {
    if (event.target.matches('input, textarea, [contenteditable="true"]')) {
        currentActiveElement = event.target;
    }
}, true);