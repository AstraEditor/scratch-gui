const manifest = {
    name: 'Sprite File List View',
    description: 'Transforms the sprite list into a VSCode-style file explorer with folders (works with // folder naming).',
    tags: ['theme', 'new', 'MistWarp'],
    "credits": [
    {
      "name": "Mistium",
      "link": "https://mistium.com/"
    },
    {
      "name": "Bilup (Translations)",
      "link": "https://www.bilup.org/"
    }
  ],
    userscripts: [
        {
            url: 'userscript.js'
        }
    ],
    userstyles: [
        {
            url: 'style.css'
        }
    ],
    enabledByDefault: false
};
export default manifest;
