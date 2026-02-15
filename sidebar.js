// --- Side Panel 状態管理 ---
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.shouldCloseSidePanel) {
        if (changes.shouldCloseSidePanel.newValue &&
            typeof changes.shouldCloseSidePanel.newValue === 'number') {
            chrome.storage.local.set({ shouldCloseSidePanel: 0 });
            window.close();
        }
    }
});

window.addEventListener('beforeunload', () => {
    chrome.storage.local.set({ sidePanelOpen: false });
});

// --- TemplateManager クラス ---
class TemplateManager {
    constructor() {
        this.templates = {};
        this.categoryOrder = [];
        this.currentEditingCategory = null;
        this.currentEditingTemplate = null;
        this.dragState = null;
        this.init();
    }

    async init() {
        await this.loadTemplates();
        this.bindEvents();
        this.render();
        await chrome.storage.local.set({ sidePanelOpen: true });
    }

    bindEvents() {
        document.getElementById('close-sidebar').addEventListener('click', () => {
            window.close();
        });

        document.getElementById('add-category-btn').addEventListener('click', () => {
            this.showAddCategoryForm();
        });

        document.getElementById('save-category-btn').addEventListener('click', () => {
            this.saveCategory();
        });

        document.getElementById('cancel-category-btn').addEventListener('click', () => {
            this.hideAddCategoryForm();
        });

        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('save-template-btn').addEventListener('click', () => {
            this.saveTemplate();
        });

        document.getElementById('cancel-template-btn').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('template-modal').addEventListener('click', (e) => {
            if (e.target.id === 'template-modal') {
                this.closeModal();
            }
        });

        document.getElementById('category-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveCategory();
            }
        });

        document.getElementById('template-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('template-content-input').focus();
            }
        });
    }

    // --- カテゴリーフォーム ---
    showAddCategoryForm() {
        document.getElementById('add-category-form').style.display = 'block';
        document.getElementById('add-category-btn').style.display = 'none';
        document.getElementById('category-name-input').focus();
    }

    hideAddCategoryForm() {
        document.getElementById('add-category-form').style.display = 'none';
        document.getElementById('add-category-btn').style.display = 'flex';
        document.getElementById('category-name-input').value = '';
        this.currentEditingCategory = null;
    }

    async saveCategory() {
        const categoryName = document.getElementById('category-name-input').value.trim();
        if (!categoryName) return;

        if (categoryName.length > 20) {
            this.showToast('カテゴリー名は20文字以内で入力してください', 'warning');
            return;
        }

        if (this.currentEditingCategory) {
            const oldName = this.currentEditingCategory;
            if (oldName !== categoryName) {
                if (this.templates[categoryName]) {
                    this.showToast('同じ名前のカテゴリーが既に存在します', 'warning');
                    return;
                }
                this.templates[categoryName] = this.templates[oldName];
                delete this.templates[oldName];
                const idx = this.categoryOrder.indexOf(oldName);
                if (idx !== -1) this.categoryOrder[idx] = categoryName;
            }
            this.currentEditingCategory = null;
        } else {
            if (this.templates[categoryName]) {
                this.showToast('同じ名前のカテゴリーが既に存在します', 'warning');
                return;
            }
            this.templates[categoryName] = [];
            this.categoryOrder.push(categoryName);
        }

        await this.saveTemplates();
        this.hideAddCategoryForm();
        this.render();
        this.showToast('カテゴリーを保存しました');
    }

    editCategory(categoryName) {
        this.currentEditingCategory = categoryName;
        document.getElementById('category-name-input').value = categoryName;
        this.showAddCategoryForm();
    }

    async deleteCategory(categoryName) {
        if (confirm(`カテゴリー「${categoryName}」を削除しますか？\nこのカテゴリー内のテンプレートもすべて削除されます。`)) {
            delete this.templates[categoryName];
            this.categoryOrder = this.categoryOrder.filter(n => n !== categoryName);
            await this.saveTemplates();
            this.render();
            this.showToast('カテゴリーを削除しました');
        }
    }

    toggleCategory(categoryName) {
        const templatesList = document.querySelector(`[data-category="${CSS.escape(categoryName)}"] .templates-list`);
        const toggle = document.querySelector(`[data-category="${CSS.escape(categoryName)}"] .category-toggle`);
        if (!templatesList || !toggle) return;

        templatesList.classList.toggle('open');
        toggle.classList.toggle('open');
    }

    // --- テンプレートモーダル ---
    showAddTemplateModal(categoryName) {
        this.currentEditingTemplate = { categoryName, isNew: true };
        document.getElementById('modal-title').textContent = 'テンプレートを追加';
        document.getElementById('template-name-input').value = '';
        document.getElementById('template-content-input').value = '';
        document.getElementById('template-modal').style.display = 'flex';
        document.getElementById('template-name-input').focus();
    }

    showEditTemplateModal(categoryName, templateIndex) {
        const template = this.templates[categoryName][templateIndex];
        this.currentEditingTemplate = { categoryName, templateIndex, isNew: false };
        document.getElementById('modal-title').textContent = 'テンプレートを編集';
        document.getElementById('template-name-input').value = template.name;
        document.getElementById('template-content-input').value = template.content;
        document.getElementById('template-modal').style.display = 'flex';
        document.getElementById('template-name-input').focus();
    }

    closeModal() {
        document.getElementById('template-modal').style.display = 'none';
        document.getElementById('template-name-input').value = '';
        document.getElementById('template-content-input').value = '';
        this.currentEditingTemplate = null;
    }

    async saveTemplate() {
        const name = document.getElementById('template-name-input').value.trim();
        const content = document.getElementById('template-content-input').value.trim();

        if (!name || !content) {
            this.showToast('テンプレート名と内容を入力してください', 'warning');
            return;
        }

        if (name.length > 15) {
            this.showToast('テンプレート名は15文字以内で入力してください', 'warning');
            return;
        }

        const { categoryName, templateIndex, isNew } = this.currentEditingTemplate;

        if (isNew) {
            const existingNames = this.templates[categoryName].map(t => t.name);
            if (existingNames.includes(name)) {
                this.showToast('同じ名前のテンプレートが既に存在します', 'warning');
                return;
            }
            this.templates[categoryName].push({ name, content });
        } else {
            const existingNames = this.templates[categoryName]
                .map((t, i) => i !== templateIndex ? t.name : null)
                .filter(n => n !== null);
            if (existingNames.includes(name)) {
                this.showToast('同じ名前のテンプレートが既に存在します', 'warning');
                return;
            }
            this.templates[categoryName][templateIndex] = { name, content };
        }

        await this.saveTemplates();
        this.closeModal();
        this.render();
        this.showToast('テンプレートを保存しました');
    }

    async deleteTemplate(categoryName, templateIndex) {
        const template = this.templates[categoryName][templateIndex];
        if (confirm(`テンプレート「${template.name}」を削除しますか？`)) {
            this.templates[categoryName].splice(templateIndex, 1);
            await this.saveTemplates();
            this.render();
            this.showToast('テンプレートを削除しました');
        }
    }

    async insertTemplate(content) {
        this.showToast('テンプレートを挿入しました');
        try {
            await chrome.runtime.sendMessage({
                action: 'insertTemplate',
                content: content
            });
        } catch (error) {
            console.error('[ささっとテンプレ] Insert error:', error);
            this.showToast('挿入に失敗しました', 'error');
        }
    }

    async copyTemplate(content) {
        try {
            await navigator.clipboard.writeText(content);
            this.showToast('クリップボードにコピーしました');
        } catch (error) {
            console.error('[ささっとテンプレ] Copy error:', error);
            this.showToast('コピーに失敗しました', 'error');
        }
    }

    // --- ストレージ ---
    async loadTemplates() {
        const data = await chrome.storage.local.get(['templates', 'categoryOrder']);
        this.templates = data.templates || {};
        this.categoryOrder = data.categoryOrder || Object.keys(this.templates);
        // カテゴリー順序の整合性チェック
        const templateKeys = Object.keys(this.templates);
        this.categoryOrder = this.categoryOrder.filter(k => templateKeys.includes(k));
        templateKeys.forEach(k => {
            if (!this.categoryOrder.includes(k)) this.categoryOrder.push(k);
        });
    }

    async saveTemplates() {
        await chrome.storage.local.set({
            templates: this.templates,
            categoryOrder: this.categoryOrder
        });
    }

    // --- トースト通知 ---
    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 2000);
    }

    // --- HTML エスケープ ---
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- テンプレート D&D ---
    setupTemplateDragAndDrop(categoryDiv, categoryName) {
        const templateItems = categoryDiv.querySelectorAll('.template-item');
        const templatesList = categoryDiv.querySelector('.templates-list');

        templateItems.forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                const sourceIndex = parseInt(item.dataset.templateIndex);
                this.dragState = {
                    type: 'template',
                    sourceCategoryName: categoryName,
                    sourceIndex: sourceIndex
                };
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
                requestAnimationFrame(() => item.classList.add('dragging'));
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.drag-over, .drag-over-category').forEach(el => {
                    el.classList.remove('drag-over');
                    el.classList.remove('drag-over-category');
                });
                this.dragState = null;
            });
        });

        // テンプレート一覧をドロップゾーンに
        templatesList.addEventListener('dragover', (e) => {
            if (!this.dragState || this.dragState.type !== 'template') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            templatesList.classList.add('drag-over');
        });

        templatesList.addEventListener('dragleave', (e) => {
            if (!templatesList.contains(e.relatedTarget)) {
                templatesList.classList.remove('drag-over');
            }
        });

        templatesList.addEventListener('drop', async (e) => {
            e.preventDefault();
            templatesList.classList.remove('drag-over');
            if (!this.dragState || this.dragState.type !== 'template') return;

            const { sourceCategoryName, sourceIndex } = this.dragState;
            const template = this.templates[sourceCategoryName][sourceIndex];
            if (!template) return;

            // ドロップ位置を計算
            const items = Array.from(templatesList.querySelectorAll('.template-item:not(.dragging)'));
            let targetIndex = items.length;
            for (let i = 0; i < items.length; i++) {
                const rect = items[i].getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    targetIndex = parseInt(items[i].dataset.templateIndex);
                    break;
                }
            }

            if (sourceCategoryName === categoryName) {
                // 同一カテゴリー内の並び替え
                this.templates[categoryName].splice(sourceIndex, 1);
                const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
                this.templates[categoryName].splice(Math.min(adjustedIndex, this.templates[categoryName].length), 0, template);
            } else {
                // カテゴリー間移動
                this.templates[sourceCategoryName].splice(sourceIndex, 1);
                this.templates[categoryName].splice(Math.min(targetIndex, this.templates[categoryName].length), 0, template);
                this.showToast(`「${template.name}」を移動しました`);
            }

            this.dragState = null;
            await this.saveTemplates();
            this.render();
        });
    }

    // --- カテゴリー D&D ---
    setupCategoryDragAndDrop(categoryDiv, categoryName) {
        const handle = categoryDiv.querySelector('.category-drag-handle');
        if (!handle) return;

        handle.addEventListener('dragstart', (e) => {
            this.dragState = { type: 'category', sourceCategoryName: categoryName };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
            requestAnimationFrame(() => categoryDiv.classList.add('category-dragging'));
        });

        handle.addEventListener('dragend', () => {
            categoryDiv.classList.remove('category-dragging');
            document.querySelectorAll('.drag-over-category').forEach(el => {
                el.classList.remove('drag-over-category');
            });
            this.dragState = null;
        });

        categoryDiv.addEventListener('dragover', (e) => {
            if (!this.dragState || this.dragState.type !== 'category') return;
            if (this.dragState.sourceCategoryName === categoryName) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            categoryDiv.classList.add('drag-over-category');
        });

        categoryDiv.addEventListener('dragleave', (e) => {
            if (!categoryDiv.contains(e.relatedTarget)) {
                categoryDiv.classList.remove('drag-over-category');
            }
        });

        categoryDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            categoryDiv.classList.remove('drag-over-category');
            if (!this.dragState || this.dragState.type !== 'category') return;

            const { sourceCategoryName } = this.dragState;
            const sourceIdx = this.categoryOrder.indexOf(sourceCategoryName);
            const targetIdx = this.categoryOrder.indexOf(categoryName);
            if (sourceIdx === -1 || targetIdx === -1) return;

            this.categoryOrder.splice(sourceIdx, 1);
            this.categoryOrder.splice(targetIdx, 0, sourceCategoryName);

            this.dragState = null;
            await this.saveTemplates();
            this.render();
            this.showToast('カテゴリーの順序を変更しました');
        });
    }

    // --- レンダリング ---
    render() {
        const categoriesList = document.getElementById('categories-list');
        categoriesList.innerHTML = '';

        if (this.categoryOrder.length === 0) {
            categoriesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">📋</span>
                    <div class="empty-state-text">
                        カテゴリーを追加して<br>テンプレートを作成しましょう
                    </div>
                </div>`;
            return;
        }

        this.categoryOrder.forEach(categoryName => {
            if (!this.templates[categoryName]) return;

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.setAttribute('data-category', categoryName);

            const templates = this.templates[categoryName];

            categoryDiv.innerHTML = `
                <div class="category-header">
                    <div class="category-drag-handle" draggable="true" title="ドラッグで並び替え">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                        </svg>
                    </div>
                    <div class="category-name">
                        <span>${this.escapeHtml(categoryName)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <div class="category-actions">
                            <button class="edit-category-btn" title="カテゴリーを編集">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button class="delete-category-btn" title="カテゴリーを削除">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"/>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                </svg>
                            </button>
                        </div>
                        <span class="category-toggle">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6,9 12,15 18,9"/>
                            </svg>
                        </span>
                    </div>
                </div>
                <div class="templates-list">
                    ${templates.length === 0 ?
                        '<div class="empty-state" style="margin: 12px; padding: 16px;">テンプレートがありません</div>' :
                        templates.map((template, index) => `
                            <div class="template-item" draggable="true" data-template-index="${index}" data-category="${this.escapeHtml(categoryName)}">
                                <div class="drag-indicator">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/>
                                        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                                        <circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/>
                                    </svg>
                                </div>
                                <button class="template-button">
                                    <span class="template-text">${this.escapeHtml(template.name)}</span>
                                </button>
                                <div class="template-preview">${this.escapeHtml(template.content)}</div>
                                <div class="template-actions">
                                    <button class="copy-template-btn" title="クリップボードにコピー">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                    </button>
                                    <button class="edit-template-btn" title="テンプレートを編集">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <button class="delete-template-btn" title="テンプレートを削除">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <polyline points="3,6 5,6 21,6"/>
                                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')
                    }
                    <button class="add-template-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span class="add-text">新しいテンプレートを追加</span>
                    </button>
                </div>
            `;

            // --- イベントバインド ---
            const categoryHeader = categoryDiv.querySelector('.category-header');
            const categoryNameEl = categoryDiv.querySelector('.category-name');
            const categoryToggle = categoryDiv.querySelector('.category-toggle');

            const toggleHandler = (e) => {
                if (e.target.closest('.category-actions') || e.target.closest('.category-drag-handle')) return;
                this.toggleCategory(categoryName);
            };
            categoryNameEl.addEventListener('click', toggleHandler);
            categoryToggle.addEventListener('click', toggleHandler);

            categoryDiv.querySelector('.edit-category-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editCategory(categoryName);
            });

            categoryDiv.querySelector('.delete-category-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteCategory(categoryName);
            });

            categoryDiv.querySelector('.add-template-btn').addEventListener('click', () => {
                this.showAddTemplateModal(categoryName);
            });

            categoryDiv.querySelectorAll('.template-button').forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    this.insertTemplate(templates[index].content);
                });
            });

            categoryDiv.querySelectorAll('.copy-template-btn').forEach((btn, index) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.copyTemplate(templates[index].content);
                });
            });

            categoryDiv.querySelectorAll('.edit-template-btn').forEach((btn, index) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditTemplateModal(categoryName, index);
                });
            });

            categoryDiv.querySelectorAll('.delete-template-btn').forEach((btn, index) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteTemplate(categoryName, index);
                });
            });

            // D&D セットアップ
            this.setupTemplateDragAndDrop(categoryDiv, categoryName);
            this.setupCategoryDragAndDrop(categoryDiv, categoryName);

            categoriesList.appendChild(categoryDiv);
        });
    }
}

// --- エラーハンドリング ---
window.addEventListener('error', (event) => {
    console.error('[ささっとテンプレ] Error:', event.error);
});

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    new TemplateManager();
});
