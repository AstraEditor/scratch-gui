const getSideBar = () => {
    return document.querySelectorAll("[class*=gui_tab-panel]")[0];
}

// 单例实例
let instance = null;

/**
 * 适用于Addons的侧边栏
 * ## 注意：该侧边栏仅在代码编辑区有效 
 * ```javascript
 * import sidebar from "../../ui/side-bar/side-bar.js"
 * 
 * const sideBar = new SideBar();
 * sideBar.setContent(element);
 * sideBar.open(); // 打开侧边栏
 * 
 * sideBar.close(); // 关闭侧边栏
 * 
 * sideBar.isOpen(); // 侧边栏是否打开
 * 
 * sideBar.clearContent(); // 清空内容
 * sideBar.getWidth(); // 获取当前宽度
 * 
 * ```
 * @class
 * @param {Element} element - 侧边栏内渲染元素（可选）
 */
export default class SideBar {
    constructor(element) {
        // 销毁旧实例
        if (instance) {
            instance.destroy();
        }
        instance = this;

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

        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;

        // 绑定方法以便后续移除
        this._boundStartResize = (e) => this.startResize(e);
        this._boundDoResize = (e) => this.doResize(e);
        this._boundEndResize = () => this.endResize();
        this._boundHandleMouseEnter = () => {
            this.resizeHandle.style.background = "var(--ui-primary)";
        };
        this._boundHandleMouseLeave = () => {
            if (!this.isResizing) {
                this.resizeHandle.style.background = "transparent";
            }
        };

        this.resizeHandle.addEventListener("mouseenter", this._boundHandleMouseEnter);
        this.resizeHandle.addEventListener("mouseleave", this._boundHandleMouseLeave);
        this.resizeHandle.addEventListener("mousedown", this._boundStartResize);
        document.addEventListener("mousemove", this._boundDoResize);
        document.addEventListener("mouseup", this._boundEndResize);

        this.element.appendChild(this.resizeHandle);

        this.extensionButton = document.querySelector("[class*=gui_extension-button-container]");

        if (element) this.setContent(element);

        if (getSideBar()) getSideBar().prepend(this.element);
    }

    /**
     * 设置侧边栏内容
     * @param {Element} content - 要显示的内容元素
     */
    setContent(content) {
        this.clearContent();
        this.contentContainer.appendChild(content);
    }

    /**
     * 清空侧边栏内容
     */
    clearContent() {
        this.contentContainer.innerHTML = "";
    }

    /**
     * 获取内容容器（方便直接操作）
     */
    getContentContainer() {
        return this.contentContainer;
    }

    /**
     * 销毁侧边栏实例
     */
    destroy() {
        // 移除事件监听器
        this.resizeHandle.removeEventListener("mouseenter", this._boundHandleMouseEnter);
        this.resizeHandle.removeEventListener("mouseleave", this._boundHandleMouseLeave);
        this.resizeHandle.removeEventListener("mousedown", this._boundStartResize);
        document.removeEventListener("mousemove", this._boundDoResize);
        document.removeEventListener("mouseup", this._boundEndResize);

        // 重置 extensionButton
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = "0px";
        }

        // 移除 DOM 元素
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        instance = null;
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
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = this.currentWidth + "px";
        }
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
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = this.currentWidth + "px";
        }
        window.dispatchEvent(new Event("resize"));
    }

    close() {
        this.element.style.display = "none";
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = "0px";
        }
        window.dispatchEvent(new Event("resize"));
    }

    isOpen() {
        return this.element.style.display !== "none";
    }

    getWidth() {
        return this.currentWidth;
    }
}
