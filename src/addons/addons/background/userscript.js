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

}

let bgDB;
let isRefreshingBG = false;
let wallpaperTransitionTimeout = null;
let wallpaperRefreshToken = 0;
let cachedModalBackgroundConfig = null;
let modalBackgroundConfigPromise = null;
let modalBackgroundUpdateScheduled = false;
const modalBackgroundCacheKeys = new Set([
    'EnableModalBG',
    'ModalBGLink',
    'ModalBGLayout',
    'ModalBGBlur',
    'ModalBGOpacity',
    'ModalBGOffsetX',
    'ModalBGOffsetY',
    'ModalBGSize',
    'ModalBGAlignX',
    'ModalBGAlignY'
]);

function invalidateModalBackgroundConfigCache() {
    cachedModalBackgroundConfig = null;
    modalBackgroundConfigPromise = null;
}

function scheduleModalBackgroundUpdate() {
    if (modalBackgroundUpdateScheduled) return;
    modalBackgroundUpdateScheduled = true;
    window.requestAnimationFrame(async () => {
        modalBackgroundUpdateScheduled = false;
        await addModalBackground();
    });
}

async function applySettings(id, value) {
    try {
        const nowSettings = await bgDB.getSetting('settings') || {};
        nowSettings[id] = value;
        await bgDB.saveSetting('settings', nowSettings);
        if (modalBackgroundCacheKeys.has(id)) {
            invalidateModalBackgroundConfigCache();
        }
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

async function getModalBackgroundConfig() {
    if (cachedModalBackgroundConfig !== null) {
        return cachedModalBackgroundConfig;
    }
    if (modalBackgroundConfigPromise) {
        return modalBackgroundConfigPromise;
    }

    modalBackgroundConfigPromise = (async () => {
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
            offsetY: Number(settings.ModalBGOffsetY) || 0,
            modalSize: Number.isFinite(Number(settings.ModalBGSize)) ? Number(settings.ModalBGSize) : 100,
            alignX: settings.ModalBGAlignX || 'center',
            alignY: settings.ModalBGAlignY || 'center'
        };
    })();

    try {
        cachedModalBackgroundConfig = await modalBackgroundConfigPromise;
        return cachedModalBackgroundConfig;
    } finally {
        modalBackgroundConfigPromise = null;
    }
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
        const savedCurrentWallpaperId = resolvedSettings.currentWallpaperId;
        if (savedCurrentWallpaperId && list.includes(savedCurrentWallpaperId)) {
            selectedId = savedCurrentWallpaperId;
        }
    }
    if (!selectedId || !list.includes(selectedId)) {
        const savedIndex = Number(resolvedSettings.WallpaperRotationIndex);
        if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < list.length) {
            selectedId = list[savedIndex];
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
    document.documentElement.style.setProperty('--enable-workspace-background', 'transparent');
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

    // 初始化数据库并加载保存的背景
    bgDB = new BackgroundDB();
    await bgDB.open();

    // 加载保存的背景
    await refreshWorkSpaceBackground();
    await initializeWallpaperRotation();

    /**  
    * 监听工作区，防止blocks重绘时把我刚刚放进去的img干丢了
    * */
    const addObserver = async () => {
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

    addObserver();

    window.addEventListener('resize', () => {
        resizeWorkspaceBackground();
        scheduleModalBackgroundUpdate();
    });

    window.addEventListener('modal-opened', () => {
        scheduleModalBackgroundUpdate();
    })


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

    addContext(content, msg).then(() => {
        addModalBackground();
    });

    backdrop.addEventListener("click", remove);
    closeButton.addEventListener("click", remove);
}

async function addContext(modal, msg) {
    const modalConfig = await getModalBackgroundConfig();
    const modalSettings = {
        enabled: modalConfig !== null,
        link: modalConfig ? modalConfig.link : null,
        layout: modalConfig ? modalConfig.layout : 'fit',
        blur: modalConfig ? modalConfig.blur : 0,
        opacity: modalConfig ? modalConfig.opacity : 0.35,
        offsetX: modalConfig ? modalConfig.offsetX : 0,
        offsetY: modalConfig ? modalConfig.offsetY : 0,
        modalSize: modalConfig ? modalConfig.modalSize : 100,
        alignX: modalConfig ? modalConfig.alignX : 'center',
        alignY: modalConfig ? modalConfig.alignY : 'center'
    };

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
    workspaceClearButton.innerHTML = msg('disable');
    workspaceClearButton.addEventListener('click', async () => {
        await applySettings('EnableWorkSpaceBG', false);
        document.documentElement.style.setProperty('--enable-workspace-background', 'var(--ui-secondary)');
        await refreshWorkSpaceBackground();
        await refreshWallpaperList();
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

    // Helper function to create section headers similar to settings modal
    const createHeader = (title) => {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'sa-background-section-header';

        const titleElement = document.createElement('span');
        titleElement.className = 'sa-background-section-title';
        titleElement.textContent = title;

        const divider = document.createElement('div');
        divider.className = 'sa-background-divider';

        headerDiv.appendChild(titleElement);
        headerDiv.appendChild(divider);

        return headerDiv;
    };

    const createControlLabel = (labelNode) => {
        const label = document.createElement('div');
        label.className = 'sa-background-control-label';
        if (typeof labelNode === 'string') {
            label.textContent = labelNode;
        } else if (labelNode) {
            label.appendChild(labelNode);
        }
        return label;
    };

    const createControlInput = (...nodes) => {
        const input = document.createElement('div');
        input.className = 'sa-background-control-input';
        for (const node of nodes) {
            if (node) input.appendChild(node);
        }
        return input;
    };

    const createControlRow = (labelNode, ...controlNodes) => {
        const row = document.createElement('div');
        row.className = 'sa-background-control-row';
        row.appendChild(createControlLabel(labelNode));
        row.appendChild(createControlInput(...controlNodes));
        return row;
    };

    const createFullRow = (...nodes) => {
        const row = document.createElement('div');
        row.className = 'sa-background-control-row sa-background-control-row-full';
        const content = document.createElement('div');
        content.className = 'sa-background-control-full';
        for (const node of nodes) {
            if (node) content.appendChild(node);
        }
        row.appendChild(content);
        return row;
    };

    const createFormGrid = () => {
        const grid = document.createElement('div');
        grid.className = 'sa-background-form-grid';
        return grid;
    };

    const createRangeControl = (input, formatValue = (value) => String(value)) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'sa-background-range-control';
        const value = document.createElement('span');
        value.className = 'sa-background-range-value';

        const sync = () => {
            value.textContent = formatValue(input.value);
        };

        input.addEventListener('input', sync);
        sync();

        wrapper.appendChild(input);
        wrapper.appendChild(value);

        return { element: wrapper, sync };
    };

    const createPreview = (emptyText) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'sa-background-preview';

        const image = document.createElement('img');
        image.className = 'sa-background-preview-image';
        image.alt = '';
        image.draggable = false;

        const empty = document.createElement('span');
        empty.className = 'sa-background-preview-empty';
        empty.textContent = emptyText;

        wrapper.appendChild(image);
        wrapper.appendChild(empty);

        return { wrapper, image, empty };
    };

    const setPreviewSource = (preview, source, altText = '') => {
        const hasSource = Boolean(source);
        preview.image.hidden = !hasSource;
        preview.empty.hidden = hasSource;
        preview.image.src = hasSource ? source : '';
        preview.image.alt = altText;
    };

    const setPreviewAppearance = (preview, { blur = 0, opacity = 1 } = {}) => {
        preview.image.style.filter = `blur(${blur}px)`;
        preview.image.style.opacity = `${opacity}`;
    };

    const workspaceTitle = createHeader(msg('background-workspace'));
    const rotateTitle = createHeader(msg('background-rotate'));
    const modalTitle = createHeader(msg('background-modal'));

    // Layout
    const workspaceImageLayout = document.createElement('select');
    const workspaceImageLayoutValue = await getSetting('WorkSpaceBGLayout') || 'stretch';
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
    workspaceImageLayout.value = workspaceImageLayoutValue;
    workspaceImageLayout.addEventListener('change', async (e) => {
        await applySettings('WorkSpaceBGLayout', e.target.value);
        resizeWorkspaceBackground();
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
        await refreshPreviews();
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
        await refreshPreviews();
    });
    const workspaceBlurControl = createRangeControl(workspaceBlur, (value) => `${value}px`);
    const workspaceOpacityControl = createRangeControl(workspaceOpacity, (value) => `${value}%`);

    // Offset X
    const workspaceOffsetXText = document.createElement('span');
    workspaceOffsetXText.textContent = msg('background-offset-x');
    const workspaceOffsetX = document.createElement('input');
    workspaceOffsetX.type = 'number';
    workspaceOffsetX.min = '-500';
    workspaceOffsetX.max = '500';
    workspaceOffsetX.step = '1';
    workspaceOffsetX.value = await getSetting('WorkSpaceBGOffsetX') || 0;
    workspaceOffsetX.className = 'sa-background-offset';
    workspaceOffsetX.addEventListener('input', async () => {
        applySettings('WorkSpaceBGOffsetX', Number(workspaceOffsetX.value));
        await refreshWorkSpaceBackground();
    });

    // Offset Y
    const workspaceOffsetYText = document.createElement('span');
    workspaceOffsetYText.textContent = msg('background-offset-y');
    const workspaceOffsetY = document.createElement('input');
    workspaceOffsetY.type = 'number';
    workspaceOffsetY.min = '-500';
    workspaceOffsetY.max = '500';
    workspaceOffsetY.step = '1';
    workspaceOffsetY.value = await getSetting('WorkSpaceBGOffsetY') || 0;
    workspaceOffsetY.className = 'sa-background-offset';
    workspaceOffsetY.addEventListener('input', async () => {
        applySettings('WorkSpaceBGOffsetY', Number(workspaceOffsetY.value));
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
                    modalSettings.link = loadEvent.target.result;
                    modalSettings.enabled = true;
                    await applySettings('ModalBGLink', modalSettings.link);
                    await applySettings('ModalBGName', file.name);
                    await applySettings('EnableModalBG', modalSettings.enabled);
                    await addModalBackground();
                    await refreshPreviews();
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
        modalAddPicInput.value = '';
    });
    modalAddButton.addEventListener('click', () => {
        modalAddPicInput.click();
    });
    modalClearButton.addEventListener('click', async () => {
        modalSettings.enabled = false;
        modalSettings.link = null;
        document.documentElement.style.setProperty('--enable-modal-background', 'var(--ui-modal-background)');
        await applySettings('EnableModalBG', modalSettings.enabled);
        await applySettings('ModalBGLink', null);
        await applySettings('ModalBGName', null);
        await addModalBackground();
        await refreshPreviews();
    });

    const modalImageLayout = document.createElement('select');
    const modalImageLayoutValue = modalSettings.layout;
    modalImageLayout.className = 'sa-background-layout';
    [
        { name: msg('background-layout-stretch'), value: 'stretch' },
        { name: msg('background-layout-height-priority'), value: 'height-priority' },
        { name: msg('background-layout-width-priority'), value: 'width-priority' },
        { name: msg('background-layout-fit'), value: 'fit' },
        { name: msg('background-layout-fixed'), value: 'fixed' },
    ].forEach(layout => {
        const option = document.createElement('option');
        option.value = layout.value;
        option.textContent = layout.name;
        modalImageLayout.appendChild(option);
    });
    modalImageLayout.value = modalImageLayoutValue;
    modalImageLayout.addEventListener('change', async (e) => {
        modalSettings.layout = e.target.value;
        await applySettings('ModalBGLayout', modalSettings.layout);
        await addModalBackground();
    });

    const modalBlur = document.createElement('input');
    modalBlur.type = 'range';
    modalBlur.min = 0;
    modalBlur.max = 20;
    modalBlur.value = modalSettings.blur;
    modalBlur.className = 'sa-background-blur';
    modalBlur.addEventListener('input', async () => {
        modalSettings.blur = Number(modalBlur.value);
        await applySettings('ModalBGBlur', modalSettings.blur);
        await addModalBackground();
        await refreshPreviews();
    });

    const modalOpacity = document.createElement('input');
    modalOpacity.type = 'range';
    modalOpacity.min = 0;
    modalOpacity.max = 100;
    modalOpacity.value = modalSettings.opacity * 100;
    modalOpacity.className = 'sa-background-opacity';
    modalOpacity.addEventListener('input', async () => {
        modalSettings.opacity = Number(modalOpacity.value) / 100;
        await applySettings('ModalBGOpacity', modalSettings.opacity);
        await addModalBackground();
        await refreshPreviews();
    });
    const modalBlurControl = createRangeControl(modalBlur, (value) => `${value}px`);
    const modalOpacityControl = createRangeControl(modalOpacity, (value) => `${value}%`);

    const modalOffsetX = document.createElement('input');
    modalOffsetX.type = 'number';
    modalOffsetX.min = '-500';
    modalOffsetX.max = '500';
    modalOffsetX.step = '1';
    modalOffsetX.value = modalSettings.offsetX;
    modalOffsetX.className = 'sa-background-offset';
    modalOffsetX.addEventListener('input', async () => {
        modalSettings.offsetX = Number(modalOffsetX.value) || 0;
        await applySettings('ModalBGOffsetX', modalSettings.offsetX);
        await addModalBackground();
    });

    const modalOffsetY = document.createElement('input');
    modalOffsetY.type = 'number';
    modalOffsetY.min = '-500';
    modalOffsetY.max = '500';
    modalOffsetY.step = '1';
    modalOffsetY.value = modalSettings.offsetY;
    modalOffsetY.className = 'sa-background-offset';
    modalOffsetY.addEventListener('input', async () => {
        modalSettings.offsetY = Number(modalOffsetY.value) || 0;
        await applySettings('ModalBGOffsetY', modalSettings.offsetY);
        await addModalBackground();
    });

    const modalSize = document.createElement('input');
    modalSize.type = 'number';
    modalSize.min = '0';
    modalSize.max = '500';
    modalSize.step = '1';
    modalSize.value = modalSettings.modalSize;
    modalSize.className = 'sa-background-size';
    modalSize.addEventListener('input', async () => {
        const value = Number(modalSize.value);
        modalSettings.modalSize = Number.isFinite(value) ? value : 100;
        await applySettings('ModalBGSize', modalSettings.modalSize);
        await addModalBackground();
    });

    const modalAlignX = document.createElement('select');
    const modalAlignXValue = modalSettings.alignX;
    modalAlignX.className = 'sa-background-layout';
    [
        { name: msg('background-align-left'), value: 'left' },
        { name: msg('background-align-center'), value: 'center' },
        { name: msg('background-align-right'), value: 'right' }
    ].forEach((optionData) => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.name;
        modalAlignX.appendChild(option);
    });
    modalAlignX.value = modalAlignXValue;
    modalAlignX.addEventListener('change', async (e) => {
        modalSettings.alignX = e.target.value;
        await applySettings('ModalBGAlignX', modalSettings.alignX);
        await addModalBackground();
    });

    const modalAlignY = document.createElement('select');
    const modalAlignYValue = modalSettings.alignY;
    modalAlignY.className = 'sa-background-layout';
    [
        { name: msg('background-align-top'), value: 'top' },
        { name: msg('background-align-center'), value: 'center' },
        { name: msg('background-align-bottom'), value: 'bottom' }
    ].forEach((optionData) => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.name;
        modalAlignY.appendChild(option);
    });
    modalAlignY.value = modalAlignYValue;
    modalAlignY.addEventListener('change', async (e) => {
        modalSettings.alignY = e.target.value;
        await applySettings('ModalBGAlignY', modalSettings.alignY);
        await addModalBackground();
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
    const animationDurationControl = createRangeControl(animationDuration, (value) => `${value}ms`);

    const workspaceDiv = document.createElement('section');
    workspaceDiv.className = 'sa-background-panel sa-background-blur-wrapper';
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
    const modalSizeText = document.createElement('span');
    modalSizeText.textContent = msg('background-size');
    const modalAlignXText = document.createElement('span');
    modalAlignXText.textContent = msg('background-align-horizontal');
    const modalAlignYText = document.createElement('span');
    modalAlignYText.textContent = msg('background-align-vertical');
    const animationDurationText = document.createElement('span');
    animationDurationText.textContent = msg('animation-duration');
    const previewEmptyText = msg('background-preview-empty');
    const workspacePreview = createPreview(previewEmptyText);
    const modalPreview = createPreview(previewEmptyText);
    const modalDiv = document.createElement('section');
    modalDiv.className = 'sa-background-panel sa-background-blur-wrapper';


    // Rotation UI
    const rotationDiv = document.createElement('section');
    rotationDiv.className = 'sa-background-panel sa-background-rotation-wrapper';

    const rotationToggleLabel = document.createElement('label');
    rotationToggleLabel.className = 'sa-background-rotation-label';
    const rotationToggle = document.createElement('input');
    rotationToggle.type = 'checkbox';
    rotationToggle.checked = await getSetting('WallpaperRotationEnabled') || false;
    rotationToggle.addEventListener('change', async () => {
        document.querySelector('.sa-background-rotation-all').style.display = rotationToggle.checked ? 'block' : 'none';
        await applySettings('WallpaperRotationEnabled', rotationToggle.checked);
        await syncWallpaperSelection();
        await initializeWallpaperRotation();
        await refreshWorkSpaceBackground();
        await refreshWallpaperList();
    });
    rotationToggleLabel.appendChild(rotationToggle);
    rotationToggleLabel.appendChild(document.createTextNode(' ' + msg('rotation-enable')));

    const intervalLabel = document.createElement('span');
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

    async function refreshPreviews() {
        const activeWallpaper = await getActiveWorkspaceWallpaper();
        setPreviewSource(
            workspacePreview,
            activeWallpaper && activeWallpaper.link ? activeWallpaper.link : null,
            activeWallpaper && activeWallpaper.name ? activeWallpaper.name : msg('background-workspace')
        );
        setPreviewAppearance(workspacePreview, {
            blur: Number(workspaceBlur.value) || 0,
            opacity: (Number(workspaceOpacity.value) || 0) / 100
        });
        setPreviewSource(
            modalPreview,
            modalSettings.enabled && modalSettings.link ? modalSettings.link : null,
            msg('background-modal')
        );
        setPreviewAppearance(modalPreview, {
            blur: Number(modalBlur.value) || 0,
            opacity: (Number(modalOpacity.value) || 0) / 100
        });
    }

    async function refreshWallpaperList() {
        const settings = await bgDB.getSetting('settings') || {};
        const isBackgroundVisible = settings.EnableWorkSpaceBG !== false;
        const activeWallpaper = await getActiveWorkspaceWallpaper();
        const currentWallpaperId = activeWallpaper ? activeWallpaper.id : await getSetting('currentWallpaperId');
        const wallpapers = await bgDB.listWallpapers();
        wallpaperListContainer.innerHTML = '';
        wallpapers.forEach((wallpaper, index) => {
            const right = document.createElement('div');
            right.className = 'sa-background-wallpaper-item';

            const title = document.createElement('span');
            title.textContent = wallpaper.name || wallpaper.id;
            title.className = wallpaper.enabled ? 'sa-background-wallpaper-title' : 'sa-background-wallpaper-title disabled';

            const selectButton = document.createElement('button');
            if (wallpaper.id === currentWallpaperId) selectButton.className = 'sa-background-wallpaper-active';
            else selectButton.className = 'sa-background-wallpaper-not-active';
            selectButton.textContent = msg('active');
            selectButton.disabled = wallpaper.id === currentWallpaperId && isBackgroundVisible;
            selectButton.addEventListener('click', async () => {
                await setCurrentWallpaperId(wallpaper.id);
                await refreshWallpaperList();
            });


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

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '×';
            deleteButton.className = 'sa-background-delete';
            deleteButton.addEventListener('click', async () => {
                await deleteWallpaperAndRefresh(wallpaper.id);
                await refreshWallpaperList();
            });

            const left = document.createElement('div');
            left.className = 'sa-background-left'

            left.appendChild(selectButton);

            left.appendChild(enabledLabel);
            left.appendChild(title);
            right.appendChild(deleteButton);

            const content = document.createElement('div');
            content.className = 'sa-background-list-content';
            content.style.animationDelay = `${index * 100}ms`;
            content.style.opacity = 0;
            content.appendChild(left)
            content.appendChild(right);

            wallpaperListContainer.appendChild(content)
        });
        await refreshPreviews();
    }

    const workspaceForm = createFormGrid();
    const modalForm = createFormGrid();
    const rotationForm = createFormGrid();

    const workspaceAddClearWrapper = document.createElement('div');
    workspaceAddClearWrapper.className = 'sa-background-actions';
    workspaceAddClearWrapper.appendChild(workspaceAddButton);
    workspaceAddClearWrapper.appendChild(workspaceClearButton);
    const modalActions = document.createElement('div');
    modalActions.className = 'sa-background-actions';
    modalActions.appendChild(modalAddButton);
    modalActions.appendChild(modalClearButton);

    const rotationListShell = document.createElement('div');
    rotationListShell.className = 'sa-background-list-shell';
    rotationListShell.appendChild(wallpaperListContainer);

    workspaceForm.appendChild(createControlRow(msg('background-layout'), workspaceImageLayout));
    workspaceForm.appendChild(createControlRow(workspaceBlurText, workspaceBlurControl.element));
    workspaceForm.appendChild(createControlRow(workspaceOpacityText, workspaceOpacityControl.element));
    workspaceForm.appendChild(createControlRow(workspaceOffsetXText, workspaceOffsetX));
    workspaceForm.appendChild(createControlRow(workspaceOffsetYText, workspaceOffsetY));
    workspaceForm.appendChild(createFullRow(workspaceAddClearWrapper));

    modalForm.appendChild(createControlRow(msg('background-layout'), modalImageLayout));
    modalForm.appendChild(createFullRow(modalActions));
    modalForm.appendChild(createControlRow(modalBlurText, modalBlurControl.element));
    modalForm.appendChild(createControlRow(modalOpacityText, modalOpacityControl.element));
    modalForm.appendChild(createControlRow(modalSizeText, modalSize));
    modalForm.appendChild(createControlRow(modalAlignXText, modalAlignX));
    modalForm.appendChild(createControlRow(modalAlignYText, modalAlignY));
    modalForm.appendChild(createControlRow(modalOffsetXText, modalOffsetX));
    modalForm.appendChild(createControlRow(modalOffsetYText, modalOffsetY));

    rotationForm.appendChild(createFullRow(rotationToggleLabel));
    const rotationAllDiv = document.createElement('div');
    rotationAllDiv.className = 'sa-background-rotation-all';
    rotationAllDiv.appendChild(createControlRow(animationDurationText, animationDurationControl.element));
    rotationAllDiv.appendChild(createControlRow(intervalLabel, intervalInput));
    rotationAllDiv.appendChild(createFullRow(rotateNowButton));
    rotationAllDiv.appendChild(createFullRow(rotationListShell));
    rotationForm.append(rotationAllDiv);

    workspaceDiv.appendChild(workspaceTitle);
    workspaceDiv.appendChild(workspacePreview.wrapper);
    workspaceDiv.appendChild(workspaceForm);

    rotationDiv.appendChild(rotateTitle);
    rotationDiv.appendChild(rotationForm);

    modalDiv.appendChild(modalTitle);
    modalDiv.appendChild(modalPreview.wrapper);
    modalDiv.appendChild(modalForm);

    const content = document.createElement('div');
    content.className = 'sa-background-content-wrapper';
    content.appendChild(workspaceDiv);
    content.appendChild(rotationDiv);
    content.appendChild(modalDiv);

    modal.appendChild(content);

    await refreshWallpaperList();
    await refreshPreviews();
}

function getModalBackgroundPosition(alignX, alignY, offsetX, offsetY) {
    const normalize = (align, offset, axis) => {
        if (align === 'center') {
            return `calc(50% + ${offset}px)`;
        }
        if (align === (axis === 'x' ? 'right' : 'bottom')) {
            return `calc(100% + ${offset}px)`;
        }
        return `calc(0% + ${offset}px)`;
    };

    return `${normalize(alignX, offsetX, 'x')} ${normalize(alignY, offsetY, 'y')}`;
}

async function addModalBackground() {
    try {
        const config = await getModalBackgroundConfig();
        const modalContents = Array.from(document.querySelectorAll('[class*=\"modal_content\"]'));
        if (!modalContents.length) return;

        const modalBackgrounds = Array.from(new Set(modalContents.map((content) => {
            const fullscreenShell = content.closest('.sa-modal-shell-fullscreen');
            return fullscreenShell || content;
        })));
        const resetModalBackground = (target) => {
            if (!target) return;
            target.classList.remove('sa-modal-background-enabled');
            target.classList.remove('sa-modal-background-fullscreen');
            target.style.removeProperty('--sa-modal-bg-image');
            target.style.removeProperty('--sa-modal-bg-size');
            target.style.removeProperty('--sa-modal-bg-position');
            target.style.removeProperty('--sa-modal-bg-blur');
            target.style.removeProperty('--sa-modal-bg-opacity');
            target.style.removeProperty('--sa-modal-bg-modalsize');
        };
        document.querySelectorAll('[class*="library_library-scroll-grid"]').forEach(ele => ele.style.background = 'transparent')

        if (!config) {
            document.documentElement.style.setProperty('--enable-modal-background', 'var(--ui-modal-background)')
            modalBackgrounds.forEach(resetModalBackground);
            return;
        }
        document.documentElement.style.setProperty('--enable-modal-background', 'transparent');

        const modalSizeValue = Number.isFinite(config.modalSize) ? config.modalSize : 100;
        const isNoFit = modalSizeValue === 0;
        let modalSizeFactor = isNoFit ? 1 : Math.max(modalSizeValue, 10) / 100;
        let backgroundSize;
        if (config.layout === 'fixed') {
            backgroundSize = `${modalSizeValue}px`;
            modalSizeFactor = 1; // no scale for fixed
        } else {
            let backgroundLayout = 'cover';
            switch (config.layout) {
                case 'stretch':
                    backgroundLayout = '100% 100%';
                    break;
                case 'height-priority':
                    backgroundLayout = 'auto 100%';
                    break;
                case 'width-priority':
                    backgroundLayout = '100% auto';
                    break;
                case 'fit':
                    backgroundLayout = 'cover';
                    break;
            }
            backgroundSize = isNoFit ? 'auto' : backgroundLayout;
        }
        const backgroundPosition = getModalBackgroundPosition(config.alignX, config.alignY, config.offsetX, config.offsetY);

        modalBackgrounds.forEach((bg) => {
            resetModalBackground(bg);

            bg.classList.add('sa-modal-background-enabled');
            bg.classList.toggle('sa-modal-background-fullscreen', Boolean(bg.closest('.sa-modal-shell-fullscreen')));
            bg.style.setProperty('--sa-modal-bg-image', `url("${config.link}")`);
            bg.style.setProperty('--sa-modal-bg-size', backgroundSize);
            bg.style.setProperty('--sa-modal-bg-position', backgroundPosition);
            bg.style.setProperty('--sa-modal-bg-blur', `${config.blur}px`);
            bg.style.setProperty('--sa-modal-bg-opacity', `${config.opacity}`);
            bg.style.setProperty('--sa-modal-bg-modalsize', `${modalSizeFactor}`);
        });

    } catch (e) {
        console.warn('Failed to add modal background settings:', e);
    }
}

async function resizeWorkspaceBackground() {
    try {
        const mode = await getSetting('WorkSpaceBGLayout') || 'stretch';
        const offsetX = await getSetting('WorkSpaceBGOffsetX') || 0;
        const offsetY = await getSetting('WorkSpaceBGOffsetY') || 0;
        const workspace = document.querySelector('[class*=gui_blocks-wrapper]');
        const bgImage = document.querySelector('.sa-background-image');
        if (bgImage && workspace) {
            applyBackgroundLayout({
                image: bgImage,
                containerWidth: workspace.clientWidth,
                containerHeight: workspace.clientHeight,
                mode,
                offsetX,
                offsetY
            });
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
    const refreshToken = ++wallpaperRefreshToken;
    try {
        const animationDuration = await getSetting('WorkSpaceBGAnimationDuration') || 500;
        const isWorkspaceBackgroundEnabled = await getSetting('EnableWorkSpaceBG');
        document.documentElement.style.setProperty(
            '--enable-workspace-background',
            isWorkspaceBackgroundEnabled === false ? 'var(--ui-secondary)' : 'transparent'
        );
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
                    wallpaperTransitionTimeout = null;
                    isRefreshingBG = false;
                }, animationDuration);
            } else {
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

    workspace.prepend(background);
    await resizeWorkspaceBackground();

    // Trigger fade in
    requestAnimationFrame(async () => {
        background.style.opacity = `${await getSetting('WorkSpaceBGOpacity') || 0.5}`;
    });
}
