import _js from './userscript.js';
import _css from '!css-loader!./style.css';
import _folder from '!raw-loader!./assets/folder.svg';
import _folderOpen from '!raw-loader!./assets/folder-open.svg';
import _file from '!raw-loader!./assets/file.svg';
import _stage from '!raw-loader!./assets/stage.svg';
import _expand from '!raw-loader!./assets/expand.svg';
import _collapse from '!raw-loader!./assets/collapse.svg';
import _newFolder from '!raw-loader!./assets/new-folder.svg';

export const resources = {
    'userscript.js': _js,
    'style.css': _css,
    'assets/folder.svg': _folder,
    'assets/folder-open.svg': _folderOpen,
    'assets/file.svg': _file,
    'assets/stage.svg': _stage,
    'assets/expand.svg': _expand,
    'assets/collapse.svg': _collapse,
    'assets/new-folder.svg': _newFolder
};
