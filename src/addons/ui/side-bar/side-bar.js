const getSideBar = () => {
    return document.querySelectorAll("[class*=gui_tab-panel]")[0];
}

// 全局单例实例
let instance = null;

// 插件注册表：pluginName -> { content, callbacks }
const pluginRegistry = new Map();

// 当前活动的插件名称
let activePlugin = null;

export default class SideBar {
    constructor(element) {
        // 如果传入元素，使用旧 API 模式
        if (element) {
            // 确保实例存在
            if (!instance) {
                instance = new SideBarInternal();
            }
            // 直接设置内容并打开
            instance.setContent(element);
            instance.open();
            // 返回实例，以便兼容旧代码
            return instance;
        }

        // 如果没有传入元素，返回全局实例（用于静态方法调用）
        if (!instance) {
            instance = new SideBarInternal();
        }
        return instance;
    }

    /**
     * 注册插件内容和回调
     */
    static register(pluginName, content, callbacks = {}) {
        pluginRegistry.set(pluginName, {
            content,
            callbacks: {
                onActivate: callbacks.onActivate || (() => {}),
                onDeactivate: callbacks.onDeactivate || (() => {})
            }
        });
    }

    /**
     * 切换到指定插件
     */
    static switchTo(pluginName) {
        if (!instance) {
            instance = new SideBarInternal();
        }

        const plugin = pluginRegistry.get(pluginName);
        if (!plugin) {
            console.warn(`SideBar: Plugin "${pluginName}" not registered`);
            return;
        }

        // 如果当前有活动插件，先停用它
        if (activePlugin && activePlugin !== pluginName) {
            const currentPlugin = pluginRegistry.get(activePlugin);
            if (currentPlugin && currentPlugin.callbacks.onDeactivate) {
                currentPlugin.callbacks.onDeactivate();
            }
        }

        // 切换到新插件
        instance.setContent(plugin.content);
        instance.open();
        activePlugin = pluginName;

        // 调用新插件的激活回调
        if (plugin.callbacks.onActivate) {
            plugin.callbacks.onActivate();
        }
    }

    /**
     * 关闭侧边栏
     */
    static close() {
        if (!instance) return;

        // 停用当前活动插件
        if (activePlugin) {
            const plugin = pluginRegistry.get(activePlugin);
            if (plugin && plugin.callbacks.onDeactivate) {
                plugin.callbacks.onDeactivate();
            }
            activePlugin = null;
        }

        instance.close();
    }

    /**
     * 打开侧边栏（保持当前内容）
     */
    static open() {
        if (!instance) {
            instance = new SideBarInternal();
        }
        instance.open();
    }

    /**
     * 检查侧边栏是否打开
     */
    static isOpen() {
        return instance ? instance.isOpen() : false;
    }

    /**
     * 获取当前活动插件名称
     */
    static getActivePlugin() {
        return activePlugin;
    }

    /**
     * 设置内容（兼容旧 API）
     */
    static setContent(content) {
        if (!instance) {
            instance = new SideBarInternal();
        }
        instance.setContent(content);
    }

    /**
     * 清空内容（兼容旧 API）
     */
    static clearContent() {
        if (!instance) return;
        instance.clearContent();
    }

    /**
     * 获取内容容器（兼容旧 API）
     */
    static getContentContainer() {
        return instance ? instance.getContentContainer() : null;
    }

    /**
     * 获取宽度（兼容旧 API）
     */
    static getWidth() {
        return instance ? instance.getWidth() : 300;
    }

    /**
     * 销毁侧边栏（仅用于彻底清理）
     */
    static destroy() {
        if (!instance) return;

        // 停用所有插件
        pluginRegistry.forEach((plugin) => {
            if (plugin.callbacks.onDeactivate) {
                plugin.callbacks.onDeactivate();
            }
        });

        activePlugin = null;
        instance.destroy();
        instance = null;
    }
}

/**
 * SideBar 内部实现类
 */
