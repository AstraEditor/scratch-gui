// We don't use this file


// /**
//  * Copyright (C) 2021 Thomas Weber
//  *
//  * This program is free software: you can redistribute it and/or modify
//  * it under the terms of the GNU General Public License version 3 as
//  * published by the Free Software Foundation.
//  *
//  * This program is distributed in the hope that it will be useful,
//  * but WITHOUT ANY WARRANTY; without even the implied warranty of
//  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  * GNU General Public License for more details.
//  *
//  * You should have received a copy of the GNU General Public License
//  * along with this program.  If not, see <https://www.gnu.org/licenses/>.
//  */

// /* eslint-disable import/no-commonjs */
// /* eslint-disable import/no-nodejs-modules */
// /* eslint-disable no-console */
// /* global __dirname */

// const fs = require('fs');
// const childProcess = require('child_process');
// const rimraf = require('rimraf');
// const pathUtil = require('path');
// const {addons, newAddons} = require('./addons.js');

// // 遍历目录中的所有文件
// const walk = dir => {
//     const children = fs.readdirSync(dir);
//     const files = [];
//     for (const child of children) {
//         const path = pathUtil.join(dir, child);
//         const stat = fs.statSync(path);
//         if (stat.isDirectory()) {
//             const childChildren = walk(path);
//             for (const childChild of childChildren) {
//                 files.push(pathUtil.join(child, childChild));
//             }
//         } else {
//             files.push(child);
//         }
//     }
//     return files;
// };

// // 深度克隆对象
// const clone = obj => JSON.parse(JSON.stringify(obj));

// const repoPath = pathUtil.resolve(__dirname, 'ScratchAddons');
// if (!process.argv.includes('-')) {
//     rimraf.sync(repoPath);
//     childProcess.execSync(`git clone --depth=1 --branch=tw https://github.com/TurboWarp/addons ${repoPath}`);
// }

// // 创建必要的目录
// for (const folder of ['addons', 'addons-l10n', 'addons-l10n-settings', 'libraries']) {
//     const path = pathUtil.resolve(__dirname, folder);
//     rimraf.sync(path);
//     fs.mkdirSync(path, {recursive: true});
// }

// const generatedPath = pathUtil.resolve(__dirname, 'generated');
// rimraf.sync(generatedPath);
// fs.mkdirSync(generatedPath, {recursive: true});

// process.chdir(repoPath);
// const commitHash = childProcess.execSync('git rev-parse --short HEAD')
//     .toString()
//     .trim();

// // 用于生成导入语句的类
// class GeneratedImports {
//     constructor () {
//         this.source = '';
//         this.namespaces = new Map();
//     }

//     add (src, namespace) {
//         // 在Windows上，将路径中的\转换为/
//         src = src.replace(/\\/g, '/');

//         namespace = namespace.replace(/[^\w\d_]/g, '_');

//         const count = this.namespaces.get(namespace) || 1;
//         this.namespaces.set(namespace, count + 1);

//         // 所有标识符都应该以_开头，这样像debugger和2d-color-picker这样的名称将是有效标识符
//         let importName = `_${namespace}`;
//         if (count !== 1) {
//             importName += `${count}`;
//         }

//         this.source += `import ${importName} from ${JSON.stringify(src)};\n`;
//         return importName;
//     }

//     toString () {
//         return this.source;
//     }
// }

// // 匹配所有正则表达式匹配项
// const matchAll = (str, regex) => {
//     const matches = [];
//     let match;
//     while ((match = regex.exec(str)) !== null) {
//         matches.push(match);
//     }
//     return matches;
// };

