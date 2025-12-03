const CUSTOM_ACCENT_ID = 'custom';

// Default custom colors (can be overridden by user)
let customColors = {
    primary: '#ff4c4c',
    secondary: '#ff4c4c',
    tertiary: '#cc3333'
};

const guiColors = {
    'motion-primary': () => customColors.primary,
    'motion-primary-transparent': () => customColors.primary + 'e6',
    'motion-tertiary': () => customColors.tertiary,

    'looks-secondary': () => customColors.secondary,
    'looks-transparent': () => customColors.secondary + '59',
    'looks-light-transparent': () => customColors.secondary + '26',
    'looks-secondary-dark': () => {
        // Convert to darker version
        const hex = customColors.secondary.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const darkerR = Math.floor(r * 0.7);
        const darkerG = Math.floor(g * 0.7);
        const darkerB = Math.floor(b * 0.7);
        return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
    },

    'extensions-primary': () => {
        // Generate complementary color
        const hex = customColors.primary.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgb(${r}, ${g}, ${b})`;
    },
    'extensions-tertiary': () => {
        return customColors.tertiary;
    },
    'extensions-transparent': () => {
        return customColors.primary + '59';
    },
    'extensions-light': () => {
        // Generate lighter version
        const hex = customColors.primary.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const lighterR = Math.min(255, Math.floor(r * 1.3));
        const lighterG = Math.min(255, Math.floor(g * 1.3));
        const lighterB = Math.min(255, Math.floor(b * 1.3));
        return `rgb(${lighterR}, ${lighterG}, ${lighterB})`;
    },

    'drop-highlight': () => {
        // Generate lighter version
        const hex = customColors.primary.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const lighterR = Math.min(255, Math.floor(r * 1.3));
        const lighterG = Math.min(255, Math.floor(g * 1.3));
        const lighterB = Math.min(255, Math.floor(b * 1.3));
        return `rgb(${lighterR}, ${lighterG}, ${lighterB})`;
    },
    
    // Add menu bar colors for better theme integration
    'menu-bar-background': () => customColors.primary,
    'menu-bar-text': () => '#ffffff',
    'menu-bar-text-transparent': () => '#ffffff99',
    'menu-bar-border': () => customColors.tertiary,
    'menu-bar-item-hover': () => customColors.secondary + '33',
    'menu-bar-item-active': () => customColors.secondary + '66',
    
    // Add background colors
    'background': () => '#ffffff',
    'background-on': () => '#f8f8f8',
    'background-hover': () => '#f0f0f0',
    'background-active': () => '#e8e8e8',
    
    // Add text colors
    'text': () => '#000000',
    'text-on-primary': () => '#ffffff',
    'text-secondary': () => '#666666',
    'text-tertiary': () => '#999999',
    
    // Add border colors
    'border': () => '#cccccc',
    'border-accent': () => customColors.tertiary,
    'border-error': () => '#ff8c1a',
    'border-success': () => '#00c175',
    
    // Add input colors - don't override default input colors to prevent white background
    'input-border-accent': () => customColors.secondary
};

const blockColors = {
    // Remove custom block colors to prevent block color changes
    checkboxActiveBackground: () => customColors.primary,
    checkboxActiveBorder: () => customColors.tertiary
};

/**
 * Update custom colors
 * @param {Object} colors - Object with primary, secondary, tertiary colors
 */
const updateCustomColors = (colors) => {
    customColors = {
        primary: colors.primary || customColors.primary,
        secondary: colors.secondary || customColors.secondary,
        tertiary: colors.tertiary || customColors.tertiary || '#cc3333'
    };
};

/**
 * Get current custom colors
 * @returns {Object} Current custom colors
 */
const getCustomColors = () => ({
    primary: customColors.primary || '#ff4c4c',
    secondary: customColors.secondary || '#ff4c4c',
    tertiary: customColors.tertiary || '#cc3333'
});

/**
 * Resolve color function to actual color value
 * @param {Function|String} color - Color function or string
 * @returns {String} Resolved color
 */
const resolveColor = (color) => {
    if (typeof color === 'function') {
        return color();
    }
    return color;
};

/**
 * Get resolved GUI colors
 * @returns {Object} Resolved GUI colors
 */
const getResolvedGuiColors = () => {
    const resolved = {};
    Object.keys(guiColors).forEach(key => {
        resolved[key] = resolveColor(guiColors[key]);
    });
    return resolved;
};

/**
 * Get resolved block colors
 * @returns {Object} Resolved block colors
 */
const getResolvedBlockColors = () => {
    const resolved = {};
    Object.keys(blockColors).forEach(key => {
        const value = blockColors[key];
        if (typeof value === 'function') {
            resolved[key] = resolveColor(value);
        } else if (typeof value === 'object' && value !== null) {
            resolved[key] = {};
            Object.keys(value).forEach(subKey => {
                resolved[key][subKey] = resolveColor(value[subKey]);
            });
        } else {
            resolved[key] = value;
        }
    });
    return resolved;
};

export {
    guiColors,
    blockColors,
    updateCustomColors,
    getCustomColors,
    getResolvedGuiColors,
    getResolvedBlockColors,
    CUSTOM_ACCENT_ID
};