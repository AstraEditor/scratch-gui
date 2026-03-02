const manifest = {
    name: 'Sprite File List View',
    description: 'Transforms the sprite list into a VSCode-style file explorer with folders (works with // folder naming).',
    tags: ['editor', 'sprites', 'MistWarp'],
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