// // 包含导入的库
// const includeImportedLibraries = contents => {
//     // 解析如下内容：
//     // import { normalizeHex, getHexRegex } from "../../libraries/normalize-color.js";
//     // import RateLimiter from "../../libraries/rate-limiter.js";
//     // import "../../libraries/thirdparty/cs/chart.min.js";
//     const matches = matchAll(
//         contents,
//         /import +(?:(?:{.*}|.*) +from +)?["']\.\.\/\.\.\/libraries\/([\w\d_./-]+(?:\.esm)?\.js)["'];/g
//     );
//     for (const match of matches) {
//         const libraryFile = match[1];
//         const oldLibraryPath = pathUtil.resolve(__dirname, 'ScratchAddons', 'libraries', libraryFile);
//         const newLibraryPath = pathUtil.resolve(__dirname, 'libraries', libraryFile);
//         const libraryContents = fs.readFileSync(oldLibraryPath, 'utf-8');
//         const newLibraryDirName = pathUtil.dirname(newLibraryPath);
//         fs.mkdirSync(newLibraryDirName, {
//             recursive: true
//         });
//         fs.writeFileSync(newLibraryPath, libraryContents);
//     }
// };

// // 包含必要的polyfill
// const includePolyfills = contents => {
//     if (contents.includes('EventTarget')) {
//         contents = `import EventTarget from "../../event-target.js"; /* 由pull.js插入 */\n\n${contents}`;
//     }
//     return contents;
// };

// // 检测未实现的API
// const detectUnimplementedAPIs = (addonId, contents) => {
//     if (contents.includes('data-addon-id')) {
//         console.warn(`警告：${addonId}似乎使用了data-addon-id。应该使用[data-addons*=...]代替。`);
//     }

//     if (contents.includes('addon.self.dir')) {
//         // eslint-disable-next-line max-len
//         console.warn(`警告：${addonId}包含未重写的addon.self.dir。应该修改它或此脚本，以便它将被重写。`);
//     }

//     if (contents.includes('addon.self.lib')) {
//         // eslint-disable-next-line max-len
//         console.warn(`警告：${addonId}包含未重写的addon.self.lib。应该使用现代ES6导入语句。`);
//     }
// };

// // 重写资源导入
// const rewriteAssetImports = contents => {
//     // 将addon.self.dir连接重写为调用运行时函数。

//     // 重写如下内容：
//     // el.src = addon.self.dir + "/" + name + ".svg";
//     //          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  匹配
//     //                           ^^^^^^^^^^^^^^^^^^^  捕获组1
//     contents = contents.replace(
//         /addon\.self\.(?:dir|lib) *\+ *([^;,\n]+)/g,
//         (_fullText, name) => `addon.self.getResource(${name}) /* 由pull.js重写 */`
//     );

//     // 重写如下内容：
//     // `${addon.self.dir}/${name}.svg`
//     //                   ^^^^^^^^^^^^  捕获组1
//     contents = contents.replace(
//         /`\${addon\.self\.(?:dir|lib)}([^`]+)`/g,
//         (_fullText, name) => `addon.self.getResource(\`${name}\`) /* 由pull.js重写 */`
//     );

//     return contents;
// };

// // 规范化清单文件
// const normalizeManifest = (id, manifest) => {
//     const KEEP_TAGS = [
//         'recommended',
//         'theme',
//         'beta',
//         'danger'
//     ];
//     manifest.tags = manifest.tags.filter(i => KEEP_TAGS.includes(i));
//     if (newAddons.includes(id)) {
//         manifest.tags.push('new');
//     }

//     delete manifest.versionAdded;
//     delete manifest.latestUpdate;
//     delete manifest.libraries;
//     delete manifest.injectAsStyleElt;
//     delete manifest.updateUserstylesOnSettingsChange;
//     delete manifest.presetPreview;

//     // 所有插件都有动态启用功能
//     delete manifest.dynamicEnable;

//     // 过滤用户脚本
//     const filterUserscripts = scripts => scripts
//         .filter(({matches}) => matches.includes('projects') || matches.includes('https://scratch.mit.edu/projects/*'))
//         .map(obj => ({
//             url: obj.url,
//             if: obj.if
//         }));

//     if (manifest.userscripts) {
//         manifest.userscripts = filterUserscripts(manifest.userscripts);
//     }
//     if (manifest.userstyles) {
//         manifest.userstyles = filterUserscripts(manifest.userstyles);
//     }

//     // 处理贡献者信息
//     if (manifest.credits) {
//         for (const user of manifest.credits) {
//             if (user.link && !user.link.startsWith('https://scratch.mit.edu/')) {
//                 console.warn(`警告：${id}包含不安全的贡献者链接：${user.link}`);
//             }

