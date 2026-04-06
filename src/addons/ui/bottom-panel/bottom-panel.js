/**
 * 工作区下方面板组件 - 简化版
 * 移除所有复杂的自动调整逻辑，只保留基本功能
 */
class BottomPanelInternal {
    constructor() {
        this.DEFAULT_HEIGHT = 200;
        this.MIN_HEIGHT = 100;
        this.MAX_HEIGHT = 500;
        this.currentHeight = this.DEFAULT_HEIGHT;

        // 创建按钮栏容器（独立于面板，常显）
        this.buttonBar = document.createElement("div");
        this.buttonBar.className = "addons-bottom-panel-button-bar";
        this.buttonBar.style.cssText = `
            display: flex;
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

        this.resizeHandle = document.createElement("div");
        this.resizeHandle.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            cursor: ns-resize;
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

        this.insertToDOM();
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
     * 获取按钮栏容器
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
    
            // 停止 MutationObserver
                    if (this._tabObserver) {
                        this._tabObserver.disconnect();
                        this._tabObserver = null;
                    }
            
                    // 移除 DOM 元素
                    if (this.element && this.element.parentNode) {
                        this.element.parentNode.removeChild(this.element);
                    }
                }
    startResize(e) {
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.currentHeight;
        this.resizeHandle.style.background = "var(--ui-primary)";
        document.body.style.cursor = "ns-resize";
        document.body.style.userSelect = "none";
    }

    doResize(e) {
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
        // 使用 CSS 类控制 buttonBar 样式，而不是移动 DOM
        this.buttonBar.classList.add('bottom-panel-open');
        this.buttonBar.style.borderTop = "none";
        this.buttonBar.style.borderBottom = "1px solid var(--ui-black-transparent)";
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
     * 获取按钮栏容器
     */
    static getButtonBar() {
        if (!instance) {
            instance = new BottomPanelInternal();
        }
        return instance.getButtonBar();
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