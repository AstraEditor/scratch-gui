/**
 * 背景数据库管理类
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
     * 保存背景
     * @param {string} data base64 图片数据
     * @returns {Promise<void>}
     */
    save(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({
                link: data,
                sequenceId: Date.now()
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
     * 获取最新的背景
     * @returns {Promise<string|null>} base64 图片数据
     */
    getLatest() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = (e) => {
                const records = e.target.result;
                if (records && records.length > 0) {
                    const latest = records.reduce((a, b) => 
                        a.sequenceId > b.sequenceId ? a : b
                    );
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

// 全局数据库实例
let bgDB;

export default async function ({ addon, msg }) {
    let bgButton;
    
    // 初始化数据库并加载保存的背景
    bgDB = new BackgroundDB();
    await bgDB.open();
    
    // 加载保存的背景
    const savedBg = await bgDB.getLatest();
    if (savedBg) {
        applyBackground(savedBg);
        console.log('已加载保存的背景');
    }

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
        addon.tab.createModal(msg('background-title') || '背景设置', {
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
            applyBackground(e.target.result);
            await bgDB.save(e.target.result);
        };
        reader.readAsDataURL(file);
    });

    const context = document.createElement("button");
    context.className = "sa-background-add";
    context.textContent = msg("add");
    context.addEventListener('click', () => {
        picinput.click();
    });

    modal.appendChild(context);
}

function applyBackground(data) {
    const blocklySvg = document.getElementsByClassName('blocklySvg')[0];
    blocklySvg.style.backgroundColor = "transparent";
    const workspace = document.getElementsByClassName('injectionDiv')[0];
    workspace.style.backgroundImage = `
    linear-gradient(
        color-mix(in srgb, var(--ui-secondary) 50%, transparent),
        color-mix(in srgb, var(--ui-secondary) 50%, transparent)
    ),
    url(${data})
    `;
    workspace.style.backgroundPosition = 'center';
    workspace.style.backgroundRepeat = 'no-repeat';
    workspace.style.backgroundSize = 'cover';
}
