const manifest = {
  "editorOnly": true,
  "dynamicDisable": false,
  "name": "Terminal",
  "description": "A Terminal at the bottom of the editor, you can execute commands to view project information and debug",
  "tags": ["new","recommanded"],
  "credits": [
    {
      name: "Cyberexplorer",
      link: "https://github.com/LanwyWriteXU"
    }
  ],
  "enabledByDefault": false,
  "userscripts": [
    {
      url: "userscript.js"
    }
  ],
  "userstyles": [
    {
      url: "terminal.css"
    }
  ],
  "info": [
    {
      "type": "notice",
      "text": "When the Debugger plugin is enabled simultaneously, there is a probability that the blocks may not load.I hope it can replace the Debugger plugin and be even better and more superior.",
      "id": "notice"
    }
  ]
};
export default manifest;