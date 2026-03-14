/**
 * @license
 * ScratchComment Markdown Editor addon
 */

const manifest = {
    editorOnly: true,
    noTranslations: true,
    name: 'Comment Markdown Editor',
    description: 'Add Markdown editing and preview functions to the annotation boxes, supporting syntax such as headings, bold, italic, code and links. Use the shortcut key Ctrl+M to quickly switch between editing and preview modes.',
    tags: ["new"],
    credits: [
        {
            name: 'NeuronPulse',
            link: 'https://github.com/NeuronPulse/tw-comment-markdown-editor/'
        }
    ],
    userstyles: [
        {
            url: 'userstyle.css'
        }
    ],
    userscripts: [
        {
            url: 'userscript.js'
        }
    ],
    dynamicDisable: true,
    enabledByDefault: false
};

export default manifest;
