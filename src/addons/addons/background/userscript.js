/**
 * IndexedDB by AI （嘿嘿）
 */
class BackgroundDB {
    constructor(dbName = 'sa-background', version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.settingsStore = 'settings_store';
        this.wallpapersStore = 'wallpapers_store';
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
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.log('Cannot open indexedDB:', event);
                reject(event);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.settingsStore)) {
                    db.createObjectStore(this.settingsStore, { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains(this.wallpapersStore)) {
                    db.createObjectStore(this.wallpapersStore, { keyPath: 'id' });
                }

                if (db.objectStoreNames.contains('background_store')) {
                    const transaction = event.target.transaction;
                    const oldStore = transaction.objectStore('background_store');
                    const newStore = transaction.objectStore(this.wallpapersStore);
                    oldStore.openCursor().onsuccess = (cursorEvent) => {
                        const cursor = cursorEvent.target.result;
                        if (!cursor) return;
                        const record = cursor.value;
                        const wallpaper = {
                            id: cursor.key,
                            name: 'Workspace Background',
                            source: 'legacy',
                            sourceUrl: null,
                            link: typeof record === 'object' && record.link ? record.link : record,
                            enabled: true,
                            addedAt: new Date().toISOString()
                        };
                        newStore.put(wallpaper);
                        cursor.continue();
                    };
                }
            };
        });
    }

    saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStore], 'readwrite');
            const store = transaction.objectStore(this.settingsStore);
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = (e) => {
                console.log('IndexedDB saveSetting failed', e);
                reject(e);
            };
        });
    }

    getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStore], 'readonly');
            const store = transaction.objectStore(this.settingsStore);
            const request = store.get(key);
            request.onsuccess = (e) => {
                const record = e.target.result;
                resolve(record ? record.value : null);
            };
            request.onerror = (e) => {
                console.log('IndexedDB getSetting failed', e);
                reject(e);
            };
        });
    }

    saveWallpaper(wallpaper) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.wallpapersStore], 'readwrite');
            const store = transaction.objectStore(this.wallpapersStore);
            const wallpaperRecord = Object.assign({
                id: wallpaper.id || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
                name: wallpaper.name || 'Wallpaper',
                source: wallpaper.source || 'local',
                sourceUrl: wallpaper.sourceUrl || null,
                link: wallpaper.link || null,
                enabled: typeof wallpaper.enabled === 'boolean' ? wallpaper.enabled : true,
                addedAt: wallpaper.addedAt || new Date().toISOString()
            }, wallpaper);
            const request = store.put(wallpaperRecord);
            request.onsuccess = () => resolve(wallpaperRecord);
            request.onerror = (e) => {
                console.log('IndexedDB saveWallpaper failed', e);
                reject(e);
            };
        });
    }

    getWallpaper(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.wallpapersStore], 'readonly');
            const store = transaction.objectStore(this.wallpapersStore);
            const request = store.get(id);
            request.onsuccess = (e) => {
                resolve(e.target.result || null);
            };
            request.onerror = (e) => {
                console.log('IndexedDB getWallpaper failed', e);
                reject(e);
            };
        });
    }

    listWallpapers({ enabledOnly = false, source } = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.wallpapersStore], 'readonly');
            const store = transaction.objectStore(this.wallpapersStore);
            const request = store.getAll();
            request.onsuccess = (e) => {
                let records = e.target.result || [];
                if (enabledOnly) {
                    records = records.filter((item) => item.enabled !== false);
                }
                if (source) {
                    records = records.filter((item) => item.source === source);
                }
                resolve(records);
            };
            request.onerror = (e) => {
                console.log('IndexedDB listWallpapers failed', e);
                reject(e);
            };
        });
    }

    deleteWallpaper(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.wallpapersStore], 'readwrite');
            const store = transaction.objectStore(this.wallpapersStore);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    clearWallpapers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.wallpapersStore], 'readwrite');
            const store = transaction.objectStore(this.wallpapersStore);
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
        const nowSettings = await bgDB.getSetting('settings') || {};
        nowSettings[id] = value;
        await bgDB.saveSetting('settings', nowSettings);
    } catch (e) {
        throw new Error(e);
    }
}
async function getSetting(id) {
    try {
        const nowSettings = await bgDB.getSetting('settings') || {};
        return nowSettings[id];
    } catch (e) {
        throw new Error(e);
    }
}

async function getActiveWorkspaceWallpaper() {
    const settings = await bgDB.getSetting('settings') || {};
    if (settings.EnableWorkSpaceBG === false) return null;
    if (settings.WallpaperRotationEnabled) {
        let list = Array.isArray(settings.WallpaperRotationList) && settings.WallpaperRotationList.length
            ? settings.WallpaperRotationList
            : (await bgDB.listWallpapers({ enabledOnly: true })).map((item) => item.id);
        if (!list.length) return null;
        const index = Number(settings.WallpaperRotationIndex) || 0;
        const wallpaperId = list[index % list.length];
        return await bgDB.getWallpaper(wallpaperId);
    }
    const wallpaperId = settings.currentWallpaperId || 'WorkSpaceBG';
    return await bgDB.getWallpaper(wallpaperId);
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
    workspaceClearButton.addEventListener('click', async () => {
        await bgDB.deleteWallpaper('WorkSpaceBG');
        await applySettings('EnableWorkSpaceBG', false);
        await applySettings('currentWallpaperId', null);
        document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
        await refreshWorkSpaceBackground();
    });
    const workspaceAddPicInput = document.createElement("input");
    workspaceAddPicInput.type = "file";
    workspaceAddPicInput.accept = ".png, .bmp, .jpg, .jpeg";
    workspaceAddPicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            await bgDB.saveWallpaper({
                id: 'WorkSpaceBG',
                name: 'Workspace Background',
                source: 'local',
                link: e.target.result,
                enabled: true
            });
            await applySettings('EnableWorkSpaceBG', true);
            await applySettings('currentWallpaperId', 'WorkSpaceBG');
            await refreshWorkSpaceBackground();
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
    if (isRefreshingBG) return;
    isRefreshingBG = true;
    try {
        const wallpaper = await getActiveWorkspaceWallpaper();
        if (!wallpaper || !wallpaper.link) {
            document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
            isRefreshingBG = false;
            return;
        }

        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        if (!workspace) { isRefreshingBG = false; return; }

        document.querySelectorAll('.sa-background-image').forEach(img => img.remove());

        const background = document.createElement('img');
        background.className = 'sa-background-image';
        background.src = wallpaper.link;
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