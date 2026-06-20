/**
 * 将任何 CSS 颜色值转换为 HEX
 */
export const toHex = (color) => {
    const temp = document.createElement('div');
    temp.style.color = color;
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);

    const colorFuncMatch = computed.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))??\)$/);
    if (colorFuncMatch) {
        const toHexComponent = (n) => Math.round(Number(n) * 255).toString(16).padStart(2, '0');
        let hex = `#${toHexComponent(colorFuncMatch[1])}${toHexComponent(colorFuncMatch[2])}${toHexComponent(colorFuncMatch[3])}`;
        if (colorFuncMatch[4] !== undefined && Number(colorFuncMatch[4]) < 1) {
            hex += toHexComponent(Number(colorFuncMatch[4]) * 255);
        }
        return hex;
    }

    const nums = computed.match(/[\d.]+/g);
    if (!nums) return computed;

    const toHexComponent = (n) => Math.round(Number(n)).toString(16).padStart(2, '0');
    let hex = `#${toHexComponent(nums[0])}${toHexComponent(nums[1])}${toHexComponent(nums[2])}`;

    if (nums[3] !== undefined && Number(nums[3]) < 1) {
        hex += toHexComponent(Number(nums[3]) * 255);
    }

    return hex;
}
