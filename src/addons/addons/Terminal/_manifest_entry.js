const manifest = {
  "editorOnly": true,
  "dynamicDisable": true,
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
  ]
};
export default manifest;