class SideBarInternal {
    constructor() {
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
            flex-shrink: 0;
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

        // 监听标签页切换
        this._boundHandleTabChange = () => {
            if (this.isOpen() && this.isCostumeTabOpen()) {
                this.close();
                this.wasOpenBefore = true;
            } else if (!this.isOpen() && this.wasOpenBefore && !this.isCostumeTabOpen()) {
                this.wasOpenBefore = false;
                this.open();
            }
        };

        // 使用MutationObserver监听tab-panel的class变化
        this._tabObserver = new MutationObserver(() => {
            this._boundHandleTabChange();
        });

        setTimeout(() => {
            const tabPanel = document.querySelector("[class*=gui_tab-panel]");
            if (tabPanel) {
                this._tabObserver.observe(tabPanel, {
                    attributes: true,
                    attributeFilter: ['class']
                });
            }
        }, 1000);

        this.wasOpenBefore = false;

        this.extensionButton = document.querySelector("[class*=gui_extension-button-container]");

        if (getSideBar()) getSideBar().prepend(this.element);

        // 监听父元素高度变化
        this._boundUpdateHeight = () => this.updateHeight();
        this._resizeObserver = new ResizeObserver(() => {
            this._boundUpdateHeight();
        });

        // 监听父元素和 editor-wrapper 的高度变化
        setTimeout(() => {
            const tabPanel = getSideBar();
            const editorWrapper = document.querySelector("[class*=editor-wrapper]");
            if (tabPanel) {
                this._resizeObserver.observe(tabPanel);
            }
            if (editorWrapper) {
                this._resizeObserver.observe(editorWrapper);
            }
            // 初始化高度
            this.updateHeight();
        }, 100);

        // 监听 Bottom Panel 的打开/关闭
        this._bottomPanelObserver = new MutationObserver(() => {
            this.updateHeight();
        });

        // 监听 buttonBar 的父元素变化（在 editor-wrapper 和 bottomPanel 之间移动）
        this._buttonBarObserver = new MutationObserver(() => {
            this.updateHeight();
        });

        setTimeout(() => {
            const bottomPanel = document.querySelector(".addons-bottom-panel");
            if (bottomPanel) {
                this._bottomPanelObserver.observe(bottomPanel, {
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }

            const buttonBar = document.querySelector(".addons-bottom-panel-button-bar");
            if (buttonBar) {
                this._buttonBarObserver.observe(buttonBar, {
                    childList: true,
                    subtree: true
                });
            }
        }, 2000);

        // 延迟初始化，确保 DOM 完全准备好
        setTimeout(() => this.updateHeight(), 500);

        // 监听 bottomPanel 的自定义事件
        this._boundHandleBottomPanelEvent = () => {
            this.updateHeight();
        };
        window.addEventListener('bottomPanelResized', this._boundHandleBottomPanelEvent);
        window.addEventListener('bottomPanelOpened', this._boundHandleBottomPanelEvent);
        window.addEventListener('bottomPanelClosed', this._boundHandleBottomPanelEvent);
    }

    /**
     * 更新侧边栏高度
     */
    updateHeight() {
        // 只在 Sidebar 打开时更新高度
        if (!this.isOpen()) return;

        const tabPanel = getSideBar();
        if (!tabPanel) return;

        // 使用 offsetHeight 获取 tabPanel 的高度
        const tabPanelHeight = tabPanel.offsetHeight;

        if (tabPanelHeight < 100) return;

        // 获取 Bottom Panel 的高度（如果打开）
        const bottomPanel = document.querySelector(".addons-bottom-panel");
        let bottomPanelHeight = 0;
        if (bottomPanel && bottomPanel.style.display !== "none") {
            bottomPanelHeight = bottomPanel.offsetHeight;
        }

        // 计算可用高度：tabPanel 高度减去 bottomPanel
        // 注意：buttonBar 在底部时不影响 tabPanel 的高度
        let availableHeight = tabPanelHeight - bottomPanelHeight;

        // 确保最小高度
        availableHeight = Math.max(100, availableHeight);

        // 限制最大高度不超过窗口高度
        const finalHeight = Math.min(availableHeight, window.innerHeight);

        // 更新侧边栏高度
        this.element.style.height = `${finalHeight}px`;

        // 调试日志
        console.log('Sidebar updateHeight:', {
            tabPanelHeight,
            bottomPanelHeight,
            availableHeight,
            finalHeight
        });
    }

    /**
     * 检测CostumeTab是否打开
     */
    isCostumeTabOpen() {
        // 检查是否在costume标签页
        const costumeTab = document.querySelector("[class*='costume-tab']");
        if (costumeTab) {
            const style = window.getComputedStyle(costumeTab);
            if (style.display !== 'none') {
                return true;
            }
        }
        return false;
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
     * 获取内容容器
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

        // 停止 ResizeObserver
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        // 停止 Bottom Panel Observer
        if (this._bottomPanelObserver) {
            this._bottomPanelObserver.disconnect();
            this._bottomPanelObserver = null;
        }

        // 停止 ButtonBar Observer
        if (this._buttonBarObserver) {
            this._buttonBarObserver.disconnect();
            this._buttonBarObserver = null;
        }

        // 停止 MutationObserver
        if (this._tabObserver) {
            this._tabObserver.disconnect();
            this._tabObserver = null;
        }

        // 移除 bottomPanel 自定义事件监听器
        window.removeEventListener('bottomPanelResized', this._boundHandleBottomPanelEvent);
        window.removeEventListener('bottomPanelOpened', this._boundHandleBottomPanelEvent);
        window.removeEventListener('bottomPanelClosed', this._boundHandleBottomPanelEvent);
        this._boundHandleBottomPanelEvent = null;

        // 重置 extensionButton
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = "0px";
        }

        // 移除 DOM 元素
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
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
        }
        this.updateHeight();
    }

    open() {
        this.element.style.display = "flex";
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = this.currentWidth + "px";
        }
        this.updateHeight();
    }

    close() {
        this.element.style.display = "none";
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = "0px";
        }
        this.updateHeight();
    }

    isOpen() {
        return this.element.style.display !== "none";
    }

    getWidth() {
        return this.currentWidth;
    }
}