/**
 * 将任何 CSS 颜色值转换为 HEX（含 alpha）
 */
export const toHex = (color) => {
    const temp = document.createElement('div');
    temp.style.color = color;
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);

    const toHexComponent = (n) => Math.round(Number(n)).toString(16).padStart(2, '0');

    // color(srgb r g b [/ a]) 格式：rgb 范围 [0, 1]，a 范围 [0, 1]
    const colorFuncMatch = computed.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
    if (colorFuncMatch) {
        const r = toHexComponent(Number(colorFuncMatch[1]) * 255);
        const g = toHexComponent(Number(colorFuncMatch[2]) * 255);
        const b = toHexComponent(Number(colorFuncMatch[3]) * 255);
        const a = colorFuncMatch[4] !== undefined ? toHexComponent(Number(colorFuncMatch[4]) * 255) : '';
        return `#${r}${g}${b}${a}`;
    }

    // rgb(r, g, b) / rgba(r, g, b, a) 格式：rgb 范围 [0, 255]，a 范围 [0, 1]
    const nums = computed.match(/[\d.]+/g);
    if (!nums) return computed;

    const r = toHexComponent(Number(nums[0]));
    const g = toHexComponent(Number(nums[1]));
    const b = toHexComponent(Number(nums[2]));
    const a = nums[3] !== undefined ? toHexComponent(Number(nums[3]) * 255) : '';

    return `#${r}${g}${b}${a}`;
}
