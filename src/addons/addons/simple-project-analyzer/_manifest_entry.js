const manifest = {
  "editorOnly": true,
  "name": "Simple Project Analyzer",
  "description": "Analyses your Scratch project and shows detailed statistics including Dr.Scratch scoring, block distribution and more.",
  "credits": [
    {
      name: "Cyberexplorer",
      link: "https://github.com/LanwyWriteXU"
    },
    {
      name: "KOSHINO",
      link: "https://github.com/KOSHINOawa"
    }
  ],
  "tags": [
    "recommended",
    "new",
    "development"
  ],
  "dynamicDisable": true,
  "userscripts": [
    {
      url: "userscript.js"
    }
  ],
  "userstyles": [
    {
      url: "userstyle.css"
    }
  ],
  "enabledByDefault": true
};
export default manifest;