class TemplateManager {
    constructor() {
        this.templates = {};
        this.currentEditingCategory = null;
        this.currentEditingTemplate = null;
        this.init();
    }

    init() {
        this.loadTemplates();
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        document.getElementById('close-sidebar').addEventListener('click', () => {
            this.closeSidebar();
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

    closeSidebar() {
        window.parent.postMessage({ type: 'CLOSE_SIDEBAR' }, '*');
    }

    showAddCategoryForm() {
        document.getElementById('add-category-form').style.display = 'block';
        document.getElementById('add-category-btn').style.display = 'none';
        document.getElementById('category-name-input').focus();
    }

    hideAddCategoryForm() {
        document.getElementById('add-category-form').style.display = 'none';
        document.getElementById('add-category-btn').style.display = 'block';
        document.getElementById('category-name-input').value = '';
        this.currentEditingCategory = null;
    }

    saveCategory() {
        const categoryName = document.getElementById('category-name-input').value.trim();
        if (!categoryName) return;

        if (categoryName.length > 20) {
            alert('カテゴリー名は20文字以内で入力してください。');
            return;
        }

        if (this.currentEditingCategory) {
            const oldName = this.currentEditingCategory;
            if (oldName !== categoryName) {
                this.templates[categoryName] = this.templates[oldName];
                delete this.templates[oldName];
            }
            this.currentEditingCategory = null;
        } else {
            if (this.templates[categoryName]) {
                alert('同じ名前のカテゴリーが既に存在します。');
                return;
            }
            this.templates[categoryName] = [];
        }

        this.saveTemplates();
        this.hideAddCategoryForm();
        this.render();
    }

    editCategory(categoryName) {
        this.currentEditingCategory = categoryName;
        document.getElementById('category-name-input').value = categoryName;
        this.showAddCategoryForm();
    }

    deleteCategory(categoryName) {
        if (confirm(`カテゴリー「${categoryName}」を削除しますか？このカテゴリー内のテンプレートもすべて削除されます。`)) {
            delete this.templates[categoryName];
            this.saveTemplates();
            this.render();
        }
    }

    toggleCategory(categoryName) {
        const templatesList = document.querySelector(`[data-category="${categoryName}"] .templates-list`);
        const toggle = document.querySelector(`[data-category="${categoryName}"] .category-toggle`);

        templatesList.classList.toggle('open');
        toggle.textContent = templatesList.classList.contains('open') ? '▲' : '▼';
    }

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

    saveTemplate() {
        const name = document.getElementById('template-name-input').value.trim();
        const content = document.getElementById('template-content-input').value.trim();

        if (!name || !content) {
            alert('テンプレート名と内容を入力してください。');
            return;
        }

        if (name.length > 20) {
            alert('テンプレート名は20文字以内で入力してください。');
            return;
        }

        const { categoryName, templateIndex, isNew } = this.currentEditingTemplate;

        if (isNew) {
            const existingNames = this.templates[categoryName].map(t => t.name);
            if (existingNames.includes(name)) {
                alert('同じ名前のテンプレートが既に存在します。');
                return;
            }
            this.templates[categoryName].push({ name, content });
        } else {
            const existingNames = this.templates[categoryName]
                .map((t, i) => i !== templateIndex ? t.name : null)
                .filter(n => n !== null);

            if (existingNames.includes(name)) {
                alert('同じ名前のテンプレートが既に存在します。');
                return;
            }
            this.templates[categoryName][templateIndex] = { name, content };
        }

        this.saveTemplates();
        this.closeModal();
        this.render();
    }

    deleteTemplate(categoryName, templateIndex) {
        const template = this.templates[categoryName][templateIndex];
        if (confirm(`テンプレート「${template.name}」を削除しますか？`)) {
            this.templates[categoryName].splice(templateIndex, 1);
            this.saveTemplates();
            this.render();
        }
    }

    insertTemplate(content) {
        this.showInsertionFeedback();
        window.parent.postMessage({
            type: 'INSERT_TEMPLATE',
            content: content
        }, '*');
    }

    showInsertionFeedback() {
        const existingFeedback = document.querySelector('.insertion-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }

        const feedback = document.createElement('div');
        feedback.className = 'insertion-feedback';
        feedback.innerHTML = '✅ テンプレートを挿入しました';

        document.body.appendChild(feedback);

        setTimeout(() => {
            feedback.classList.add('show');
        }, 10);

        setTimeout(() => {
            feedback.classList.remove('show');
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 2000);
    }

    loadTemplates() {
        const callbackId = 'load_' + Date.now();
        window[callbackId] = (data) => {
            this.templates = data || {};
            this.render();
            delete window[callbackId];
        };

        window.parent.postMessage({
            type: 'GET_STORAGE',
            callback: callbackId
        }, '*');
    }

    saveTemplates() {
        const callbackId = 'save_' + Date.now();
        window[callbackId] = () => {
            delete window[callbackId];
        };

        window.parent.postMessage({
            type: 'SET_STORAGE',
            data: this.templates,
            callback: callbackId
        }, '*');
    }

    render() {
        const categoriesList = document.getElementById('categories-list');
        categoriesList.innerHTML = '';

        const categoryNames = Object.keys(this.templates);

        if (categoryNames.length === 0) {
            categoriesList.innerHTML = '<div class="empty-state">カテゴリーを追加してテンプレートを作成しましょう</div>';
            return;
        }

        categoryNames.forEach(categoryName => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.setAttribute('data-category', categoryName);

            const templates = this.templates[categoryName];
            const isOpen = false;

            categoryDiv.innerHTML = `
                <div class="category-header" style="background: ${this.getCategoryColor(categoryName)};">
                    <div class="category-name">
                        <span>${this.escapeHtml(categoryName)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="category-actions">
                            <button class="edit-category-btn" title="カテゴリーを編集">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button class="delete-category-btn" title="カテゴリーを削除">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"/>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            </button>
                        </div>
                        <span class="category-toggle ${isOpen ? 'open' : ''}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6,9 12,15 18,9"/>
                            </svg>
                        </span>
                    </div>
                </div>
                <div class="templates-list ${isOpen ? 'open' : ''}">
                    ${templates.length === 0 ?
                        '<div class="empty-state">テンプレートがありません</div>' :
                        templates.map((template, index) => `
                            <div class="template-item" data-template-index="${index}">
                                <button class="template-button" title="${this.escapeHtml(template.content)}">
                                    <span class="template-text">${this.escapeHtml(template.name)}</span>
                                </button>
                                <div class="template-actions">
                                    <button class="edit-template-btn" title="テンプレートを編集">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <button class="delete-template-btn" title="テンプレートを削除">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3,6 5,6 21,6"/>
                                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')
                    }
                    <button class="add-template-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span class="add-text">新しいテンプレートを追加</span>
                    </button>
                </div>
            `;

            const categoryHeader = categoryDiv.querySelector('.category-header');
            const categoryNameEl = categoryDiv.querySelector('.category-name');
            const categoryToggle = categoryDiv.querySelector('.category-toggle');

            const toggleHandler = (e) => {
                if (e.target.closest('.category-actions')) return;
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

            categoryDiv.querySelectorAll('.template-button').forEach((buttonEl, index) => {
                buttonEl.addEventListener('click', () => {
                    this.insertTemplate(templates[index].content);
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

            categoriesList.appendChild(categoryDiv);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCategoryColor(categoryName) {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            'linear-gradient(135deg, #ff8a80 0%, #ea4c89 100%)',
            'linear-gradient(135deg, #8fd3f4 0%, #84fab0 100%)',
            'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
            'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
            'linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)'
        ];

        // カテゴリー名に基づいてハッシュ値を生成し、色を選択
        let hash = 0;
        for (let i = 0; i < categoryName.length; i++) {
            const char = categoryName.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }

        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

}

window.addEventListener('message', function(event) {
    try {
        if (event.data.type === 'STORAGE_RESPONSE') {
            if (window[event.data.callback]) {
                window[event.data.callback](event.data.data);
            }
        } else if (event.data.type === 'STORAGE_SET_RESPONSE') {
            if (window[event.data.callback]) {
                window[event.data.callback]();
            }
        }
    } catch (error) {
        console.error('Sidebar message handling error:', error);
    }
});

window.addEventListener('error', function(event) {
    console.error('Sidebar error:', event.error);
});

document.addEventListener('DOMContentLoaded', () => {
    new TemplateManager();
});