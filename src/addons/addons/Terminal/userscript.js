import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";
import SideBar from "../../ui/side-bar/side-bar.js";
import icon from "!../../../lib/tw-recolor/build!./logo.svg";
import iconSidebar from "!../../../lib/tw-recolor/build!./icon-sidebar.svg";
import iconBottom from "!../../../lib/tw-recolor/build!./icon-bottom.svg";
import iconWindow from "!../../../lib/tw-recolor/build!./icon-window.svg";
import { setup as setupDebugger, setPaused as setPausedDebugger } from "../debugger/module.js";

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

  // 当前 Terminal 位置
  let currentPosition = POSITION_TYPES.BOTTOM_PANEL;

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
      background-color: var(--ui-white);
      border: 1px solid var(--ui-black-transparent);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      display: flex;
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

  // 切换 Terminal 位置
  function switchTerminalPosition(newPosition) {
    if (newPosition === currentPosition) return;

    // 先关闭当前位置
    closeTerminalAtPosition(currentPosition);

    // 切换到新位置
    currentPosition = newPosition;
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

        // 在独立窗口模式下，terminalHeader 作为拖拽标题栏
        terminalHeader.style.cursor = "move";
        terminalHeader.style.userSelect = "none";

        // 显示关闭按钮
        if (windowCloseButton) {
          windowCloseButton.style.display = "block";
          terminalHeader.appendChild(windowCloseButton);
        }

        // 启用拖拽功能
        terminalHeader.addEventListener("mousedown", handleWindowDragStart);
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
            floatingWindow.removeChild(terminalContainer);
          }
          floatingWindow.style.display = "none";

          // 恢复 terminalHeader 样式
          terminalHeader.style.cursor = "";
          terminalHeader.style.userSelect = "";

          // 隐藏并移除关闭按钮
          if (windowCloseButton && windowCloseButton.parentNode === terminalHeader) {
            windowCloseButton.style.display = "none";
            terminalHeader.removeChild(windowCloseButton);
          }

          // 禁用拖拽功能
          terminalHeader.removeEventListener("mousedown", handleWindowDragStart);
        }
        break;
    }
  }

  // 处理窗口拖拽开始
  function handleWindowDragStart(e) {
    // 不在拖拽按钮上开始拖拽
    if (e.target.tagName === "BUTTON") return;

    isDraggingWindow = true;
    dragOffsetX = e.clientX - floatingWindow.offsetLeft;
    dragOffsetY = e.clientY - floatingWindow.offsetTop;
    document.addEventListener("mousemove", handleWindowDrag);
    document.addEventListener("mouseup", stopWindowDrag);
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
    link.title = "点击跳转到积木";
    
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
  continueButton.innerHTML = "▶ 继续执行";
  // continueButton.title = "继续运行";
  continueButton.style.display = "none";

  continueButton.addEventListener("click", () => {
    setPausedDebugger(false);
    continueButton.style.display = "none";
  });

  // 创建位置切换按钮容器
  const positionSwitchContainer = document.createElement("div");
  positionSwitchContainer.className = "sa-terminal-position-switch";
  positionSwitchContainer.style.cssText = `
    display: flex;
    gap: 4px;
    align-items: center;
    position: relative;
  `;

  // 位置图标映射
  const positionIcons = {
    [POSITION_TYPES.SIDEBAR]: iconSidebar,
    [POSITION_TYPES.BOTTOM_PANEL]: iconBottom,
    [POSITION_TYPES.WINDOW]: iconWindow
  };

  // 位置标题映射
  const positionTitles = {
    [POSITION_TYPES.SIDEBAR]: "侧边栏",
    [POSITION_TYPES.BOTTOM_PANEL]: "底部面板",
    [POSITION_TYPES.WINDOW]: "独立窗口"
  };

  // 创建轮换按钮
  const rotateButton = document.createElement("button");
  rotateButton.className = "sa-terminal-rotate-button";
  rotateButton.title = `当前位置: ${positionTitles[currentPosition]} (点击轮换)`;
  rotateButton.style.cssText = `
    background: none;
    border: 1px solid var(--ui-black-transparent);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    color: var(--ui-text-primary);
    transition: all 0.2s;
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
    background: var(--ui-white);
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
  const createPopupButton = (type, iconUrl, title) => {
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
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      font-family: inherit;
      gap: 8px;
    `;

    // 添加SVG图标
    const img = document.createElement("img");
    img.src = iconUrl;
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
    "侧边栏"
  );

  const bottomPopupButton = createPopupButton(
    POSITION_TYPES.BOTTOM_PANEL,
    iconBottom,
    "底部面板"
  );

  const windowPopupButton = createPopupButton(
    POSITION_TYPES.WINDOW,
    iconWindow,
    "独立窗口"
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
    // 更新轮换按钮的图标
    rotateBtnIcon.src = positionIcons[currentPosition];
    rotateButton.title = `当前位置: ${positionTitles[currentPosition]} (点击轮换)`;

    // 更新浮窗按钮的状态
    const popupButtons = popupContainer.querySelectorAll(".sa-terminal-popup-button");
    popupButtons.forEach(button => {
      if (button.dataset.position === currentPosition) {
        button.style.backgroundColor = "var(--ui-primary)";
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

  terminalHeader.appendChild(terminalTitle);
  terminalHeader.appendChild(continueButton);
  terminalHeader.appendChild(positionSwitchContainer);
  terminalContainer.appendChild(terminalHeader);

  // 创建终端输出区域
  const terminalOutput = document.createElement("div");
  terminalOutput.className = "sa-terminal-output";
  
  // 初始化欢迎信息
  const welcomeLine1 = document.createElement("div");
  welcomeLine1.textContent = "AstraEditor Terminal v1.0";
  terminalOutput.appendChild(welcomeLine1);
  
  const welcomeLine2 = document.createElement("div");
  welcomeLine2.textContent = "Type 'help' for available commands.";
  terminalOutput.appendChild(welcomeLine2);
  
  const welcomeLine3 = document.createElement("div");
  welcomeLine3.textContent = ""; // 空行
  terminalOutput.appendChild(welcomeLine3);

  terminalContainer.appendChild(terminalOutput);

  // 重复内容处理
  let lastLogElement = null;
  let lastLogContent = "";
  let lastLogCount = 1;

  const addLogLine = (content, element) => {
    // 检查是否与上一行内容相同
    const currentContent = content;
    
    if (currentContent === lastLogContent && lastLogElement) {
      // 重复内容，增加计数
      lastLogCount++;
      // 更新显示的计数
      let counter = lastLogElement.querySelector('.sa-terminal-log-counter');
      if (!counter) {
        counter = document.createElement("span");
        counter.className = "sa-terminal-log-counter";
        lastLogElement.insertBefore(counter, lastLogElement.firstChild);
      }
      counter.textContent = lastLogCount;
    } else {
      // 新内容，添加新行
      if (element) {
        terminalOutput.appendChild(element);
      } else {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        line.textContent = content;
        terminalOutput.appendChild(line);
      }
      
      // 更新上一行记录
      lastLogElement = element || terminalOutput.lastChild;
      lastLogContent = currentContent;
      lastLogCount = 1;
    }
    
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  };

  // 重置重复内容记录（用于非积木输出的内容）
  const resetLogTracking = () => {
    lastLogElement = null;
    lastLogContent = "";
    lastLogCount = 1;
  };

  // 获取元素的内容标识符（用于比较重复内容）
  const getElementContentHash = (element) => {
    return element.textContent.replace(/\s+/g, ' ').trim();
  };

  // 添加日志行（支持重复内容合并）
  const addLogLineWithElement = (element) => {
    const contentHash = getElementContentHash(element);
    
    if (contentHash === lastLogContent && lastLogElement) {
      // 重复内容，增加计数
      lastLogCount++;
      // 更新显示的计数
      let counter = lastLogElement.querySelector('.sa-terminal-log-counter');
      if (!counter) {
        counter = document.createElement("span");
        counter.className = "sa-terminal-log-counter";
        lastLogElement.insertBefore(counter, lastLogElement.firstChild);
      }
      counter.textContent = lastLogCount;
      // 移除重复的元素
      element.remove();
    } else {
      // 新内容，添加新行
      terminalOutput.appendChild(element);
      // 更新上一行记录
      lastLogElement = element;
      lastLogContent = contentHash;
      lastLogCount = 1;
    }
    
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  };

  
  // 添加断点积木
  addon.tab.addBlock("\u200B\u200Bterminal_breakpoint\u200B\u200B", {
    args: [],
    displayName: msg("block-breakpoint"),
    callback: (_, thread) => {
      // 检查是否在播放器模式下
      if (addon.tab.redux.state.scratchGui.mode.isPlayerOnly) {
        if (terminalOutput) {
          const line = document.createElement("div");
          line.className = "sa-terminal-log-line";
          
          const mark = document.createElement("span");
          mark.className = "sa-terminal-log-mark error";
          mark.textContent = "[error]";
          line.appendChild(mark);
          
          line.appendChild(document.createTextNode(" 断点积木只能在编辑器中使用。"));
          
          addLogLineWithElement(line);
        }
        return;
      }
      
      // 使用debugger的setPaused功能暂停VM
      setPausedDebugger(true);
      
      // 显示继续按钮
      continueButton.style.display = "inline-block";
      
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        const mark = document.createElement("span");
        mark.className = "sa-terminal-log-mark log";
        mark.textContent = "[breakpoint]";
        line.appendChild(mark);
        
        line.appendChild(document.createTextNode(" 程序已暂停"));
        
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        addLogLineWithElement(line);
      }
    },
  });

  // 添加输出块到 Scratch
  addon.tab.addBlock("\u200B\u200Bterminal_log\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-log"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        // 添加文本内容
        const textSpan = document.createElement("span");
        textSpan.textContent = text;
        line.appendChild(textSpan);
        
        // 添加跳转到块的链接
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        addLogLineWithElement(line);
      }
    },
  });

  addon.tab.addBlock("\u200B\u200Bterminal_log_colored\u200B\u200B %s %s", {
    args: ["text", "color"],
    displayName: msg("block-log-colored"),
    callback: ({ text, color }, thread) => {
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        // 添加彩色文本内容
        const textSpan = document.createElement("span");
        textSpan.style.color = color;
        textSpan.textContent = text;
        line.appendChild(textSpan);
        
        // 添加跳转到块的链接
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            link.style.color = ""; // 重置颜色，使用CSS定义的默认颜色
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        addLogLineWithElement(line);
      }
    },
  });

  // 添加日志积木（带 [log] 白色标记）
  addon.tab.addBlock("\u200B\u200Bterminal_log_debug\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-log-debug"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        const mark = document.createElement("span");
        mark.className = "sa-terminal-log-mark log";
        mark.textContent = "[log]";
        line.appendChild(mark);
        
        const textSpan = document.createElement("span");
        textSpan.textContent = " " + text;
        line.appendChild(textSpan);
        
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        addLogLineWithElement(line);
      }
    },
  });

  // 添加警告积木（带 [warn] 橙色标记）
  addon.tab.addBlock("\u200B\u200Bterminal_warn\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-warn"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        const mark = document.createElement("span");
        mark.className = "sa-terminal-log-mark warn";
        mark.textContent = "[warn]";
        line.appendChild(mark);
        
        const textSpan = document.createElement("span");
        textSpan.textContent = " " + text;
        line.appendChild(textSpan);
        
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        addLogLineWithElement(line);
      }
    },
  });

  // 添加错误积木（带 [error] 红色标记）
  addon.tab.addBlock("\u200B\u200Bterminal_error\u200B\u200B %s", {
    args: ["text"],
    displayName: msg("block-error"),
    callback: ({ text }, thread) => {
      if (terminalOutput) {
        const line = document.createElement("div");
        line.className = "sa-terminal-log-line";
        
        const mark = document.createElement("span");
        mark.className = "sa-terminal-log-mark error";
        mark.textContent = "[error]";
        line.appendChild(mark);
        
        const textSpan = document.createElement("span");
        textSpan.textContent = " " + text;
        line.appendChild(textSpan);
        
        if (thread) {
          const blockId = thread.peekStack();
          const targetId = thread.target.id;
          const targetInfo = getTargetInfoById(targetId);
          if (blockId && targetInfo.exists) {
            const link = createBlockLink(targetInfo, blockId);
            link.className = "sa-terminal-block-link";
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        addLogLineWithElement(line);
      }
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

  // 创建输入行
  const inputLine = document.createElement("div");
  inputLine.className = "sa-terminal-input-line";

  const prompt = document.createElement("span");
  prompt.className = "sa-terminal-prompt";
  prompt.textContent = "> ";

  const terminalInput = document.createElement("input");
  terminalInput.type = "text";
  terminalInput.className = "sa-terminal-input";
  terminalInput.placeholder = "Enter command...";

  inputLine.appendChild(prompt);
  inputLine.appendChild(terminalInput);
  terminalContainer.appendChild(inputLine);

  // 命令历史
  const commandHistory = [];
  let historyIndex = -1;

  // 存储用户输入用于返回值积木
  let lastUserInput = "";

  // 可用命令
  const commands = {
    help: {
      description: "Show available commands",
      execute: (args) => {
        let output = "Available commands:\n";
        for (const [name, cmd] of Object.entries(commands)) {
          output += `  ${name} - ${cmd.description}\n`;
        }
        return output;
      }
    },
    clear: {
      description: "Clear the terminal",
      execute: () => {
        terminalOutput.textContent = "";
        return "";
      }
    },
    echo: {
      description: "Echo the input text",
      execute: (args) => args.join(" ")
    },
    project: {
      description: "Show project information",
      execute: () => {
        try {
          const vm = addon.tab.traps.vm;
          const target = vm.runtime.getEditingTarget();
          const stage = vm.runtime.getTargetForStage();

          return `Project Information:
  Stage: ${stage.getName()}
  Current Sprite: ${target.getName()}
  Sprites: ${vm.runtime.targets.length - 1}
  Variables: ${Object.keys(stage.variables).length}
  Broadcasts: ${Object.keys(stage.blocks).filter(k => k.startsWith('broadcast_')).length}
`;
        } catch (e) {
          return "Error: Unable to get project information";
        }
      }
    },
    variables: {
      description: "List all variables",
      execute: () => {
        try {
          const vm = addon.tab.traps.vm;
          const target = vm.runtime.getEditingTarget();
          const stage = vm.runtime.getTargetForStage();

          let output = "Global Variables:\n";
          Object.values(stage.variables).forEach(v => {
            if (v.type === "" || v.type === "list") {
              const value = v.type === "list" ? `[${v.value.join(", ")}]` : v.value;
              output += `  ${v.name} = ${value}\n`;
            }
          });

          output += "\nLocal Variables:\n";
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
          return "Error: Unable to get variables";
        }
      }
    },
    sprites: {
      description: "List all sprites",
      execute: () => {
        try {
          const vm = addon.tab.traps.vm;
          let output = "Sprites:\n";
          vm.runtime.targets.forEach(target => {
            if (!target.isStage) {
              output += `  ${target.getName()}\n`;
            }
          });
          return output;
        } catch (e) {
          return "Error: Unable to get sprites";
        }
      }
    },
    version: {
      description: "Show terminal version",
      execute: () => "AstraEditor Terminal v1.0"
    },
    "creeper?": {
      description: "",
      execute: () => "Awwww Man!"
    }

  };

  // 执行命令
  const executeCommand = (command) => {
    const parts = command.trim().split(" ");
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // 存储用户输入
    lastUserInput = command.trim();

    // 添加到历史记录
    if (command.trim()) {
      commandHistory.push(command.trim());
      historyIndex = commandHistory.length;
    }

    // 重置重复内容记录，命令行不应该触发合并
    resetLogTracking();

    // 显示输入的命令 - 使用div保持格式
    const commandLine = document.createElement("div");
    commandLine.className = "sa-terminal-command-line";
    commandLine.textContent = `> ${command}`;
    terminalOutput.appendChild(commandLine);

    if (!cmdName) {
      return;
    }

    const cmd = commands[cmdName];
    if (cmd) {
      try {
        const result = cmd.execute(args);
        if (result) {
          // 使用pre标签保持格式
          const resultLine = document.createElement("div");
          resultLine.className = "sa-terminal-result-line";
          resultLine.textContent = result;
          terminalOutput.appendChild(resultLine);
        }
      } catch (e) {
        const errorLine = document.createElement("div");
        errorLine.className = "sa-terminal-error-line";
        errorLine.textContent = `Error: ${e.message}`;
        terminalOutput.appendChild(errorLine);
      }
    }
    // 不显示unknown command，允许用户输入任意内容

    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  };

  // 输入处理
  terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const command = terminalInput.value;
      terminalInput.value = "";
      executeCommand(command);
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
  toggleBtnIcon.style.width = '20px';
  toggleBtnIcon.style.height = '20px';

  // 只添加图标，不添加文本
  toggleButton.appendChild(toggleBtnIcon);

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
      terminalInput.focus();
      toggleButton.classList.add("sa-terminal-toggle-active");
    },
    onDeactivate: () => {
      toggleButton.classList.remove("sa-terminal-toggle-active");
    }
  });

  BottomPanel.register('terminal', terminalContainer, {
    onActivate: () => {
      terminalInput.focus();
      toggleButton.classList.add("sa-terminal-toggle-active");
      // 移除按钮栏的底部边框
      const buttonBar = BottomPanel.getButtonBar();
      if (buttonBar) {
        buttonBar.style.borderBottom = "none";
      }
    },
    onDeactivate: () => {
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
        }
        break;
      case POSITION_TYPES.WINDOW:
        // 独立窗口模式：添加到舞台头部
        addon.tab.appendToSharedSpace({
          space: "stageHeader",
          element: stageHeaderButton,
          order: 0
        });
        break;
    }

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
      window.dispatchEvent(new Event("resize"));
      break;
    }
    console.log("Button bar not found yet, waiting...");
    await new Promise(resolve => setTimeout(resolve, 100));
  }

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