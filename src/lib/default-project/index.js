import projectData from './project-data';

/* eslint-disable import/no-unresolved */
import overrideDefaultProject from '!arraybuffer-loader!./override-default-project.sb3';
import backdrop from '!raw-loader!./cd21514d0531fdffb22204e0ec5ed84a.svg';
/* eslint-enable import/no-unresolved */
import { TextEncoder } from '../tw-text-encoder';

import titlesContent from './titles.json'

import { ACCENT_MAP } from '../themes/index.js';

const theme = (() => {
    try {
        const themeStr = localStorage.getItem('tw:theme');
        if (!themeStr || themeStr === 'undefined' || themeStr === 'null') {
            return { gui: 'dark', accent: 'astraeditor' };
        }
        return JSON.parse(themeStr);
    } catch (e) {
        console.warn('Failed to parse theme from localStorage:', e);
        return { gui: 'dark', accent: 'astraeditor' };
    }
})();

/**
 * 调整 HEX 颜色的亮度
 * @param {string} hex - 十六进制颜色值，支持 #RGB、#RRGGBB 格式
 * @param {number} factor - 亮度衰减值 (0~2)
 *                          <1 变暗，=1 不变，>1 变亮
 * @returns {string} 新的十六进制颜色值
 */
function adjustHexBrightness(hex, factor) {
    // 移除 # 号
    let h = hex.replace('#', '');

    // 处理简写格式 #RGB
    if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
    }

    // 解析 RGB
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);

    // 调整亮度
    r = Math.min(255, Math.max(0, Math.floor(r * factor)));
    g = Math.min(255, Math.max(0, Math.floor(g * factor)));
    b = Math.min(255, Math.max(0, Math.floor(b * factor)));

    // 转换回 HEX
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const returnRandomText = () => {
    const userName = localStorage.getItem('tw:username') || '创作者'

    const titles = titlesContent

    if (!titles || titles.length === 0) {
        return '你好世界'
    }

    const randomTitle = titles[Math.floor(Math.random() * titles.length)]
    return randomTitle.replace('${UserName}', userName)
}


const getThemeColor = () => {
    try {
        if (theme.accent == 'custom') {
            const customThemeStr = localStorage.getItem('constomTheme');
            if (!customThemeStr || customThemeStr === 'undefined' || customThemeStr === 'null') {
                return '#0099ff';
            }
            const customTheme = JSON.parse(customThemeStr);
            return customTheme && customTheme['looks-secondary'] ? customTheme['looks-secondary'] : '#0099ff';
        }
        return ACCENT_MAP[theme.accent]?.guiColors?.['looks-secondary'] || '#0099ff';
    } catch (e) {
        console.warn('Failed to get theme color:', e);
        return '#0099ff';
    }
}