//             delete user.note;
//             delete user.id;
//         }
//     }
// };

// // 生成清单条目
// const generateManifestEntry = (id, manifest) => {
//     const trimmedManifest = clone(manifest);
//     delete trimmedManifest.enabledByDefaultMobile;
//     delete trimmedManifest.permissions;

//     let result = '/* 由pull.js生成 */\n';
//     result += `const manifest = ${JSON.stringify(trimmedManifest, null, 2)};\n`;
//     if (typeof manifest.enabledByDefaultMobile === 'boolean') {
//         result += 'import {isMobile} from "../../environment";\n';
//         result += `if (isMobile) manifest.enabledByDefault = ${manifest.enabledByDefaultMobile};\n`;
//     }
//     if (manifest.permissions && manifest.permissions.includes('clipboardWrite')) {
//         result += 'import {clipboardSupported} from "../../environment";\n';
//         result += 'if (!clipboardSupported) manifest.unsupported = true;\n';
//     }
//     if (id === 'mediarecorder') {
//         result += 'import {mediaRecorderSupported} from "../../environment";\n';
//         result += 'if (!mediaRecorderSupported) manifest.unsupported = true;\n';
//     }
//     if (id === 'tw-disable-cloud-variables') {
//         result += 'import {isScratchDesktop} from "../../../lib/isScratchDesktop";\n';
//         result += 'if (isScratchDesktop()) manifest.unsupported = true;\n';
//     }
//     result += 'export default manifest;\n';
//     return result;
// };

// // 生成运行时条目
// const generateRuntimeEntry = (id, manifest, assets) => {
//     const importSection = new GeneratedImports();
//     let exportSection = 'export const resources = {\n';

//     // 处理用户脚本
//     for (const userscript of manifest.userscripts || []) {
//         const src = userscript.url;
//         const importName = importSection.add(`./${src}`, 'js');
//         exportSection += `  ${JSON.stringify(src)}: ${importName},\n`;
//     }

//     // 处理用户样式
//     for (const userstyle of manifest.userstyles || []) {
//         const src = userstyle.url;
//         const importName = importSection.add(`!css-loader!./${src}`, 'css');
//         exportSection += `  ${JSON.stringify(src)}: ${importName},\n`;
//     }

//     // 处理资源文件
//     for (const assetName of assets) {
//         const importName = importSection.add(`!url-loader!./${assetName}`, 'asset');
//         exportSection += `  ${JSON.stringify(assetName)}: ${importName},\n`;
//     }

//     exportSection += '};\n';
//     let result = '/* 由pull.js生成 */\n';
//     result += importSection.toString();
//     result += exportSection;
//     return result;
// };

// const addonIdToManifest = {};
// // 处理单个插件
// const processAddon = (id, oldDirectory, newDirectory) => {
//     const files = walk(oldDirectory);

//     const ASSET_EXTENSIONS = [
//         '.svg',
//         '.png'
//     ];
//     const assets = files.filter(file => ASSET_EXTENSIONS.some(extension => file.endsWith(extension)));

//     for (const file of files) {
//         const oldPath = pathUtil.join(oldDirectory, file);
//         let contents = fs.readFileSync(oldPath);

//         const newPath = pathUtil.join(newDirectory, file);
//         fs.mkdirSync(pathUtil.dirname(newPath), {recursive: true});

//         if (file === 'addon.json') {
//             contents = contents.toString('utf-8');
//             const parsedManifest = JSON.parse(contents);
//             normalizeManifest(id, parsedManifest);
//             addonIdToManifest[id] = parsedManifest;

//             const settingsEntryPath = pathUtil.join(newDirectory, '_manifest_entry.js');
//             fs.writeFileSync(settingsEntryPath, generateManifestEntry(id, parsedManifest));

//             const runtimeEntryPath = pathUtil.join(newDirectory, '_runtime_entry.js');
//             fs.writeFileSync(runtimeEntryPath, generateRuntimeEntry(id, parsedManifest, assets));
//             continue;
//         }

