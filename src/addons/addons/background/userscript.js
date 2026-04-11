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
     * @param {'WorkSpaceBG' | 'settings'} sequenceId ID
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
let isRefreshingBG = false;

async function applySettings(id, value) {
    try {
        const nowSettings = await bgDB.get('settings') || {};
        nowSettings[id] = value;
        await bgDB.save('settings', nowSettings);
    } catch (e) {
        throw new Error(e);
    }
}
async function getSetting(id) {
    try {
        const nowSettings = await bgDB.get('settings') || {};
        return nowSettings[id];
    } catch (e) {
        throw new Error(e);
    }
}


export default async function ({ addon, msg }) {
    let bgButton;

    // 初始化数据库并加载保存的背景
    bgDB = new BackgroundDB();
    await bgDB.open();

    // 加载保存的背景
    await refreshWorkSpaceBackground();

    /**  
    * 监听工作区，防止blocks重绘时把我刚刚放进去的img干丢了
    * */
    const AddObserver = async () => {
        try {
            const observer = new MutationObserver(async () => {
                if (isRefreshingBG) return;
                const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
                const bg = document.querySelector('.sa-background-image');
                if (workspace && !bg) {
                    await refreshWorkSpaceBackground();
                }
            });

            observer.observe(document, { childList: true, subtree: true });
        } catch (e) {
            console.warn('Warning: Failed to add Observer:', e);
        }
    };

    AddObserver();

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

async function addContext(modal, msg) {
    // Workspace
    // Add BG
    const workspaceAddButton = document.createElement("button");
    workspaceAddButton.className = "sa-background-add";
    workspaceAddButton.textContent = msg("add");
    workspaceAddButton.addEventListener('click', () => {
        workspaceAddPicInput.click();
        document.documentElement.style.setProperty('--enable-workspace-background', 'transparent');
        applySettings('EnableWorkSpaceBG', true);
    });
    const workspaceClearButton = document.createElement("button");
    workspaceClearButton.className = "sa-background-add";
    workspaceClearButton.textContent = msg("clear");
    workspaceClearButton.addEventListener('click', () => {
        bgDB.delete('WorkSpaceBG');
        applySettings('EnableWorkSpaceBG', false);
        document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
    });
    const workspaceAddPicInput = document.createElement("input");
    workspaceAddPicInput.type = "file";
    workspaceAddPicInput.accept = ".png, .bmp, .jpg, .jpeg";
    workspaceAddPicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            await bgDB.save('WorkSpaceBG', e.target.result);
            refreshWorkSpaceBackground();
        };
        reader.readAsDataURL(file);
    });
    const workspaceTitle = document.createElement('h2');
    workspaceTitle.textContent = msg('background-workspace');

    // Layout
    const workspaceImageLayout = document.createElement('select');
    workspaceImageLayout.value = await getSetting('WorkSpaceBGLayout') || 'stretch';
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

    // Blur
    const workspaceBlur = document.createElement('input');
    workspaceBlur.type = 'range';
    workspaceBlur.min = 0;
    workspaceBlur.max = 20;
    workspaceBlur.value = await getSetting('WorkSpaceBGBlur') || 0;
    workspaceBlur.className = 'sa-background-blur';
    workspaceBlur.addEventListener('input', async () => {
        applySettings('WorkSpaceBGBlur', workspaceBlur.value);
        await refreshWorkSpaceBackground();
    });
    // Opacity
    const workspaceOpacity = document.createElement('input');
    workspaceOpacity.type = 'range';
    workspaceOpacity.min = 0;
    workspaceOpacity.max = 100;
    workspaceOpacity.value = await getSetting('WorkSpaceBGOpacity') * 100 || 50;
    workspaceOpacity.className = 'sa-background-opacity';
    workspaceOpacity.addEventListener('input', async () => {
        applySettings('WorkSpaceBGOpacity', workspaceOpacity.value / 100);
        await refreshWorkSpaceBackground();
    });


    const workspaceDiv = document.createElement('div');
    workspaceDiv.className = 'sa-background-blur-wrapper';
    const workspaceBlurText = document.createElement('span');
    workspaceBlurText.textContent = msg('background-blur');
    const workspaceOpacityText = document.createElement('span');
    workspaceOpacityText.textContent = msg('background-opacity');

    // All
    workspaceDiv.appendChild(workspaceTitle);
    workspaceDiv.appendChild(workspaceImageLayout);
    workspaceDiv.appendChild(workspaceAddButton);
    workspaceDiv.appendChild(workspaceClearButton);
    workspaceDiv.appendChild(workspaceBlurText);
    workspaceDiv.appendChild(workspaceBlur);
    workspaceDiv.appendChild(workspaceOpacityText);
    workspaceDiv.appendChild(workspaceOpacity);

    modal.appendChild(workspaceDiv);
}

async function saveLayout(layout) {
    await applySettings('WorkSpaceBGLayout', layout);
    resizeWorkspaceBackground();
}


async function resizeWorkspaceBackground() {
    try {
        const mode = await getSetting('WorkSpaceBGLayout') || 'stretch';
        const workspaceWidth = getComputedStyle(document.querySelector('[class*=gui_blocks-wrapper]')).width;
        const workspaceHeight = getComputedStyle(document.querySelector('[class*=gui_blocks-wrapper]')).height;
        const bgImage = document.querySelector('.sa-background-image');
        if (bgImage) {
            bgImage.style.objectFit = 'none';
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
            console.warn('Cannot find background image element, try to spawn again');
            await refreshWorkSpaceBackground();
        }
    } catch (e) {
        console.warn('Failed to resize background image:', e);
    }

}


async function refreshWorkSpaceBackground() {
    if (isRefreshingBG) return
    isRefreshingBG = true;
    try {
        if(await getSetting('EnableWorkSpaceBG') === false) {
            document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
            return;
        }
        const data = await bgDB.get('WorkSpaceBG');
        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        if (!workspace) return;

        document.querySelectorAll('.sa-background-image').forEach(img => img.remove());

        if (!data) return;

        const background = document.createElement('img');
        background.className = 'sa-background-image';
        background.src = data;
        background.style.filter = `blur(${await getSetting('WorkSpaceBGBlur') || 0}px)`;
        background.style.clipPath = 'inset(0)';
        background.style.opacity = `${await getSetting('WorkSpaceBGOpacity') || 0.5}`;
        background.style.position = 'absolute';
        background.draggable = false;
        workspace.prepend(background);
        await resizeWorkspaceBackground();
    } catch (e) {
        console.log(e);
    }
    isRefreshingBG = false;
}