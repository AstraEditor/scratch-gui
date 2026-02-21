import addSmallStageClass from "../../libraries/common/cs/small-stage.js";

export default async function ({ addon, console }) {
  // 创建 FPS 显示容器
  const fpsContainerContainer = document.createElement("div");
  addon.tab.displayNoneWhileDisabled(fpsContainerContainer, { display: "flex" });

  const fpsContainer = document.createElement("div");
  const fpsText = document.createElement("span");

  fpsContainerContainer.className = "fps-container-container";
  fpsContainer.className = "fps-container";

  fpsContainerContainer.appendChild(fpsContainer);
  fpsContainer.appendChild(fpsText);

  const vm = addon.tab.traps.vm;

  // FPS 计算逻辑 - 参考 debugger/performance.js
  const renderTimes = [];
  let lastFpsTime = performance.now();
  let currentFps = 60;
  let updateInterval = null;

  const updateFps = () => {
    if (addon.self.disabled) return;

    const now = performance.now();

    // 移除超过 1 秒的帧时间记录
    while (renderTimes.length > 0 && renderTimes[0] <= now - 1000) {
      renderTimes.shift();
    }
    renderTimes.push(now);

    // 每秒更新一次显示
    if (now - lastFpsTime >= 1000) {
      lastFpsTime = now;

      // 获取目标帧率
      const maxFps = vm.runtime.frameLoop.framerate === 0 ? 60 : vm.runtime.frameLoop.framerate;
      currentFps = Math.min(renderTimes.length, maxFps);
      fpsText.style.color = currentFps > maxFps * 0.7 ? "#82c1ff" : (
        currentFps > maxFps * 0.5 ? "#82ff97" : (
          currentFps > maxFps * 0.2 ? "rgb(255, 197, 130)" : "rgb(255, 130, 130)"
        )

      )
      fpsText.setAttribute("data-content", `${currentFps} FPS`);
    }
  };

  // 使用 addAfterStepCallback 在每次 VM step 后更新 FPS
  const originalStep = vm.runtime._step;
  vm.runtime._step = function (...args) {
    const ret = originalStep.call(this, ...args);
    updateFps();
    return ret;
  };

  // 初始化显示
  fpsText.setAttribute("data-content", "60 FPS");

  addSmallStageClass();

  while (true) {
    await addon.tab.waitForElement('[class*="controls_controls-container"]', {
      markAsSeen: true,
      reduxEvents: [
        "scratch-gui/mode/SET_PLAYER",
        "fontsLoaded/SET_FONTS_LOADED",
        "scratch-gui/locales/SELECT_LOCALE"
      ],
    });

    if (addon.tab.editorMode === "editor") {
      addon.tab.appendToSharedSpace({ space: "afterStopButton", element: fpsContainerContainer, order: 0 });
    } else {
      fpsContainerContainer.remove();
    }
  }
}