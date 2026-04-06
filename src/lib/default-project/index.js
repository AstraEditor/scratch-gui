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
    try{
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
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="490.2439" height="376.21952" viewBox="0,0,490.2439,376.21952"><g stroke="none" stroke-miterlimit="10"><path d="M0,376.21951v-376.21951h490.2439v376.21952z" fill="#000000" stroke-width="0"/><path d="M218.68429,189.14698c-2.47093,0.38014 -2.85107,-2.09078 -2.85107,-2.09078l-0.39947,-2.65745c-0.58296,-8.76063 -2.77976,-17.15406 -3.74964,-25.83007c0,0 -0.27608,-2.4847 2.20863,-2.76078c2.48471,-0.27608 2.76079,2.20863 2.76079,2.20863c0.96561,8.74732 3.17912,17.21504 3.76915,26.04963l0.35241,2.22977c0,0 0.38014,2.47092 -2.09079,2.85107z" fill="#ffffff" stroke-width="0.5"/><path d="M263.41693,184.10086c-2.5,0 -2.5,-2.5 -2.5,-2.5l0.04282,-0.29116c-0.61854,-3.31211 -0.66697,-6.51117 -0.97314,-9.82912c-0.55808,-6.04779 -2.2393,-12.08318 -2.99774,-18.14106c0,0 -0.31009,-2.4807 2.17061,-2.79078c2.4807,-0.31008 2.79078,2.17061 2.79078,2.17061c0.76479,6.12786 2.43536,12.20363 3.0173,18.32511c0.30081,3.16419 0.31159,6.18425 0.90655,9.34381l0.04282,1.2126c0,0 0,2.5 -2.5,2.5z" fill="#ffffff" stroke-width="0.5"/><path d="M248.01585,195.06373c1.38675,2.08013 -0.69338,3.46688 -0.69338,3.46688l-1.10982,0.65017c-4.75599,1.65399 -9.11013,1.78332 -13.73059,-0.27243c0,0 -2.2699,-1.04765 -1.22225,-3.31754c1.04765,-2.2699 3.31754,-1.22225 3.31754,-1.22225c3.2842,1.59431 6.55828,1.35771 9.95362,0.10351l0.018,-0.10171c0,0 2.08013,-1.38675 3.46688,0.69338z" fill="#ffffff" stroke-width="0.5"/><path d="M218.19458,201.87166c0.2251,2.27651 -0.6902,4.72842 -2.71066,6.16297c-1.39372,0.98956 -3.21205,1.40674 -4.92098,1.44193c-5.40889,0.11137 -7.75764,-5.90933 -6.48718,-10.38804c1.02801,-3.62401 2.88709,-3.81449 5.72479,-5.12387c0,0 2.06744,-0.88604 3.12068,0.9838c1.66804,0.27876 3.27307,1.28524 4.31134,3.00286c0.84941,1.40521 1.1143,2.73293 0.96202,3.92035z" fill="#ffb1b1" stroke-width="0.5"/><path d="M265.63625,195.29595c0.12301,-0.5277 0.32294,-1.02603 0.64122,-1.47917c1.31746,-1.87572 3.07959,-2.37452 4.75988,-2.07129c0.69728,-0.14246 1.85022,-0.14054 2.58146,1.112c0.79024,0.55302 1.46909,1.25434 1.94882,2.00817c0.78355,1.23126 0.98737,6.98979 0.17429,8.26927c-3.27675,5.15637 -11.59587,4.2852 -12.38093,-2.31399c-0.25444,-2.1388 0.78916,-4.00667 2.27526,-5.52499z" fill="#ffb1b1" stroke-width="0.5"/><text transform="translate(144.35623,240.7337) scale(0.5,0.5)" font-size="40" xml:space="preserve" fill="#9966ff" stroke-width="1" font-family="Sans Serif" font-weight="normal" text-anchor="start"><tspan x="0" dy="0">赛博猫猫帮我画吉祥物</tspan></text></g></svg><!--rotationCenter:240:180-->
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
