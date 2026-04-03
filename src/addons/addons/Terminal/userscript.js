import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";

export default async function ({ addon, console, msg }) {
  // 创建终端容器
  const terminalContainer = document.createElement("div");
  addon.tab.displayNoneWhileDisabled(terminalContainer, { display: "flex" });
  terminalContainer.className = "sa-terminal-container";

  // 创建终端头部
  const terminalHeader = document.createElement("div");
  terminalHeader.className = "sa-terminal-header";

  const terminalTitle = document.createElement("span");
  terminalTitle.className = "sa-terminal-title";
  terminalTitle.textContent = "Scratch Terminal";

  const terminalStatus = document.createElement("span");
  terminalStatus.className = "sa-terminal-status";
  terminalStatus.textContent = "● Ready";

  terminalHeader.appendChild(terminalTitle);
  terminalHeader.appendChild(terminalStatus);
  terminalContainer.appendChild(terminalHeader);

  // 创建终端输出区域
  const terminalOutput = document.createElement("div");
  terminalOutput.className = "sa-terminal-output";
  terminalOutput.textContent = `Scratch Terminal v1.0
Type 'help' for available commands.
`;

  terminalContainer.appendChild(terminalOutput);

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
      execute: () => "Scratch Terminal v1.0"
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
  toggleButton.textContent = "⌨ Terminal";
  toggleButton.style.cssText = `
    padding: 0 12px;
    background: var(--ui-white);
    border: none;
    border-right: 1px solid var(--ui-black-transparent);
    height: 24px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  `;

  toggleButton.addEventListener("mouseover", () => {
    if (!toggleButton.classList.contains("sa-terminal-toggle-active")) {
      toggleButton.style.background = "var(--ui-primary)";
      toggleButton.style.color = "var(--ui-white)";
    }
  });

  toggleButton.addEventListener("mouseout", () => {
    if (!toggleButton.classList.contains("sa-terminal-toggle-active")) {
      toggleButton.style.background = "var(--ui-white)";
      toggleButton.style.color = "var(--text-primary)";
    }
  });

  addon.tab.displayNoneWhileDisabled(toggleButton);

  // 注册面板插件
  BottomPanel.register('terminal', terminalContainer, {
    onActivate: () => {
      terminalInput.focus();
      toggleButton.classList.add("sa-terminal-toggle-active");
      toggleButton.style.background = "var(--ui-primary)";
      toggleButton.style.color = "var(--ui-white)";
    },
    onDeactivate: () => {
      toggleButton.classList.remove("sa-terminal-toggle-active");
      toggleButton.style.background = "var(--ui-white)";
      toggleButton.style.color = "var(--text-primary)";
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