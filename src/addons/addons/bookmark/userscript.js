import icon from "!../../../lib/tw-recolor/build!./bookmark.svg";
import SideBar from "../../ui/side-bar/side-bar.js";

// 检测是否启用 VSCode 布局
function isVSCodeLayoutEnabled() {
  try {
    const settings = localStorage.getItem("AESettings");
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.EnableVSCodeLayout === true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

export default async ({ addon, msg, console }) => {
  const Blockly = await addon.tab.traps.getBlockly();
  const vm = addon.tab.traps.vm;

  const BOOKMARK_MAGIC = " // _bookmark_";
  const BOOKMARK_COMMENT_HEADER = msg("comment-header");

  // Get current editing target
  const getEditingTarget = () => {
    return vm.runtime.getEditingTarget();
  };

  // Find the bookmark comment in the current target
  const findBookmarkComment = () => {
    const target = getEditingTarget();
    if (!target || !target.comments) return null;

    const comments = Object.values(target.comments);
    for (const comment of comments) {
      if (comment.text.includes(BOOKMARK_MAGIC)) {
        return comment;
      }
    }
    return null;
  };

  // Parse bookmark data from comment
  const parseBookmarkComment = () => {
    const comment = findBookmarkComment();
    if (!comment) return [];

    const lineWithMagic = comment.text.split("\n").find((i) => i.endsWith(BOOKMARK_MAGIC));
    if (!lineWithMagic) {
      console.warn("Bookmark comment does not contain valid line");
      return [];
    }

    const jsonText = lineWithMagic.substr(0, lineWithMagic.length - BOOKMARK_MAGIC.length);
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      console.warn("Bookmark comment has invalid JSON", e);
      return [];
    }
  };

  // Save bookmark data to comment
  const saveBookmarkComment = (bookmarks) => {
    const text = `${BOOKMARK_COMMENT_HEADER}\n${JSON.stringify(bookmarks)}${BOOKMARK_MAGIC}`;
    const existingComment = findBookmarkComment();

    if (existingComment) {
      existingComment.text = text;
    } else {
      const target = getEditingTarget();
      if (!target) return;

      target.createComment(
        Math.random() + "",
        null,
        text,
        50,
        50,
        350,
        150,
        false
      );
    }

    // Notify project changed
    vm.runtime.emitProjectChanged();
    if (vm.editingTarget === vm.runtime.getTargetForStage()) {
      vm.emitWorkspaceUpdate();
    }
  };

  // Get the main workspace (similar to Utils.getWorkspace)
  const getWorkspace = () => {
    const currentWorkspace = Blockly.getMainWorkspace();
    if (currentWorkspace.getToolbox()) {
      return currentWorkspace;
    }
    return Blockly.getMainWorkspace();
  };

  // Get current workspace state
  const getWorkspaceState = () => {
    const workspace = getWorkspace();
    const s = workspace.getMetrics();
    return {
      viewLeft: s.viewLeft,
      viewTop: s.viewTop,
      scale: workspace.scale,
      timestamp: Date.now()
    };
  };

  // Restore workspace state (similar to NavigationHistory.goBack)
  const restoreWorkspaceState = (state) => {
    const workspace = getWorkspace();

    // First set the scale
    workspace.setScale(state.scale);

    // Use requestAnimationFrame to ensure the workspace is updated after scale change
    requestAnimationFrame(() => {
      const s = workspace.getMetrics();

      // Then restore the scroll position
      // Calculate scroll position based on current contentLeft/contentTop
      const sx = state.viewLeft - s.contentLeft;
      const sy = state.viewTop - s.contentTop;

      workspace.scrollbar.set(sx, sy);

      // Hide Blockly floating elements
      Blockly.hideChaff();
    });
  };

  let bookmarkButton = null;
  let sidebarContent = null;
  let currentVSCodeLayout = isVSCodeLayoutEnabled();

  // Check if VSCodeLayout is enabled
  const isVSCodeLayout = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('AESettings'));
      return settings && settings.EnableVSCodeLayout;
    } catch (e) {
      return false;
    }
  };

  // Show bookmark in sidebar
  const showBookmarkSidebar = (img) => { //img是图标
    // 如果还没有创建内容，创建并注册
    if (!sidebarContent) {
      sidebarContent = document.createElement("div");
      sidebarContent.className = "sa-bookmark-sidebar-content";

      // 创建书签列表
      const bookmarkList = document.createElement("div");
      bookmarkList.className = "sa-bookmark-list";

      const renderBookmarks = () => {
        bookmarkList.innerHTML = "";
        const bookmarks = parseBookmarkComment();

        if (bookmarks.length === 0) {
          const emptyMessage = document.createElement("div");
          emptyMessage.className = "sa-bookmark-empty";
          emptyMessage.textContent = msg("no-bookmarks");
          bookmarkList.appendChild(emptyMessage);
          return;
        }

        bookmarks.forEach((bookmark, index) => {
          const bookmarkItem = document.createElement("div");
          bookmarkItem.className = "sa-bookmark-item";

          const bookmarkInfo = document.createElement("div");
          bookmarkInfo.className = "sa-bookmark-info";

          const bookmarkName = document.createElement("span");
          bookmarkName.className = "sa-bookmark-name";
          bookmarkName.textContent = bookmark.name || msg("bookmark-default-name", { index: index + 1 });
          bookmarkName.title = msg("edit-bookmark-hint");

          // Make bookmark name editable
          bookmarkName.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "text";
            input.value = bookmark.name || msg("bookmark-default-name", { index: index + 1 });
            input.className = "sa-bookmark-name-input";
            input.classList.add(addon.tab.scratchClass("input_input-form"));

            const saveEdit = () => {
              const newName = input.value.trim();
              bookmark.name = newName || null;
              saveBookmarkComment(bookmarks);
              bookmarkName.textContent = newName || msg("bookmark-default-name", { index: index + 1 });
            };

            input.addEventListener("blur", saveEdit);
            input.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                saveEdit();
              } else if (e.key === "Escape") {
                bookmarkName.textContent = bookmark.name || msg("bookmark-default-name", { index: index + 1 });
              }
            });

            bookmarkName.innerHTML = "";
            bookmarkName.appendChild(input);
            input.focus();
            input.select();
          });

          const bookmarkTime = document.createElement("span");
          bookmarkTime.className = "sa-bookmark-time";
          bookmarkTime.textContent = new Date(bookmark.timestamp).toLocaleString();

          bookmarkInfo.appendChild(bookmarkName);
          bookmarkInfo.appendChild(bookmarkTime);

          const bookmarkActions = document.createElement("div");
          bookmarkActions.className = "sa-bookmark-actions";

          const jumpButton = document.createElement("button");
          jumpButton.className = "sa-bookmark-action-button";
          jumpButton.textContent = msg("jump");
          jumpButton.addEventListener("click", () => {
            restoreWorkspaceState(bookmark.state);
          });

          const deleteButton = document.createElement("button");
          deleteButton.className = "sa-bookmark-action-button sa-bookmark-delete";
          deleteButton.textContent = msg("delete");
          deleteButton.addEventListener("click", () => {
            const bookmarks = parseBookmarkComment();
            bookmarks.splice(index, 1);
            saveBookmarkComment(bookmarks);
            renderBookmarks();
          });

          bookmarkActions.appendChild(jumpButton);
          bookmarkActions.appendChild(deleteButton);

          bookmarkItem.appendChild(bookmarkInfo);
          bookmarkItem.appendChild(bookmarkActions);
          bookmarkList.appendChild(bookmarkItem);
        });
      };

      // 添加书签表单
      const addBookmarkForm = document.createElement("div");
      addBookmarkForm.className = "sa-bookmark-add-form";

      const nameLabel = document.createElement("label");
      nameLabel.textContent = msg("bookmark-name");

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = msg("bookmark-name-placeholder");
      nameInput.className = addon.tab.scratchClass("input_input-form");

      const addButton = document.createElement("button");
      addButton.textContent = msg("add-bookmark");
      addButton.className = addon.tab.scratchClass("prompt_ok-button");

      addButton.addEventListener("click", () => {
        const name = nameInput.value.trim();
        const bookmarks = parseBookmarkComment();
        const newBookmark = {
          name: name || null,
          state: getWorkspaceState(),
          timestamp: Date.now()
        };
        bookmarks.push(newBookmark);
        saveBookmarkComment(bookmarks);
        nameInput.value = "";
        renderBookmarks();
      });

      addBookmarkForm.appendChild(nameLabel);
      addBookmarkForm.appendChild(nameInput);
      addBookmarkForm.appendChild(addButton);

      sidebarContent.appendChild(bookmarkList);
      sidebarContent.appendChild(addBookmarkForm);

      // 注册插件内容和回调
      SideBar.register('bookmark', sidebarContent, {
        onActivate: () => {
          // 激活时添加按钮状态
          if (bookmarkButton) {
            bookmarkButton.classList.add('sa-bookmark-button-active', "is-selected");
            img.style.filter = "grayscale(0%)";
          }
          // 渲染书签列表
          renderBookmarks();
        },
        onDeactivate: () => {
          // 停用时移除按钮状态
          if (bookmarkButton) {
            bookmarkButton.classList.remove('sa-bookmark-button-active', "is-selected");
            img.style.filter = "grayscale(100%)";
          }
        }
      });
    }

    // 切换到书签插件
    SideBar.switchTo('bookmark');
  };

  // Create bookmark modal
  const createBookmarkModal = () => {
    const { backdrop, container, content, closeButton, remove } = addon.tab.createModal(msg("bookmark-title"), {
      isOpen: true,
      useEditorClasses: true
    });
    container.classList.add("sa-bookmark-modal");
    content.classList.add("sa-bookmark-modal-content");
    
    // Check theme after a small delay to ensure DOM is ready
    setTimeout(() => {
      // The theme is handled by CSS variables, no need for JavaScript detection
      console.log('Bookmark plugin - Modal opened');
    }, 10);

    // Create bookmark list
    const bookmarkList = document.createElement("div");
    bookmarkList.className = "sa-bookmark-list";

    let bookmarks = parseBookmarkComment();

    const renderBookmarks = () => {
      bookmarkList.innerHTML = "";
      bookmarks = parseBookmarkComment();

      if (bookmarks.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "sa-bookmark-empty";
        emptyMessage.textContent = msg("no-bookmarks");
        bookmarkList.appendChild(emptyMessage);
        return;
      }

      bookmarks.forEach((bookmark, index) => {
        const bookmarkItem = document.createElement("div");
        bookmarkItem.className = "sa-bookmark-item";

        const bookmarkInfo = document.createElement("div");
        bookmarkInfo.className = "sa-bookmark-info";

        const bookmarkName = document.createElement("span");
        bookmarkName.className = "sa-bookmark-name";
        bookmarkName.textContent = bookmark.name || msg("bookmark-default-name", { index: index + 1 });
        bookmarkName.title = msg("edit-bookmark-hint");

        // Make bookmark name editable
        bookmarkName.addEventListener("click", () => {
          const input = document.createElement("input");
          input.type = "text";
          input.value = bookmark.name || msg("bookmark-default-name", { index: index + 1 });
          input.className = "sa-bookmark-name-input";
          input.classList.add(addon.tab.scratchClass("input_input-form"));

          const saveEdit = () => {
            const newName = input.value.trim();
            bookmark.name = newName || null;
            saveBookmarkComment(bookmarks);
            bookmarkName.textContent = newName || msg("bookmark-default-name", { index: index + 1 });
          };

          input.addEventListener("blur", saveEdit);
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              saveEdit();
            } else if (e.key === "Escape") {
              bookmarkName.textContent = bookmark.name || msg("bookmark-default-name", { index: index + 1 });
            }
          });

          bookmarkName.innerHTML = "";
          bookmarkName.appendChild(input);
          input.focus();
          input.select();
        });

        const bookmarkTime = document.createElement("span");
        bookmarkTime.className = "sa-bookmark-time";
        bookmarkTime.textContent = new Date(bookmark.timestamp).toLocaleString();

        bookmarkInfo.appendChild(bookmarkName);
        bookmarkInfo.appendChild(bookmarkTime);

        const bookmarkActions = document.createElement("div");
        bookmarkActions.className = "sa-bookmark-actions";

        const jumpButton = document.createElement("button");
        jumpButton.className = "sa-bookmark-action-button";
        jumpButton.textContent = msg("jump");
        jumpButton.addEventListener("click", () => {
          restoreWorkspaceState(bookmark.state);
          remove();
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "sa-bookmark-action-button sa-bookmark-delete";
        deleteButton.textContent = msg("delete");
        deleteButton.addEventListener("click", () => {
          bookmarks.splice(index, 1);
          saveBookmarkComment(bookmarks);
          renderBookmarks();
        });

        bookmarkActions.appendChild(jumpButton);
        bookmarkActions.appendChild(deleteButton);

        bookmarkItem.appendChild(bookmarkInfo);
        bookmarkItem.appendChild(bookmarkActions);
        bookmarkList.appendChild(bookmarkItem);
      });
    };

    renderBookmarks();

    // Add bookmark form
    const addBookmarkForm = document.createElement("div");
    addBookmarkForm.className = "sa-bookmark-add-form";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = msg("bookmark-name");

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = msg("bookmark-name-placeholder");
    nameInput.className = addon.tab.scratchClass("input_input-form");

    const addButton = document.createElement("button");
    addButton.textContent = msg("add-bookmark");
    addButton.className = addon.tab.scratchClass("prompt_ok-button");

    addButton.addEventListener("click", () => {
      const name = nameInput.value.trim();
      const newBookmark = {
        name: name || null,
        state: getWorkspaceState(),
        timestamp: Date.now()
      };
      bookmarks.push(newBookmark);
      saveBookmarkComment(bookmarks);
      nameInput.value = "";
      renderBookmarks();
    });

    addBookmarkForm.appendChild(nameLabel);
    addBookmarkForm.appendChild(nameInput);
    addBookmarkForm.appendChild(addButton);

    content.appendChild(bookmarkList);
    content.appendChild(addBookmarkForm);

    // Close handlers
    backdrop.addEventListener("click", () => remove());
    closeButton.addEventListener("click", () => remove());

    // Close on Escape
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        remove();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);
  };

  // Create bookmark button
  const createBookmarkButton = async () => {
    const VSCodeLayout = isVSCodeLayoutEnabled();

    // 检测是否在 VSCodeLayout 下
    const tabBar = await addon.tab.waitForElement('[class*="react-tabs_react-tabs__tab-list"]', {
      markAsSeen: true
    });

    // 等待 bookmarkContainer 出现
    const bookmarkContainer = await addon.tab.waitForElement('.bookmarkContainer', {
      markAsSeen: true
    });

    if (!bookmarkContainer) return;

    bookmarkButton = document.createElement('li');
    bookmarkButton.className = addon.tab.scratchClass('menu-bar_menu-bar-button', {
      others: 'sa-bookmark-button'
    });
    const img = document.createElement('img');

    if (VSCodeLayout) {
      // VSCodeLayout 下使用 SVG 图标
      img.src = icon();
      img.style.filter = "grayscale(100%)";
      img.style.width = '20px';
      img.style.height = '20px';
      img.alt = msg("bookmark-button");
      bookmarkButton.appendChild(img);
    } else {
      // 普通布局下使用文字
      bookmarkButton.textContent = msg("bookmark-button");
    }
    bookmarkButton.title = msg("bookmark-button-tooltip");

    // 禁用时隐藏按钮
    addon.tab.displayNoneWhileDisabled(bookmarkButton);

    bookmarkButton.addEventListener("click", () => {
      // 重新检测布局模式
      currentVSCodeLayout = isVSCodeLayoutEnabled();

      if (currentVSCodeLayout) {
        // VSCode 布局下，切换 sidebar
        if (SideBar.getActivePlugin() === 'bookmark') {
          SideBar.close();
        } else {
          showBookmarkSidebar(img);
        }
      } else {
        // 非 VSCode 布局下，显示 modal
        createBookmarkModal();
      }
    });

    // 将按钮添加到目标位置
    if (VSCodeLayout) {
      // VSCodeLayout 下，按钮应该插入到标签栏（TabList）中
      tabBar.appendChild(bookmarkButton);
    } else {
      // 普通布局下，插入到 bookmarkContainer
      bookmarkContainer.appendChild(bookmarkButton);
    }
  };

  // Create the button
  await createBookmarkButton();
};
