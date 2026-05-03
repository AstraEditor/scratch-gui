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
export default `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="512.25277" height="435.9117" viewBox="0,0,512.25277,435.9117">
    <defs>
        <linearGradient x1="242.7725" y1="-7.80612" x2="242.7725" y2="363.59027"
            gradientUnits="userSpaceOnUse" id="color-1">
            <stop offset="0" stop-color="${getThemeColor()}" stop-opacity="0" />
            <stop offset="1" stop-color="${getThemeColor()}" stop-opacity="0.12157" />
        </linearGradient>
        <radialGradient cx="370.85338" cy="203.34342" r="90.4858" gradientUnits="userSpaceOnUse"
            id="color-2">
            <stop offset="0" stop-color="${getBG()}" stop-opacity="0.91373" />
            <stop offset="1" stop-color="${getBG()}" stop-opacity="0" />
        </radialGradient>
        <radialGradient cx="267.18421" cy="244.12274" r="90.47588" gradientUnits="userSpaceOnUse"
            id="color-3">
            <stop offset="0" stop-color="${getBG()}" stop-opacity="0.91373" />
            <stop offset="1" stop-color="${getBG()}" stop-opacity="0" />
        </radialGradient>
        <radialGradient cx="365.27361" cy="289.02176" r="97.52569" gradientUnits="userSpaceOnUse"
            id="color-4">
            <stop offset="0" stop-color="${getBG()}" stop-opacity="0.91373" />
            <stop offset="1" stop-color="${getBG()}" stop-opacity="0" />
        </radialGradient>
    </defs>
    <g transform="translate(4.08044,7.80612)">
        <g stroke-miterlimit="10">
            <path d="M0.00001,365.24391v-365.2439h482.31707v365.24391z" fill="${getBG()}" stroke="none"
                stroke-width="0" />
            <path d="M-4.08044,363.59027v-371.39639h493.70588v371.39639z" fill="url(#color-1)"
                stroke="none" stroke-width="0" />
            <path
                d="M295.39956,153.41741c27.57338,-41.672 83.70784,-53.10119 125.37982,-25.5278c41.672,27.57339 53.10119,83.70787 25.52781,125.37984c-27.57338,41.672 -83.70784,53.10117 -125.37982,25.52779c-41.67198,-27.57338 -53.10116,-83.70785 -25.5278,-125.37985z"
                fill="url(#color-2)" stroke="none" stroke-width="0" />
            <path
                d="M326.79923,269.92302c-36.77091,-24.33043 -46.85588,-73.86284 -22.52546,-110.63375c24.33043,-36.7709 73.86286,-46.85588 110.63376,-22.52545c36.77091,24.33043 46.85589,73.86284 22.52546,110.63375c-24.33043,36.7709 -73.86286,46.85589 -110.63376,22.52546z"
                fill="#0099ff" stroke="#0066ff" stroke-width="6" />
            <path
                d="M294.7874,225.2389c5.78727,5.93634 12.29199,11.35017 19.48776,16.11141c37.09222,24.54306 82.96477,25.40708 119.80181,6.21952c-25.18967,33.43855 -72.39228,41.89518 -107.77723,18.48178c-15.32749,-10.14184 -26.01822,-24.66262 -31.51234,-40.8127z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M412.03918,159.20491c4.57512,10.16769 -10.80974,14.6085 -9.5657,17.5917c3.4243,8.21169 6.72169,11.67208 1.5972,14.96326c-15.65994,10.0575 -20.22118,-5.22669 -25.19562,-1.8199c-6.91875,4.73837 -21.29822,3.6496 -27.69506,-3.2377c-4.06257,-4.37407 9.60779,-13.2476 7.21285,-13.74287c-3.46904,-0.71739 -8.36822,-18.33284 -3.85684,-24.35586c4.51138,-6.02301 18.75977,4.45938 18.75977,4.45938c0,0 3.95774,-12.41945 11.02907,-11.14659c7.07133,1.27283 10.61477,15.04251 10.61477,15.04251c0,0 13.73681,-5.22731 17.09962,2.24608z"
                fill-opacity="0.21961" fill="#ffffff" stroke="none" stroke-width="0" />
            <path
                d="M397.12451,172.01662c-0.51729,9.82766 -8.90357,17.37524 -18.73125,16.85796c-9.82767,-0.51728 -17.37524,-8.90356 -16.85796,-18.73125c0.51729,-9.82766 8.90356,-17.37524 18.73123,-16.85796c9.82767,0.51728 17.37522,8.90357 16.85793,18.73123z"
                fill="#0099ff" stroke="none" stroke-width="0" />
            <path
                d="M392.15323,183.23312c0.48673,-1.78529 0.7917,-3.64943 0.89293,-5.57263c0.52182,-9.91358 -4.50528,-18.83536 -12.36654,-23.74903c9.28395,1.05983 16.25451,9.18229 15.75672,18.63954c-0.21564,4.09655 -1.79851,7.79692 -4.28311,10.68213z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M176.70831,244.12274c0,-49.96845 40.50743,-90.47586 90.47586,-90.47586c49.96845,0 90.47587,40.50743 90.47587,90.47586c0,49.96845 -40.50742,90.47588 -90.47587,90.47588c-49.96845,0 -90.47586,-40.50743 -90.47586,-90.47587z"
                fill="url(#color-3)" stroke="none" stroke-width="0" />
            <path
                d="M267.18421,323.95766c-44.09159,0 -79.83492,-35.74328 -79.83492,-79.83487c0,-44.09159 35.74329,-79.8349 79.83492,-79.8349c44.09159,0 79.83487,35.74331 79.83487,79.8349c0,44.09159 -35.74328,79.83487 -79.83487,79.83487z"
                fill="#0099ff" stroke="#0066ff" stroke-width="6" />
            <path
                d="M277.17542,184.58576c9.42621,5.95487 -0.95374,18.14798 1.7299,19.9494c7.3871,4.95867 12.04649,6.02499 9.58895,11.59749c-7.50999,17.02903 -19.74798,6.79948 -22.01657,12.38561c-3.15528,7.76954 -15.74807,14.79634 -24.88336,12.58245c-5.80172,-1.40602 0.70235,-16.34976 -1.56825,-15.44123c-3.28892,1.316 -17.09516,-10.67127 -16.65641,-18.18371c0.43873,-7.51244 18.10574,-6.63299 18.10574,-6.63299c0,0 -3.55263,-12.54134 3.047,-15.3819c6.59964,-2.84056 17.15308,6.68756 17.15308,6.68756c0,0 8.57153,-11.93957 15.49991,-7.56269z"
                fill-opacity="0.21961" fill="#ffffff" stroke="none" stroke-width="0" />
            <path
                d="M271.80678,203.50046c4.99169,8.48138 2.16267,19.40348 -6.31871,24.39516c-8.48138,4.99168 -19.40349,2.16266 -24.39517,-6.31873c-4.99165,-8.48138 -2.16266,-19.40347 6.31873,-24.39515c8.48138,-4.99168 19.40349,-2.16267 24.39515,6.31871z"
                fill="#0099ff" stroke="none" stroke-width="0" />
            <path
                d="M309.89234,303.17672c-33.39121,22.0942 -77.93422,14.11404 -101.7046,-17.44045c34.76146,18.10647 78.04941,17.2911 113.05168,-5.86908c6.79032,-4.49298 12.92856,-9.60177 18.38975,-15.20362c-5.18457,15.24014 -15.27294,28.94277 -29.73682,38.51315z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M273.85033,215.59788c-0.57925,-1.75744 -1.35355,-3.48039 -2.33037,-5.14013c-5.0353,-8.55551 -14.15092,-13.22196 -23.41839,-12.98185c8.32733,-4.23916 18.62265,-1.3118 23.42619,6.84992c2.08071,3.53536 2.80257,7.49481 2.32258,11.27204z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M283.94939,235.21142c29.71862,-44.91412 90.22042,-57.23252 135.13455,-27.5139c44.91413,29.71862 57.23252,90.2204 27.5139,135.13455c-29.71861,44.91413 -90.22041,57.23252 -135.13455,27.5139c-44.91413,-29.71861 -57.23251,-90.22043 -27.5139,-135.13455z"
                fill="url(#color-4)" stroke="none" stroke-width="0" />
            <path
                d="M317.79198,360.78132c-39.63173,-26.22337 -50.50133,-79.60949 -24.27794,-119.24121c26.22337,-39.63172 79.60946,-50.50131 119.24119,-24.27794c39.63173,26.22337 50.50133,79.60949 24.27796,119.24121c-26.22337,39.63173 -79.60949,50.50131 -119.24121,24.27794z"
                fill="#0099ff" stroke="#0066ff" stroke-width="6" />
            <path
                d="M295.94719,317.46389c5.46116,5.60185 11.59942,10.71064 18.38974,15.20362c35.00229,23.16018 78.29023,23.97553 113.05169,5.86907c-23.77038,31.55449 -68.3134,39.53465 -101.70463,17.44045c-14.46386,-9.57041 -24.55223,-23.27298 -29.7368,-38.51316z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <path
                d="M409.66371,241.4492c4.93111,10.95873 -11.65071,15.74509 -10.30994,18.96036c3.69071,8.85055 7.24463,12.58018 1.72144,16.12741c-16.8783,10.84001 -21.7944,-5.63334 -27.1559,-1.96149c-7.45705,5.10705 -22.95524,3.93353 -29.84978,-3.48961c-4.37864,-4.71436 10.35527,-14.27827 7.77401,-14.81206c-3.7389,-0.7732 -9.01926,-19.75919 -4.15688,-26.25077c4.86238,-6.4916 20.21928,4.80631 20.21928,4.80631c0,0 4.26565,-13.3857 11.88716,-12.01384c7.62149,1.37188 11.44059,16.21285 11.44059,16.21285c0,0 14.80554,-5.63399 18.42996,2.42082z"
                fill-opacity="0.21961" fill="#ffffff" stroke="none" stroke-width="0" />
            <path
                d="M393.58862,255.25768c-0.55752,10.59231 -9.59626,18.72708 -20.18855,18.16955c-10.59231,-0.55752 -18.72706,-9.59626 -18.16953,-20.18855c0.55752,-10.59231 9.59627,-18.72706 20.18856,-18.16953c10.59231,0.55752 18.72705,9.59624 18.16953,20.18855z"
                fill="#0099ff" stroke="none" stroke-width="0" />
            <path
                d="M388.23059,267.34683c0.52459,-1.92419 0.85328,-3.93336 0.96241,-6.00617c0.56242,-10.68485 -4.85579,-20.30078 -13.32867,-25.59674c10.00624,1.14228 17.51914,9.89664 16.98262,20.0897c-0.2324,4.41526 -1.93845,8.40355 -4.61636,11.51324z"
                fill="#0066ff" stroke="none" stroke-width="0" />
            <text transform="translate(13.03785,335.66573) scale(0.5,0.5)" font-size="40" font-style="italic"
                xml:space="preserve" fill="${getTextBG()}" stroke="none" stroke-width="1" filter="url(#shadow)"
                font-family="Sans Serif" font-weight="normal" text-anchor="start"><tspan x="0" dy="0">${returnRandomText()}</tspan></text>
            <path
                d="M306.1168,131.61076c33.43024,-50.52357 101.48827,-64.38043 152.01184,-30.95019c49.33277,32.64232 63.70687,98.29933 33.23529,148.41088c22.62957,37.81772 23.10909,86.82439 -2.83443,126.03317c-36.03116,54.45436 -109.38419,69.38928 -163.83855,33.35812c-20.50046,-13.56467 -35.39984,-32.41897 -44.08736,-53.56313c-8.167,1.94011 -16.68767,2.96707 -25.4482,2.96707c-60.58226,0 -109.69393,-49.11161 -109.69393,-109.69387c0,-60.58226 49.11161,-109.6939 109.69393,-109.6939c15.05089,0 29.3938,3.03122 42.45155,8.51649c2.38492,-5.26502 5.21816,-10.40982 8.50987,-15.38463z"
                fill-opacity="0.03922" fill="${getThemeColor()}" stroke="none" stroke-width="0" />
        </g>
    </g>
    <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${getBG()}" flood-opacity="0.5"/>
        </filter>
    </defs>
</svg><!--rotationCenter:244.0804404434777:187.80611921455403-->
`
