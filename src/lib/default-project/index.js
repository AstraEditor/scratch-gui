import projectData from './project-data';

/* eslint-disable import/no-unresolved */
import overrideDefaultProject from '!arraybuffer-loader!./override-default-project.sb3';
import backdrop from '!raw-loader!./cd21514d0531fdffb22204e0ec5ed84a.svg';
/* eslint-enable import/no-unresolved */
import { TextEncoder } from '../tw-text-encoder';

import titlesContent from './titles.json'

import { ACCENT_MAP } from '../themes/index.js';

// Safely parse theme from localStorage
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
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="593.28489" height="425.66905" viewBox="0,0,593.28489,425.66905">
	<defs>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-1">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-2">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-3">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-4">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-5">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-6">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-7">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-8">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-9">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-10">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-11">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
		<radialGradient cx="273.38749" cy="316.85553" r="191.65592" fx="83.54215" fy="290.574" gradientUnits="userSpaceOnUse" id="color-12">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.88" stop-color="${getThemeColor()}" />
			<stop offset="1" stop-color="${getThemeColor()}" />
		</radialGradient>
	</defs>
	<g transform="translate(60.74938,0)">
		<g stroke="none" stroke-miterlimit="10">
			<path d="M0,360v-360h480v360z" fill="${getBG()}" fill-rule="nonzero" />
			<g>
				<g fill-rule="evenodd">
					<path d="M-60.74938,250.79089c0,-71.60744 58.04822,-129.65565 129.65565,-129.65565c71.60744,0 129.65565,58.04822 129.65565,129.65565c0,71.60744 -58.04822,129.65565 -129.65565,129.65565c-71.60744,0 -129.65565,-58.04822 -129.65565,-129.65565z" fill-opacity="0.58039"
						fill="${getThemeColor()}" />
					<path d="M55.3017,293.45976c0,-53.39174 43.23573,-96.67488 96.57182,-96.67488c53.33609,0 96.57182,43.28314 96.57182,96.67488c0,53.39174 -43.23573,96.67488 -96.57182,96.67488c-53.33609,0 -96.57182,-43.28314 -96.57182,-96.67488z" fill-opacity="0.58039" fill="${getThemeColor()}" />
					<path d="M22.67548,299.15925c34.8648,3.13936 60.57949,33.94752 57.44013,68.81025c-3.13936,34.86274 -33.94752,60.57949 -68.81232,57.44013c-34.86212,-3.14142 -60.57867,-33.94958 -57.43848,-68.81232c3.14039,-34.86274 33.94793,-60.57949 68.81067,-57.43807z" fill-opacity="0.58039"
						fill="${getThemeColor()}" />
					<path
						d="M362.23518,290.57394c1.63461,0 2.93529,0.48441 3.90204,1.45115c0.96675,0.96675 1.45115,2.24681 1.45115,3.83814c0,1.58926 -0.48441,2.85902 -1.45115,3.80516c-0.96675,0.94614 -2.26743,1.41817 -3.90204,1.41817c-1.59132,0 -2.84871,-0.47204 -3.77218,-1.41817c-0.92552,-0.94614 -1.38725,-2.2159 -1.38725,-3.80516c0,-1.63461 0.46173,-2.92498 1.38725,-3.87112c0.92346,-0.94614 2.18085,-1.41817 3.77218,-1.41817z"
						fill="url(#color-1)" />
					<path d="M102.15707,292.42911h9.14804l18.61558,49.67728h-9.4696l-4.86672,-13.50769h-17.70655l-4.86672,13.50769h-9.4696zM106.56825,304.44235l-5.64177,15.71534h11.67519l-5.64383,-15.71534z" fill="url(#color-2)" />
					<path d="M276.47899,292.42911h32.34177v8.18129h-23.4452v11.88544h22.14659v8.18129h-22.14659v13.24796h24.29034v8.18129h-33.1869z" fill="url(#color-3)" />
					<path
						d="M340.84303,292.42911h8.60592v49.79684h-8.60592v-4.75129h-0.38752c-1.08012,1.82219 -2.46944,3.22181 -4.17413,4.1968c-1.70469,0.97706 -3.61346,1.46558 -5.72629,1.46558c-3.06309,0 -5.76957,-0.82452 -8.12151,-2.47356c-2.34988,-1.64904 -4.17207,-3.97006 -5.46656,-6.96513c-1.2945,-2.99507 -1.94174,-6.44362 -1.94174,-10.34978c0,-3.7763 0.63694,-7.09499 1.90876,-9.96019c1.27182,-2.86314 3.06309,-5.08728 5.36968,-6.67036c2.30865,-1.58514 4.95124,-2.37668 7.92775,-2.37668c2.11283,0 4.04427,0.49883 5.79019,1.4965c1.74798,0.99767 3.22593,2.38698 4.43385,4.16588h0.38752zM332.43087,312.54326c-2.5457,0 -4.61525,1.03065 -6.21069,3.09195c-1.59751,2.0613 -2.39523,4.7616 -2.39523,8.10502c0,3.3393 0.8204,6.04166 2.45913,8.10296c1.63873,2.0613 3.77424,3.09195 6.40651,3.09195c2.50035,0 4.52867,-1.03065 6.08083,-3.09195c1.55422,-2.0613 2.33133,-4.76366 2.33133,-8.10296c0,-3.34343 -0.79978,-6.04373 -2.39523,-8.10502c-1.59544,-2.0613 -3.68766,-3.09195 -6.27665,-3.09195z"
						fill="url(#color-4)" />
					<path
						d="M169.86247,295.72719h8.64921v10.86098h9.94989v7.80407h-9.94989v15.41233c0,1.60369 0.43287,2.84047 1.30068,3.70828c0.86575,0.86575 2.12314,1.30068 3.77218,1.30068c1.38725,0 2.75183,-0.2185 4.0958,-0.65137v8.0638c-1.82013,0.60808 -3.85875,0.91109 -6.11175,0.91109c-3.77218,0 -6.66624,-1.04096 -8.68219,-3.12081c-2.01595,-2.08191 -3.02392,-5.09553 -3.02392,-9.04085v-16.58314h-5.72422v-7.80407h5.72422z"
						fill="url(#color-5)" />
					<path
						d="M378.05152,295.72719h8.65127v10.86098h9.94989v7.80407h-9.94989v15.41233c0,1.60369 0.43287,2.84047 1.30068,3.70828c0.86575,0.86575 2.12314,1.30068 3.77218,1.30068c1.38725,0 2.75183,-0.2185 4.0958,-0.65137v8.0638c-1.82013,0.60808 -3.85875,0.91109 -6.11175,0.91109c-3.77218,0 -6.66624,-1.04096 -8.68219,-3.12081c-2.01595,-2.08191 -3.02599,-5.09553 -3.02599,-9.04085v-16.58314h-5.72216v-7.80407h5.72216z"
						fill="url(#color-6)" />
					<path
						d="M146.87487,304.38464c3.27334,0 6.11381,0.6926 8.52553,2.07985c2.41172,1.38725 4.32666,3.29602 5.7469,5.72216l-6.39209,4.42148c-0.99148,-1.5604 -2.15406,-2.77451 -3.48772,-3.64025c-1.33572,-0.86781 -2.77657,-1.30068 -4.32666,-1.30068c-1.72325,0 -3.06927,0.33599 -4.03602,1.00797c-0.96881,0.67198 -1.45322,1.57071 -1.45322,2.69824c0,1.08424 0.59159,2.01595 1.77478,2.79512c1.18525,0.78123 3.1105,1.47383 5.77988,2.08191c8.43895,1.86341 12.65843,5.61291 12.65843,11.2485c0,2.29629 -0.61427,4.32254 -1.84074,6.07877c-1.22647,1.75623 -2.93735,3.12081 -5.13469,4.0958c-2.19528,0.97499 -4.71419,1.46352 -7.55466,1.46352c-3.70415,0 -6.91153,-0.76886 -9.6242,-2.30865c-2.71061,-1.53773 -4.69151,-3.56398 -5.94066,-6.07877l6.39415,-4.48745c1.11928,1.82219 2.44264,3.20944 3.97212,4.16176c1.52742,0.95438 3.2383,1.43054 5.13263,1.43054c1.85311,0 3.28365,-0.33599 4.29575,-1.00797c1.0121,-0.67198 1.51712,-1.57071 1.51712,-2.69824c0,-1.17082 -0.538,-2.1355 -1.614,-2.89406c-1.076,-0.75856 -2.79924,-1.39756 -5.16767,-1.91701c-4.34728,-1.04096 -7.67421,-2.50448 -9.97668,-4.3885c-2.30453,-1.88609 -3.45474,-4.34522 -3.45474,-7.38151c0,-3.42382 1.28007,-6.14267 3.84226,-8.15862c2.56219,-2.01595 6.01693,-3.02392 10.36421,-3.02392z"
						fill="url(#color-7)" />
					<path
						d="M216.93221,304.38464h0.38752v8.62035h-0.58129c-4.56784,0 -7.99371,0.87399 -10.27763,2.62403c-2.28392,1.75004 -3.42588,4.1597 -3.42588,7.22691v19.25046h-8.59561v-36.81478h8.59561v6.80641h0.32362c1.37901,-2.46325 3.19913,-4.36377 5.46244,-5.70361c2.26124,-1.33984 4.96567,-2.00977 8.11121,-2.00977z"
						fill="url(#color-8)" />
					<path
						d="M234.0987,304.38464c2.99507,0 5.63147,0.56273 7.91126,1.69026c2.27773,1.12753 4.0587,2.74153 5.33876,4.84405c1.28007,2.10252 1.92113,4.54104 1.92113,7.31555v23.99145h-8.66157v-4.61525h-0.38959c-0.86781,1.73355 -2.22414,3.08782 -4.069,4.06282c-1.84486,0.97499 -3.89791,1.46352 -6.15504,1.46352c-3.42794,0 -6.26222,-0.94201 -8.49667,-2.8281c-2.23651,-1.88609 -3.35373,-4.43179 -3.35373,-7.64123c0,-2.5993 0.69466,-4.89764 2.08397,-6.89092c1.38931,-1.99534 3.38671,-3.53306 5.99013,-4.61731c2.60548,-1.08424 5.68712,-1.6243 9.24698,-1.6243h5.14294v-1.43054c0,-1.90876 -0.64931,-3.44649 -1.95205,-4.61731c-1.30274,-1.17082 -3.03835,-1.75623 -5.2089,-1.75623c-3.0837,0 -5.55726,1.34397 -7.4248,4.0319l-6.05403,-4.22566c3.29808,-4.76778 8.00814,-7.1527 14.1302,-7.1527zM237.22363,326.81775c-6.81671,0 -10.22404,1.75416 -10.22404,5.26662c0,1.16876 0.47822,2.09016 1.4326,2.76214c0.95644,0.67198 2.2798,1.00797 3.97212,1.00797c2.12726,0 4.02572,-0.58541 5.69743,-1.75623c1.67171,-1.16876 2.50654,-2.83841 2.50654,-5.00483v-2.27567z"
						fill="url(#color-9)" />
					<path
						d="M416.95646,304.38464c3.53925,0 6.61471,0.79154 9.22637,2.37255c2.61166,1.58308 4.62968,3.82577 6.05403,6.73014c1.42436,2.90437 2.13757,6.32819 2.13757,10.27351c0,3.94532 -0.71321,7.36914 -2.13757,10.27351c-1.42436,2.90437 -3.44237,5.14706 -6.05403,6.73014c-2.61166,1.58102 -5.68712,2.37255 -9.22637,2.37255c-3.53925,0 -6.61471,-0.79154 -9.22637,-2.37255c-2.61166,-1.58308 -4.62968,-3.82577 -6.05403,-6.73014c-1.42436,-2.90437 -2.13757,-6.32819 -2.13757,-10.27351c0,-3.94532 0.71321,-7.36914 2.13757,-10.27351c1.42436,-2.90437 3.44237,-5.14706 6.05403,-6.73014c2.61166,-1.58102 5.68712,-2.37255 9.22637,-2.37255zM416.95646,312.51234c-2.67556,0 -4.78015,1.00797 -6.31376,3.02392c-1.53154,2.01595 -2.29835,4.75748 -2.29835,8.22458c0,3.4671 0.77711,6.20863 2.33133,8.22458c1.55422,2.01595 3.6485,3.02392 6.28078,3.02392c2.63228,0 4.72656,-1.00797 6.28078,-3.02392c1.55422,-2.01595 2.33133,-4.75748 2.33133,-8.22458c0,-3.4671 -0.7668,-6.20863 -2.29835,-8.22458c-1.53361,-2.01595 -3.63819,-3.02392 -6.31376,-3.02392z"
						fill="url(#color-10)" />
					<path
						d="M462.84508,304.38464h0.38752v8.62035h-0.58129c-4.56784,0 -7.99371,0.87399 -10.27763,2.62403c-2.28392,1.75004 -3.42588,4.1597 -3.42588,7.22691v19.25046h-8.59561v-36.81478h8.59561v6.80641h0.32362c1.37901,-2.46325 3.19913,-4.36377 5.46244,-5.70361c2.26124,-1.33984 4.96567,-2.00977 8.11121,-2.00977z"
						fill="url(#color-11)" />
					<path d="M358.1064,306.65207h8.65745v35.45433h-8.65745z" fill="url(#color-12)" />
				</g><text transform="translate(521.03003,280.99507)" font-size="20" xml:space="preserve" fill="${getTextBG()}" fill-rule="nonzero" font-family="Arial, Helvetica, sans-serif" font-weight="400" text-anchor="end">
					<tspan x="-30" dy="0">${returnRandomText()}</tspan>
				</text>
			</g>
		</g>
	</g>
</svg><!--rotationCenter:300.7493788278236:180-->
` //其实replace也行...


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