//         if (file.endsWith('.js') || file.endsWith('.css')) {
//             contents = contents.toString('utf-8');

//             if (file.endsWith('.js')) {
//                 includeImportedLibraries(contents);
//                 contents = includePolyfills(contents);
//                 contents = rewriteAssetImports(contents);
//             }

//             detectUnimplementedAPIs(id, contents);
//         }

//         fs.writeFileSync(newPath, contents);
//     }
// };

// // 跳过的消息列表
// const SKIP_MESSAGES = [
//     '_general/meta/addonSettings',
//     '_general/meta/managedBySa',
//     '_locale',
//     '_locale_name',
//     'debugger/@settings-name-log_max_list_length',
//     'debugger/log-msg-list-append-too-long',
//     'debugger/log-msg-list-insert-too-long',
//     'debugger/@settings-name-log_invalid_cloud_data',
//     'debugger/log-cloud-data-nan',
//     'debugger/log-cloud-data-too-long',
//     'editor-devtools/extension-description-not-for-addon',
//     'mediarecorder/added-by',
//     'editor-theme3/@settings-name-sa-color',
//     'editor-theme3/@settings-name-forums',
//     'editor-theme3/@info-disablesMenuBar',
//     'editor-theme3/@info-aboutHighContrast',
//     'editor-theme3/@settings-name-monitors',
//     'block-switching/@settings-name-sa',
//     'custom-menu-bar/@credits-dropdown',
//     'custom-menu-bar/@credits-tutorials-button',
//     'custom-menu-bar/@info-tutorials-button-update',
//     'custom-menu-bar/@settings-name-compact-username',
//     'custom-menu-bar/@settings-name-hide-tutorials-button',
//     'custom-menu-bar/@settings-name-my-stuff'
// ];

// // 解析消息目录
// const parseMessageDirectory = localeRoot => {
//     const unstructure = string => {
//         if (typeof string === 'object') {
//             return string.string;
//         }
//         return string;
//     };

//     const settings = {};
//     const runtime = {};
//     const upstreamMessageIds = new Set();

//     for (const addon of ['_general', ...addons]) {
//         const path = pathUtil.join(localeRoot, `${addon}.json`);
//         try {
//             const contents = fs.readFileSync(path, 'utf-8');
//             const parsed = JSON.parse(contents);
//             for (const id of Object.keys(parsed).sort()) {
//                 upstreamMessageIds.add(id);
//                 if (SKIP_MESSAGES.includes(id)) {
//                     continue;
//                 }

//                 // 以/@update结尾的消息是描述新功能的临时通知。
//                 // 我们不显示它们。
//                 if (id.endsWith('/@update')) {
//                     continue;
//                 }

//                 const value = unstructure(parsed[id]);
//                 if (id.includes('/@')) {
//                     settings[id] = value;
//                 } else {
//                     runtime[id] = value;
//                 }
//             }
//         } catch (e) {
//             // 忽略文件不存在导致的错误。
//             if (e.code !== 'ENOENT') {
//                 throw e;
//             }
//         }
//     }

//     return {
//         settings,
//         runtime,
//         upstreamMessageIds
//     };
// };

// // 生成条目
// const generateEntries = (items, callback) => {
//     let exportSection = 'export default {\n';
//     const importSection = new GeneratedImports();
//     for (const i of items) {
//         const {src, name, type} = callback(i);
//         if (type === 'lazy-import') {
//             // eslint-disable-next-line max-len
//             exportSection += `  ${JSON.stringify(i)}: () => import(/* webpackChunkName: ${JSON.stringify(name)} */ ${JSON.stringify(src)}),\n`;
//         } else if (type === 'lazy-require') {
//             exportSection += `  ${JSON.stringify(i)}: () => require(${JSON.stringify(src)}),\n`;
//         } else if (type === 'eager-import') {
//             const importName = importSection.add(src, i);
//             exportSection += `  ${JSON.stringify(i)}: ${importName},\n`;
//         } else {
//             throw new Error(`未知类型：${type}`);
//         }
//     }
//     exportSection += '};\n';
//     let result = '/* 由pull.js生成 */\n';
//     result += importSection.toString();
//     result += exportSection;
//     return result;
// };

