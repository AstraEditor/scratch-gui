/**
 * IndexedDB by AI （嘿嘿）
 */
class BackgroundDB {
    constructor(dbName = 'sa-background', storeName = 'backgrounds', version = 1) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
        this.db = null;
    }

    /**
     * 打开数据库
     * @returns {Promise<IDBDatabase>}
     */
    open() {
        return new Promise((resolve, reject) => {
            const indexedDB = window.indexedDB ||
                window.mozIndexedDB ||
                window.webkitIndexedDB ||
                window.msIndexedDB;

            const request = indexedDB.open(this.dbName, this.version);

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('数据库打开成功');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.log('数据库打开报错', event);
                reject(event);
            };

            request.onupgradeneeded = (event) => {
                console.log('onupgradeneeded');
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'sequenceId'
                    });
                    objectStore.createIndex('link', 'link', { unique: false });
                    objectStore.createIndex('sequenceId', 'sequenceId', { unique: false });
                }
            };
        });
    }

    /**
     * 保存
     * @param {string} ID ID
     * @param {string} data base64 图片数据
     * @returns {Promise<void>}
     */
    save(ID, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({
                link: data,
                sequenceId: ID
            });
            request.onsuccess = () => {
                console.log('背景保存成功');
                resolve();
            };
            request.onerror = (e) => {
                console.log('背景保存失败', e);
                reject(e);
            };
        });
    }

    /**
     * 获取背景
     * @param {'WorkSpaceBG'} sequenceId ID
     * @returns {Promise<string|null>} base64 图片数据
     */
    get(sequenceId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (e) => {
                const records = e.target.result;
                if (records && records.length > 0) {
                    let latest = { link: null, sequenceId: null };
                    records.forEach(element => {
                        if (sequenceId == element.sequenceId) {
                            latest = element;
                        }
                    });
                    resolve(latest.link || null);
                } else {
                    resolve(null);
                }
            };
            request.onerror = (e) => {
                console.log('加载背景失败', e);
                reject(e);
            };
        });
    }

    /**
     * 获取所有背景
     * @returns {Promise<Array>}
     */
    getAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e);
        });
    }

    /**
     * 删除指定背景
     * @param {number} sequenceId 主键
     * @returns {Promise<void>}
     */
    delete(sequenceId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(sequenceId);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    /**
     * 清空所有背景
     * @returns {Promise<void>}
     */
    clear() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
}

let bgDB;

export default async function ({ addon, msg }) {
    let bgButton;

    // 初始化数据库并加载保存的背景
    bgDB = new BackgroundDB();
    await bgDB.open();

    // 加载保存的背景
    const savedBg = await bgDB.get('WorkSpaceBG');
    if (savedBg) {
        applyWorkspaceBackground(savedBg);
    }

    /**  
     * 监听工作区，防止blocks重绘时把我刚刚放进去的img干丢了
     * */
    const observer = new MutationObserver(() => {
        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        if (workspace) {
            applyWorkspaceBackground(savedBg);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', () => {
        resizeWorkspaceBackground();
    });

    while (true) {
        const elem = await addon.tab.waitForElement('div[class*="menu-bar_file-group"] > div:last-child:not(.sa-background)', {
            markAsSeen: true,
            reduxEvents: ["scratch-gui/mode/SET_PLAYER", "fontsLoaded/SET_FONTS_LOADED", "scratch-gui/locales/SELECT_LOCALE"],
        });

        if (!bgButton) {
            bgButton = Object.assign(document.createElement('div'), {
                className: 'sa-background ' + elem.className,
                textContent: msg('background'),
            });
            bgButton.addEventListener('click', () => {
                showBgModal(addon, msg)
            });
        }

        elem.parentElement.appendChild(bgButton);
    }
}

function showBgModal(addon, msg) {
    const { backdrop, container, content, closeButton, remove } =
        addon.tab.createModal(msg('background-title'), {
            isOpen: true,
            useEditorClasses: true
        });

    container.classList.add('sa-background-popup');
    content.classList.add('sa-background-content');

    addContext(content, msg);

    backdrop.addEventListener("click", remove);
    closeButton.addEventListener("click", remove);
}

function addContext(modal, msg) {
    const picinput = document.createElement("input");
    picinput.type = "file";
    picinput.accept = ".png, .bmp, .jpg, .jpeg";
    picinput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            console.log('文件内容:', e.target.result);
            applyWorkspaceBackground(e.target.result);
            await bgDB.save('WorkSpaceBG', e.target.result);
        };
        reader.readAsDataURL(file);
    });
    const workspaceTitle = document.createElement('h2');
    workspaceTitle.textContent = msg('background-workspace');
    modal.appendChild(workspaceTitle);

    const workspaceAddButton = document.createElement("button");
    workspaceAddButton.className = "sa-background-add";
    workspaceAddButton.textContent = msg("add");
    workspaceAddButton.addEventListener('click', () => {
        picinput.click();
    });

    const workspaceImageLayout = document.createElement('select');
    workspaceImageLayout.className = 'sa-background-layout';
    [
        { name: msg('background-layout-stretch'), value: 'stretch' },
        { name: msg('background-layout-height-priority'), value: 'height-priority' },
        { name: msg('background-layout-width-priority'), value: 'width-priority' },
        { name: msg('background-layout-fit'), value: 'fit' },
    ].forEach(layout => {
        const option = document.createElement('option');
        option.value = layout.value;
        option.textContent = layout.name;
        workspaceImageLayout.appendChild(option);
    });
    workspaceImageLayout.addEventListener('change', (e) => {
        saveLayout(e.target.value);
    });

    modal.appendChild(workspaceImageLayout);
    modal.appendChild(workspaceAddButton);
}

function saveLayout(layout) {
    bgDB.save('WorkSpaceBGLayout', layout);
    applyWorkspaceBackground(bgDB.get('WorkSpaceBG'));
}

async function resizeWorkspaceBackground() {
    const mode = await bgDB.get('WorkSpaceBGLayout') || 'stretch';
    const workspaceWidth = getComputedStyle(document.querySelector('[class*=gui_blocks-wrapper]')).width;
    const workspaceHeight = getComputedStyle(document.querySelector('[class*=gui_blocks-wrapper]')).height;
    const bgImage = document.querySelector('.sa-background-image');
    bgImage.style.objectFit = 'none';
    if (bgImage) {
        switch (mode) {
            case 'stretch':
                bgImage.style.width = workspaceWidth;
                bgImage.style.height = workspaceHeight;
                break;
            case 'height-priority':
                bgImage.style.height = workspaceHeight;
                bgImage.style.width = 'auto';
                break;
            case 'width-priority':
                bgImage.style.width = workspaceWidth;
                bgImage.style.height = 'auto';
                break;
            case 'fit':
                bgImage.style.width = workspaceWidth;
                bgImage.style.height = workspaceHeight;
                bgImage.style.objectFit = 'cover';
                break;
        }
    } else {
        console.warn('Cannot find background image element');
    }
}

function applyWorkspaceBackground(data) {
    try {
        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        const background = document.createElement('img');
        const existingBg = workspace.querySelector('.sa-background-image');
        if (existingBg) {
            existingBg.src = data;
            return;
        }
        background.src = data;
        background.className = 'sa-background-image';
        background.style.opacity = '0.5';
        background.draggable = false;
        background.style.position = 'absolute';
        workspace.prepend(background);
        resizeWorkspaceBackground();
    } catch (e) {
        // ignore
        console.log(e);
    }

}
