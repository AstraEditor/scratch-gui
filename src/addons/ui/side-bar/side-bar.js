const getSideBar = () => {
    return document.querySelectorAll("[class*=gui_tab-panel]")[0];
}

/**
 * 适用于Addons的侧边栏
 * ## 注意：该侧边栏仅在代码编辑区有效 
 * ```javascript
 * import sidebar from "../../ui/side-bar/side-bar.js"
 * 
 * const sideBar = new SideBar();
 * sideBar.addTab("名字", 元素名);
 * sideBar.open(); // 打开侧边栏
 * 
 * sideBar.close(); // 关闭侧边栏
 * 
 * sideBar.isOpen(); // 侧边栏是否打开
 * 
 * sideBar.removeTab(index); // 删除下标为index的标签页
 * sideBar.switchTab(index); // 切换到下标为index的标签页
 * sideBar.getTabIndex(); // 获取当前选中的标签页索引
 * sideBar.getAllTabs() // 获取所有标签页
 * sideBar.getSelectedIndex(); // 获取当前选中的标签页索引
 * 
 * ```
 * @class
 * @param {Element} element - 侧边栏内渲染元素
 */
export default class SideBar {
    constructor(element) {
        this.DEFAULT_WIDTH = 300;
        this.MIN_WIDTH = 200;
        this.MAX_WIDTH = 600;
        this.currentWidth = this.DEFAULT_WIDTH;

        this.element = document.createElement("div");
        this.element.className = "addons-side-bar";
        this.element.style.cssText = `
            position: relative;
            top: 0;
            left: 0;
            width: ${this.currentWidth}px;
            height: 100%;
            background-color: var(--ui-white);
            z-index: 489;
            display: none;
            flex-direction: column;
        `;

        this.tabs = [];
        this.contents = [];
        this.activeTabIndex = 0;

        this.tabsContainer = document.createElement("div");
        this.tabsContainer.style.cssText = `
            display: flex;
            align-items: stretch;
            background: #2d2d2d;
            min-height: 35px;
            overflow-x: auto;
            overflow-y: hidden;
        `;
        this.element.appendChild(this.tabsContainer);

        this.contentContainer = document.createElement("div");
        this.contentContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            position: relative;
            background: var(--ui-white);
        `;
        this.element.appendChild(this.contentContainer);

        this.resizeHandle = document.createElement("div");
        this.resizeHandle.style.cssText = `
            position: absolute;
            right: 0;
            top: 0;
            width: 4px;
            height: 100%;
            cursor: ew-resize;
            background: transparent;
            z-index: 10;
        `;
        this.resizeHandle.addEventListener("mouseenter", () => {
            this.resizeHandle.style.background = "var(--ui-primary)";
        });
        this.resizeHandle.addEventListener("mouseleave", () => {
            if (!this.isResizing) {
                this.resizeHandle.style.background = "transparent";
            }
        });

        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;

        this.resizeHandle.addEventListener("mousedown", (e) => this.startResize(e));
        document.addEventListener("mousemove", (e) => this.doResize(e));
        document.addEventListener("mouseup", () => this.endResize());

        this.element.appendChild(this.resizeHandle);

        this.extensionButton = document.querySelector("[class*=gui_extension-button-container]");
        // this.extensionButton.style.marginLeft = this.currentWidth + "px";

        if (element) this.addTab("默认", element);

        if (getSideBar()) getSideBar().prepend(this.element);
    }

    addTab(title, content) {
        const tabIndex = this.tabs.length;

        const tab = document.createElement("div");
        tab.style.cssText = `
            display: flex;
            align-items: center;
            padding: 0 12px;
            min-width: 80px;
            max-width: 150px;
            height: 35px;
            cursor: pointer;
            font-size: 13px;
            color: rgba(255,255,255,0.7);
            background: transparent;
            border-right: 1px solid rgba(255,255,255,0.1);
            white-space: nowrap;
            overflow: hidden;
            flex-shrink: 0;
        `;

        const titleSpan = document.createElement("span");
        titleSpan.textContent = title;
        titleSpan.style.cssText = `
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
        `;

        const closeBtn = document.createElement("span");
        closeBtn.textContent = "×";
        closeBtn.style.cssText = `
            margin-left: 8px;
            font-size: 16px;
            opacity: 0;
            transition: opacity 0.15s;
            flex-shrink: 0;
        `;
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.removeTab(tabIndex);
        });

        tab.appendChild(titleSpan);
        tab.appendChild(closeBtn);

        tab.addEventListener("click", () => this.switchTab(tabIndex));
        tab.addEventListener("mouseenter", () => {
            if (tabIndex !== this.activeTabIndex) {
                tab.style.background = "rgba(255,255,255,0.1)";
            }
            closeBtn.style.opacity = "1";
        });
        tab.addEventListener("mouseleave", () => {
            if (tabIndex !== this.activeTabIndex) {
                tab.style.background = "transparent";
                closeBtn.style.opacity = "0";
            }
        });

        this.tabsContainer.appendChild(tab);
        this.tabs.push({ element: tab, closeBtn, titleSpan });

        const contentWrapper = document.createElement("div");
        contentWrapper.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
        `;
        contentWrapper.appendChild(content);
        this.contentContainer.appendChild(contentWrapper);
        this.contents.push(contentWrapper);

        if (this.tabs.length === 1) {
            this.switchTab(0);
        }

        return tabIndex;
    }

