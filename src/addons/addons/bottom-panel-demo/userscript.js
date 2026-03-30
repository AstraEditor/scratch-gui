import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";

export default async function ({ addon, console, msg }) {
  // 创建演示内容
  const demoContent = document.createElement("div");
  demoContent.style.cssText = `
    padding: 10px;
    font-family: sans-serif;
  `;

  const title = document.createElement("h3");
  title.textContent = "工作区下方面板演示";
  title.style.cssText = `
    margin: 0 0 10px 0;
    color: var(--text-primary);
  `;

  const description = document.createElement("p");
  description.textContent = "这是一个显示在工作区下方的面板容器。";
  description.style.cssText = `
    margin: 0 0 10px 0;
    color: var(--text-primary);
    font-size: 14px;
  `;

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "在这里输入内容...";
  input.style.cssText = `
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
    border: 1px solid var(--ui-black-transparent);
    border-radius: 4px;
    font-size: 14px;
  `;

  const output = document.createElement("div");
  output.textContent = "输出内容将显示在这里";
  output.style.cssText = `
    padding: 10px;
    background: var(--ui-primary);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 14px;
    min-height: 40px;
  `;

  input.addEventListener("input", (e) => {
    output.textContent = e.target.value || "输出内容将显示在这里";
  });

  demoContent.appendChild(title);
  demoContent.appendChild(description);
  demoContent.appendChild(input);
  demoContent.appendChild(output);

  // 创建切换按钮
  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = msg("toggle-panel");
  toggleBtn.className = addon.tab.scratchClass("button_button");
  toggleBtn.style.cssText = `
    margin: 10px;
  `;

  // 注册面板插件
  BottomPanel.register('bottom-panel-demo', demoContent, {
    onActivate: () => {
      console.log('底部面板已激活');
      toggleBtn.textContent = msg("close-panel");
      toggleBtn.classList.add(addon.tab.scratchClass("button_is-active"));
    },
    onDeactivate: () => {
      console.log('底部面板已停用');
      toggleBtn.textContent = msg("toggle-panel");
      toggleBtn.classList.remove(addon.tab.scratchClass("button_is-active"));
    }
  });

  // 按钮点击事件
  toggleBtn.addEventListener("click", () => {
    if (BottomPanel.isOpen() && BottomPanel.getActivePlugin() === 'bottom-panel-demo') {
      BottomPanel.close();
    } else {
      BottomPanel.switchTo('bottom-panel-demo');
    }
  });

  // 添加到菜单栏
  while (true) {
    await addon.tab.waitForElement("[class*='menu-bar_menu-bar']", {
      markAsSeen: true,
      reduxEvents: ["scratch-gui/mode/SET_PLAYER", "fontsLoaded/SET_FONTS_LOADED", "scratch-gui/locales/SELECT_LOCALE"],
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    addon.tab.appendToSharedSpace({ space: "menuBar", element: toggleBtn, order: 0 });
  }

  addon.self.addEventListener("disabled", () => {
    if (BottomPanel.getActivePlugin() === 'bottom-panel-demo') {
      BottomPanel.close();
    }
  });
}