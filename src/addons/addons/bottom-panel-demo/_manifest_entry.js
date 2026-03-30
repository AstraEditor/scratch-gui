export default {
  id: "bottom-panel-demo",
  name: "底部面板演示",
  description: "演示如何使用工作区下方面板组件",
  version: "1.0.0",
  author: "Your Name",
  credits: [],
  dynamicEnable: true,
  dynamicDisable: true,
  userscripts: [
    {
      url: "userscript.js",
      matches: ["https://scratch.mit.edu/projects/*"]
    }
  ]
};