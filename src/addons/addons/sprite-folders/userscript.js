export default async ({ addon, console, msg }) => {
    const DIVIDER = '//';

    function getFolderFromName(name) {
        if (!name || typeof name !== 'string') return null;
        const idx = name.indexOf(DIVIDER);
        if (idx === -1 || idx === 0) return null;
        return name.substr(0, idx);
    }

    function getNameWithoutFolder(name) {
        if (!name || typeof name !== 'string') return name;
        const idx = name.indexOf(DIVIDER);
        if (idx === -1 || idx === 0) return name;
        return name.substr(idx + DIVIDER.length);
    }

    function setFolderOfName(name, folder) {
        const basename = getNameWithoutFolder(name);
        if (folder) {
            return `${folder}${DIVIDER}${basename}`;
        }
        return basename;
    }

    let vm;
    let expandedFolders = new Set();
    let emptyFolders = new Set();
    let draggedSprite = null;
    let draggedOverFolder = null;

    // Cache for loaded SVGs
    const svgCache = new Map();

    async function loadSVG(name) {
        if (svgCache.has(name)) {
            return svgCache.get(name);
        }

        try {
            const svgContent = await addon.self.getResource(`/assets/${name}.svg`);
            if (svgContent) {
                svgCache.set(name, svgContent);
                return svgContent;
            }
        } catch (e) {
            console.warn(`Failed to load SVG ${name}:`, e);
        }

        return '';
    }

    function createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'sa-file-list-toolbar';

        const btnExpand = createToolbarButton('expand', msg('expand-all'), () => expandAllFolders());
        const btnCollapse = createToolbarButton('collapse', msg('collapse-all'), () => collapseAllFolders());
        const btnAddFolder = createToolbarButton('new-folder', msg('new-folder'), () => createNewFolder());

        toolbar.appendChild(btnExpand);
        toolbar.appendChild(btnCollapse);
        toolbar.appendChild(btnAddFolder);

        return toolbar;
    }

    function createToolbarButton(iconName, title, onClick) {
        const btn = document.createElement('button');
        btn.className = 'sa-toolbar-button';
        btn.title = title;
        btn.addEventListener('click', onClick);

        const icon = document.createElement('span');
        icon.className = 'sa-toolbar-icon';

        loadSVG(iconName).then(svgContent => {
            if (svgContent) {
                icon.innerHTML = svgContent;
                icon.style.display = 'inline-block';
            }
        });

        btn.appendChild(icon);
        return btn;
    }

    function expandAllFolders() {
        const currentFolders = new Set();
        vm.runtime.targets.forEach(t => {
            const name = t.name || t.sprite?.name;
            if (name) {
                const folder = getFolderFromName(name);
                if (folder) currentFolders.add(folder);
            }
        });
        expandedFolders = currentFolders;
        renderFileList();
    }

    function collapseAllFolders() {
        expandedFolders.clear();
        renderFileList();
    }

    function createNewFolder() {
        const folderName = prompt(msg('folder-name-prompt'));
        if (!folderName) return;

        // Check if folder already exists
        const existingWithSprites = vm.runtime.targets.some(t => {
            const name = t.name || t.sprite?.name;
            return name && getFolderFromName(name) === folderName;
        });

        if (existingWithSprites || emptyFolders.has(folderName)) {
            alert(msg('folder-exists'));
            return;
        }

        emptyFolders.add(folderName);
        expandedFolders.add(folderName);
        renderFileList();
    }

    function renameFolder(oldFolderName) {
        const newFolderName = prompt(msg('rename-folder-prompt', { name: oldFolderName }), oldFolderName);
        if (!newFolderName || newFolderName === oldFolderName) return;

        const hasSprites = vm.runtime.targets.some(t => {
            const name = t.name || t.sprite?.name;
            return name && getFolderFromName(name) === oldFolderName;
        });

        // Handle empty folders (UI-only)
        if (!hasSprites && emptyFolders.has(oldFolderName)) {
            emptyFolders.delete(oldFolderName);
            emptyFolders.add(newFolderName);
            if (expandedFolders.has(oldFolderName)) {
                expandedFolders.delete(oldFolderName);
                expandedFolders.add(newFolderName);
            }
            renderFileList();
            return;
        }

        // Handle folders with sprites
        const targets = vm.runtime.targets.filter(t => {
            const name = t.name || t.sprite?.name;
            if (!name) return false;
            return getFolderFromName(name) === oldFolderName;
        });

        targets.forEach(target => {
            const oldName = target.name || target.sprite?.name;
            const newName = setFolderOfName(oldName, newFolderName);
            vm.renameSprite(target.id, newName);
        });

        renderFileList();
    }

    function deleteFolder(folderName) {
        const hasSprites = vm.runtime.targets.some(t => {
            const name = t.name || t.sprite?.name;
            return name && getFolderFromName(name) === folderName;
        });

        if (hasSprites) {
            if (!confirm(msg('delete-folder-with-sprites', { name: folderName }))) return;

            const targets = vm.runtime.targets.filter(t => {
                const name = t.name || t.sprite?.name;
                if (!name) return false;
                return getFolderFromName(name) === folderName;
            });

            targets.forEach(target => {
                vm.deleteSprite(target.id);
            });
        } else {
            if (!confirm(msg('remove-empty-folder', { name: folderName }))) return;
            emptyFolders.delete(folderName);
        }

        expandedFolders.delete(folderName);
        renderFileList();
    }

    async function getSpriteImage(sprite) {
        // Runtime targets have a .sprite property that contains the costume info
        const actualSprite = sprite.sprite || sprite;

        // Get the current costume from the sprite's costume array
        const costumes = actualSprite.costumes;
        if (costumes && costumes.length > 0) {
            // Use currentCostumeIndex if available
            const index = actualSprite.currentCostumeIndex || 0;
            const costume = costumes[Math.min(index, costumes.length - 1)];

            if (costume && costume.asset) {
                try {
                    const dataUri = await costume.asset.encodeDataURI();
                    if (dataUri) return dataUri;
                } catch (e) {
                }

                // Fallback to asset URL
                if (costume.asset.assetId) {
                    const url = `https://assets.scratch.mit.edu/internalapi/asset/${costume.asset.assetId}.${costume.dataFormat || 'png'}/get/`;
                    return url;
                }
                if (costume.md5ext) {
                    return `https://assets.scratch.mit.edu/internalapi/asset/${costume.md5ext}/get/`;
                }
            }
        }

        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    function getSpriteDisplayName(sprite) {
        const spriteName = sprite.name || sprite.sprite?.name || msg('untitled');
        const folder = getFolderFromName(spriteName);
        return folder ? getNameWithoutFolder(spriteName) : spriteName;
    }

    function sortSpritesAlphabetically(sprites) {
        return sprites.sort((a, b) => {
            const nameA = getSpriteDisplayName(a).toLowerCase();
            const nameB = getSpriteDisplayName(b).toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    let spriteItemIcons = new Map();

    function updateSpriteIcon(sprite) {
        const icon = spriteItemIcons.get(sprite.id);
        if (!icon) return;

        const actualSprite = sprite.sprite || sprite;
        const costumes = actualSprite.costumes;

        if (costumes && costumes.length > 0) {
            const index = actualSprite.currentCostumeIndex || 0;
            const costume = costumes[Math.min(index, costumes.length - 1)];

            if (costume && costume.asset) {
                costume.asset.encodeDataURI().then(dataUri => {
                    if (dataUri && icon.parentNode) {
                        icon.src = dataUri;
                    }
                }).catch(() => {
                    const url = `https://assets.scratch.mit.edu/internalapi/asset/${costume.asset.assetId}.${costume.dataFormat || 'png'}/get/`;
                    if (icon.parentNode) {
                        icon.src = url;
                    }
                });
            }
        }
    }

    function renderFileList() {
        const container = document.querySelector('[class*="sprite-selector_items-wrapper"]');
        if (!container || !vm || !vm.runtime || !vm.runtime.targets) return;

        const existingContainer = container.querySelector('.sa-file-list-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        spriteItemIcons.clear();

        const listContainer = document.createElement('div');
        listContainer.className = 'sa-file-list-container';

        const toolbar = createToolbar();
        listContainer.appendChild(toolbar);

        const fileList = document.createElement('div');
        fileList.className = 'sa-file-list';

        const sprites = vm.runtime.targets.filter(t => !t.isStage && t.id);

        // Group sprites by folder
        const grouped = {};
        sprites.forEach(sprite => {
            const spriteName = sprite.name || sprite.sprite?.name;
            if (!spriteName) return;

            const folder = getFolderFromName(spriteName);
            if (folder) {
                if (!grouped[folder]) {
                    grouped[folder] = [];
                }
                grouped[folder].push(sprite);
            }
        });

        // Sprites without folders
        const nonFolderSprites = sprites.filter(sprite => {
            const spriteName = sprite.name || sprite.sprite?.name;
            return !spriteName || !getFolderFromName(spriteName);
        });

        // Get all folder folders (both with sprites and empty)
        const allFolders = new Set([
            ...Object.keys(grouped),
            ...emptyFolders
        ]);

        // Sort folders alphabetically
        const sortedFolders = Array.from(allFolders).sort();

        // Render folders first
        sortedFolders.forEach(folder => {
            const folderItem = createFolderItem(folder, 0);
            fileList.appendChild(folderItem);

            if (expandedFolders.has(folder) && grouped[folder]) {
                // Sort sprites within this folder alphabetically
                const sortedSprites = sortSpritesAlphabetically(grouped[folder]);
                sortedSprites.forEach(sprite => {
                    fileList.appendChild(createListItem(sprite, 1, fileList, container));
                });
            }
        });

        // Render non-folder sprites at the bottom, sorted alphabetically
        const sortedNonFolderSprites = sortSpritesAlphabetically(nonFolderSprites);
        sortedNonFolderSprites.forEach(sprite => {
            fileList.appendChild(createListItem(sprite, 0, fileList, container));
        });

        listContainer.appendChild(fileList);

        const originalContent = container.querySelector('[class*="sprite-selector_sprite-wrapper"]');
        if (originalContent) {
            originalContent.style.display = 'none';
        }

        container.appendChild(listContainer);
    }

    function createListItem(sprite, level = 0, fileList, container) {
        const item = document.createElement('div');
        const isSelected = vm && vm.editingTarget && sprite.id === vm.editingTarget.id;

        item.className = `sa-file-list-item ${isSelected ? 'selected' : ''}`;
        item.dataset.spriteId = sprite.id;
        item.style.paddingLeft = `${level * 16 + 8}px`;
        item.draggable = true;

        const iconContainer = document.createElement('span');
        iconContainer.className = 'sa-file-icon-container';

        const icon = document.createElement('img');
        icon.className = 'sa-file-icon';
        icon.alt = '';
        spriteItemIcons.set(sprite.id, icon);

        getSpriteImage(sprite).then(src => {
            if (icon.parentNode) {
                icon.src = src;
                icon.addEventListener('error', () => {
                    console.error('Failed to load sprite image:', sprite.name, src);
                });
            }
        });

        iconContainer.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'sa-file-name';
        const spriteName = sprite.name || sprite.sprite?.name || 'Untitled';
        const folder = getFolderFromName(spriteName);
        name.textContent = folder ? getNameWithoutFolder(spriteName) : spriteName;

        item.appendChild(iconContainer);
        item.appendChild(name);

        item.addEventListener('click', () => selectSprite(sprite));

        // Right-click to show context menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Select the sprite first
            selectSprite(sprite);

            showSpriteContextMenu(e, sprite, container);
        });

        // Drag events
        item.addEventListener('dragstart', (e) => {
            draggedSprite = sprite;
            selectSprite(sprite);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            draggedSprite = null;
            item.classList.remove('dragging');
            if (draggedOverFolder) {
                draggedOverFolder.classList.remove('drag-over');
                draggedOverFolder = null;
            }
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        return item;
    }

    function createFolderItem(foldername, level = 0) {
        const isExpanded = expandedFolders.has(foldername);

        const item = document.createElement('div');
        item.className = `sa-folder-item ${isExpanded ? 'expanded' : ''}`;
        item.style.paddingLeft = `${level * 16 + 8}px`;

        // Folder icon
        const folderIconWrapper = document.createElement('span');
        folderIconWrapper.className = 'sa-folder-icon';
        item.appendChild(folderIconWrapper);

        loadSVG(isExpanded ? 'folder-open' : 'folder').then(svgContent => {
            if (svgContent) {
                folderIconWrapper.innerHTML = svgContent;
                folderIconWrapper.style.display = 'inline-flex';
            }
        });

        const name = document.createElement('span');
        name.className = 'sa-folder-name';
        name.textContent = foldername;
        item.appendChild(name);

        item.addEventListener('click', () => toggleFolder(foldername));

        // Folder right-click menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showFolderContextMenu(e, foldername);
        });

        // Drop events for folders
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!isExpanded) {
                e.dataTransfer.dropEffect = 'move';
            }
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (draggedSprite && getFolderFromName(draggedSprite.name || draggedSprite.sprite?.name) !== foldername) {
                item.classList.add('drag-over');
                draggedOverFolder = item;
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');

            if (draggedSprite) {
                const spriteName = draggedSprite.name || draggedSprite.sprite?.name;
                const currentFolder = getFolderFromName(spriteName);

                if (currentFolder !== foldername) {
                    const newName = setFolderOfName(spriteName, foldername);
                    vm.renameSprite(draggedSprite.id, newName);

                    // If folder was empty, it's no longer empty
                    if (emptyFolders.has(foldername)) {
                        emptyFolders.delete(foldername);
                    }

                    setTimeout(() => renderFileList(), 100);
                }
            }
        });

        return item;
    }

    function removeContextMenu() {
        const last_menu = document.getElementsByClassName('sa-folder-context-menu');
        try {
            for (let i = 0; i <= last_menu.length; i += 1) {
                last_menu[i].remove();
            }
        } catch (e) {
            // 忽略
        }
    }

    function showFolderContextMenu(e, foldername) {
        removeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'sa-folder-context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        const hasSprites = vm.runtime.targets.some(t => {
            const name = t.name || t.sprite?.name;
            return name && getFolderFromName(name) === foldername;
        });

        const btnRename = document.createElement('div');
        btnRename.className = 'sa-context-menu-item';
        btnRename.textContent = msg('rename');
        btnRename.addEventListener('click', () => {
            menu.remove();
            renameFolder(foldername);
        });

        const btnDelete = document.createElement('div');
        btnDelete.className = 'sa-context-menu-item';
        btnDelete.textContent = hasSprites ? msg('delete') : msg('remove-folder');
        btnDelete.addEventListener('click', () => {
            menu.remove();
            deleteFolder(foldername);
        });

        menu.appendChild(btnRename);
        menu.appendChild(btnDelete);

        document.body.appendChild(menu);

        const closeMenu = (e2) => {
            if (!menu.contains(e2.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    function showSpriteContextMenu(e, sprite, container) {
        removeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'sa-folder-context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        const duplicateBtn = document.createElement('div');
        duplicateBtn.className = 'sa-context-menu-item';
        duplicateBtn.textContent = msg('duplicate');
        duplicateBtn.addEventListener('click', () => {
            menu.remove();
            vm.duplicateSprite(sprite.id);
        });

        const exportBtn = document.createElement('div');
        exportBtn.className = 'sa-context-menu-item';
        exportBtn.textContent = msg('export');
        exportBtn.addEventListener('click', () => {
            menu.remove();
            // Find the original wrapper and call its export handler
            const originalWrappers = container.querySelectorAll('[class*="sprite-selector_sprite-wrapper"]');
            for (const wrapper of originalWrappers) {
                const reactKey = Object.keys(wrapper).find(key => key.startsWith('__reactInternalInstance$'));
                if (reactKey) {
                    const fiber = wrapper[reactKey];
                    // Navigate fiber tree: child -> child -> child -> stateNode
                    const stateNode = fiber?.child?.child?.child?.stateNode;
                    if (stateNode && stateNode.props && stateNode.props.id === sprite.id && stateNode.props.onExportButtonClick) {
                        stateNode.props.onExportButtonClick(sprite.id);
                        return;
                    }
                }
            }
        });

        const renameBtn = document.createElement('div');
        renameBtn.className = 'sa-context-menu-item';
        renameBtn.textContent = msg('rename');
        renameBtn.addEventListener('click', () => {
            menu.remove();
            const newName = prompt(msg('rename-sprite-prompt'), sprite.name || sprite.sprite?.name);
            if (newName && newName !== (sprite.name || sprite.sprite?.name)) {
                vm.renameSprite(sprite.id, newName);
            }
        });

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'sa-context-menu-item sa-context-menu-danger';
        deleteBtn.textContent = msg('delete');
        deleteBtn.addEventListener('click', () => {
            if (confirm(msg('delete-sprite-confirm'))) {
                menu.remove();
                vm.deleteSprite(sprite.id);
            }
        });

        menu.appendChild(duplicateBtn);
        menu.appendChild(exportBtn);
        menu.appendChild(renameBtn);
        menu.appendChild(deleteBtn);

        document.body.appendChild(menu);

        const closeMenu = (e2) => {
            if (!menu.contains(e2.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    function toggleFolder(foldername) {
        if (expandedFolders.has(foldername)) {
            expandedFolders.delete(foldername);
        } else {
            expandedFolders.add(foldername);
        }
        renderFileList();
    }

    function selectSprite(sprite) {
        if (!vm || !vm.setEditingTarget) return;
        vm.setEditingTarget(sprite.id);
    }

    function updateSelection() {
        if (!vm || !vm.editingTarget || !vm.editingTarget.id) return;

        const items = document.querySelectorAll('.sa-file-list-item');
        items.forEach(item => {
            const spriteId = item.dataset.spriteId;
            if (spriteId === vm.editingTarget.id) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function autoExpandCurrentFolder() {
        if (!vm || !vm.editingTarget) return;

        const currentSprite = vm.editingTarget;
        if (!currentSprite || currentSprite.isStage) return;

        const spriteName = currentSprite.name || currentSprite.sprite?.name;
        if (!spriteName) return;

        const folder = getFolderFromName(spriteName);
        if (folder && !expandedFolders.has(folder)) {
            expandedFolders.add(folder);
            renderFileList();
        }
    }

    function observeSpriteList() {
        let renderTimeout = null;
        let updateTimeout = null;

        const observer = new MutationObserver((mutations) => {
            let spriteItemsChanged = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.toString().includes('sprite-selector_sprite-wrapper')) {
                            spriteItemsChanged = true;
                        }
                    }
                });
            });

            const listContainer = container?.querySelector('.sa-file-list-container');

            // Hide any new original sprite items that appear
            const originalItems = container?.querySelectorAll('[class*="sprite-selector_sprite-wrapper"]');
            if (originalItems) {
                originalItems.forEach(item => {
                    if (item.style.display !== 'none') {
                        item.style.display = 'none';
                    }
                });
            }

            // Check if our container exists, if not render it
            if (!listContainer || spriteItemsChanged) {
                if (!renderTimeout) {
                    renderTimeout = setTimeout(() => {
                        renderFileList();
                        renderTimeout = null;
                    }, 50);
                }
                return;
            }

            // Debounce updateSelection to avoid excessive calls
            if (!updateTimeout) {
                updateTimeout = setTimeout(() => {
                    updateSelection();
                    updateTimeout = null;
                }, 50);
            }
        });

        const container = document.querySelector('[class*="sprite-selector_items-wrapper"]');

        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    vm = addon.tab.traps.vm;

    // Wait for both the container and sprites to be available
    const container = await addon.tab.waitForElement('[class*="sprite-selector_items-wrapper"]');

    // Initial render after ensuring sprites are loaded
    function initialRender() {
        if (vm && vm.runtime && vm.runtime.targets && vm.runtime.targets.length > 0) {
            if (vm.editingTarget) {
                autoExpandCurrentFolder();
            }
            renderFileList();
        } else {
            // If sprites aren't loaded yet, try again after a short delay
            setTimeout(initialRender, 100);
        }
    }

    initialRender();
    observeSpriteList();

    // Listen for sprite updates
    vm.runtime.on('targetsUpdate', () => {
        setTimeout(() => {
            // Update icons for sprites whose costumes have changed before re-rendering
            vm.runtime.targets.forEach(target => {
                if (!target.isStage && target.id) {
                    updateSpriteIcon(target);
                }
            });
            renderFileList();
            updateSelection();
        }, 100);
    });

    vm.runtime.on('targetChanged', () => {
        updateSelection();
        autoExpandCurrentFolder();
    });

    vm.on('SCRIPT_CHANGED', () => {
        updateSelection();
    });

    let visualUpdateTimeout = null;

    vm.on('VISUAL_CHANGED', () => {
        updateSelection();
        // Debounce and re-render the entire list when visuals change
        if (visualUpdateTimeout) clearTimeout(visualUpdateTimeout);
        visualUpdateTimeout = setTimeout(() => {
            renderFileList();
            visualUpdateTimeout = null;
        }, 100);
    });

    vm.on('PROJECT_CHANGED', () => {
        renderFileList();
        updateSelection();
    });

    // Listen for sprite addition (VM event when new sprite is created)
    const originalInstallTargets = vm.installTargets.bind(vm);
    vm.installTargets = function (...args) {
        return originalInstallTargets(...args).then(() => {
            setTimeout(() => {
                renderFileList();
                updateSelection();
            }, 100);
        });
    };

    // Also listen for project loaded events
    vm.on('PROJECT_LOADED', () => {
        setTimeout(() => {
            renderFileList();
            if (vm.editingTarget) {
                autoExpandCurrentFolder();
            }
        }, 500);
    });
};
