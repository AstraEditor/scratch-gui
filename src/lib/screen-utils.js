import {
    STAGE_DISPLAY_SCALE_METADATA,
    STAGE_SIZE_MODES,
    STAGE_DISPLAY_SIZES,
    FIXED_WIDTH
} from '../lib/layout-constants';

const maxScaleParam = typeof URLSearchParams !== 'undefined' && new URLSearchParams(location.search).get('scale');

/**
 * @typedef {object} StageDimensions
 * @property {int} height - the height to be used for the stage in the current situation.
 * @property {int} width - the width to be used for the stage in the current situation.
 * @property {number} scale - the scale factor from the stage's default size to its current size.
 * @property {int} heightDefault - the height of the stage in its default (large) size.
 * @property {int} widthDefault - the width of the stage in its default (large) size.
 */

const STAGE_DIMENSION_DEFAULTS = {
    // referencing css/units.css,
    // spacingBorderAdjustment = 2 * $full-screen-top-bottom-margin +
    //   2 * $full-screen-border-width
    fullScreenSpacingBorderAdjustment: 8,
    // referencing css/units.css,
    // menuHeightAdjustment = $stage-menu-height
    menuHeightAdjustment: 44,
    // referencing css/units.css,
    // menuBarHeightAdjustment = $menu-bar-height (permanent menu bar in fullscreen)
    menuBarHeightAdjustment: 48
};

/**
 * Get the current menu bar height from CSS custom property.
 * Plugins can override --stage-fullscreen-top to change this value.
 * @returns {number} menu bar height in pixels
 */
const getMenuBarHeight = () => {
    if (typeof window === 'undefined') {
        return STAGE_DIMENSION_DEFAULTS.menuBarHeightAdjustment;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const cssValue = rootStyle.getPropertyValue('--stage-fullscreen-top').trim();
    if (cssValue) {
        // Convert rem to px if needed
        if (cssValue.endsWith('rem')) {
            const remValue = parseFloat(cssValue);
            const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
            return remValue * fontSize;
        }
        // Already in px
        if (cssValue.endsWith('px')) {
            return parseFloat(cssValue);
        }
        // Assume it's a number (rem)
        const remValue = parseFloat(cssValue);
        if (!isNaN(remValue)) {
            const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
            return remValue * fontSize;
        }
    }
    return STAGE_DIMENSION_DEFAULTS.menuBarHeightAdjustment;
};

/**
 * Resolve the current GUI and browser state to an actual stage size enum value.
 * @param {STAGE_SIZE_MODES} stageSizeMode - the state of the stage size toggle button.
 * @param {boolean} isUnconstrained - true if the window is large enough for the full stage at its full size.
 * @return {STAGE_DISPLAY_SIZES} - the stage size enum value we should use in this situation.
 */
const resolveStageSize = (stageSizeMode, isUnconstrained) => {
    if (stageSizeMode === STAGE_SIZE_MODES.full && !isUnconstrained) {
        return STAGE_DISPLAY_SIZES.constrained;
    }
    return stageSizeMode;
};

/**
 * Retrieve info used to determine the actual stage size based on the current GUI and browser state.
 * @param {STAGE_DISPLAY_SIZES} stageSize - the current fully-resolved stage size.
 * @param {{width: number, height: number}} customStageSize Custom stage size
 * @param {boolean} isFullScreen - true if full-screen mode is enabled.
 * @return {StageDimensions} - an object describing the dimensions of the stage.
 */
const getStageDimensions = (stageSize, customStageSize, isFullScreen) => {
    const stageDimensions = {
        heightDefault: customStageSize.height,
        widthDefault: customStageSize.width,
        height: 0,
        width: 0,
        scale: 0
    };

    if (isFullScreen) {
        stageDimensions.height = window.innerHeight -
            STAGE_DIMENSION_DEFAULTS.menuHeightAdjustment -
            getMenuBarHeight() -
            STAGE_DIMENSION_DEFAULTS.fullScreenSpacingBorderAdjustment;

        stageDimensions.width = stageDimensions.height * (customStageSize.width / customStageSize.height);

        const maxWidth = maxScaleParam ? (
            Math.min(window.innerWidth, maxScaleParam * customStageSize.width)
        ) : window.innerWidth;
        if (stageDimensions.width > maxWidth) {
            stageDimensions.width = maxWidth;
            stageDimensions.height = stageDimensions.width * (customStageSize.height / customStageSize.width);
        }

        stageDimensions.scale = stageDimensions.width / stageDimensions.widthDefault;
    } else {
        const metadata = STAGE_DISPLAY_SCALE_METADATA[stageSize];
        if (metadata.width) {
            // Uses a fixed width.
            stageDimensions.width = metadata.width;
            stageDimensions.scale = stageDimensions.width / stageDimensions.widthDefault;
            stageDimensions.height = stageDimensions.scale * stageDimensions.heightDefault;
        } else {
            // Uses a width relative to the current size.
            stageDimensions.scale = metadata.scale;
            stageDimensions.height = stageDimensions.scale * stageDimensions.heightDefault;
            stageDimensions.width = stageDimensions.scale * stageDimensions.widthDefault;
        }
    }

    // Round off dimensions to prevent resampling/blurriness
    stageDimensions.height = Math.round(stageDimensions.height);
    stageDimensions.width = Math.round(stageDimensions.width);

    return stageDimensions;
};

/**
 * @param {STAGE_DISPLAY_SIZES} stageSize - the current fully-resolved stage size.
 * @returns {number} Minimum width to display the stage area of the screen at. May be wider than the stage's actual size
 */
const getMinWidth = stageSize => {
    const metadata = STAGE_DISPLAY_SCALE_METADATA[stageSize];
    if (metadata.width) {
        return metadata.width;
    }
    return FIXED_WIDTH * metadata.scale;
};

/**
 * Take a pair of sizes for the stage (a target height and width and a default height and width),
 * calculate the ratio between them, and return a CSS transform to scale to that ratio.
 * @param {object} sizeInfo An object containing dimensions of the target and default stage sizes.
 * @param {number} sizeInfo.width The target width
 * @param {number} sizeInfo.height The target height
 * @param {number} sizeInfo.widthDefault The default width
 * @param {number} sizeInfo.heightDefault The default height
 * @returns {object} the CSS transform
 */
const stageSizeToTransform = ({width, height, widthDefault, heightDefault}) => {
    const scaleX = width / widthDefault;
    const scaleY = height / heightDefault;
    if (scaleX === 1 && scaleY === 1) {
        // Do not set a transform if the scale is 1 because
        // it messes up `position: fixed` elements like the context menu.
        return;
    }
    return {transform: `scale(${scaleX},${scaleY})`};
};

export {
    getStageDimensions,
    getMinWidth,
    resolveStageSize,
    stageSizeToTransform
};