    removeTab(index) {
        if (this.tabs.length <= 1) {
            this.close();
            return;
        }

        const wasActive = index === this.activeTabIndex;

        this.tabs[index].element.remove();
        this.contents[index].remove();
        this.tabs.splice(index, 1);
        this.contents.splice(index, 1);

        this.tabs.forEach((tabData, i) => {
            const tab = tabData.element;
            tab.onclick = null;
            tab.addEventListener("click", () => this.switchTab(i));
        });

        if (wasActive) {
            const newIndex = Math.min(index, this.tabs.length - 1);
            this.switchTab(newIndex);
        } else if (this.activeTabIndex > index) {
            this.activeTabIndex--;
        }
    }

    switchTab(index) {
        if (index < 0 || index >= this.tabs.length) return;

        this.tabs.forEach((tabData, i) => {
            const tab = tabData.element;
            const closeBtn = tabData.closeBtn;
            if (i === index) {
                tab.style.background = "var(--ui-white)";
                tab.style.color = "var(--ui-text)";
                tab.style.borderTop = "2px solid var(--ui-primary)";
                tab.style.marginTop = "0";
                tab.style.paddingTop = "0";
                closeBtn.style.opacity = "1";
            } else {
                tab.style.background = "transparent";
                tab.style.color = "rgba(255,255,255,0.7)";
                tab.style.borderTop = "none";
                tab.style.marginTop = "0";
                tab.style.paddingTop = "0";
                closeBtn.style.opacity = "0";
            }
        });

        this.contents.forEach((content, i) => {
            content.style.display = i === index ? "block" : "none";
        });

        this.activeTabIndex = index;
    }

    startResize(e) {
        this.isResizing = true;
        this.startX = e.clientX;
        this.startWidth = this.currentWidth;
        this.resizeHandle.style.background = "var(--ui-primary)";
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
    }

    doResize(e) {
        if (!this.isResizing) return;

        const deltaX = e.clientX - this.startX;
        this.currentWidth = Math.max(
            this.MIN_WIDTH,
            Math.min(this.MAX_WIDTH, this.startWidth + deltaX)
        );
        this.element.style.width = `${this.currentWidth}px`;
        this.extensionButton.style.marginLeft = this.currentWidth + "px";
    }

    endResize() {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle.style.background = "transparent";
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.dispatchEvent(new Event("resize"));
        }
    }

    open() {
        this.element.style.display = "flex";
    }

    close() {
        this.element.style.display = "none";
        window.dispatchEvent(new Event("resize"));
    }

    isOpen() {
        return this.element.style.display !== "none";
    }

    getWidth() {
        return this.currentWidth;
    }

    getTabIndex() {
        return this.activeTabIndex;
    }

    getAllTabs() {
        return this.tabs;
    }
    
    getSelectedIndex() {
        return this.activeTabIndex;
    }
}
