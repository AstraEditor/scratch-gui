import reduxInstance from '../../redux.js';
import './bottom-panel.css';

/**
 * 工作区下方面板组件 - 简化版
 * 移除所有复杂的自动调整逻辑，只保留基本功能
 */

// 项目加载相关的 action 类型
const PROJECT_LOAD_ACTIONS = [
    'scratch-gui/project-state/DONE_CREATING_NEW',
    'scratch-gui/project-state/DONE_LOADING_VM_WITH_ID',
    'scratch-gui/project-state/DONE_LOADING_VM_WITHOUT_ID',
    'scratch-gui/project-state/DONE_REMIXING',
    'scratch-gui/project-state/START_CREATING_NEW',
    'scratch-gui/project-state/START_LOADING_VM_FILE_UPLOAD'
];

class BottomPanelInternal {
    constructor() {
        this.DEFAULT_HEIGHT = 200;
        this.MIN_HEIGHT = 100;
        this.MAX_HEIGHT = 500;
        this.currentHeight = this.DEFAULT_HEIGHT;

        // 创建按钮栏容器（独立于面板）
        this.buttonBar = document.createElement("div");
        this.buttonBar.className = "addons-bottom-panel-button-bar";
        this.buttonBar.style.cssText = `
            display: none;
            gap: 0;
            background: var(--ui-white);
            border-top: 1px solid var(--ui-black-transparent);
            flex-shrink: 0;
            position: relative;
        `;

        this.element = document.createElement("div");
        this.element.className = "addons-bottom-panel";
        this.element.style.cssText = `
            position: relative;
            bottom: 0;
            left: 0;
            width: 100%;
            height: ${this.currentHeight}px;
            max-height: ${this.MAX_HEIGHT}px;
            min-height: ${this.MIN_HEIGHT}px;
            background-color: var(--ui-white);
            z-index: 489;
            display: none;
            flex-direction: column;
            flex-shrink: 0;
            border-top: 1px solid var(--ui-black-transparent);
            min-height: 0;
        `;

        this.contentContainer = document.createElement("div");
        this.contentContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            position: relative;
            background: var(--ui-white);
            padding: 10px;
            min-height: 0;
        `;
        this.element.appendChild(this.contentContainer);

        // 拖拽手柄现在放在按钮栏的上边缘
        this.resizeHandle = document.createElement("div");
        this.resizeHandle.style.cssText = `
            position: absolute;
            top: -2px;
            left: 0;
            width: 100%;
            height: 4px;
            cursor: ns-resize;
            pointer-events: none;
            background: transparent;
            z-index: 10;
        `;

        this.isResizing = false;
        this.startY = 0;
        this.startHeight = 0;

        // 绑定方法以便后续移除
        this._boundStartResize = (e) => this.startResize(e);
        this._boundDoResize = (e) => this.doResize(e);
        this._boundEndResize = () => this.endResize();
        this._boundHandleMouseEnter = () => {
            this.resizeHandle.style.background = "var(--looks-secondary)";
        };
        this._boundHandleMouseLeave = () => {
            // 检查是否正在角落拖拽（通过检查 Sidebar 的状态）
            const isCornerResizing = window.aeResizeHandles?.sideBar?.instance?._cornerResizing;
            if (!this.isResizing && !isCornerResizing) {
                this.resizeHandle.style.background = "transparent";
            }
            // 确保在角落拖拽时保持高亮
            if (isCornerResizing) {
                this.resizeHandle.style.background = "var(--looks-secondary)";
            }
        };

        this.resizeHandle.addEventListener("mouseenter", this._boundHandleMouseEnter);
        this.resizeHandle.addEventListener("mouseleave", this._boundHandleMouseLeave);
        this.resizeHandle.addEventListener("mousedown", this._boundStartResize);
        document.addEventListener("mousemove", this._boundDoResize);
        document.addEventListener("mouseup", this._boundEndResize);

        // 将拖拽手柄添加到按钮栏，而不是主面板
        this.buttonBar.appendChild(this.resizeHandle);

        // 注册到全局对象以支持角落检测
        if (!window.aeResizeHandles) {
            window.aeResizeHandles = {};
        }
        window.aeResizeHandles.bottomPanel = {
            instance: this,
            isOpen: () => this.isOpen(),
            resize: (deltaY) => {
                this.currentHeight = Math.max(
                    this.MIN_HEIGHT,
                    Math.min(this.MAX_HEIGHT, this.currentHeight + deltaY)
                );
                this.element.style.height = `${this.currentHeight}px`;
                this.element.style.maxHeight = `${this.currentHeight}px`;
            }
        };

        // 角落检测相关的状态
        this._inCorner = false;
        this._cornerResizing = false;

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

        this.insertToDOM();

        // 监听项目加载事件，在重载或打开新作品时自动关闭底部面板
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
     * 检查按钮栏是否有按钮（不包含resizeHandle）
     */
    hasButtons() {
        // resizeHandle 是按钮栏的第一个子元素，所以检查是否有其他子元素
        return this.buttonBar.children.length > 1;
    }

    /**
     * 更新按钮栏显示状态
     */
    updateButtonBarVisibility() {
        if (this.hasButtons()) {
            this.buttonBar.style.display = "flex";
        } else {
            this.buttonBar.style.display = "none";
        }
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
     * 检测是否启用VSCode布局
     */
    isVSCodeLayout() {
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

    /**

         * 插入到DOM中

         */

    insertToDOM() {
        const editorWrapper = document.querySelector("[class*=editor-wrapper]");
        const backpackContainer = document.querySelector("[class^='backpack_backpack-container']");

        if (editorWrapper) {
            // 确定插入位置：在背包容器之前插入
            const insertBeforeElement = backpackContainer;

            // 确保按钮栏被插入到背包容器之前
            if (!editorWrapper.contains(this.buttonBar)) {
                if (insertBeforeElement) {
                    editorWrapper.insertBefore(this.buttonBar, insertBeforeElement);
                } else {
                    // 如果背包容器不存在，添加到末尾
                    editorWrapper.appendChild(this.buttonBar);
                }
                console.log("BottomPanel button bar inserted");
            }

            // 确保主面板被插入到背包容器之前
            if (!editorWrapper.contains(this.element)) {
                if (insertBeforeElement) {
                    editorWrapper.insertBefore(this.element, insertBeforeElement);
                } else {
                    // 如果背包容器不存在，添加到末尾
                    editorWrapper.appendChild(this.element);
                }
                console.log("BottomPanel main panel inserted");
            }
        } else {
            // 如果editor-wrapper不存在，延迟重试
            console.log("editor-wrapper not found, retrying...");
            setTimeout(() => this.insertToDOM(), 100);
        }
    }

    /**
     * 设置面板内容
     */
    setContent(content) {
        this.clearContent();
        this.contentContainer.appendChild(content);
    }

    /**
     * 清空面板内容
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
     * 获取按钮栏容器（添加按钮后自动更新显示状态）
     */
    getButtonBar() {
        return this.buttonBar;
    }

    /**
     * 销毁面板实例
     */
    destroy() {
        // 移除事件监听器
        this.resizeHandle.removeEventListener("mouseenter", this._boundHandleMouseEnter);
        this.resizeHandle.removeEventListener("mouseleave", this._boundHandleMouseLeave);
        this.resizeHandle.removeEventListener("mousedown", this._boundStartResize);
        document.removeEventListener("mousemove", this._boundDoResize);
        document.removeEventListener("mouseup", this._boundEndResize);

        // 从全局对象中移除 BottomPanel 的引用
        if (window.aeResizeHandles && window.aeResizeHandles.bottomPanel) {
            delete window.aeResizeHandles.bottomPanel;
        }

        // 停止 MutationObserver
        if (this._tabObserver) {
            this._tabObserver.disconnect();
            this._tabObserver = null;
        }

        // 移除 Redux 事件监听器
        if (this._boundHandleProjectLoad) {
            reduxInstance.removeEventListener('statechanged', this._boundHandleProjectLoad);
            this._boundHandleProjectLoad = null;
        }

        // 移除 DOM 元素
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
    startResize(e) {
        // 面板折叠时不允许拖拽
        if (!this.isOpen()) {
            return;
        }

        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.currentHeight;
        this.resizeHandle.style.background = "var(--looks-secondary)";
        document.body.style.cursor = "ns-resize";
        document.body.style.userSelect = "none";
    }

    doResize(e) {
        // 角落拖拽由 Sidebar 处理，完全退出
        if (window.aeResizeHandles?.sideBar?.instance?._cornerResizing) {
            return;
        }

        if (!this.isResizing) return;

        const deltaY = this.startY - e.clientY;
        this.currentHeight = Math.max(
            this.MIN_HEIGHT,
            Math.min(this.MAX_HEIGHT, this.startHeight + deltaY)
        );
        this.element.style.height = `${this.currentHeight}px`;
        this.element.style.maxHeight = `${this.currentHeight}px`;
    }

    endResize() {
        // 角落拖拽由 Sidebar 处理，完全退出
        if (window.aeResizeHandles?.sideBar?.instance?._cornerResizing) {
            return;
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle.style.background = "transparent";
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.dispatchEvent(new Event("resize"));
        }
        // 触发自定义事件通知 sidebar 更新高度
        window.dispatchEvent(new CustomEvent('bottomPanelResized', { detail: { height: this.currentHeight } }));
    }

    open() {
        this.element.style.display = "flex";
        // 更新按钮栏显示状态
        this.updateButtonBarVisibility();
        // 使用 CSS 类控制 buttonBar 样式，而不是移动 DOM
        this.buttonBar.classList.add('bottom-panel-open');
        this.buttonBar.style.borderTop = "none";
        this.buttonBar.style.borderBottom = "1px solid var(--ui-black-transparent)";
        // 启用拖拽手柄
        this.resizeHandle.style.pointerEvents = "auto";
        this.resizeHandle.style.cursor = "ns-resize";
        window.dispatchEvent(new Event("resize"));
        // 触发自定义事件通知 sidebar 更新高度
        window.dispatchEvent(new CustomEvent('bottomPanelOpened'));
    }

    close() {
        this.element.style.display = "none";
        // 使用 CSS 类控制 buttonBar 样式，而不是移动 DOM
        this.buttonBar.classList.remove('bottom-panel-open');
        this.buttonBar.style.borderTop = "1px solid var(--ui-black-transparent)";
        this.buttonBar.style.borderBottom = "none";
        // 禁用拖拽手柄
        this.resizeHandle.style.pointerEvents = "none";
        this.resizeHandle.style.cursor = "default";
        // 更新按钮栏显示状态（可能没有按钮）
        this.updateButtonBarVisibility();
        window.dispatchEvent(new Event("resize"));
        // 触发自定义事件通知 sidebar 更新高度
        window.dispatchEvent(new CustomEvent('bottomPanelClosed'));
    }

    isOpen() {
        return this.element.style.display !== "none";
    }

    getHeight() {
        return this.currentHeight;
    }
}

// 全局单例实例
let instance = null;

// 插件注册表：pluginName -> { content, callbacks }
const pluginRegistry = new Map();

// 当前活动的插件名称
let activePlugin = null;

/**
 * 工作区下方面板 - 静态方法接口
 */
export default class BottomPanel {
    constructor(element) {
        // 如果传入元素，使用兼容模式
        if (element) {
            if (!instance) {
                instance = new BottomPanelInternal();
            }
            instance.setContent(element);
            instance.open();
            return instance;
        }

        // 如果没有传入元素，返回全局实例（用于静态方法调用）
        if (!instance) {
            instance = new BottomPanelInternal();
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
                onActivate: callbacks.onActivate || (() => { }),
                onDeactivate: callbacks.onDeactivate || (() => { })
            }
        });
    }

    /**
     * 切换到指定插件
     */
    static switchTo(pluginName) {
        if (!instance) {
            instance = new BottomPanelInternal();
        }

        const plugin = pluginRegistry.get(pluginName);
        if (!plugin) {
            console.warn(`BottomPanel: Plugin "${pluginName}" not registered`);
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
     * 关闭面板
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
     * 打开面板（保持当前内容）
     */
    static open() {
        if (!instance) {
            instance = new BottomPanelInternal();
        }
        instance.open();
    }

    /**
     * 检查面板是否打开
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
            instance = new BottomPanelInternal();
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
     * 获取按钮栏容器（添加按钮后需要调用 updateButtonBarVisibility）
     */
    static getButtonBar() {
        if (!instance) {
            instance = new BottomPanelInternal();
        }
        return instance.getButtonBar();
    }

    /**
     * 更新按钮栏显示状态（在添加或移除按钮后调用）
     */
    static updateButtonBarVisibility() {
        if (!instance) {
            instance = new BottomPanelInternal();
        }
        instance.updateButtonBarVisibility();
    }

    /**
     * 获取高度（兼容旧 API）
     */
    static getHeight() {
        return instance ? instance.getHeight() : 200;
    }

    /**
     * 销毁面板（仅用于彻底清理）
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
