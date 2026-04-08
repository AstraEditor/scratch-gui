import reduxInstance from '../../redux.js';

const getSideBar = () => {
    return document.querySelectorAll("[class*=gui_tab-panel]")[0];
}

// 全局单例实例
let instance = null;

// 项目加载相关的 action 类型
const PROJECT_LOAD_ACTIONS = [
    'scratch-gui/project-state/DONE_CREATING_NEW',
    'scratch-gui/project-state/DONE_LOADING_VM_WITH_ID',
    'scratch-gui/project-state/DONE_LOADING_VM_WITHOUT_ID',
    'scratch-gui/project-state/DONE_REMIXING',
    'scratch-gui/project-state/START_CREATING_NEW',
    'scratch-gui/project-state/START_LOADING_VM_FILE_UPLOAD'
];

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
            flex: 0 0 auto;
            background-color: var(--ui-white);
            z-index: 489;
            display: none;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
            height: 100%;
        `;

        this.contentContainer = document.createElement("div");
        this.contentContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
            background: var(--ui-white);
            min-height: 0;
            max-height: 100%;
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

        // 使用防抖函数处理频繁的布局更新请求
        this._debounceTimer = null;
        this._scheduleUpdate = () => {
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
            }
            this._debounceTimer = setTimeout(() => {
                this.updateHeight();
                this._debounceTimer = null;
            }, 100);
        };

        // 监听 Bottom Panel 的自定义事件，用于在 Bottom Panel 打开/关闭时触发布局更新
        this._boundHandleBottomPanelEvent = () => {
            this._scheduleUpdate();
        };
        window.addEventListener('bottomPanelResized', this._boundHandleBottomPanelEvent);
        window.addEventListener('bottomPanelOpened', this._boundHandleBottomPanelEvent);
        window.addEventListener('bottomPanelClosed', this._boundHandleBottomPanelEvent);

        // 监听项目加载事件，在重载或打开新作品时自动关闭侧边栏
        this._boundHandleProjectLoad = (e) => {
            const { action } = e.detail;
            if (PROJECT_LOAD_ACTIONS.includes(action.type) && this.isOpen()) {
                // 调用当前活动插件的 onDeactivate 回调
                if (activePlugin) {
                    const plugin = pluginRegistry.get(activePlugin);
                    if (plugin && plugin.callbacks.onDeactivate) {
                        plugin.callbacks.onDeactivate();
                    }
                    activePlugin = null;
                }
                this.close();
            }
        };
        reduxInstance.addEventListener('statechanged', this._boundHandleProjectLoad);
    }

    /**
     * 更新侧边栏布局
     * 由于使用 height: 100%，主要确保内容容器正确处理滚动
     */
    updateHeight() {
        // 只在 Sidebar 打开时更新
        if (!this.isOpen()) return;

        // 确保内容容器的样式正确
        this.contentContainer.style.flex = '1';
        this.contentContainer.style.minHeight = '0';
        this.contentContainer.style.overflowY = 'auto';
        this.contentContainer.style.overflowX = 'hidden';

        // 触发一次重排，让浏览器重新计算布局
        void this.element.offsetHeight;
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

        // 停止 MutationObserver
        if (this._tabObserver) {
            this._tabObserver.disconnect();
            this._tabObserver = null;
        }

        // 清除防抖定时器
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        // 移除 bottomPanel 自定义事件监听器
        window.removeEventListener('bottomPanelResized', this._boundHandleBottomPanelEvent);
        window.removeEventListener('bottomPanelOpened', this._boundHandleBottomPanelEvent);
        window.removeEventListener('bottomPanelClosed', this._boundHandleBottomPanelEvent);
        this._boundHandleBottomPanelEvent = null;

        // 移除 Redux 事件监听器
        if (this._boundHandleProjectLoad) {
            reduxInstance.removeEventListener('statechanged', this._boundHandleProjectLoad);
            this._boundHandleProjectLoad = null;
        }

        // 重置 extensionButton
        if (this.extensionButton) {
            this.extensionButton.style.marginLeft = "0px";
            this.extensionButton.style.left = "0px";
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