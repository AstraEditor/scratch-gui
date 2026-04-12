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

    listWallpapers({ enabledOnly = false } = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.wallpapersStore], 'readonly');
            const store = transaction.objectStore(this.wallpapersStore);
            const request = store.getAll();
            request.onsuccess = (e) => {
                let records = e.target.result || [];
                if (enabledOnly) {
                    records = records.filter((item) => item.enabled !== false);
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
let wallpaperTransitionTimeout = null;
let wallpaperRefreshToken = 0;
let isRefreshingModalBG = false;

import close from './close.svg';

async function extractThemeColor(imageSrc) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = Math.min(img.width, 100); // Downsample for performance
                canvas.height = Math.min(img.height, 100);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);
                resolve(`rgb(${r}, ${g}, ${b})`);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = reject;
        img.src = imageSrc;
    });
}

function adjustColorBrightness(color, amount) {
    const rgb = color.match(/\d+/g);
    if (!rgb) return color;
    let r = parseInt(rgb[0]) + amount;
    let g = parseInt(rgb[1]) + amount;
    let b = parseInt(rgb[2]) + amount;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r}, ${g}, ${b})`;
}

function rgbToHex(rgb) {
  const result = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!result) return rgb;
  const r = parseInt(result[1]);
  const g = parseInt(result[2]);
  const b = parseInt(result[3]);
  const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return hex;
}


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

function applyBackgroundLayout({
    image,
    containerWidth,
    containerHeight,
    mode = 'stretch',
    offsetX = 0,
    offsetY = 0
}) {
    if (!image || !containerWidth || !containerHeight) return;

    image.style.objectFit = 'none';
    image.style.width = 'auto';
    image.style.height = 'auto';
    image.style.left = '0';
    image.style.top = '0';
    image.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    switch (mode) {
        case 'stretch':
            image.style.width = `${containerWidth}px`;
            image.style.height = `${containerHeight}px`;
            image.style.objectFit = 'fill';
            break;
        case 'height-priority':
            image.style.height = `${containerHeight}px`;
            break;
        case 'width-priority':
            image.style.width = `${containerWidth}px`;
            break;
        case 'fit':
            image.style.width = `${containerWidth}px`;
            image.style.height = `${containerHeight}px`;
            image.style.objectFit = 'cover';
            break;
    }
}

function getModalContainers() {
    return Array.from(document.querySelectorAll('[class*="modal_modal-content"]'));
}

function removeModalBackgroundLayers() {
    getModalContainers().forEach((modalContainer) => {
        modalContainer.classList.remove('sa-modal-background-enabled');
        modalContainer.querySelectorAll('.sa-modal-background-layer').forEach((layer) => layer.remove());
    });
}

async function getModalBackgroundConfig() {
    const settings = await bgDB.getSetting('settings') || {};
    if (settings.EnableModalBG === false || !settings.ModalBGLink) {
        return null;
    }

    return {
        link: settings.ModalBGLink,
        layout: settings.ModalBGLayout || 'fit',
        blur: Number(settings.ModalBGBlur) || 0,
        opacity: typeof settings.ModalBGOpacity === 'number' ? settings.ModalBGOpacity : 0.35,
        offsetX: Number(settings.ModalBGOffsetX) || 0,
        offsetY: Number(settings.ModalBGOffsetY) || 0
    };
}

let wallpaperRotationTimer = null;

function getWallpaperRotationInterval(settings = {}) {
    const intervalMinutes = Number(settings.WallpaperRotationIntervalMinutes);
    return intervalMinutes > 0 ? intervalMinutes * 60 * 1000 : 5 * 60 * 1000;
}

async function getWallpaperRotationList(settings = null) {
    const resolvedSettings = settings || await bgDB.getSetting('settings') || {};
    const savedList = Array.isArray(resolvedSettings.WallpaperRotationList) ? resolvedSettings.WallpaperRotationList : null;
    if (savedList && savedList.length) {
        const validIds = [];
        const seenIds = new Set();
        for (const wallpaperId of savedList) {
            if (seenIds.has(wallpaperId)) continue;
            seenIds.add(wallpaperId);
            const wallpaper = await bgDB.getWallpaper(wallpaperId);
            if (wallpaper && wallpaper.enabled !== false) {
                validIds.push(wallpaperId);
            }
        }
        if (validIds.length > 0) {
            return validIds;
        }
    }
    const wallpapers = await bgDB.listWallpapers({ enabledOnly: true });
    return wallpapers.map((item) => item.id);
}

async function syncWallpaperSelection({ preferredId = null, settings = null } = {}) {
    const resolvedSettings = settings || await bgDB.getSetting('settings') || {};
    const list = await getWallpaperRotationList(resolvedSettings);
    if (!list.length) {
        await applySettings('WallpaperRotationIndex', 0);
        await applySettings('currentWallpaperId', null);
        return null;
    }

    let selectedId = preferredId;
    if (!selectedId || !list.includes(selectedId)) {
        const savedIndex = Number(resolvedSettings.WallpaperRotationIndex);
        if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < list.length) {
            selectedId = list[savedIndex];
        }
    }
    if (!selectedId || !list.includes(selectedId)) {
        const savedCurrentWallpaperId = resolvedSettings.currentWallpaperId;
        if (savedCurrentWallpaperId && list.includes(savedCurrentWallpaperId)) {
            selectedId = savedCurrentWallpaperId;
        }
    }
    if (!selectedId || !list.includes(selectedId)) {
        selectedId = list[0];
    }

    const selectedIndex = list.indexOf(selectedId);
    await applySettings('WallpaperRotationIndex', selectedIndex);
    await applySettings('currentWallpaperId', selectedId);
    return {
        list,
        wallpaperId: selectedId,
        index: selectedIndex
    };
}

async function advanceWallpaperRotationIndex() {
    const settings = await bgDB.getSetting('settings') || {};
    const syncedSelection = await syncWallpaperSelection({ settings });
    if (!syncedSelection) return null;
    const { list, index: currentIndex } = syncedSelection;
    const nextIndex = (currentIndex + 1) % list.length;
    await applySettings('WallpaperRotationIndex', nextIndex);
    await applySettings('currentWallpaperId', list[nextIndex]);
    return list[nextIndex];
}

async function stopWallpaperRotationTimer() {
    if (wallpaperRotationTimer !== null) {
        window.clearTimeout(wallpaperRotationTimer);
        wallpaperRotationTimer = null;
    }
}

async function scheduleWallpaperRotationTimer() {
    await stopWallpaperRotationTimer();
    const settings = await bgDB.getSetting('settings') || {};
    if (!settings.WallpaperRotationEnabled) return;
    const interval = getWallpaperRotationInterval(settings);
    wallpaperRotationTimer = window.setTimeout(async () => {
        try {
            await advanceWallpaperRotationIndex();
            await refreshWorkSpaceBackground();
        } catch (e) {
            console.warn('Wallpaper rotation timer error:', e);
        } finally {
            await scheduleWallpaperRotationTimer();
        }
    }, interval);
}

async function initializeWallpaperRotation() {
    const enabled = await getSetting('WallpaperRotationEnabled');
    if (enabled) {
        await scheduleWallpaperRotationTimer();
    } else {
        await stopWallpaperRotationTimer();
    }
}

function clearWallpaperTransitionTimeout() {
    if (wallpaperTransitionTimeout !== null) {
        window.clearTimeout(wallpaperTransitionTimeout);
        wallpaperTransitionTimeout = null;
    }
}

async function setCurrentWallpaperId(id) {
    await applySettings('currentWallpaperId', id);
    await applySettings('EnableWorkSpaceBG', true);
    await syncWallpaperSelection({ preferredId: id });
    await refreshWorkSpaceBackground();
}

async function updateWallpaperEnabled(id, enabled) {
    const wallpaper = await bgDB.getWallpaper(id);
    if (!wallpaper) return;
    wallpaper.enabled = enabled;
    await bgDB.saveWallpaper(wallpaper);
    await syncWallpaperSelection();
    await refreshWorkSpaceBackground();
}

async function deleteWallpaperAndRefresh(id) {
    await bgDB.deleteWallpaper(id);
    const currentId = await getSetting('currentWallpaperId');
    if (currentId === id) {
        await applySettings('currentWallpaperId', null);
    }
    await syncWallpaperSelection();
    await refreshWorkSpaceBackground();
}

async function getActiveWorkspaceWallpaper() {
    const settings = await bgDB.getSetting('settings') || {};
    if (settings.EnableWorkSpaceBG === false) return null;
    if (settings.WallpaperRotationEnabled) {
        const syncedSelection = await syncWallpaperSelection({ settings });
        if (!syncedSelection) return null;
        return await bgDB.getWallpaper(syncedSelection.wallpaperId);
    }
    const wallpaperId = settings.currentWallpaperId || 'WorkSpaceBG';
    const wallpaper = await bgDB.getWallpaper(wallpaperId);
    if (wallpaper || !settings.currentWallpaperId) {
        return wallpaper;
    }
    const syncedSelection = await syncWallpaperSelection({ settings });
    if (!syncedSelection) return null;
    return await bgDB.getWallpaper(syncedSelection.wallpaperId);
}


export default async function ({ addon, msg }) {
    let bgButton;

    // Save original UI colors
    const originalPrimary = getComputedStyle(document.documentElement).getPropertyValue('--ui-primary').trim();
    const originalSecondary = getComputedStyle(document.documentElement).getPropertyValue('--ui-secondary').trim();

    // 初始化数据库并加载保存的背景
    bgDB = new BackgroundDB();
    await bgDB.open();

    // 加载保存的背景
    await refreshWorkSpaceBackground();
    await refreshModalBackground();
    await initializeWallpaperRotation();

    const watchModalBackground = async () => {
        while (true) {
            await addon.tab.waitForElement('[class*="modal_modal-content"]', {
                markAsSeen: true
            });
            await refreshModalBackground();
        }
    };

    watchModalBackground();

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
        resizeModalBackground();
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
    workspaceAddPicInput.multiple = true;
    workspaceAddPicInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const savedIds = await Promise.all(files.map((file, index) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (loadEvent) => {
                try {
                    const wallpaperId = files.length === 1 ? 'WorkSpaceBG' : `WorkSpaceBG-${Date.now()}-${index}`;
                    await bgDB.saveWallpaper({
                        id: wallpaperId,
                        name: file.name,
                        link: loadEvent.target.result,
                        enabled: true
                    });
                    resolve(wallpaperId);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        })));

        await applySettings('EnableWorkSpaceBG', true);
        if (savedIds.length) {
            await applySettings('currentWallpaperId', savedIds[0]);
        }
        await syncWallpaperSelection({ preferredId: savedIds[0] || null });
        await refreshWorkSpaceBackground();
        await refreshWallpaperList();
        workspaceAddPicInput.value = '';
    });
    const workspaceTitle = document.createElement('h1');
    workspaceTitle.textContent = msg('background-workspace');

    const modalTitle = document.createElement('h1');
    modalTitle.textContent = msg('background-modal');

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

    const modalAddButton = document.createElement("button");
    modalAddButton.className = "sa-background-add";
    modalAddButton.textContent = msg("add");
    const modalClearButton = document.createElement("button");
    modalClearButton.className = "sa-background-add";
    modalClearButton.textContent = msg("clear");
    const modalAddPicInput = document.createElement("input");
    modalAddPicInput.type = "file";
    modalAddPicInput.accept = ".png, .bmp, .jpg, .jpeg";
    modalAddPicInput.addEventListener('change', async (e) => {
        const [file] = Array.from(e.target.files || []);
        if (!file) return;

        await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (loadEvent) => {
                try {
                    await applySettings('ModalBGLink', loadEvent.target.result);
                    await applySettings('ModalBGName', file.name);
                    await applySettings('EnableModalBG', true);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });

        await refreshModalBackground();
        modalAddPicInput.value = '';
    });
    modalAddButton.addEventListener('click', () => {
        modalAddPicInput.click();
    });
    modalClearButton.addEventListener('click', async () => {
        await applySettings('EnableModalBG', false);
        await applySettings('ModalBGLink', null);
        await applySettings('ModalBGName', null);
        await refreshModalBackground();
    });

    const modalImageLayout = document.createElement('select');
    modalImageLayout.value = await getSetting('ModalBGLayout') || 'fit';
    modalImageLayout.className = 'sa-background-layout';
    [
        { name: msg('background-layout-stretch'), value: 'stretch' },
        { name: msg('background-layout-height-priority'), value: 'height-priority' },
        { name: msg('background-layout-width-priority'), value: 'width-priority' },
        { name: msg('background-layout-fit'), value: 'fit' },
    ].forEach(layout => {
        const option = document.createElement('option');
        option.value = layout.value;
        option.textContent = layout.name;
        modalImageLayout.appendChild(option);
    });
    modalImageLayout.addEventListener('change', async (e) => {
        await applySettings('ModalBGLayout', e.target.value);
        await resizeModalBackground();
    });

    const modalBlur = document.createElement('input');
    modalBlur.type = 'range';
    modalBlur.min = 0;
    modalBlur.max = 20;
    modalBlur.value = await getSetting('ModalBGBlur') || 0;
    modalBlur.className = 'sa-background-blur';
    modalBlur.addEventListener('input', async () => {
        await applySettings('ModalBGBlur', Number(modalBlur.value));
        await refreshModalBackground();
    });

    const modalOpacity = document.createElement('input');
    modalOpacity.type = 'range';
    modalOpacity.min = 0;
    modalOpacity.max = 100;
    modalOpacity.value = (await getSetting('ModalBGOpacity')) * 100 || 35;
    modalOpacity.className = 'sa-background-opacity';
    modalOpacity.addEventListener('input', async () => {
        await applySettings('ModalBGOpacity', modalOpacity.value / 100);
        await refreshModalBackground();
    });

    const modalOffsetX = document.createElement('input');
    modalOffsetX.type = 'number';
    modalOffsetX.min = '-500';
    modalOffsetX.max = '500';
    modalOffsetX.step = '1';
    modalOffsetX.value = await getSetting('ModalBGOffsetX') || 0;
    modalOffsetX.className = 'sa-background-offset';
    modalOffsetX.addEventListener('input', async () => {
        await applySettings('ModalBGOffsetX', Number(modalOffsetX.value) || 0);
        await resizeModalBackground();
    });

    const modalOffsetY = document.createElement('input');
    modalOffsetY.type = 'number';
    modalOffsetY.min = '-500';
    modalOffsetY.max = '500';
    modalOffsetY.step = '1';
    modalOffsetY.value = await getSetting('ModalBGOffsetY') || 0;
    modalOffsetY.className = 'sa-background-offset';
    modalOffsetY.addEventListener('input', async () => {
        await applySettings('ModalBGOffsetY', Number(modalOffsetY.value) || 0);
        await resizeModalBackground();
    });

    // Animation Duration
    const animationDuration = document.createElement('input');
    animationDuration.type = 'range';
    animationDuration.min = 0;
    animationDuration.max = 2000;
    animationDuration.step = 100;
    animationDuration.value = await getSetting('WorkSpaceBGAnimationDuration') || 500;
    animationDuration.className = 'sa-background-animation-duration';
    animationDuration.addEventListener('input', async () => {
        applySettings('WorkSpaceBGAnimationDuration', Number(animationDuration.value));
    });

    const workspaceDiv = document.createElement('div');
    workspaceDiv.className = 'sa-background-blur-wrapper';
    const workspaceBlurText = document.createElement('span');
    workspaceBlurText.textContent = msg('background-blur');
    const workspaceOpacityText = document.createElement('span');
    workspaceOpacityText.textContent = msg('background-opacity');
    const modalBlurText = document.createElement('span');
    modalBlurText.textContent = msg('background-blur');
    const modalOpacityText = document.createElement('span');
    modalOpacityText.textContent = msg('background-opacity');
    const modalOffsetXText = document.createElement('span');
    modalOffsetXText.textContent = msg('background-offset-x');
    const modalOffsetYText = document.createElement('span');
    modalOffsetYText.textContent = msg('background-offset-y');
    const animationDurationText = document.createElement('span');
    animationDurationText.textContent = msg('animation-duration');
    const modalDiv = document.createElement('div');
    modalDiv.className = 'sa-background-blur-wrapper';


    // Rotation UI
    const rotationDiv = document.createElement('div');
    rotationDiv.className = 'sa-background-rotation-wrapper';
    const rotationTitle = document.createElement('h2');
    rotationTitle.textContent = msg('rotation');

    const rotationToggleLabel = document.createElement('label');
    rotationToggleLabel.className = 'sa-background-rotation-label';
    const rotationToggle = document.createElement('input');
    rotationToggle.type = 'checkbox';
    rotationToggle.checked = await getSetting('WallpaperRotationEnabled') || false;
    rotationToggle.addEventListener('change', async () => {
        await applySettings('WallpaperRotationEnabled', rotationToggle.checked);
        await syncWallpaperSelection();
        await initializeWallpaperRotation();
        await refreshWorkSpaceBackground();
        await refreshWallpaperList();
    });
    rotationToggleLabel.appendChild(rotationToggle);
    rotationToggleLabel.appendChild(document.createTextNode(' ' + msg('rotation-enable')));

    const intervalLabel = document.createElement('label');
    intervalLabel.className = 'sa-background-rotation-label';
    intervalLabel.textContent = msg('rotation-interval');
    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.min = '1';
    intervalInput.value = await getSetting('WallpaperRotationIntervalMinutes') || 5;
    intervalInput.className = 'sa-background-rotation-interval';
    intervalInput.addEventListener('change', async () => {
        await applySettings('WallpaperRotationIntervalMinutes', Number(intervalInput.value) || 5);
        await initializeWallpaperRotation();
    });
    intervalLabel.appendChild(intervalInput);

    const rotateNowButton = document.createElement('button');
    rotateNowButton.className = 'sa-background-add';
    rotateNowButton.textContent = msg('rotate-now');
    rotateNowButton.addEventListener('click', async () => {
        await advanceWallpaperRotationIndex();
        await refreshWorkSpaceBackground();
        await refreshWallpaperList();
    });

    const wallpaperListContainer = document.createElement('div');
    wallpaperListContainer.className = 'sa-background-wallpaper-list';

    async function refreshWallpaperList() {
        const activeWallpaper = await getActiveWorkspaceWallpaper();
        const currentWallpaperId = activeWallpaper ? activeWallpaper.id : await getSetting('currentWallpaperId');
        const wallpapers = await bgDB.listWallpapers();
        wallpaperListContainer.innerHTML = '';
        wallpapers.forEach((wallpaper) => {
            const item = document.createElement('div');
            item.className = 'sa-background-wallpaper-item';

            const title = document.createElement('span');
            title.textContent = wallpaper.name || wallpaper.id;
            title.className = wallpaper.enabled ? 'sa-background-wallpaper-title' : 'sa-background-wallpaper-title disabled';

            const activeBadge = document.createElement('span');
            activeBadge.textContent = msg('active');
            activeBadge.className = 'sa-background-wallpaper-active';

            const enabledLabel = document.createElement('label');
            enabledLabel.className = 'sa-background-wallpaper-enabled-label';
            const enabledInput = document.createElement('input');
            enabledInput.type = 'checkbox';
            enabledInput.checked = wallpaper.enabled !== false;
            enabledInput.addEventListener('change', async () => {
                await updateWallpaperEnabled(wallpaper.id, enabledInput.checked);
                await refreshWallpaperList();
            });
            enabledLabel.appendChild(enabledInput);

            const selectButton = document.createElement('button');
            selectButton.className = 'sa-background-add';
            selectButton.textContent = msg('set-current');
            selectButton.disabled = wallpaper.id === currentWallpaperId;
            selectButton.addEventListener('click', async () => {
                await setCurrentWallpaperId(wallpaper.id);
                await refreshWallpaperList();
            });

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.className = 'sa-background-delete';
            deleteButton.addEventListener('click', async () => {
                await deleteWallpaperAndRefresh(wallpaper.id);
                await refreshWallpaperList();
            });

            if (wallpaper.id === currentWallpaperId) item.appendChild(activeBadge);
            item.appendChild(enabledLabel);
            item.appendChild(title);
            if(wallpaper.enabled) item.appendChild(selectButton);
            item.appendChild(deleteButton);
            wallpaperListContainer.appendChild(item);
        });
    }

    rotationDiv.appendChild(rotationTitle);
    rotationDiv.appendChild(animationDurationText);
    rotationDiv.appendChild(animationDuration);
    rotationDiv.appendChild(rotationToggleLabel);
    rotationDiv.appendChild(intervalLabel);
    rotationDiv.appendChild(rotateNowButton);
    rotationDiv.appendChild(wallpaperListContainer);

    // All
    workspaceDiv.appendChild(workspaceTitle);
    workspaceDiv.appendChild(workspaceImageLayout);
    workspaceDiv.appendChild(workspaceAddButton);
    workspaceDiv.appendChild(workspaceClearButton);
    workspaceDiv.appendChild(workspaceBlurText);
    workspaceDiv.appendChild(workspaceBlur);
    workspaceDiv.appendChild(workspaceOpacityText);
    workspaceDiv.appendChild(workspaceOpacity);

    modalDiv.appendChild(modalTitle);
    modalDiv.appendChild(modalImageLayout);
    modalDiv.appendChild(modalAddButton);
    modalDiv.appendChild(modalClearButton);
    modalDiv.appendChild(modalBlurText);
    modalDiv.appendChild(modalBlur);
    modalDiv.appendChild(modalOpacityText);
    modalDiv.appendChild(modalOpacity);
    modalDiv.appendChild(modalOffsetXText);
    modalDiv.appendChild(modalOffsetX);
    modalDiv.appendChild(modalOffsetYText);
    modalDiv.appendChild(modalOffsetY);

    modal.appendChild(workspaceDiv);
    modal.appendChild(modalDiv);
    modal.appendChild(rotationDiv);

    await refreshWallpaperList();
}

async function saveLayout(layout) {
    await applySettings('WorkSpaceBGLayout', layout);
    resizeWorkspaceBackground();
}


async function resizeWorkspaceBackground() {
    try {
        const mode = await getSetting('WorkSpaceBGLayout') || 'stretch';
        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        const bgImage = document.querySelector('.sa-background-image');
        if (bgImage && workspace) {
            applyBackgroundLayout({
                image: bgImage,
                containerWidth: workspace.clientWidth,
                containerHeight: workspace.clientHeight,
                mode
            });
        } else {
            console.warn('Cannot find background image element, try to spawn again');
            await refreshWorkSpaceBackground();
        }
    } catch (e) {
        console.warn('Failed to resize background image:', e);
    }

}

async function resizeModalBackground() {
    try {
        const modalConfig = await getModalBackgroundConfig();
        if (!modalConfig) {
            removeModalBackgroundLayers();
            return;
        }

        getModalContainers().forEach((modalContainer) => {
            const bgImage = modalContainer.querySelector('.sa-modal-background-image');
            if (!bgImage) return;
            applyBackgroundLayout({
                image: bgImage,
                containerWidth: modalContainer.clientWidth,
                containerHeight: modalContainer.clientHeight,
                mode: modalConfig.layout,
                offsetX: modalConfig.offsetX,
                offsetY: modalConfig.offsetY
            });
        });
    } catch (e) {
        console.warn('Failed to resize modal background image:', e);
    }
}


async function refreshWorkSpaceBackground() {
    if (isRefreshingBG) return;
    isRefreshingBG = true;
    const refreshToken = ++wallpaperRefreshToken;
    try {
        const animationDuration = await getSetting('WorkSpaceBGAnimationDuration') || 500;
        clearWallpaperTransitionTimeout();
        const wallpaper = await getActiveWorkspaceWallpaper();
        const existingBackgrounds = Array.from(document.querySelectorAll('.sa-background-image'));
        const existingBg = existingBackgrounds[0] || null;
        existingBackgrounds.slice(1).forEach((backgroundImage) => backgroundImage.remove());

        if (!wallpaper || !wallpaper.link) {
            if (existingBg) {
                existingBg.style.transition = `opacity ${animationDuration}ms ease-out`;
                existingBg.style.opacity = '0';
                wallpaperTransitionTimeout = window.setTimeout(() => {
                    if (refreshToken !== wallpaperRefreshToken) return;
                    existingBg.remove();
                    document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
                    // Restore original UI colors
                    document.documentElement.style.setProperty('--ui-primary', originalPrimary);
                    document.documentElement.style.setProperty('--ui-secondary', originalSecondary);
                    wallpaperTransitionTimeout = null;
                    isRefreshingBG = false;
                }, animationDuration);
            } else {
                document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
                // Restore original UI colors
                document.documentElement.style.setProperty('--ui-primary', originalPrimary);
                document.documentElement.style.setProperty('--ui-secondary', originalSecondary);
                isRefreshingBG = false;
            }
            return;
        }

        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        if (!workspace) {
            isRefreshingBG = false;
            return;
        }

        if (existingBg && existingBg.dataset.wallpaperId === wallpaper.id) {
            existingBg.src = wallpaper.link;
            existingBg.style.filter = `blur(${await getSetting('WorkSpaceBGBlur') || 0}px)`;
            existingBg.style.opacity = `${await getSetting('WorkSpaceBGOpacity') || 0.5}`;
            await resizeWorkspaceBackground();
            isRefreshingBG = false;
            return;
        }

        if (existingBg) {
            existingBg.style.transition = `opacity ${animationDuration}ms ease-out`;
            existingBg.style.opacity = '0';
            wallpaperTransitionTimeout = window.setTimeout(async () => {
                if (refreshToken !== wallpaperRefreshToken) return;
                existingBg.remove();
                await createNewBackground(wallpaper, workspace, animationDuration);
                wallpaperTransitionTimeout = null;
                isRefreshingBG = false;
            }, animationDuration);
        } else {
            await createNewBackground(wallpaper, workspace, animationDuration);
            isRefreshingBG = false;
        }
    } catch (e) {
        console.log(e);
        isRefreshingBG = false;
    }
}

async function createNewBackground(wallpaper, workspace, animationDuration) {
    clearWallpaperTransitionTimeout();
    workspace.querySelectorAll('.sa-background-image').forEach((backgroundImage) => backgroundImage.remove());
    const background = document.createElement('img');
    background.className = 'sa-background-image';
    background.dataset.wallpaperId = wallpaper.id || '';
    background.src = wallpaper.link;
    background.style.filter = `blur(${await getSetting('WorkSpaceBGBlur') || 0}px)`;
    background.style.clipPath = 'inset(0)';
    background.style.opacity = '0'; // Start invisible
    background.style.position = 'absolute';
    background.draggable = false;
    background.style.transition = `opacity ${animationDuration}ms ease-in`; // Add transition for fade in

    // // Extract theme color when image loads
    // background.onload = async () => {
    //     try {
    //         const themeColor = await extractThemeColor(wallpaper.link);
    //         if (themeColor) {
    //             const primaryColor = themeColor;
    //             const secondaryColor = adjustColorBrightness(themeColor, -20); // Darker for secondary
    //             document.documentElement.style.setProperty('--menu-bar-background', primaryColor);
    //             document.documentElement.style.setProperty('--looks-secondary', primaryColor);
    //             document.documentElement.style.setProperty('--looks-transparent', rgbToHex(primaryColor) + '80');
    //             document.documentElement.style.setProperty('--motion-primary-transparent', rgbToHex(primaryColor) + 'cc');
    //             document.documentElement.style.setProperty('--looks-light-transparent', rgbToHex(primaryColor) + '40');
    //         }
    //     } catch (e) {
    //         console.warn('Failed to extract theme color:', e);
    //     }
    // };

    workspace.prepend(background);
    await resizeWorkspaceBackground();

    // Trigger fade in
    requestAnimationFrame(async () => {
        background.style.opacity = `${await getSetting('WorkSpaceBGOpacity') || 0.5}`;
    });
}

async function refreshModalBackground() {
    if (isRefreshingModalBG) return;
    isRefreshingModalBG = true;

    try {
        const modalConfig = await getModalBackgroundConfig();
        if (!modalConfig) {
            removeModalBackgroundLayers();
            isRefreshingModalBG = false;
            return;
        }

        const modalContainers = getModalContainers();
        if (!modalContainers.length) {
            isRefreshingModalBG = false;
            return;
        }

        modalContainers.forEach((modalContainer) => {
            let backgroundLayer = modalContainer.querySelector('.sa-modal-background-layer');
            let backgroundImage = modalContainer.querySelector('.sa-modal-background-image');

            modalContainer.classList.add('sa-modal-background-enabled');

            if (!backgroundLayer) {
                backgroundLayer = document.createElement('div');
                backgroundLayer.className = 'sa-modal-background-layer';
                backgroundImage = document.createElement('img');
                backgroundImage.className = 'sa-modal-background-image';
                backgroundImage.draggable = false;
                backgroundLayer.appendChild(backgroundImage);
                modalContainer.prepend(backgroundLayer);
            }

            backgroundImage.src = modalConfig.link;
            backgroundImage.style.filter = `blur(${modalConfig.blur}px)`;
            backgroundImage.style.opacity = `${modalConfig.opacity}`;
        });

        await resizeModalBackground();
    } catch (e) {
        console.warn('Failed to refresh modal background:', e);
    } finally {
        isRefreshingModalBG = false;
    }
}