const getBG = () => {
    try {
        if (theme.gui == 'light') return '#fff'
        if (theme.gui == 'dark') return '#000'
        else return '#000'
    } catch {
        return '#000'
    }
}
const getTextBG = () => {
    try {
        if (theme.gui == 'light') return '#000'
        if (theme.gui == 'dark') return '#fff'
        else return '#fff'
    } catch {
        return '#fff'
    }
}
const costume = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="482.31707" height="365.24391" viewBox="0,0,482.31707,365.24391">
    <defs>
        <radialGradient cx="264.11422" cy="158.12283" r="42.70084" gradientUnits="userSpaceOnUse"
            id="color-1">
            <stop offset="0" stop-color="${getBG()}" stop-opacity="0.91373" />
            <stop offset="1" stop-color="${getBG()}" stop-opacity="0" />
        </radialGradient>
        <radialGradient cx="215.19206" cy="177.36686" r="42.69616" gradientUnits="userSpaceOnUse"
            id="color-2">
            <stop offset="0" stop-color="${getBG()}" stop-opacity="0.91373" />
            <stop offset="1" stop-color="${getBG()}" stop-opacity="0" />
        </radialGradient>
        <radialGradient cx="261.48109" cy="198.555" r="46.02301" gradientUnits="userSpaceOnUse"
            id="color-3">
            <stop offset="0" stop-color="${getBG()}" stop-opacity="0.91373" />
            <stop offset="1" stop-color="${getBG()}" stop-opacity="0" />
        </radialGradient>
    </defs>
    <g transform="translate(-0.36585,0.48781)">
        <g stroke-miterlimit="10">
            <path d="M0.36586,364.7561v-365.2439h482.31707v365.24391z" fill="${getBG()}" stroke="none"
                stroke-width="0" />
            <path
                d="M228.50707,134.56242c13.01206,-19.66529 39.50228,-25.0588 59.16756,-12.04674c19.66529,13.01206 25.0588,39.50229 12.04674,59.16757c-13.01206,19.66529 -39.50228,25.05879 -59.16756,12.04673c-19.66528,-13.01206 -25.05879,-39.50228 -12.04674,-59.16757z"
                fill="url(#color-1)" stroke="none" stroke-width="0" />
            <path
                d="M243.32478,189.54218c-17.35243,-11.48169 -22.1116,-34.85636 -10.62991,-52.20879c11.48169,-17.35243 34.85637,-22.1116 52.2088,-10.62991c17.35243,11.48169 22.1116,34.85636 10.62991,52.20879c-11.48169,17.35243 -34.85637,22.1116 -52.2088,10.62991z"
                fill="#0099ff" stroke="#0066ff" stroke-width="3" />
            <path
                d="M228.21819,168.45545c2.73105,2.8014 5.80067,5.35622 9.1964,7.60308c17.50406,11.58203 39.15162,11.98977 56.53526,2.93503c-11.88717,15.77987 -34.16239,19.77061 -50.86078,8.72167c-7.23314,-4.786 -12.27817,-11.63845 -14.87088,-19.25978z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M283.55007,137.29358c2.15903,4.7982 -5.10119,6.89385 -4.51412,8.30164c1.61595,3.87515 3.17201,5.50813 0.75373,7.06126c-7.39003,4.7462 -9.54251,-2.46651 -11.88998,-0.85882c-3.265,2.23607 -10.05077,1.72227 -13.06948,-1.52789c-1.91715,-2.06415 4.53398,-6.25163 3.40379,-6.48535c-1.63706,-0.33854 -3.94902,-8.65139 -1.82007,-11.49369c2.12895,-2.8423 8.85286,2.10441 8.85286,2.10441c0,0 1.86768,-5.86082 5.20469,-5.26015c3.33701,0.60066 5.00918,7.09866 5.00918,7.09866c0,0 6.48249,-2.4668 8.06942,1.05994z"
                fill-opacity="0.21961" fill="#ffffff" stroke="none" stroke-width="0" />
            <path
                d="M276.51174,143.33951c-0.24411,4.63774 -4.20165,8.19949 -8.8394,7.95538c-4.63774,-0.24411 -8.19949,-4.20165 -7.95538,-8.8394c0.24411,-4.63774 4.20165,-8.19949 8.83939,-7.95538c4.63774,0.24411 8.19948,4.20165 7.95537,8.83939z"
                fill="#0099ff" stroke="none" stroke-width="0" />
            <path
                d="M274.16576,148.63265c0.22969,-0.84249 0.37361,-1.72219 0.42138,-2.62976c0.24625,-4.67828 -2.12607,-8.88853 -5.83585,-11.20732c4.38116,0.50014 7.67061,4.33318 7.4357,8.79612c-0.10176,1.93319 -0.84873,3.67942 -2.02123,5.04097z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M172.49589,177.36686c0,-23.58044 19.11572,-42.69615 42.69615,-42.69615c23.58044,0 42.69616,19.11572 42.69616,42.69615c0,23.58044 -19.11572,42.69616 -42.69616,42.69616c-23.58044,0 -42.69615,-19.11572 -42.69615,-42.69616z"
                fill="url(#color-2)" stroke="none" stroke-width="0" />
            <path
                d="M215.19206,215.04148c-20.80711,0 -37.67462,-16.86749 -37.67462,-37.6746c0,-20.80711 16.86749,-37.67461 37.67462,-37.67461c20.80711,0 37.6746,16.8675 37.6746,37.67461c0,20.80711 -16.86749,37.6746 -37.6746,37.6746z"
                fill="#0099ff" stroke="#0066ff" stroke-width="3" />
            <path
                d="M219.90698,149.27097c4.44829,2.81014 -0.45008,8.56415 0.81635,9.41425c3.48602,2.34003 5.68482,2.84323 4.52509,5.47293c-3.54401,8.03611 -9.3192,3.20872 -10.38976,5.84485c-1.489,3.6665 -7.43162,6.98249 -11.74262,5.93774c-2.73787,-0.66351 0.33144,-7.71556 -0.74007,-7.28682c-1.55206,0.62103 -8.06732,-5.03584 -7.86027,-8.58101c0.20704,-3.54517 8.54422,-3.13015 8.54422,-3.13015c0,0 -1.67651,-5.91834 1.4379,-7.25882c3.11441,-1.34048 8.09465,3.1559 8.09465,3.1559c0,0 4.04496,-5.63436 7.31451,-3.56888z"
                fill-opacity="0.21961" fill="#ffffff" stroke="none" stroke-width="0" />
            <path
                d="M217.37348,158.19694c2.35561,4.00242 1.02058,9.15663 -2.98184,11.51224c-4.00242,2.35561 -9.15663,1.02057 -11.51224,-2.98185c-2.35559,-4.00242 -1.02057,-9.15662 2.98185,-11.51223c4.00242,-2.35561 9.15663,-1.02058 11.51223,2.98184z"
                fill="#0099ff" stroke="none" stroke-width="0" />
            <path
                d="M235.34631,205.23482c-15.75753,10.4264 -36.77767,6.66051 -47.99507,-8.23026c16.40416,8.54456 36.83203,8.15978 53.34983,-2.76966c3.2044,-2.12027 6.10107,-4.53114 8.67824,-7.17469c-2.44663,7.19192 -7.2074,13.65828 -14.033,18.17461z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M218.33785,163.90579c-0.27335,-0.82935 -0.63875,-1.64242 -1.09972,-2.42566c-2.37619,-4.0374 -6.67791,-6.23953 -11.05129,-6.12622c3.92972,-2.00049 8.78815,-0.61905 11.05497,3.23252c0.9819,1.66836 1.32255,3.53685 1.09604,5.31935z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M223.10366,173.16155c14.02441,-21.19527 42.57561,-27.0084 63.77088,-12.98399c21.19527,14.02441 27.0084,42.5756 12.98399,63.77088c-14.02441,21.19527 -42.5756,27.0084 -63.77088,12.98399c-21.19527,-14.02441 -27.0084,-42.57561 -12.98399,-63.77088z"
                fill="url(#color-3)" stroke="none" stroke-width="0" />
            <path
                d="M239.0742,232.41881c-18.70247,-12.37498 -23.83191,-37.56824 -11.45692,-56.27071c12.37498,-18.70247 37.56823,-23.8319 56.2707,-11.45692c18.70247,12.37498 23.83191,37.56824 11.45693,56.27071c-12.37498,18.70247 -37.56824,23.8319 -56.27071,11.45692z"
                fill="#0099ff" stroke="#0066ff" stroke-width="3" />
            <path
                d="M228.7655,211.97703c2.57716,2.64355 5.47384,5.05442 8.67824,7.17469c16.51781,10.92944 36.94567,11.31421 53.34983,2.76965c-11.2174,14.89077 -32.23754,18.65666 -47.99508,8.23026c-6.82559,-4.51634 -11.58636,-10.98267 -14.03299,-18.17461z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M282.42907,176.1052c2.32702,5.1715 -5.49805,7.43021 -4.86533,8.94752c1.74167,4.17663 3.41879,5.93667 0.81236,7.61063c-7.96498,5.11547 -10.28492,-2.65841 -12.81505,-0.92564c-3.51903,2.41005 -10.83273,1.85626 -14.08631,-1.64677c-2.06631,-2.22474 4.88672,-6.73801 3.66861,-6.98991c-1.76441,-0.36488 -4.25625,-9.32449 -1.96166,-12.38791c2.29459,-3.06343 9.54161,2.26813 9.54161,2.26813c0,0 2.01299,-6.3168 5.60963,-5.66941c3.59663,0.6474 5.39889,7.65095 5.39889,7.65095c0,0 6.98683,-2.65872 8.69722,1.1424z"
                fill-opacity="0.21961" fill="#ffffff" stroke="none" stroke-width="0" />
            <path
                d="M274.84313,182.62151c-0.2631,4.99858 -4.52854,8.83743 -9.52711,8.57433c-4.99858,-0.2631 -8.83742,-4.52854 -8.57432,-9.52711c0.2631,-4.99858 4.52854,-8.83742 9.52711,-8.57432c4.99858,0.2631 8.83742,4.52853 8.57432,9.52711z"
                fill="#0099ff" stroke="none" stroke-width="0" />
            <path
                d="M272.31464,188.32646c0.24756,-0.90804 0.40267,-1.85618 0.45417,-2.83435c0.26541,-5.04225 -2.29148,-9.58007 -6.28989,-12.07927c4.72201,0.53905 8.2674,4.67029 8.01421,9.48046c-0.10967,2.08359 -0.91477,3.96569 -2.17849,5.43317z"
                fill="#0066ff" stroke="none" stroke-width="0" />
        </g>
    </g>
</svg><!--rotationCenter:239.634145:180.487805-->
`

const defaultProject = translator => {
    if (overrideDefaultProject.byteLength > 0) {
        return [{
            id: 0,
            assetType: 'Project',
            dataFormat: 'JSON',
            data: overrideDefaultProject
        }];
    }

    let _TextEncoder;
    if (typeof TextEncoder === 'undefined') {
        _TextEncoder = require('text-encoding').TextEncoder;
    } else {
        _TextEncoder = TextEncoder;
    }
    const encoder = new _TextEncoder();

    const projectJson = projectData(translator);

    return [{
        id: 0,
        assetType: 'Project',
        dataFormat: 'JSON',
        data: JSON.stringify(projectJson)
    }, {
        id: 'cd21514d0531fdffb22204e0ec5ed84a',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(backdrop)
    }, {
        id: '927d672925e7b99f7813735c484c6923',
        assetType: 'ImageVector',
        dataFormat: 'SVG',
        data: encoder.encode(costume)
    }];
}

export default defaultProject;
