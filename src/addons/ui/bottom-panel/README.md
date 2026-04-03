# 工作区下方面板组件 (Bottom Panel)

## 概述

这是一个用于在Scratch编辑器工作区下方显示内容的容器组件。它的位置和书包容器一样，显示在编辑区下方。

## 使用方式

### 基本使用

```javascript
import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";

// 创建演示内容
const demoContent = document.createElement("div");
demoContent.textContent = "这是底部面板的内容";

// 注册插件
BottomPanel.register('my-plugin', demoContent, {
  onActivate: () => console.log('插件已激活'),
  onDeactivate: () => console.log('插件已停用')
});

// 切换到插件
BottomPanel.switchTo('my-plugin');

// 关闭面板
BottomPanel.close();
```

### 完整示例

```javascript
import BottomPanel from "../../ui/bottom-panel/bottom-panel.js";

export default async function ({ addon, console, msg }) {
  // 创建内容
  const content = document.createElement("div");
  content.innerHTML = `
    <h3>我的面板</h3>
    <p>这是我的自定义面板内容</p>
  `;

  // 注册插件
  BottomPanel.register('my-plugin', content, {
    onActivate: () => {
      console.log('面板已激活');
    },
    onDeactivate: () => {
      console.log('面板已停用');
    }
  });

  // 创建切换按钮
  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "切换面板";
  toggleBtn.className = addon.tab.scratchClass("button_button");

  // 按钮点击事件
  toggleBtn.addEventListener("click", () => {
    if (BottomPanel.isOpen() && BottomPanel.getActivePlugin() === 'my-plugin') {
      BottomPanel.close();
    } else {
      BottomPanel.switchTo('my-plugin');
    }
  });

  // 添加到菜单栏
  addon.tab.appendToSharedSpace({ 
    space: "menuBar", 
    element: toggleBtn, 
    order: 0 
  });

  // 禁用时清理
  addon.self.addEventListener("disabled", () => {
    if (BottomPanel.getActivePlugin() === 'my-plugin') {
      BottomPanel.close();
    }
  });
}
```

## API

### 静态方法

#### `BottomPanel.register(pluginName, content, callbacks)`

注册一个插件到面板。

- `pluginName` (string): 插件名称（唯一标识）
- `content` (Element): 插件内容元素
- `callbacks` (Object): 回调函数
  - `onActivate` (Function): 插件激活时调用
  - `onDeactivate` (Function): 插件停用时调用

#### `BottomPanel.switchTo(pluginName)`

切换到指定插件。

- `pluginName` (string): 插件名称

#### `BottomPanel.close()`

关闭面板。

#### `BottomPanel.open()`

打开面板（保持当前内容）。

#### `BottomPanel.isOpen()`

检查面板是否打开。

返回值: (boolean)

#### `BottomPanel.getActivePlugin()`

获取当前活动插件名称。

返回值: (string|null)

#### `BottomPanel.setContent(content)`

设置面板内容。

- `content` (Element): 内容元素

#### `BottomPanel.clearContent()`

清空面板内容。

#### `BottomPanel.getContentContainer()`

获取内容容器。

返回值: (Element|null)

#### `BottomPanel.getHeight()`

获取面板高度。

返回值: (number)

#### `BottomPanel.destroy()`

销毁面板实例（仅用于彻底清理）。

## 样式

面板使用以下CSS类：

- `.addons-bottom-panel`: 面板容器
- `.addons-bottom-panel-content`: 内容容器
- `.addons-bottom-panel-resize-handle`: 调整大小手柄

可以通过CSS自定义样式：

```css
.addons-bottom-panel {
  background-color: var(--ui-white);
  border-top: 1px solid var(--ui-black-transparent);
}
```

## 高度调整

- 默认高度: 200px
- 最小高度: 100px
- 最大高度: 500px

用户可以通过拖动顶部的调整手柄来改变面板高度。

## 注意事项

1. 面板只显示在编辑器模式，不在播放器模式
2. 多个插件可以注册到同一个面板，通过 `switchTo` 方法切换
3. 插件名称必须唯一
4. 建议在addon禁用时调用 `close()` 方法清理状态

## 示例项目

项目中包含一个完整的示例：`src/addons/addons/bottom-panel-demo/`

该示例演示了：
- 如何创建面板内容
- 如何注册插件
- 如何创建切换按钮
- 如何处理激活/停用事件
- 如何在禁用时清理资源

## 兼容性

- 支持所有现代浏览器
- 与现有的侧边栏系统兼容
- 与VSCode布局兼容