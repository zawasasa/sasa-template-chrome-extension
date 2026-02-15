(function () {
    'use strict';

    // iframe内では実行しない
    if (window.self !== window.top) return;

    // 二重注入防止
    if (document.getElementById('sasatto-template-toggle-tab')) return;

    // --- 設定 ---
    const TAB_WIDTH = 32;
    const TAB_HEIGHT = 64;
    const TAB_SPACING = 8;
    const TAB_ICON = '📋';
    const TAB_COLOR = '#7CB342';
    const TAB_HOVER_COLOR = '#689F38';
    const TAB_DRAG_COLOR = '#558B2F';
    const TAB_ID = 'sasatto-template-toggle-tab';

    // --- テンプレート挿入用の状態 ---
    let currentActiveElement = null;

    // --- 動的配置: 衝突回避 ---
    function findAvailablePosition() {
        const defaultTop = (window.innerHeight - TAB_HEIGHT) / 2;

        const rightEdgeElements = Array.from(document.querySelectorAll('*')).filter(el => {
            if (el.id === TAB_ID) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return style.position === 'fixed' &&
                rect.right >= window.innerWidth - 50 &&
                rect.width > 20 && rect.width < 100 &&
                rect.height > 40 && rect.height < 150;
        });

        if (rightEdgeElements.length === 0) return defaultTop;

        const occupiedRanges = rightEdgeElements.map(el => {
            const rect = el.getBoundingClientRect();
            return { top: rect.top - TAB_SPACING, bottom: rect.bottom + TAB_SPACING };
        });

        const isPositionFree = (top) => {
            const bottom = top + TAB_HEIGHT;
            return !occupiedRanges.some(range =>
                top < range.bottom && bottom > range.top
            );
        };

        if (isPositionFree(defaultTop)) return defaultTop;

        // 下方向 → 上方向の順に探索
        for (let offset = TAB_HEIGHT + TAB_SPACING; offset < window.innerHeight; offset += TAB_HEIGHT + TAB_SPACING) {
            if (defaultTop + offset + TAB_HEIGHT < window.innerHeight - 20 && isPositionFree(defaultTop + offset)) {
                return defaultTop + offset;
            }
            if (defaultTop - offset > 20 && isPositionFree(defaultTop - offset)) {
                return defaultTop - offset;
            }
        }

        return defaultTop;
    }

    // --- Toggle Tab 作成 ---
    function createToggleTab() {
        const toggleTab = document.createElement('div');
        toggleTab.id = TAB_ID;

        const savedPosition = null; // 後でストレージから復元
        const initialTop = findAvailablePosition();

        toggleTab.style.cssText = `
            position: fixed !important;
            right: 0 !important;
            top: ${initialTop}px !important;
            width: ${TAB_WIDTH}px !important;
            height: ${TAB_HEIGHT}px !important;
            background: ${TAB_COLOR} !important;
            color: white !important;
            border: none !important;
            border-radius: 8px 0 0 8px !important;
            cursor: pointer !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 16px !important;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15) !important;
            transition: background 0.2s ease !important;
            user-select: none !important;
            padding: 0 !important;
            margin: 0 !important;
            line-height: 1 !important;
        `;

        toggleTab.textContent = TAB_ICON;
        toggleTab.title = 'ささっとテンプレ（Shift+ドラッグで移動）';

        // ホバーエフェクト
        toggleTab.addEventListener('mouseenter', () => {
            if (!toggleTab.dataset.dragging) {
                toggleTab.style.background = `${TAB_HOVER_COLOR} !important`;
            }
        });
        toggleTab.addEventListener('mouseleave', () => {
            if (!toggleTab.dataset.dragging) {
                toggleTab.style.background = `${TAB_COLOR} !important`;
            }
        });

        // クリックでサイドパネルをトグル
        toggleTab.addEventListener('click', async (e) => {
            if (toggleTab.dataset.wasDragging === 'true') {
                toggleTab.dataset.wasDragging = 'false';
                return;
            }

            if (!chrome.runtime?.id) {
                alert('拡張機能が更新されました。ページをリロードしてください。');
                return;
            }

            try {
                const { sidePanelOpen } = await chrome.storage.local.get('sidePanelOpen');
                if (sidePanelOpen) {
                    await chrome.runtime.sendMessage({ action: 'closeSidePanel' });
                } else {
                    await chrome.runtime.sendMessage({ action: 'openSidePanel' });
                }
            } catch (error) {
                console.error('[ささっとテンプレ] Toggle error:', error);
                if (error.message?.includes('Extension context invalidated')) {
                    alert('拡張機能が更新されました。ページをリロードしてください。');
                }
            }
        });

        document.body.appendChild(toggleTab);

        // ストレージから位置を復元
        chrome.storage.local.get('tabPosition', (result) => {
            if (result.tabPosition != null) {
                const pos = Math.max(20, Math.min(result.tabPosition, window.innerHeight - TAB_HEIGHT - 20));
                toggleTab.style.top = `${pos}px`;
            }
        });

        makeTabDraggable(toggleTab);

        return toggleTab;
    }

    // --- ドラッグ機能 ---
    function makeTabDraggable(toggleTab) {
        let isDragging = false;
        let dragStartY = 0;
        let tabStartTop = 0;

        toggleTab.addEventListener('mousedown', (e) => {
            if (!e.shiftKey) return;
            isDragging = true;
            toggleTab.dataset.dragging = 'true';
            dragStartY = e.clientY;
            tabStartTop = parseInt(toggleTab.style.top);
            toggleTab.style.background = `${TAB_DRAG_COLOR} !important`;
            toggleTab.style.cursor = 'grabbing !important';
            toggleTab.title = 'ドラッグ中...';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = e.clientY - dragStartY;
            let newTop = tabStartTop + deltaY;
            newTop = Math.max(20, Math.min(newTop, window.innerHeight - TAB_HEIGHT - 20));
            toggleTab.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            delete toggleTab.dataset.dragging;
            toggleTab.dataset.wasDragging = 'true';
            toggleTab.style.background = `${TAB_COLOR} !important`;
            toggleTab.style.cursor = 'pointer !important';
            toggleTab.title = 'ささっとテンプレ（Shift+ドラッグで移動）';

            const newTop = parseInt(toggleTab.style.top);
            chrome.storage.local.set({ tabPosition: newTop });

            setTimeout(() => {
                toggleTab.dataset.wasDragging = 'false';
            }, 100);
        });

        // Shift+ダブルクリックで位置リセット
        toggleTab.addEventListener('dblclick', (e) => {
            if (!e.shiftKey) return;
            const defaultTop = findAvailablePosition();
            toggleTab.style.top = `${defaultTop}px`;
            chrome.storage.local.set({ tabPosition: defaultTop });
        });
    }

    // --- ウィンドウリサイズ対応 ---
    window.addEventListener('resize', () => {
        const tab = document.getElementById(TAB_ID);
        if (!tab) return;
        const currentTop = parseInt(tab.style.top);
        if (currentTop + TAB_HEIGHT > window.innerHeight - 20) {
            const newTop = Math.max(20, window.innerHeight - TAB_HEIGHT - 20);
            tab.style.top = `${newTop}px`;
        }
    });

    // --- テンプレート挿入ロジック ---
    function insertTemplate(content) {
        const activeElement = document.activeElement;

        if (activeElement && isTextInput(activeElement)) {
            insertIntoElement(activeElement, content);
            return;
        }

        if (currentActiveElement && isTextInput(currentActiveElement)) {
            currentActiveElement.focus();
            setTimeout(() => insertIntoElement(currentActiveElement, content), 10);
            return;
        }

        const textInputs = document.querySelectorAll(
            'input[type="text"], input[type="email"], input[type="search"], input[type="url"], input[type="tel"], input[type="password"], input:not([type]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"]'
        );
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

        navigator.clipboard.writeText(content).then(() => {
            console.log('[ささっとテンプレ] クリップボードにコピーしました');
        }).catch(() => {
            console.log('[ささっとテンプレ] テンプレートの挿入に失敗しました');
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
        if (element.isContentEditable) return true;
        return false;
    }

    function insertIntoElement(element, content) {
        // Google Docs等のリッチエディタ対応: execCommand を最優先で試行
        if (element.isContentEditable || element.contentEditable === 'true') {
            element.focus();
            // execCommand('insertText') はリッチエディタ（Google Docs等）で最も互換性が高い
            const success = document.execCommand('insertText', false, content);
            if (success) return;

            // execCommandが失敗した場合、Selection APIにフォールバック
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
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.focus();
            // execCommand を先に試す（React等のフレームワーク対応）
            const start = element.selectionStart || 0;
            const end = element.selectionEnd || 0;
            const success = document.execCommand('insertText', false, content);
            if (success) return;

            // フォールバック: 直接value操作
            const value = element.value || '';
            element.value = value.substring(0, start) + content + value.substring(end);
            element.selectionStart = element.selectionEnd = start + content.length;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // --- メッセージ受信（テンプレート挿入リクエスト） ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'insertTemplate') {
            insertTemplate(request.content);
            sendResponse({ success: true });
        }
        return true;
    });

    // --- アクティブ要素の追跡 ---
    function findEditableElement(element) {
        if (!element) return null;
        // 要素自体がテキスト入力可能か
        if (isTextInput(element)) return element;
        // 親要素に contenteditable があるか（Google Docs等の深いネスト対応）
        const editable = element.closest('[contenteditable="true"]');
        if (editable) return editable;
        return null;
    }

    document.addEventListener('click', (event) => {
        const editable = findEditableElement(event.target);
        if (editable) currentActiveElement = editable;
    });

    document.addEventListener('focus', (event) => {
        const editable = findEditableElement(event.target);
        if (editable) currentActiveElement = editable;
    }, true);

    // --- 初期化 ---
    createToggleTab();

})();
