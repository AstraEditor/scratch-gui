import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";
import icon from "!../../../lib/tw-recolor/build!./logo.svg";
import { setup as setupDebugger, setPaused as setPausedDebugger } from "../debugger/module.js";

export default async function ({ addon, console, msg }) {
  const vm = addon.tab.traps.vm;
  
  // 初始化debugger模块
  setupDebugger(addon);

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
  continueButton.innerHTML = "▶";
  continueButton.title = "继续运行";
  continueButton.style.display = "none";
  
  continueButton.addEventListener("click", () => {
    setPausedDebugger(false);
    continueButton.style.display = "none";
  });

  terminalHeader.appendChild(terminalTitle);
  terminalHeader.appendChild(continueButton);
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

  // 创建底部的Terminal开关按钮
  const toggleButton = document.createElement("button");
  toggleButton.className = "sa-terminal-toggle-button";

  // 创建图标元素 - 使用 tw-recolor loader 加载图标（会自动替换为主题色）
  const toggleBtnIcon = document.createElement("img");
  toggleBtnIcon.draggable = false;
  toggleBtnIcon.src = icon();
  toggleBtnIcon.style.filter = "grayscale(100%)";

  // 创建文本元素
  const toggleBtnText = document.createElement("span");
  toggleBtnText.innerText = "Terminal";

  // 组合按钮内容
  toggleButton.appendChild(toggleBtnIcon);
  toggleButton.appendChild(toggleBtnText);

  addon.tab.displayNoneWhileDisabled(toggleButton);

  // 注册面板插件
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

  // 按钮点击事件
  toggleButton.addEventListener("click", () => {
    if (BottomPanel.isOpen() && BottomPanel.getActivePlugin() === 'terminal') {
      BottomPanel.close();
    } else {
      BottomPanel.switchTo('terminal');
    }
  });

  // 监听 Bottom Panel 打开事件，确保 Terminal 激活时移除边框
  window.addEventListener('bottomPanelOpened', () => {
    if (BottomPanel.getActivePlugin() === 'terminal') {
      const buttonBar = BottomPanel.getButtonBar();
      if (buttonBar) {
        buttonBar.style.borderBottom = "none";
      }
    }
  });

  // 将按钮添加到BottomPanel的按钮栏
  while (true) {
    const buttonBar = BottomPanel.getButtonBar();
    if (buttonBar) {
      console.log("Button bar found, adding terminal button");
      buttonBar.appendChild(toggleButton);
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
}