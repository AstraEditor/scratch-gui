import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";
import icon from "!../../../lib/tw-recolor/build!./logo.svg";

export default async function ({ addon, console, msg }) {
  const vm = addon.tab.traps.vm;

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

  terminalHeader.appendChild(terminalTitle);
  terminalContainer.appendChild(terminalHeader);

  // 创建终端输出区域
  const terminalOutput = document.createElement("div");
  terminalOutput.className = "sa-terminal-output";
  terminalOutput.textContent = `AstraEditor Terminal v1.0
Type 'help' for available commands.
`;

  terminalContainer.appendChild(terminalOutput);

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
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
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
            link.style.color = "var(--ui-primary)";
            line.appendChild(document.createTextNode(" ["));
            line.appendChild(link);
            line.appendChild(document.createTextNode("]"));
          }
        }
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
      }
    },
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
      execute: () => "Awwww Man!"
    }

  };

  // 执行命令
  const executeCommand = (command) => {
    const parts = command.trim().split(" ");
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // 添加到历史记录
    if (command.trim()) {
      commandHistory.push(command.trim());
      historyIndex = commandHistory.length;
    }

    // 显示输入的命令
    terminalOutput.textContent += `> ${command}\n`;

    if (!cmdName) {
      return;
    }

    const cmd = commands[cmdName];
    if (cmd) {
      try {
        const result = cmd.execute(args);
        if (result) {
          terminalOutput.textContent += result + "\n";
        }
      } catch (e) {
        terminalOutput.textContent += `Error: ${e.message}\n`;
      }
    } else {
      terminalOutput.textContent += `Unknown command: ${cmdName}. Type 'help' for available commands.\n`;
    }

    terminalOutput.textContent += "\n";
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
      break;
    }
    console.log("Button bar not found yet, waiting...");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}