// // 生成本地化条目
// const generateL10nEntries = locales => generateEntries(
//     locales.filter(i => i !== 'en'),
//     locale => ({
//         name: `addon-l10n-${locale}`,
//         src: `../addons-l10n/${locale}.json`,
//         type: 'lazy-import'
//     })
// );

// // 生成本地化设置条目
// const generateL10nSettingsEntries = locales => generateEntries(
//     locales.filter(i => i !== 'en'),
//     locale => ({
//         src: `../addons-l10n-settings/${locale}.json`,
//         type: 'lazy-require'
//     })
// );

// // 生成运行时条目
// const generateRuntimeEntries = () => generateEntries(
//     addons,
//     id => {
//         const manifest = addonIdToManifest[id];
//         return {
//             src: `../addons/${id}/_runtime_entry.js`,
//             // 将默认插件包含在单个捆绑包中
//             name: manifest.enabledByDefault ? 'addon-default-entry' : `addon-entry-${id}`,
//             // 将编辑器外有用的默认插件包含在原始捆绑包中，无需请求
//             type: (manifest.enabledByDefault && !manifest.editorOnly) ? 'lazy-require' : 'lazy-import'
//         };
//     }
// );

// // 生成清单条目
// const generateManifestEntries = () => generateEntries(
//     addons,
//     id => ({
//         src: `../addons/${id}/_manifest_entry.js`,
//         type: 'eager-import'
//     })
// );

// // 处理所有插件
// for (const addon of addons) {
//     const oldDirectory = pathUtil.resolve(__dirname, 'ScratchAddons', 'addons', addon);
//     const newDirectory = pathUtil.resolve(__dirname, 'addons', addon);
//     processAddon(addon, oldDirectory, newDirectory);
// }

// // 处理本地化文件
// const l10nFiles = fs.readdirSync(pathUtil.resolve(__dirname, 'ScratchAddons', 'addons-l10n'));
// const languages = [];
// const allUpstreamMessageIds = new Set();
// for (const file of l10nFiles) {
//     const oldDirectory = pathUtil.resolve(__dirname, 'ScratchAddons', 'addons-l10n', file);
//     // 忽略README
//     if (!fs.statSync(oldDirectory).isDirectory()) {
//         continue;
//     }
//     // 将pt-br转换为pt
//     const fixedName = file === 'pt-br' ? 'pt' : file;
//     languages.push(fixedName);
//     const runtimePath = pathUtil.resolve(__dirname, 'addons-l10n', `${fixedName}.json`);
//     const settingsPath = pathUtil.resolve(__dirname, 'addons-l10n-settings', `${fixedName}.json`);
//     const {settings, runtime, upstreamMessageIds} = parseMessageDirectory(oldDirectory);
//     for (const id of upstreamMessageIds) {
//         allUpstreamMessageIds.add(id);
//     }
//     fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 4));
//     if (fixedName !== 'en') {
//         fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
//     }
// }

// // 检查跳过的消息是否存在
// for (const id of SKIP_MESSAGES) {
//     if (!allUpstreamMessageIds.has(id)) {
//         console.warn(`警告：翻译${id}在SKIP_MESSAGES中但不存在`);
//     }
// }

// // 生成各种条目文件
// fs.writeFileSync(pathUtil.resolve(generatedPath, 'l10n-entries.js'), generateL10nEntries(languages));
// fs.writeFileSync(pathUtil.resolve(generatedPath, 'l10n-settings-entries.js'), generateL10nSettingsEntries(languages));
// fs.writeFileSync(pathUtil.resolve(generatedPath, 'addon-entries.js'), generateRuntimeEntries(languages));
// fs.writeFileSync(pathUtil.resolve(generatedPath, 'addon-manifests.js'), generateManifestEntries(languages));

// // 生成上游元数据
// const upstreamMetaPath = pathUtil.resolve(generatedPath, 'upstream-meta.json');
// fs.writeFileSync(upstreamMetaPath, JSON.stringify({
//     commit: commitHash
// }));