import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";
import SideBar from "../../ui/side-bar/side-bar.js";
import icon from "!../../../lib/tw-recolor/build!./logo.svg";
import iconSidebar from "!../../../lib/tw-recolor/build!./icon-sidebar.svg";
import iconBottom from "!../../../lib/tw-recolor/build!./icon-bottom.svg";
import iconWindow from "!../../../lib/tw-recolor/build!./icon-window.svg";
import iconContinue from "!../../../lib/tw-recolor/build!./icon-continue.svg";
import iconExport from "!../../../lib/tw-recolor/build!./icon-export.svg";
import iconSetting from "!../../../lib/tw-recolor/build!./icon-setting.svg";
import { setup as setupDebugger, setPaused as setPausedDebugger } from "./module.js";
import aeVersion from "../../../lib/ae-version.js";

const clamp = (i, min, max) => Math.max(min, Math.min(max, i));

/*
  todo:
  1.允许获取上一行输出
  2.允许输出内容不合并
  3.允许不换行输出
  4.BBCode支持
*/

/**
 * 节流函数 - 限制函数执行频率
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, wait) {
  let timeout = null;
  let lastExecTime = 0;
  
  return function(...args) {
    const currentTime = Date.now();
    const remaining = wait - (currentTime - lastExecTime);
    
    if (remaining <= 0) {
      clearTimeout(timeout);
      timeout = null;
      lastExecTime = currentTime;
      return func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        lastExecTime = Date.now();
        func.apply(this, args);
      }, remaining);
    }
  };
}

class TerminalVirtualList {
  constructor(options = {}) {

    this.rows = [];
    this.renderedStartIndex = -1;
    this.renderedEndIndex = -1;
    this.visible = false;
    this.isScrolledToEnd = true;
    this.scrollTop = 0;
    this.height = 0;
    this.rowHeight = 16;

    this.updateContentQueued = false;
    this.scrollToEndQueued = false;
    this.pendingLogs = [];
    this.batchScheduled = false;

    this.outerElement = document.createElement("div");
    this.outerElement.className = "sa-terminal-output";

    this.innerElement = document.createElement("div");
    this.innerElement.className = "sa-terminal-output-inner";
    this.outerElement.appendChild(this.innerElement);

    this.outerElement.addEventListener("scroll", this._handleScroll.bind(this), { passive: true });
  }

  _handleScroll(e) {
    this.scrollTop = e.target.scrollTop;
    this.isScrolledToEnd = e.target.scrollTop + 5 >= e.target.scrollHeight - e.target.clientHeight;
    this.height = e.target.clientHeight;
    this._updateContent();
  }

  _queueUpdateContent() {
    if (this.visible && !this.updateContentQueued) {
      this.updateContentQueued = true;
      queueMicrotask(() => {
        this.updateContentQueued = false;
        this._updateContent();
      });
    }
  }

  _scrollToEnd() {
    const scrollEnd = this.outerElement.scrollHeight - this.outerElement.offsetHeight;
    this.outerElement.scrollTop = scrollEnd;
    this.scrollTop = scrollEnd;
  }

  _queueScrollToEnd() {
    if (this.visible && !this.scrollToEndQueued) {
      this.scrollToEndQueued = true;
      queueMicrotask(() => {
        this.scrollToEndQueued = false;
        this._scrollToEnd();
      });
    }
  }

  show() {
    this.visible = true;
    this.height = this.outerElement.clientHeight || 400;
    this.renderedStartIndex = -1;
    this.renderedEndIndex = -1;
    this._updateContent();
    this._scrollToEnd();
  }

  hide() {
    this.visible = false;
  }

  clear() {
    this.rows.length = 0;
    this.innerElement.innerHTML = "";
    this.renderedStartIndex = -1;
    this.renderedEndIndex = -1;
    this.scrollTop = 0;
    this.isScrolledToEnd = true;
  }

  removeLastRow() {
    if (this.rows.length === 0) return false;
    this.rows.pop();
    this.renderedStartIndex = -1;
    this.renderedEndIndex = -1;
    this._updateContent();
    return true;
  }

  _updateContent() {
    if (this.rows.length === 0) {
      if (this.innerElement.children.length > 0) {
        this.innerElement.innerHTML = "";
      }
      this.renderedStartIndex = -1;
      this.renderedEndIndex = -1;
      return;
    }

    let viewHeight = this.outerElement.clientHeight;
    if (viewHeight === 0) {
      viewHeight = this.height || 400;
    }
    this.height = viewHeight;
    
    const totalHeight = this.rows.length * this.rowHeight;
    this.innerElement.style.height = `${totalHeight}px`;

    const scrollStartIndex = Math.floor(this.scrollTop / this.rowHeight);
    const rowsVisible = Math.ceil(viewHeight / this.rowHeight);
    const EXTRA_ROWS_ABOVE = 5;
    const EXTRA_ROWS_BELOW = 5;
    const startIndex = clamp(scrollStartIndex - EXTRA_ROWS_ABOVE, 0, this.rows.length);
    const endIndex = clamp(scrollStartIndex + rowsVisible + EXTRA_ROWS_BELOW, 0, this.rows.length);

    if (this.renderedStartIndex === startIndex && this.renderedEndIndex === endIndex) {
      return;
    }

    const existingElements = new Map();
    for (const child of this.innerElement.children) {
      const idx = parseInt(child.dataset.index, 10);
      if (!isNaN(idx)) {
        existingElements.set(idx, child);
      }
    }

    const neededIndices = new Set();
    for (let i = startIndex; i < endIndex; i++) {
      neededIndices.add(i);
    }

    for (const [idx, element] of existingElements) {
      if (!neededIndices.has(idx)) {
        element.remove();
      }
    }

    for (let i = startIndex; i < endIndex; i++) {
      const row = this.rows[i];
      let element = existingElements.get(i);

      if (!element && row.element) {
        element = row.element;
        element.style.position = "absolute";
        element.style.left = "10px";
        element.style.right = "10px";
        element.style.boxSizing = "border-box";
        element.style.height = `${this.rowHeight}px`;
        element.style.overflow = "hidden";
        this.innerElement.appendChild(element);
      }

      if (element) {
        element.style.top = `${i * this.rowHeight}px`;
        element.dataset.index = i;
      }
    }

    this.renderedStartIndex = startIndex;
    this.renderedEndIndex = endIndex;
  }

  appendLog(log) {
    this.pendingLogs.push(log);
    this._scheduleBatchUpdate();
  }

  _scheduleBatchUpdate() {
    if (!this.batchScheduled) {
      this.batchScheduled = true;
      queueMicrotask(() => {
        this.batchScheduled = false;
        this._flushPendingLogs();
      });
    }
  }

  _flushPendingLogs() {
    if (this.pendingLogs.length === 0) return;

    const logsToAdd = this.pendingLogs;
    this.pendingLogs = [];

    for (const log of logsToAdd) {
      this.rows.push(log);
    }

    if (this.visible) {
      this._queueUpdateContent();
      if (this.isScrolledToEnd) {
        this._queueScrollToEnd();
      }
    } else {
      this.renderedStartIndex = -1;
      this.renderedEndIndex = -1;
      this.isScrolledToEnd = true;
    }
  }
}

export default async function ({ addon, console, msg }) {
  const vm = addon.tab.traps.vm;

  // 初始化debugger模块
  setupDebugger(addon);

  // Terminal 位置类型
  const POSITION_TYPES = {
    SIDEBAR: 'sidebar',
    BOTTOM_PANEL: 'bottom',
    WINDOW: 'window'
  };

  // localStorage 键名
  const POSITION_STORAGE_KEY = 'AETerminalPosition';

  // 从 localStorage 读取保存的位置
  function loadSavedPosition() {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved && Object.values(POSITION_TYPES).includes(saved)) {
        if (saved === POSITION_TYPES.SIDEBAR) {
          const settings = localStorage.getItem("AESettings");
          if (settings) {
            const parsed = JSON.parse(settings);
            if (parsed.EnableVSCodeLayout !== true) {
              return POSITION_TYPES.BOTTOM_PANEL;
            }
          } else {
            return POSITION_TYPES.BOTTOM_PANEL;
          }
        }
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return POSITION_TYPES.BOTTOM_PANEL;
  }

  // 保存位置到 localStorage
  function savePosition(newPosition) {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, newPosition);
    } catch (e) {
      // ignore
    }
  }

  // 当前 Terminal 位置（从 localStorage 读取或默认底部面板）
  let currentPosition = loadSavedPosition();

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

  // 独立窗口相关变量
  let floatingWindow = null;
  let isDraggingWindow = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let windowCloseButton = null;
  
  // 窗口大小调整相关变量
  let isResizing = false;
  let resizeDirection = '';
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let resizeStartLeft = 0;
  let resizeStartTop = 0;
  
  // 调整大小的方向
  const RESIZE_DIRECTIONS = {
    TOP: 'top',
    BOTTOM: 'bottom',
    LEFT: 'left',
    RIGHT: 'right',
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right'
  };
  
  // 调整大小的阈值
  const RESIZE_THRESHOLD = 8;

  // 创建独立窗口
  function createFloatingWindow() {
    if (floatingWindow) return floatingWindow;

    floatingWindow = document.createElement("div");
    floatingWindow.className = "sa-terminal-floating-window";
    floatingWindow.style.cssText = `
      position: absolute;
      top: 100px;
      left: 100px;
      width: 600px;
      height: 400px;
      min-width: 400px;
      min-height: 300px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      display: none; /* 初始隐藏，只在需要时显示 */
      flex-direction: column;
      overflow: hidden;
    `;

    // 创建关闭按钮
    windowCloseButton = document.createElement("button");
    windowCloseButton.className = "sa-terminal-window-close-button";
    windowCloseButton.textContent = "×";
    windowCloseButton.style.cssText = `
      background: none;
      border: none;
      color: inherit;
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      margin-left: 8px;
    `;
    windowCloseButton.style.display = "none"; // 默认隐藏，只在独立窗口模式显示
    windowCloseButton.addEventListener("click", () => {
      toggleTerminal(false);
    });

    document.body.appendChild(floatingWindow);
    return floatingWindow;
  }

  function handleWindowDrag(e) {
    if (!isDraggingWindow) return;
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    floatingWindow.style.left = Math.max(0, x) + "px";
    floatingWindow.style.top = Math.max(0, y) + "px";
  }

  function stopWindowDrag() {
    isDraggingWindow = false;
    document.removeEventListener("mousemove", handleWindowDrag);
    document.removeEventListener("mouseup", stopWindowDrag);
  }
  
  // 处理窗口调整大小
  function handleWindowResize(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;
    
    let newWidth = resizeStartWidth;
    let newHeight = resizeStartHeight;
    let newLeft = resizeStartLeft;
    let newTop = resizeStartTop;
    
    // 根据调整方向计算新的大小和位置
    switch (resizeDirection) {
      case RESIZE_DIRECTIONS.LEFT:
        newWidth = Math.max(400, resizeStartWidth - deltaX);
        newLeft = resizeStartLeft + deltaX;
        break;
      case RESIZE_DIRECTIONS.RIGHT:
        newWidth = Math.max(400, resizeStartWidth + deltaX);
        break;
      case RESIZE_DIRECTIONS.TOP:
        newHeight = Math.max(300, resizeStartHeight - deltaY);
        newTop = resizeStartTop + deltaY;
        break;
      case RESIZE_DIRECTIONS.BOTTOM:
        newHeight = Math.max(300, resizeStartHeight + deltaY);
        break;
      case RESIZE_DIRECTIONS.TOP_LEFT:
        newWidth = Math.max(400, resizeStartWidth - deltaX);
        newHeight = Math.max(300, resizeStartHeight - deltaY);
        newLeft = resizeStartLeft + deltaX;
        newTop = resizeStartTop + deltaY;
        break;
      case RESIZE_DIRECTIONS.TOP_RIGHT:
        newWidth = Math.max(400, resizeStartWidth + deltaX);
        newHeight = Math.max(300, resizeStartHeight - deltaY);
        newTop = resizeStartTop + deltaY;
        break;
      case RESIZE_DIRECTIONS.BOTTOM_LEFT:
        newWidth = Math.max(400, resizeStartWidth - deltaX);
        newHeight = Math.max(300, resizeStartHeight + deltaY);
        newLeft = resizeStartLeft + deltaX;
        break;
      case RESIZE_DIRECTIONS.BOTTOM_RIGHT:
        newWidth = Math.max(400, resizeStartWidth + deltaX);
        newHeight = Math.max(300, resizeStartHeight + deltaY);
        break;
    }
    
    // 应用新的大小和位置
    if (floatingWindow) {
      floatingWindow.style.width = newWidth + "px";
      floatingWindow.style.height = newHeight + "px";
      floatingWindow.style.left = newLeft + "px";
      floatingWindow.style.top = newTop + "px";
    }
  }
  
  // 停止调整大小
  function stopWindowResize() {
    isResizing = false;
    resizeDirection = '';
    document.removeEventListener("mousemove", handleWindowResize);
    document.removeEventListener("mouseup", stopWindowResize);
    if (floatingWindow) {
      floatingWindow.style.cursor = "";
    }
  }
  
  // 检测调整大小的方向
  function getResizeDirection(e) {
    if (!floatingWindow) return '';
    
    const rect = floatingWindow.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 检测边角
    if (x <= RESIZE_THRESHOLD && y <= RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.TOP_LEFT;
    }
    if (x >= rect.width - RESIZE_THRESHOLD && y <= RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.TOP_RIGHT;
    }
    if (x <= RESIZE_THRESHOLD && y >= rect.height - RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.BOTTOM_LEFT;
    }
    if (x >= rect.width - RESIZE_THRESHOLD && y >= rect.height - RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.BOTTOM_RIGHT;
    }
    
    // 检测边
    if (x <= RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.LEFT;
    }
    if (x >= rect.width - RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.RIGHT;
    }
    if (y <= RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.TOP;
    }
    if (y >= rect.height - RESIZE_THRESHOLD) {
      return RESIZE_DIRECTIONS.BOTTOM;
    }
    
    return '';
  }
  
  // 更新鼠标样式
  function updateCursorStyle(e) {
    if (!floatingWindow) return;
    
    const direction = getResizeDirection(e);
    let cursor = "";
    
    switch (direction) {
      case RESIZE_DIRECTIONS.TOP_LEFT:
      case RESIZE_DIRECTIONS.BOTTOM_RIGHT:
        cursor = "nwse-resize";
        break;
      case RESIZE_DIRECTIONS.TOP_RIGHT:
      case RESIZE_DIRECTIONS.BOTTOM_LEFT:
        cursor = "nesw-resize";
        break;
      case RESIZE_DIRECTIONS.LEFT:
      case RESIZE_DIRECTIONS.RIGHT:
        cursor = "ew-resize";
        break;
      case RESIZE_DIRECTIONS.TOP:
      case RESIZE_DIRECTIONS.BOTTOM:
        cursor = "ns-resize";
        break;
      default:
        // 检查是否在标题栏区域
        const rect = floatingWindow.getBoundingClientRect();
        const y = e.clientY - rect.top;
        cursor = (y <= 30) ? "move" : "";
    }
    
    floatingWindow.style.cursor = cursor;
  }

  // 切换 Terminal 位置
  function switchTerminalPosition(newPosition) {
    if (newPosition === currentPosition) return;

    // 先关闭当前位置
    closeTerminalAtPosition(currentPosition);

    // 切换到新位置
    currentPosition = newPosition;
    savePosition(newPosition);
    openTerminalAtPosition(newPosition);

    // 更新切换按钮状态
    updatePositionSwitchButton();

    // 更新启用按钮位置
    updateToggleButtonPosition();

    // 发送 resize 事件
    window.dispatchEvent(new Event("resize"));
  }

  // 在指定位置打开 Terminal
  function openTerminalAtPosition(position) {
    switch (position) {
      case POSITION_TYPES.SIDEBAR:
        SideBar.switchTo('terminal');
        break;
      case POSITION_TYPES.BOTTOM_PANEL:
        BottomPanel.switchTo('terminal');
        break;
      case POSITION_TYPES.WINDOW:
        const window = createFloatingWindow();
        window.style.display = "flex";

        // 添加 terminalContainer 到窗口
        window.appendChild(terminalContainer);
        terminalContainer.style.flex = "1";
        terminalContainer.style.overflow = "auto";

        // 启用虚拟列表
        virtualList.show();

        // 在独立窗口模式下，terminalHeader 作为拖拽标题栏
        terminalHeader.style.cursor = "move";
        terminalHeader.style.userSelect = "none";

        // 显示关闭按钮
        if (windowCloseButton) {
          windowCloseButton.style.display = "block";
        }

        // 启用拖拽功能
        terminalHeader.addEventListener("mousedown", handleWindowDragStart);
        
        // 在整个窗口上添加 mousedown 事件监听器，用于调整大小
        floatingWindow.addEventListener("mousedown", handleWindowResizeStart);
        
        // 添加鼠标移动事件监听器，用于更新鼠标样式
        floatingWindow.addEventListener("mousemove", updateCursorStyle);
        break;
    }
  }

  // 关闭指定位置的 Terminal
  function closeTerminalAtPosition(position) {
    switch (position) {
      case POSITION_TYPES.SIDEBAR:
        SideBar.close();
        break;
      case POSITION_TYPES.BOTTOM_PANEL:
        BottomPanel.close();
        break;
      case POSITION_TYPES.WINDOW:
        if (floatingWindow) {
          if (terminalContainer.parentNode === floatingWindow) {
            virtualList.hide();
            floatingWindow.removeChild(terminalContainer);
          }
          floatingWindow.style.display = "none";

          // 恢复 terminalHeader 样式
          terminalHeader.style.cursor = "";
          terminalHeader.style.userSelect = "";

          // 隐藏关闭按钮
          if (windowCloseButton) {
            windowCloseButton.style.display = "none";
          }

          // 禁用拖拽功能
          terminalHeader.removeEventListener("mousedown", handleWindowDragStart);
          floatingWindow.removeEventListener("mousedown", handleWindowResizeStart);
          
          // 移除鼠标移动事件监听器
          floatingWindow.removeEventListener("mousemove", updateCursorStyle);
        }
        break;
    }
  }

  // 处理窗口拖拽开始
  function handleWindowDragStart(e) {
    // 不在拖拽按钮上开始拖拽
    if (e.target.tagName === "BUTTON") return;
    
    // 直接进行窗口拖拽
    isDraggingWindow = true;
    dragOffsetX = e.clientX - floatingWindow.offsetLeft;
    dragOffsetY = e.clientY - floatingWindow.offsetTop;
    document.addEventListener("mousemove", handleWindowDrag);
    document.addEventListener("mouseup", stopWindowDrag);
  }
  
  // 处理窗口调整大小开始（在整个窗口）
  function handleWindowResizeStart(e) {
    // 不在按钮上开始调整大小
    if (e.target.tagName === "BUTTON") return;
    
    // 检查是否在窗口边缘（调整大小）
    const direction = getResizeDirection(e);
    if (direction) {
      isResizing = true;
      resizeDirection = direction;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartWidth = floatingWindow.offsetWidth;
      resizeStartHeight = floatingWindow.offsetHeight;
      resizeStartLeft = floatingWindow.offsetLeft;
      resizeStartTop = floatingWindow.offsetTop;
      
      document.addEventListener("mousemove", handleWindowResize);
      document.addEventListener("mouseup", stopWindowResize);
    }
  }

  // 切换 Terminal 显示/隐藏
  function toggleTerminal(show) {
    if (show === undefined) {
      show = !isTerminalVisible();
    }

    if (show) {
      openTerminalAtPosition(currentPosition);
    } else {
      closeTerminalAtPosition(currentPosition);
    }
  }

  // 检查 Terminal 是否可见
  function isTerminalVisible() {
    switch (currentPosition) {
      case POSITION_TYPES.SIDEBAR:
        return SideBar.isOpen() && SideBar.getActivePlugin() === 'terminal';
      case POSITION_TYPES.BOTTOM_PANEL:
        return BottomPanel.isOpen() && BottomPanel.getActivePlugin() === 'terminal';
      case POSITION_TYPES.WINDOW:
        return floatingWindow && floatingWindow.style.display !== "none";
      default:
        return false;
    }
  }

  // 等待项目加载完成
  await new Promise((resolve, reject) => {
    if (vm.editingTarget) return resolve();
    vm.runtime.once("PROJECT_LOADED", resolve);
  });

  // 创建终端容器
  const switchToSprite = (targetId) => {
    if (targetId !== vm.editingTarget.id) {
      const target = vm.runtime.getTargetById(targetId);
      if (target) {
        vm.setEditingTarget(targetId);
      }
    }
  };

  // 激活代码选项卡
  const activateCodeTab = () => {
    const redux = addon.tab.redux;
    if (redux.state.scratchGui.editorTab.activeTabIndex !== 0) {
      redux.dispatch({
        type: "scratch-gui/navigation/ACTIVATE_TAB",
        activeTabIndex: 0,
      });
    }
  };

  // 定位到指定块
  const goToBlock = async (blockId) => {
    const ScratchBlocks = await addon.tab.traps.getBlockly();
    const workspace = ScratchBlocks.getMainWorkspace();
    const block = workspace.getBlockById(blockId);
    if (!block || block.workspace.isFlyout) return;
    
    workspace.centerOnBlock(blockId);
    block.select();
  };

  // 创建跳转到块的链接
  const createBlockLink = (targetInfo, blockId) => {
    const link = document.createElement("a");
    link.className = "sa-terminal-block-link";
    
    const { exists, name, originalId } = targetInfo;
    link.textContent = name;
    link.title = msg("block-link-title") || "点击跳转到积木";
    
    if (exists && originalId) {
      link.addEventListener("mousedown", () => {
        switchToSprite(originalId);
        activateCodeTab();
        goToBlock(blockId);
      });
    } else {
      link.classList.add("sa-terminal-block-link-unknown");
    }
    
    return link;
  };

  // 获取目标信息
  const getTargetInfoById = (id) => {
    const target = vm.runtime.getTargetById(id);
    if (target) {
      let name = target.getName();
      let original = target;
      if (!target.isOriginal) {
        name = `克隆体 (${name})`;
        original = target.sprite.clones[0];
      }
      return {
        exists: true,
        originalId: original ? original.id : null,
        name,
      };
    }
    return {
      exists: false,
      originalId: null,
      name: "（未知角色）",
    };
  };

  // 创建终端容器
  const terminalContainer = document.createElement("div");
  addon.tab.displayNoneWhileDisabled(terminalContainer, { display: "flex" });
  terminalContainer.className = "sa-terminal-container";

  // 创建终端头部
  const terminalHeader = document.createElement("div");
  terminalHeader.className = "sa-terminal-header";

  const terminalTitle = document.createElement("span");
  terminalTitle.className = "sa-terminal-title";
  terminalTitle.textContent = "AstraEditor Terminal";

  // 创建继续按钮（默认隐藏）
  const continueButton = document.createElement("button");
  continueButton.className = "sa-terminal-continue-button";
  continueButton.title = msg("button-continue") || "继续运行";

  continueButton.style.display = "none";

  // 为继续按钮添加SVG图标
  const continueBtnIcon = document.createElement("img");
  // 使用正确的图标导入方式
  continueBtnIcon.src = iconContinue();
  continueBtnIcon.style.width = "16px";
  continueBtnIcon.style.height = "16px";
  continueBtnIcon.style.filter = "grayscale(100%)";
  continueButton.appendChild(continueBtnIcon);



  continueButton.addEventListener("click", () => {
    setPausedDebugger(false);
    continueButton.style.display = "none";
  });

  // 创建导出日志按钮
  const exportButton = document.createElement("button");
  exportButton.className = "sa-terminal-export-button";
  exportButton.title = msg("button-export") || "导出日志";


  // 为导出按钮添加SVG图标
  const exportBtnIcon = document.createElement("img");
  // 使用正确的图标导入方式
  exportBtnIcon.src = iconExport();
  exportBtnIcon.style.width = "16px";
  exportBtnIcon.style.height = "16px";
  exportBtnIcon.style.filter = "grayscale(100%)";
  exportButton.appendChild(exportBtnIcon);



  // 导出日志功能
  const exportLogs = () => {
    const logs = [];
    for (const row of virtualList.rows) {
      if (row.element) {
        logs.push(row.element.textContent);
      }
    }
    const content = logs.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  exportButton.addEventListener("click", exportLogs);

  // 创建设置按钮
  const settingsButton = document.createElement("button");
  settingsButton.className = "sa-terminal-settings-button";
  settingsButton.title = msg("button-settings") || "设置";

  const settingsBtnIcon = document.createElement("img");
  settingsBtnIcon.src = iconSetting();
  settingsBtnIcon.style.cssText = `
    width: 16px;
    height: 16px;
    filter: grayscale(100%);
  `;
  settingsButton.appendChild(settingsBtnIcon);

  // 设置界面状态
  let isSettingsVisible = false;

  // 创建设置界面
  const settingsPanel = document.createElement("div");
  settingsPanel.className = "sa-terminal-settings-panel";
  settingsPanel.style.cssText = `
    display: none;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: 12px;
  `;

  // 设置界面标题栏
  const settingsHeader = document.createElement("div");
  settingsHeader.className = "sa-terminal-settings-header";
  settingsHeader.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #3c3c3c;
  `;

  const backButton = document.createElement("button");
  backButton.className = "sa-terminal-back-button";
  backButton.style.cssText = `
    background: none;
    border: 1px solid var(--ui-black-transparent);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    color: var(--ui-text-primary);
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
  `;
  backButton.textContent = msg("button-back") || "← 返回";

  const settingsTitle = document.createElement("span");
  settingsTitle.style.cssText = `
    font-weight: bold;
    color: #ffffff;
    font-size: 14px;
  `;
  settingsTitle.textContent = msg("settings-title") || "控制台设置";

  settingsHeader.appendChild(backButton);
  settingsHeader.appendChild(settingsTitle);
  settingsPanel.appendChild(settingsHeader);

  // 设置内容区域
  const settingsContent = document.createElement("div");
  settingsContent.className = "sa-terminal-settings-content";
  settingsContent.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;

  // 控制台报错开关设置
  const consoleErrorSwitchContainer = document.createElement("div");
  consoleErrorSwitchContainer.className = "sa-terminal-setting-item";
  consoleErrorSwitchContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #2d2d2d;
    border-radius: 6px;
  `;

  const consoleErrorLabel = document.createElement("span");
  consoleErrorLabel.style.cssText = `
    color: #d4d4d4;
    font-size: 13px;
  `;
  consoleErrorLabel.textContent = msg("setting-console-error") || "在终端中显示控制台报错";

  const consoleErrorSwitch = document.createElement("label");
  consoleErrorSwitch.className = "sa-terminal-switch";
  consoleErrorSwitch.style.cssText = `
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  `;

  const consoleErrorSwitchInput = document.createElement("input");
  consoleErrorSwitchInput.type = "checkbox";
  consoleErrorSwitchInput.className = "sa-terminal-switch-input";
  consoleErrorSwitchInput.style.cssText = `
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  `;

  const consoleErrorSwitchBackground = document.createElement("span");
  consoleErrorSwitchBackground.className = "sa-terminal-switch-background";
  consoleErrorSwitchBackground.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #555555;
    transition: 0.3s;
    border-radius: 22px;
  `;

  const consoleErrorSwitchSlider = document.createElement("span");
  consoleErrorSwitchSlider.className = "sa-terminal-switch-slider";
  consoleErrorSwitchSlider.style.cssText = `
    position: absolute;
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
    z-index: 1;
  `;

  consoleErrorSwitchInput.addEventListener("change", (e) => {
    if (e.target.checked) {
      consoleErrorSwitchBackground.style.backgroundColor = "var(--looks-secondary)";
      consoleErrorSwitchSlider.style.transform = "translateX(18px)";
      enableConsoleErrorInterceptor();
      saveSettings({ consoleErrorEnabled: true });
    } else {
      consoleErrorSwitchBackground.style.backgroundColor = "#555555";
      consoleErrorSwitchSlider.style.transform = "translateX(0)";
      disableConsoleErrorInterceptor();
      saveSettings({ consoleErrorEnabled: false });
    }
  });

  consoleErrorSwitch.appendChild(consoleErrorSwitchInput);
  consoleErrorSwitch.appendChild(consoleErrorSwitchBackground);
  consoleErrorSwitch.appendChild(consoleErrorSwitchSlider);
  consoleErrorSwitchContainer.appendChild(consoleErrorLabel);
  consoleErrorSwitchContainer.appendChild(consoleErrorSwitch);
  settingsContent.appendChild(consoleErrorSwitchContainer);

  // 折叠相同内容开关设置
  const mergeOutputSwitchContainer = document.createElement("div");
  mergeOutputSwitchContainer.className = "sa-terminal-setting-item";
  mergeOutputSwitchContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #2d2d2d;
    border-radius: 6px;
  `;

  const mergeOutputLabel = document.createElement("span");
  mergeOutputLabel.style.cssText = `
    color: #d4d4d4;
    font-size: 13px;
  `;
  mergeOutputLabel.textContent = msg("setting-merge-output") || "折叠相同内容输出";

  const mergeOutputSwitch = document.createElement("label");
  mergeOutputSwitch.className = "sa-terminal-switch";
  mergeOutputSwitch.style.cssText = `
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  `;

  const mergeOutputSwitchInput = document.createElement("input");
  mergeOutputSwitchInput.type = "checkbox";
  mergeOutputSwitchInput.className = "sa-terminal-switch-input";
  mergeOutputSwitchInput.style.cssText = `
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  `;

  const mergeOutputSwitchBackground = document.createElement("span");
  mergeOutputSwitchBackground.className = "sa-terminal-switch-background";
  mergeOutputSwitchBackground.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #555555;
    transition: 0.3s;
    border-radius: 22px;
  `;

  const mergeOutputSwitchSlider = document.createElement("span");
  mergeOutputSwitchSlider.className = "sa-terminal-switch-slider";
  mergeOutputSwitchSlider.style.cssText = `
    position: absolute;
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
    z-index: 1;
  `;

  mergeOutputSwitchInput.addEventListener("change", (e) => {
    if (e.target.checked) {
      mergeOutputSwitchBackground.style.backgroundColor = "var(--looks-secondary)";
      mergeOutputSwitchSlider.style.transform = "translateX(18px)";
      enableMergeOutput();
      saveSettings({ mergeOutputEnabled: true });
    } else {
      mergeOutputSwitchBackground.style.backgroundColor = "#555555";
      mergeOutputSwitchSlider.style.transform = "translateX(0)";
      disableMergeOutput();
      saveSettings({ mergeOutputEnabled: false });
    }
  });

  mergeOutputSwitch.appendChild(mergeOutputSwitchInput);
  mergeOutputSwitch.appendChild(mergeOutputSwitchBackground);
  mergeOutputSwitch.appendChild(mergeOutputSwitchSlider);
  mergeOutputSwitchContainer.appendChild(mergeOutputLabel);
  mergeOutputSwitchContainer.appendChild(mergeOutputSwitch);
  settingsContent.appendChild(mergeOutputSwitchContainer);

  settingsPanel.appendChild(settingsContent);

  // 切换显示设置界面（完全替代整个 Terminal 面板）
  const showSettingsPanel = () => {
    isSettingsVisible = true;
    terminalHeader.style.display = "none";
    terminalOutput.style.display = "none";
    settingsPanel.style.display = "flex";
  };

  const hideSettingsPanel = () => {
    isSettingsVisible = false;
    terminalHeader.style.display = "";
    terminalOutput.style.display = "";
    settingsPanel.style.display = "none";
  };

  settingsButton.addEventListener("click", showSettingsPanel);
  backButton.addEventListener("click", hideSettingsPanel);

  // 创建位置切换按钮容器
  const positionSwitchContainer = document.createElement("div");
  positionSwitchContainer.className = "sa-terminal-position-switch";
  positionSwitchContainer.style.cssText = `
    display: flex;
    gap: 4px;
    align-items: center;
    position: relative;
  `;



  // 位置标题映射
  const positionTitles = {
    [POSITION_TYPES.SIDEBAR]: msg("position-sidebar") || "侧边栏",
    [POSITION_TYPES.BOTTOM_PANEL]: msg("position-bottom") || "底部面板",
    [POSITION_TYPES.WINDOW]: msg("position-window") || "独立窗口"
  };

  // 更新位置图标映射（重新生成SVG数据）
  function updatePositionIcons() {
    return {
      [POSITION_TYPES.SIDEBAR]: iconSidebar(),
      [POSITION_TYPES.BOTTOM_PANEL]: iconBottom(),
      [POSITION_TYPES.WINDOW]: iconWindow()
    };
  }

  // 位置图标映射
  let positionIcons = updatePositionIcons();

  // 创建轮换按钮
  const rotateButton = document.createElement("button");
  rotateButton.className = "sa-terminal-rotate-button";
  const switchPositionTitle = msg("button-switch-position") || "Current position: %s (click to switch)";
  rotateButton.title = switchPositionTitle.replace("%s", positionTitles[currentPosition]);
  rotateButton.style.cssText = `
    background: none;
    border: 1px solid var(--ui-black-transparent);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    color: var(--ui-text-primary);
    min-width: 32px;
  `;

  // 添加SVG图标
  const rotateBtnIcon = document.createElement("img");
  rotateBtnIcon.src = positionIcons[currentPosition];
  rotateBtnIcon.style.width = "16px";
  rotateBtnIcon.style.height = "16px";
  rotateBtnIcon.style.filter = "grayscale(100%)";
  rotateButton.appendChild(rotateBtnIcon);

  // 点击轮换按钮切换到下一个位置
  rotateButton.addEventListener("click", () => {
    const positions = [POSITION_TYPES.SIDEBAR, POSITION_TYPES.BOTTOM_PANEL, POSITION_TYPES.WINDOW];
    const currentIndex = positions.indexOf(currentPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    const nextPosition = positions[nextIndex];
    
    // 检查是否可以使用 VSCode 布局
    if (nextPosition === POSITION_TYPES.SIDEBAR && !isVSCodeLayoutEnabled()) {
      // 如果侧边栏不可用，跳过它
      const nextNextIndex = (nextIndex + 1) % positions.length;
      switchTerminalPosition(positions[nextNextIndex]);
    } else {
      switchTerminalPosition(nextPosition);
    }
  });

  positionSwitchContainer.appendChild(rotateButton);

  // 创建浮窗容器
  const popupContainer = document.createElement("div");
  popupContainer.className = "sa-terminal-position-popup";
  popupContainer.style.cssText = `
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    border: 1px solid var(--ui-black-transparent);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px;
    display: none;
    flex-direction: column;
    gap: 2px;
    z-index: 1000;
    min-width: 120px;
  `;

  // 创建浮窗中的位置按钮
  const createPopupButton = (type, iconFunction, title) => {
    const button = document.createElement("button");
    button.className = "sa-terminal-popup-button";
    button.dataset.position = type;
    button.style.cssText = `
      background: none;
      border: none;
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      color: var(--ui-text-primary);
      text-align: left;
      display: flex;
      align-items: center;
      font-family: inherit;
      gap: 8px;
    `;

    // 添加SVG图标
    const img = document.createElement("img");
    img.src = iconFunction();
    img.style.width = "16px";
    img.style.height = "16px";
    img.style.filter = "grayscale(100%)";
    button.appendChild(img);

    // 添加文本
    const text = document.createElement("span");
    text.textContent = title;
    button.appendChild(text);

    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = "var(--ui-primary-transparent)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = "none";
    });

    button.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止触发轮换按钮的点击
      const targetPosition = button.dataset.position;
      if (targetPosition !== currentPosition) {
        switchTerminalPosition(targetPosition);
      }
      // 隐藏浮窗
      popupContainer.style.display = "none";
    });

    return button;
  };

  const sidebarPopupButton = createPopupButton(
    POSITION_TYPES.SIDEBAR,
    iconSidebar,
    msg("position-sidebar") || "侧边栏"
  );

  const bottomPopupButton = createPopupButton(
    POSITION_TYPES.BOTTOM_PANEL,
    iconBottom,
    msg("position-bottom") || "底部面板"
  );

  const windowPopupButton = createPopupButton(
    POSITION_TYPES.WINDOW,
    iconWindow,
    msg("position-window") || "独立窗口"
  );

  popupContainer.appendChild(sidebarPopupButton);
  popupContainer.appendChild(bottomPopupButton);
  popupContainer.appendChild(windowPopupButton);
  positionSwitchContainer.appendChild(popupContainer);

  // 鼠标悬浮显示浮窗
  let popupTimeout = null;

  rotateButton.addEventListener("mouseenter", () => {
    clearTimeout(popupTimeout);
    popupContainer.style.display = "flex";
  });

  positionSwitchContainer.addEventListener("mouseleave", () => {
    popupTimeout = setTimeout(() => {
      popupContainer.style.display = "none";
    }, 200);
  });

  popupContainer.addEventListener("mouseenter", () => {
    clearTimeout(popupTimeout);
  });

  popupContainer.addEventListener("mouseleave", () => {
    popupTimeout = setTimeout(() => {
      popupContainer.style.display = "none";
    }, 200);
  });

  // 更新位置切换按钮状态
  function updatePositionSwitchButton() {
    // 重新生成图标数据
    positionIcons = updatePositionIcons();
    
    // 更新轮换按钮的图标
    rotateBtnIcon.src = positionIcons[currentPosition];
    rotateButton.title = `当前位置: ${positionTitles[currentPosition]} (点击轮换)`;

    // 更新浮窗按钮的状态
    const popupButtons = popupContainer.querySelectorAll(".sa-terminal-popup-button");
    popupButtons.forEach(button => {
      if (button.dataset.position === currentPosition) {
        // button.style.backgroundColor = "var(--ui-primary)";
        button.style.color = "white";
        // 更新图标颜色
        const img = button.querySelector("img");
        if (img) {
          img.style.filter = "none";
        }
      } else {
        button.style.backgroundColor = "";
        button.style.color = "";
        // 更新图标颜色
        const img = button.querySelector("img");
        if (img) {
          img.style.filter = "grayscale(100%)";
        }
      }
    });

    // 更新侧边栏按钮的可用状态
    const useVSCodeLayout = isVSCodeLayoutEnabled();
    if (!useVSCodeLayout) {
      sidebarPopupButton.style.opacity = "0.3";
      sidebarPopupButton.style.cursor = "not-allowed";
      sidebarPopupButton.disabled = true;
    } else {
      sidebarPopupButton.style.opacity = "1";
      sidebarPopupButton.style.cursor = "pointer";
      sidebarPopupButton.disabled = false;
    }
  }

  // 创建按钮容器（用于并排放置所有操作按钮）
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "sa-terminal-header-buttons";
  buttonContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // 初始化独立窗口（确保 windowCloseButton 被创建）
  createFloatingWindow();

  // 将按钮添加到容器中
  buttonContainer.appendChild(continueButton);
  buttonContainer.appendChild(exportButton);
  buttonContainer.appendChild(settingsButton);
  buttonContainer.appendChild(positionSwitchContainer);

  // 将关闭按钮添加到按钮容器（默认隐藏，只在独立窗口模式显示）
  // 注意：windowCloseButton 已在 createFloatingWindow 中创建
  if (windowCloseButton) {
    buttonContainer.appendChild(windowCloseButton);
  }

  terminalHeader.appendChild(terminalTitle);
  terminalHeader.appendChild(buttonContainer);
  terminalContainer.appendChild(terminalHeader);

  // 创建终端输出区域（虚拟滚动列表）
  const virtualList = new TerminalVirtualList({
    rowHeight: 16,
    batchTimeout: 50
  });
  const terminalOutput = virtualList.outerElement;

  // 初始化欢迎信息
  const welcomeLine1 = document.createElement("div");
  welcomeLine1.textContent = msg("welcome-title") || "AstraEditor Terminal v1.2.0";
  virtualList.appendLog({ element: welcomeLine1, contentHash: welcomeLine1.textContent });

  const welcomeLine2 = document.createElement("div");
  welcomeLine2.textContent = msg("welcome-help") || "Type 'help' for available commands.";
  virtualList.appendLog({ element: welcomeLine2, contentHash: welcomeLine2.textContent });

  const welcomeLine3 = document.createElement("div");
  welcomeLine3.textContent = "";
  virtualList.appendLog({ element: welcomeLine3, contentHash: "" });

  terminalContainer.appendChild(terminalOutput);
  terminalContainer.appendChild(settingsPanel);

  // 设置存储键名
  const SETTINGS_STORAGE_KEY = "AETerminalSettings";

  // 加载设置
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
    return { consoleErrorEnabled: true, mergeOutputEnabled: true };
  };

  // 保存设置
  const saveSettings = (newSettings) => {
    try {
      const current = loadSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  // 控制台错误拦截器状态
  let isConsoleErrorInterceptorEnabled = true;

  // 启用控制台错误拦截器
  const enableConsoleErrorInterceptor = () => {
    isConsoleErrorInterceptorEnabled = true;
  };

  // 禁用控制台错误拦截器
  const disableConsoleErrorInterceptor = () => {
    isConsoleErrorInterceptorEnabled = false;
  };

  // 折叠相同内容状态
  let isMergeOutputEnabled = true;

  // 启用折叠相同内容
  const enableMergeOutput = () => {
    isMergeOutputEnabled = true;
    // 重新检查并合并已有的日志内容
    mergeExistingLogs();
  };

  // 禁用折叠相同内容
  const disableMergeOutput = () => {
    isMergeOutputEnabled = false;
    // 展开所有已合并的内容
    expandAllMergedLogs();
  };

  // 获取行的实际内容（不包含计数器和链接）
  const getRowContent = (row) => {
    if (row.element) {
      // 优先获取日志文本部分
      const textElement = row.element.querySelector('.sa-terminal-log-text');
      if (textElement) {
        return textElement.textContent.replace(/\s+/g, ' ').trim();
      }
      // 如果没有 .sa-terminal-log-text，返回空字符串让行不被处理
      return "";
    }
    // 如果没有 element 但有 contentHash（欢迎信息等），返回 contentHash
    if (row.contentHash) {
      return row.contentHash;
    }
    return "";
  };

  // 获取行的合并计数
  const getRowCount = (row) => {
    if (row.count) {
      return row.count;
    }
    if (row.element) {
      const counter = row.element.querySelector('.sa-terminal-log-counter');
      if (counter) {
        const count = parseInt(counter.textContent);
        return isNaN(count) ? 1 : count;
      }
    }
    return 1;
  };

  // 合并已有的日志内容
  const mergeExistingLogs = () => {
    if (virtualList.rows.length === 0) return;

    // 创建一个映射来跟踪相同内容的日志
    const contentMap = new Map();
    
    // 遍历所有日志，记录相同内容的出现次数（考虑已合并的行）
    for (const row of virtualList.rows) {
      const content = getRowContent(row);
      if (!content) continue;
      
      if (!contentMap.has(content)) {
        contentMap.set(content, { rows: [], totalCount: 0 });
      }
      contentMap.get(content).rows.push(row);
      contentMap.get(content).totalCount += getRowCount(row);
    }

    // 只处理出现多次的内容
    for (const [content, info] of contentMap) {
      if (info.totalCount > 1) {
        // 保留第一个作为主行，标记合并次数
        const mainRow = info.rows[0];
        if (mainRow.element) {
          let counter = mainRow.element.querySelector('.sa-terminal-log-counter');
          if (!counter) {
            counter = document.createElement("span");
            counter.className = "sa-terminal-log-counter";
            mainRow.element.insertBefore(counter, mainRow.element.firstChild);
          }
          counter.textContent = info.totalCount;
        }
        mainRow.count = info.totalCount;
        
        // 移除其余重复的行
        for (let i = 1; i < info.rows.length; i++) {
          const index = virtualList.rows.indexOf(info.rows[i]);
          if (index !== -1) {
            virtualList.rows.splice(index, 1);
            if (info.rows[i].element && info.rows[i].element.parentNode) {
              info.rows[i].element.remove();
            }
          }
        }
      }
    }

    // 更新虚拟列表
    virtualList.renderedStartIndex = -1;
    virtualList.renderedEndIndex = -1;
    if (virtualList.visible) {
      virtualList._updateContent();
    }

    // 更新 lastLogData
    if (virtualList.rows.length > 0) {
      const lastRow = virtualList.rows[virtualList.rows.length - 1];
      lastLogData = {
        contentHash: lastRow.contentHash,
        element: lastRow.element,
        count: lastRow.count || 1
      };
      lastLogCount = lastLogData.count;
    }
  };

  // 展开所有已合并的内容
  const expandAllMergedLogs = () => {
    if (virtualList.rows.length === 0) return;

    const newRows = [];

    for (const row of virtualList.rows) {
      // 使用 getRowContent 获取纯文本内容（不包含链接）
      const content = getRowContent(row);
      // 使用 getRowCount 获取正确的计数
      const count = getRowCount(row);

      // 克隆原元素并移除计数器
      let counterRemovedElement = null;
      if (row.element) {
        counterRemovedElement = row.element.cloneNode(true);
        const counter = counterRemovedElement.querySelector('.sa-terminal-log-counter');
        if (counter) {
          counter.remove();
        }
      }

      // 根据重复次数添加多行
      for (let i = 0; i < count; i++) {
        if (i === 0) {
          // 保留原行（包含链接等结构），但先移除计数器
          if (row.element) {
            const counter = row.element.querySelector('.sa-terminal-log-counter');
            if (counter) {
              counter.remove();
            }
          }
          newRows.push({
            element: row.element,
            contentHash: content,
            count: 1
          });
        } else {
          // 使用 cloneNode 复制完整结构
          const newElement = counterRemovedElement ? counterRemovedElement.cloneNode(true) : document.createElement("div");
          if (!counterRemovedElement) {
            newElement.className = "sa-terminal-log-line";
          }
          newRows.push({
            element: newElement,
            contentHash: content,
            count: 1
          });
        }
      }
    }

    // 替换所有行
    virtualList.rows = newRows;

    // 更新虚拟列表
    virtualList.renderedStartIndex = -1;
    virtualList.renderedEndIndex = -1;
    if (virtualList.visible) {
      virtualList._updateContent();
      virtualList._scrollToEnd();
    }

    // 重置 lastLogData
    if (virtualList.rows.length > 0) {
      const lastRow = virtualList.rows[virtualList.rows.length - 1];
      lastLogData = {
        contentHash: lastRow.contentHash,
        element: lastRow.element,
        count: 1
      };
      lastLogCount = 1;
    }
  };

  // 初始化设置开关状态
  const initSettingsSwitch = () => {
    const settings = loadSettings();
    if (!settings.consoleErrorEnabled) {
      consoleErrorSwitchInput.checked = false;
      consoleErrorSwitchBackground.style.backgroundColor = "#555555";
      consoleErrorSwitchSlider.style.transform = "translateX(0)";
      disableConsoleErrorInterceptor();
    } else {
      consoleErrorSwitchInput.checked = true;
      consoleErrorSwitchBackground.style.backgroundColor = "var(--looks-secondary)";
      consoleErrorSwitchSlider.style.transform = "translateX(18px)";
      enableConsoleErrorInterceptor();
    }

    if (!settings.mergeOutputEnabled) {
      mergeOutputSwitchInput.checked = false;
      mergeOutputSwitchBackground.style.backgroundColor = "#555555";
      mergeOutputSwitchSlider.style.transform = "translateX(0)";
      disableMergeOutput();
    } else {
      mergeOutputSwitchInput.checked = true;
      mergeOutputSwitchBackground.style.backgroundColor = "var(--looks-secondary)";
      mergeOutputSwitchSlider.style.transform = "translateX(18px)";
      enableMergeOutput();
    }
  };
  initSettingsSwitch();

  // 控制台错误拦截器 - 将 console.error 同步到 Terminal
  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    originalConsoleError(...args);

    if (terminalOutput && isConsoleErrorInterceptorEnabled) {
      resetLogTracking();

      const line = document.createElement("div");
      line.className = "sa-terminal-log-line";

      const mark = document.createElement("span");
      mark.className = "sa-terminal-log-mark console-error";
      mark.textContent = "[console.error]";
      line.appendChild(mark);

      const textSpan = document.createElement("span");
      textSpan.className = "sa-terminal-log-text";

      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      textSpan.textContent = " " + message;
      line.appendChild(textSpan);

      if (args[0] instanceof Error && args[0].stack) {
        const stackInfo = document.createElement("span");
        stackInfo.className = "sa-terminal-log-stack";
        const stackLines = args[0].stack.split('\n');
        const relevantLines = stackLines.filter(l => !l.includes('extension-hoste'));
        const locationInfo = relevantLines.slice(1, 3).map(l => l.trim()).join(' | ');
        stackInfo.textContent = locationInfo ? ` (${locationInfo})` : '';
        line.appendChild(stackInfo);
      }

      addLogLineWithElement(line);
    }
  };

  // 重复内容处理
  let lastLogData = null;
  let lastLogCount = 1;

  const addLogLine = (content, element) => {
    const currentContent = content;

    if (isMergeOutputEnabled && lastLogData && currentContent === lastLogData.contentHash) {
      lastLogCount++;
      lastLogData.count = lastLogCount;
      if (lastLogData.element && lastLogData.element.parentNode) {
        let counter = lastLogData.element.querySelector('.sa-terminal-log-counter');
        if (!counter) {
          counter = document.createElement("span");
          counter.className = "sa-terminal-log-counter";
          lastLogData.element.insertBefore(counter, lastLogData.element.firstChild);
        }
        counter.textContent = lastLogCount;
      }
    } else {
      let lineElement = element;
      if (!lineElement) {
        lineElement = document.createElement("div");
        lineElement.className = "sa-terminal-log-line";
        lineElement.textContent = content;
      }
      virtualList.appendLog({ element: lineElement, contentHash: currentContent });
      lastLogData = { contentHash: currentContent, element: lineElement, count: 1 };
      lastLogCount = 1;
    }
  };

  // 重置重复内容记录（用于非积木输出的内容）
  const resetLogTracking = () => {
    lastLogData = null;
    lastLogCount = 1;
  };

  // 获取元素的内容标识符（用于比较重复内容）
  const getElementContentHash = (element) => {
    // 优先获取日志文本部分（不包含链接）
    const textElement = element.querySelector('.sa-terminal-log-text');
    if (textElement) {
      return textElement.textContent.replace(/\s+/g, ' ').trim();
    }
    return element.textContent.replace(/\s+/g, ' ').trim();
  };

  // 添加日志行（支持重复内容合并）
  const addLogLineWithElement = (element) => {
    const contentHash = getElementContentHash(element);

    if (isMergeOutputEnabled && lastLogData && contentHash === lastLogData.contentHash) {
      lastLogCount++;
      lastLogData.count = lastLogCount;
      if (lastLogData.element && lastLogData.element.parentNode) {
        let counter = lastLogData.element.querySelector('.sa-terminal-log-counter');
        if (!counter) {
          counter = document.createElement("span");
          counter.className = "sa-terminal-log-counter";
          lastLogData.element.insertBefore(counter, lastLogData.element.firstChild);
        }
        counter.textContent = lastLogCount;
      }
      element.remove();
    } else {
      virtualList.appendLog({ element, contentHash });
      lastLogData = { contentHash, element, count: 1 };
      lastLogCount = 1;
    }
  };

  
  // 添加断点积木
  addon.tab.addBlock("\u200B\u200Bbreakpoint\u200B\u200B", {
    args: [],
    displayName: msg("block-breakpoint"),
    callback: (_, thread) => {
      if (addon.tab.redux.state.scratchGui.mode.isPlayerOnly) {
        if (terminalOutput) {
          const line = document.createElement("div");
          line.className = "sa-terminal-log-line";
          
          const mark = document.createElement("span");
          mark.className = "sa-terminal-log-mark error";
          mark.textContent = "[error]";
          line.appendChild(mark);
          
          const textSpan = document.createElement("span");
          textSpan.className = "sa-terminal-log-text";
          textSpan.textContent = " " + (msg("breakpoint-editor-only") || "断点积木只能在编辑器中使用。");
          line.appendChild(textSpan);
          
          addLogLineWithElement(line);
        }
        return;
      }
      
      setPausedDebugger(true);
      
      continueButton.style.display = "inline-block";
      
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        const mark = document.createElement("span");
        mark.className = "sa-terminal-log-mark log";
        mark.textContent = "[breakpoint]";
        line.appendChild(mark);
        
        const textSpan = document.createElement("span");
        textSpan.className = "sa-terminal-log-text";
        textSpan.textContent = " " + (msg("breakpoint-paused") || "程序已暂停");
        line.appendChild(textSpan);
        
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const linkWrapper = document.createElement("span");
            linkWrapper.className = "sa-terminal-log-link-wrapper";
            linkWrapper.textContent = "[";
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            linkWrapper.appendChild(link);
            linkWrapper.appendChild(document.createTextNode("]"));
            line.appendChild(linkWrapper);
          }
        }
        
        addLogLineWithElement(line);
      }
    },
  });

  addon.tab.addBlock("\u200B\u200Bclear\u200B\u200B", {
    args: [],
    displayName: msg("block-clear") || "Clear Terminal",
    callback: () => {
      virtualList.clear();
      resetLogTracking();
    },
  });

  addon.tab.addBlock("\u200B\u200Bdelete_last\u200B\u200B", {
    args: [],
    displayName: msg("block-delete-last") || "Delete Last Output",
    callback: () => {
      if (lastLogData && lastLogData.count > 1) {
        lastLogData.count--;
        lastLogCount = lastLogData.count;
        if (lastLogData.element) {
          const counter = lastLogData.element.querySelector('.sa-terminal-log-counter');
          if (counter) {
            if (lastLogData.count === 1) {
              counter.remove();
            } else {
              counter.textContent = lastLogData.count;
            }
          }
        }
      } else {
        const removed = virtualList.removeLastRow();
        if (removed) {
          lastLogData = null;
          lastLogCount = 1;
        }
      }
    },
  });

  const createTextWithLinks = (container, text, color) => {
    container.innerHTML = "";
    container.style.color = color || "";
    
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|data:[^\s<>"{}|\\^`\[\]]+)/gi;
    const matches = [...text.matchAll(urlRegex)];
    
    if (matches.length === 0) {
      container.textContent = text;
      return;
    }
    
    let lastIndex = 0;
    matches.forEach((match) => {
      if (match.index > lastIndex) {
        const textNode = document.createElement("span");
        textNode.className = "sa-terminal-text-plain";
        textNode.textContent = text.slice(lastIndex, match.index);
        container.appendChild(textNode);
      }
      
      const link = document.createElement("a");
      link.className = "sa-terminal-url-link";
      link.textContent = match[0];
      link.title = msg("ctrl-click-to-open") || "按下 Ctrl 并单击以打开链接";
      link.href = "#";
      link.dataset.url = match[0];
      link.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const url = e.target.dataset.url;
          if (url) {
            window.open(url, "_blank");
          }
        }
      });
      container.appendChild(link);
      
      lastIndex = match.index + match[0].length;
    });
    
    if (lastIndex < text.length) {
      const textNode = document.createElement("span");
      textNode.className = "sa-terminal-text-plain";
      textNode.textContent = text.slice(lastIndex);
      container.appendChild(textNode);
    }
  };

  const createLogLines = (text, thread, options = {}) => {
    const { markClass, markText, color } = options;
    const textStr = String(text ?? "");
    const processedText = textStr.replace(/\\n/g, '\n');
    const lines = processedText.split('\n');
    const blockId = thread ? thread.peekStack() : null;
    const targetId = thread ? thread.target.id : null;
    const targetInfo = blockId && targetId ? getTargetInfoById(targetId) : null;
    
    lines.forEach((lineContent, index) => {
      const isLastLine = index === lines.length - 1;
      const line = document.createElement("div");
      line.className = "sa-terminal-log-line";
      
      if (markClass && markText) {
        const mark = document.createElement("span");
        mark.className = `sa-terminal-log-mark ${markClass}`;
        mark.textContent = markText;
        line.appendChild(mark);
      }
      
      const textSpan = document.createElement("span");
      textSpan.className = "sa-terminal-log-text";
      const displayText = (markClass && markText) ? ` ${lineContent}` : lineContent;
      createTextWithLinks(textSpan, displayText, color);
      textSpan.title = lineContent;
      line.appendChild(textSpan);
      
      if (isLastLine && targetInfo && targetInfo.exists && blockId) {
        const linkWrapper = document.createElement("span");
        linkWrapper.className = "sa-terminal-log-link-wrapper";
        linkWrapper.textContent = "[";
        const link = createBlockLink(targetInfo, blockId);
        link.className = "sa-terminal-block-link";
        linkWrapper.appendChild(link);
        linkWrapper.appendChild(document.createTextNode("]"));
        line.appendChild(linkWrapper);
      }
      
      addLogLineWithElement(line);
    });
  };

  // 添加输出块到 Scratch
  addon.tab.addBlock("\u200B\u200Bterminal_log\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-log"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        createLogLines(text, thread);
      }
    },
  });

  addon.tab.addBlock("\u200B\u200Bterminal_log_colored\u200B\u200B %s %s", {
    args: ["text", "color"],
    displayName: msg("block-log-colored"),
    callback: ({ text, color }, thread) => {
      if (terminalOutput) {
        createLogLines(text, thread, { color });
      }
    },
  });

  addon.tab.addBlock("\u200B\u200Blog\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-log-debug"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        createLogLines(text, thread, { markClass: "log", markText: "[log]" });
      }
    },
  });

  addon.tab.addBlock("\u200B\u200Bwarn\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-warn"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        createLogLines(text, thread, { markClass: "warn", markText: "[warn]" });
      }
    },
  });

  addon.tab.addBlock("\u200B\u200Berror\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-error"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        createLogLines(text, thread, { markClass: "error", markText: "[error]" });
      }
    },
  });

  // 添加用户指令积木
  addon.tab.addBlock("\u200B\u200Badd_user_command\u200B\u200B %s %s", {
    args: ["name", "description"],
    displayName: msg("block-add-user-command") || "Add User Command",
    callback: ({ name, description }) => {
      if (name && description) {
        userCommands[name.trim()] = description.trim();
      }
    },
  });

  // 添加导出日志积木
  addon.tab.addBlock("\u200B\u200Bexport_logs\u200B\u200B", {
    args: [],
    displayName: msg("block-export-logs") || "Export Logs",
    callback: () => {
      exportLogs();
    },
  });

  // 添加返回值积木（返回用户刚才输入的内容）
  // 直接使用 vm.addAddonBlock 创建返回值块
  vm.addAddonBlock({
    procedureCode: "terminal_get_input",
    displayName: msg("block-get-input"),
    callback: () => {
      // 返回用户最后一次输入，如果没有则返回空字符串
      return lastUserInput || "";
    },
    return: 1 // 1 表示圆角返回值块
  });

  // 添加返回值积木（返回上次输入时间戳）
  vm.addAddonBlock({
    procedureCode: "terminal_get_input_timestamp",
    displayName: "上次输入时间戳",
    callback: () => {
      // 返回上次用户输入的时间戳，如果没有则返回0
      return lastInputTimestamp;
    },
    return: 1 
  });

  // 添加返回值积木（返回上一行输出内容）
  vm.addAddonBlock({
    procedureCode: "terminal_get_last_output",
    displayName: "上一行输出",
    callback: () => {
      // 返回上一行输出的内容，包括硬编码的输出内容
      if (lastLogData && lastLogData.element) {
        return lastLogData.element.textContent || "";
      }
      // 如果 lastLogData 不存在，尝试从 virtualList.rows 获取最后一行
      if (virtualList.rows.length > 0) {
        const lastRow = virtualList.rows[virtualList.rows.length - 1];
        if (lastRow.element) {
          return lastRow.element.textContent || "";
        }
        if (lastRow.contentHash) {
          return lastRow.contentHash;
        }
      }
      return "";
    },
    return: 1
  });

  // 创建输入行
  const inputLine = document.createElement("div");
  inputLine.className = "sa-terminal-input-line";

  const prompt = document.createElement("span");
  prompt.className = "sa-terminal-prompt";
  prompt.textContent = "> ";

  const terminalInput = document.createElement("input");
  terminalInput.type = "text";
  terminalInput.className = "sa-terminal-input";
  terminalInput.placeholder = msg("input-placeholder") || "Enter command...";

  inputLine.appendChild(prompt);
  inputLine.appendChild(terminalInput);
  terminalContainer.appendChild(inputLine);

  // 命令历史
  const commandHistory = [];
  let historyIndex = -1;

  // 存储用户输入用于返回值积木
  let lastUserInput = "";
  // 存储用户输入时间戳
  let lastInputTimestamp = 0;

  // 存储用户指令
  const userCommands = {};

  // 可用命令
  const commands = {
    help: {
      description: msg("command-help-desc") || "Show available commands",
      execute: (args) => {
        let output = (msg("command-help-available") || "Available commands:") + "\n\n";
        for (const [name, cmd] of Object.entries(commands)) {
          if (name !== "creeper?") {
            output += `  ${name} - ${cmd.description}\n`;
          }
        }
        
        // 显示用户指令
        const userCommandCount = Object.keys(userCommands).length;
        if (userCommandCount > 0) {
          output += "\n" + (msg("command-user-command") || "User Command：") + "\n";
          for (const [name, description] of Object.entries(userCommands)) {
            output += `  ${name} - ${description}\n`;
          }
        }
        
        return output;
      }
    },
    fastfetch: {
      description: msg("command-fastfetch-desc") || "Show device status information",
      execute: async () => {
        const asciiArt = `               ░░░░░░░░░                                
          ░░░░░░░░░░░░░░░░░░░                           
       ░░░░░░░░░░░░░░░░░░░░░░░░░                        
     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                      
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                    
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                   
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                  
 ░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒░░                
░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░              
░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░            
░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░          
░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░          
 ░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░          
  ░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░          
  ░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░          
   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░          
  ░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░          
  ░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░            
  ░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▓▒▒▒▒░░░░░░░░░░░░░░░              
  ░░░░░░░░░░░░░░░░░░░░░   ░░░░░░░░░░░░                  
    ░░░░░░░░░░░░░░░░░                                   
     ░░░░░░░░░░░░░░░                                    
       ░░░░░░░░░░░                                       `;

        let output = "Device Status:\n\n";
        
        // Navigator API information
        if (navigator.userAgent) {
          output += `  User Agent: ${navigator.userAgent.substring(0, 100)}${navigator.userAgent.length > 100 ? '...' : ''}\n`;
        }
        
        if (navigator.platform) {
          output += `  Platform: ${navigator.platform}\n`;
        }
        
        if (navigator.language) {
          output += `  Language: ${navigator.language}\n`;
        }
        
        if (navigator.hardwareConcurrency) {
          output += `  CPU Cores: ${navigator.hardwareConcurrency}\n`;
        }
        
        if (navigator.deviceMemory) {
          output += `  Device Memory: ${navigator.deviceMemory} GB\n`;
        }
        
        // Screen information
        if (screen.width && screen.height) {
          output += `  Screen Resolution: ${screen.width}x${screen.height}\n`;
        }
        
        if (screen.colorDepth) {
          output += `  Color Depth: ${screen.colorDepth} bits\n`;
        }
        
        // WebGPU support and details
        if ('gpu' in navigator) {
          output += `  WebGPU: Supported\n`;
          try {
            // Get GPU adapter information
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
              output += `  GPU Adapter: ${adapter.name}\n`;
              
              // Get adapter features
              const features = [];
              for (const feature of adapter.features) {
                features.push(feature);
              }
              if (features.length > 0) {
                output += `  GPU Features: ${features.slice(0, 5).join(', ')}${features.length > 5 ? '...' : ''}\n`;
              }
              
              // Get adapter limits
              const limits = adapter.limits;
              if (limits && limits.maxTextureDimension2D) {
                output += `  Max Texture Size: ${limits.maxTextureDimension2D}x${limits.maxTextureDimension2D}\n`;
              }
              
              // Try to get device info
              try {
                const device = await adapter.requestDevice();
                output += `  GPU Device: ${device.label || 'Default Device'}\n`;
                device.destroy(); // Cleanup
              } catch (deviceError) {
                // Device request might fail, but that's okay
              }
            } else {
              output += `  GPU Adapter: Not available\n`;
            }
          } catch (error) {
            output += `  GPU Info: Error retrieving details - ${error.message}\n`;
          }
        } else {
          output += `  WebGPU: Not Supported\n`;
        }
        
        // Network information
        if (navigator.connection) {
          const connection = navigator.connection;
          output += `  Network Type: ${connection.type || 'Unknown'}\n`;
          if (connection.effectiveType) {
            output += `  Effective Type: ${connection.effectiveType}\n`;
          }
          if (connection.downlink) {
            output += `  Downlink: ${connection.downlink} Mbps\n`;
          }
        }

        output += '\n  AstraEditor Version: ' + aeVersion.version + ' ( Built in ' + aeVersion.date + ' )\n';
        output += '  Terminal Version: 1.2.0\n';

        const asciiLines = asciiArt.split('\n');
        const infoLines = output.split('\n');
        let combined = '';
        const maxLines = Math.max(asciiLines.length, infoLines.length);

        for (let i = 0; i < maxLines; i++) {
          const ascii = asciiLines[i] || '';
          const info = infoLines[i] || '';
          const paddedAscii = ascii.padEnd(24);
          combined += paddedAscii + ' ' + info + '\n';
        }

        return combined;
      }
    },
    echo: {
      description: msg("command-echo-desc") || "Echo the input text",
      execute: (args) => args.join(" ")
    },
    project: {
      description: msg("command-project-desc") || "Show project information",
      execute: () => {
        try {
          const vm = addon.tab.traps.vm;
          const target = vm.runtime.getEditingTarget();
          const stage = vm.runtime.getTargetForStage();

          return `${msg("command-project-output") || "Project Information"}:
  ${msg("command-project-stage") || "Stage"}: ${stage.getName()}
  ${msg("command-project-sprite") || "Current Sprite"}: ${target.getName()}
  ${msg("command-project-sprites") || "Sprites"}: ${vm.runtime.targets.length - 1}
  ${msg("command-project-variables") || "Variables"}: ${Object.keys(stage.variables).length}
  ${msg("command-project-broadcasts") || "Broadcasts"}: ${Object.keys(stage.blocks).filter(k => k.startsWith('broadcast_')).length}
`;
        } catch (e) {
          return msg("command-project-error") || "Error: Unable to get project information";
        }
      }
    },
    variables: {
      description: msg("command-variables-desc") || "List all variables",
      execute: () => {
        try {
          const vm = addon.tab.traps.vm;
          const target = vm.runtime.getEditingTarget();
          const stage = vm.runtime.getTargetForStage();

          let output = msg("command-variables-global") || "Global Variables:\n";
          Object.values(stage.variables).forEach(v => {
            if (v.type === "" || v.type === "list") {
              const value = v.type === "list" ? `[${v.value.join(", ")}]` : v.value;
              output += `  ${v.name} = ${value}\n`;
            }
          });

          output += "\n" + (msg("command-variables-local") || "Local Variables:") + "\n";
          if (!target.isStage) {
            Object.values(target.variables).forEach(v => {
              if (v.type === "" || v.type === "list") {
                const value = v.type === "list" ? `[${v.value.join(", ")}]` : v.value;
                output += `  ${v.name} = ${value}\n`;
              }
            });
          }

          return output;
        } catch (e) {
          return msg("command-variables-error") || "Error: Unable to get variables";
        }
      }
    },
    sprites: {
      description: msg("command-sprites-desc") || "List all sprites",
      execute: () => {
        try {
          const vm = addon.tab.traps.vm;
          let output = (msg("command-sprites-output") || "Sprites:") + "\n";
          vm.runtime.targets.forEach(target => {
            if (!target.isStage) {
              output += `  ${target.getName()}\n`;
            }
          });
          return output;
        } catch (e) {
          return msg("command-sprites-error") || "Error: Unable to get sprites";
        }
      }
    },
    version: {
      description: msg("command-version-desc") || "Show terminal version",
      execute: () => "AstraEditor Terminal v" + aeVersion.version
    },
    "creeper?": {
      description: "",
      execute: () => msg("command-creeper") || "Awwww Man!"
    }
  };

  const executeCommand = async (command) => {
    const parts = command.trim().split(" ");
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    lastUserInput = command.trim();
    lastInputTimestamp = Date.now();

    if (command.trim()) {
      commandHistory.push(command.trim());
      historyIndex = commandHistory.length;
    }

    resetLogTracking();

    if (cmdName === "clear") {
      virtualList.clear();
      resetLogTracking();
      return;
    }

    const commandLine = document.createElement("div");
    commandLine.className = "sa-terminal-command-line";
    const commandText = document.createElement("span");
    commandText.className = "sa-terminal-command-line-text";
    commandText.title = command;
    createTextWithLinks(commandText, `> ${command}`);
    commandLine.appendChild(commandText);
    virtualList.appendLog({ element: commandLine, contentHash: commandLine.textContent });

    if (!cmdName) {
      return;
    }

    const cmd = commands[cmdName];
    if (cmd) {
      try {
        const result = await cmd.execute(args);
        if (result) {
          const lines = result.split('\n');
          lines.forEach((lineContent, index) => {
            const resultLine = document.createElement("div");
            resultLine.className = "sa-terminal-result-line";
            // 将空格转换为非断行空格以保留格式
            const escapedContent = lineContent.replace(/ /g, '&nbsp;');
            resultLine.innerHTML = escapedContent;
            resultLine.title = lineContent;
            virtualList.appendLog({ element: resultLine, contentHash: `result-${index}-${lineContent}` });
          });
        }
      } catch (e) {
        const errorLine = document.createElement("div");
        errorLine.className = "sa-terminal-error-line";
        errorLine.textContent = `Error: ${e.message}`;
        errorLine.title = `Error: ${e.message}`;
        virtualList.appendLog({ element: errorLine, contentHash: errorLine.textContent });
      }
    }
  };

  // 输入处理
  terminalInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const command = terminalInput.value;
      terminalInput.value = "";
      await executeCommand(command);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        terminalInput.value = commandHistory[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        terminalInput.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        terminalInput.value = "";
      }
    }
  });

  // 聚焦输入框
  terminalContainer.addEventListener("click", () => {
    terminalInput.focus();
  });

  // 等待 TabBar 元素（用于侧边栏模式）
  const tabBar = await addon.tab.waitForElement('[class*="react-tabs_react-tabs__tab-list"]', {
    markAsSeen: true
  });

  // 创建底部的Terminal开关按钮
  const toggleButton = document.createElement("button");
  toggleButton.className = "sa-terminal-toggle-button";

  // 创建图标元素 - 使用 tw-recolor loader 加载图标（会自动替换为主题色）
  const toggleBtnIcon = document.createElement("img");
  toggleBtnIcon.draggable = false;
  toggleBtnIcon.src = icon();
  toggleBtnIcon.style.filter = "grayscale(100%)";
  toggleBtnIcon.style.width = '25px';
  toggleBtnIcon.style.height = 'auto';

  // 创建文本元素
  const toggleBtnText = document.createElement("span");
  toggleBtnText.textContent = "Terminal";

  // 添加图标和文本
  toggleButton.appendChild(toggleBtnIcon);
  toggleButton.appendChild(toggleBtnText);

  addon.tab.displayNoneWhileDisabled(toggleButton);

  // 创建舞台头部的 Terminal 按钮（用于独立窗口模式）
  const stageHeaderButton = document.createElement("div");
  stageHeaderButton.className = "sa-terminal-stage-header-button";
  const stageHeaderBtnInner = document.createElement("div");
  stageHeaderBtnInner.className = addon.tab.scratchClass("button_outlined-button", "stage-header_stage-button");
  const stageHeaderBtnContent = document.createElement("div");
  stageHeaderBtnContent.className = addon.tab.scratchClass("button_content");
  const stageHeaderBtnIcon = document.createElement("img");
  stageHeaderBtnIcon.className = addon.tab.scratchClass("stage-header_stage-button-icon");
  stageHeaderBtnIcon.draggable = false;
  stageHeaderBtnIcon.src = icon();
  stageHeaderBtnIcon.style.filter = "grayscale(100%)";
  stageHeaderBtnContent.appendChild(stageHeaderBtnIcon);
  stageHeaderBtnInner.appendChild(stageHeaderBtnContent);
  stageHeaderButton.appendChild(stageHeaderBtnInner);

  // 注册面板插件
  SideBar.register('terminal', terminalContainer, {
    onActivate: () => {
      virtualList.show();
      terminalInput.focus();
      toggleButton.classList.add("sa-terminal-toggle-active", "is-selected");
      // 移除图标的灰度滤镜，使其显示主题色
      if (toggleBtnIcon) {
        toggleBtnIcon.style.filter = "grayscale(0%)";
      }
    },
    onDeactivate: () => {
      virtualList.hide();
      toggleButton.classList.remove("sa-terminal-toggle-active", "is-selected");
      // 恢复图标的灰度滤镜
      if (toggleBtnIcon) {
        toggleBtnIcon.style.filter = "grayscale(100%)";
      }
    }
  });

  BottomPanel.register('terminal', terminalContainer, {
    onActivate: () => {
      virtualList.show();
      terminalInput.focus();
      toggleButton.classList.add("sa-terminal-toggle-active");
      // 移除按钮栏的底部边框
      const buttonBar = BottomPanel.getButtonBar();
      if (buttonBar) {
        buttonBar.style.borderBottom = "none";
      }
    },
    onDeactivate: () => {
      virtualList.hide();
      toggleButton.classList.remove("sa-terminal-toggle-active");
      // 恢复按钮栏的底部边框
      const buttonBar = BottomPanel.getButtonBar();
      if (buttonBar) {
        buttonBar.style.borderBottom = "1px solid var(--ui-black-transparent)";
      }
    }
  });

  // 按钮点击事件（通用）
  const handleToggleButtonClick = () => {
    if (isTerminalVisible()) {
      toggleTerminal(false);
    } else {
      toggleTerminal(true);
    }
  };

  toggleButton.addEventListener("click", handleToggleButtonClick);
  stageHeaderButton.addEventListener("click", handleToggleButtonClick);

  // 监听 Bottom Panel 打开事件，确保 Terminal 激活时移除边框
  window.addEventListener('bottomPanelOpened', () => {
    if (BottomPanel.getActivePlugin() === 'terminal') {
      const buttonBar = BottomPanel.getButtonBar();
      if (buttonBar) {
        buttonBar.style.borderBottom = "none";
      }
    }
  });

  // 更新启用按钮位置
  function updateToggleButtonPosition() {
    // 先移除所有位置的按钮
    if (toggleButton.parentNode) {
      toggleButton.parentNode.removeChild(toggleButton);
    }
    if (stageHeaderButton.parentNode) {
      stageHeaderButton.parentNode.removeChild(stageHeaderButton);
    }

    // 根据当前位置添加按钮
    switch (currentPosition) {
      case POSITION_TYPES.SIDEBAR:
        // Sidebar 模式：添加到 TabBar，只显示图标
        if (tabBar) {
          // 使用与 SPA、bookmark 相同的类名
          toggleButton.className = addon.tab.scratchClass('menu-bar_menu-bar-button', {
            others: 'sa-terminal-toggle-button vscode-tab'
          });
          // 只显示图标
          toggleBtnIcon.style.display = "inline";
          toggleBtnText.style.display = "none";
          tabBar.appendChild(toggleButton);
        }
        break;
      case POSITION_TYPES.BOTTOM_PANEL:
        // Bottom Panel 模式：添加到 Bottom Panel 按钮栏
        const bottomBarButtonBar = BottomPanel.getButtonBar();
        if (bottomBarButtonBar) {
          toggleButton.className = "sa-terminal-toggle-button";
          // 显示图标和文字
          toggleBtnIcon.style.display = "inline";
          toggleBtnText.style.display = "inline";
          bottomBarButtonBar.appendChild(toggleButton);
          BottomPanel.updateButtonBarVisibility();
        }
        break;
      case POSITION_TYPES.WINDOW:
        // 独立窗口模式：添加到舞台头部
        addon.tab.appendToSharedSpace({
          space: "stageHeader",
          element: stageHeaderButton,
          order: 0
        });
        toggleButton.style.marginRight = "2px";
        break;
    }

    // 无论切换到什么模式，都更新按钮栏显示状态
    BottomPanel.updateButtonBarVisibility();

    // 更新按钮激活状态
    if (isTerminalVisible()) {
      toggleButton.classList.add("sa-terminal-toggle-active");
      stageHeaderBtnInner.classList.add("sa-terminal-toggle-active");
    } else {
      toggleButton.classList.remove("sa-terminal-toggle-active");
      stageHeaderBtnInner.classList.remove("sa-terminal-toggle-active");
    }
  }

  // 将按钮添加到BottomPanel的按钮栏（初始位置）
  while (true) {
    const buttonBar = BottomPanel.getButtonBar();
    if (buttonBar) {
      console.log("Button bar found, adding terminal button");
      // 使用 updateToggleButtonPosition 来正确设置按钮样式
      updateToggleButtonPosition();
      console.log("Terminal button added to button bar");
      BottomPanel.updateButtonBarVisibility();
      window.dispatchEvent(new Event("resize"));
      break;
    }
    console.log("Button bar not found yet, waiting...");
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Re-inject button when tab bar is recreated (project load, layout refresh, etc.)
  (async () => {
    while (true) {
      await addon.tab.waitForElement('[class*="react-tabs_react-tabs__tab-list"]', {
        markAsSeen: true,
        reduxEvents: ['scratch-gui/mode/SET_PLAYER', 'fontsLoaded/SET_FONTS_LOADED', 'scratch-gui/locales/SELECT_LOCALE'],
        reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
      });
      updateToggleButtonPosition();
    }
  })();

  // 根据主题更新按钮文字颜色
  const updateButtonTextColor = () => {
    try {
      const themeData = localStorage.getItem('tw:theme');
      let isLightMode = false;

      if (themeData) {
        const parsed = JSON.parse(themeData);
        isLightMode = parsed.gui === 'light';
      } else {
        // 如果没有存储主题数据，检查系统偏好
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        isLightMode = !prefersDark;
      }

      // 设置按钮文字颜色
      toggleBtnText.style.color = isLightMode ? '#575E75' : '#ffffff';
    } catch (e) {
      console.error('Failed to update button text color:', e);
    }
  };

  // 初始化按钮文字颜色
  updateButtonTextColor();

  // 监听主题变化
  window.addEventListener('tw:theme-changed', updateButtonTextColor);

  // 监听布局变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'AESettings') {
      const newSettings = JSON.parse(e.newValue);
      const oldSettings = JSON.parse(e.oldValue);

      if (newSettings.EnableVSCodeLayout !== oldSettings.EnableVSCodeLayout) {
        // 更新侧边栏按钮的可用状态
        updatePositionSwitchButton();

        // 如果当前在侧边栏模式且布局被禁用，切换到底部面板
        if (currentPosition === POSITION_TYPES.SIDEBAR && !newSettings.EnableVSCodeLayout) {
          switchTerminalPosition(POSITION_TYPES.BOTTOM_PANEL);
        }
      }
    }
  });

  // 初始化位置切换按钮状态
  updatePositionSwitchButton();
}