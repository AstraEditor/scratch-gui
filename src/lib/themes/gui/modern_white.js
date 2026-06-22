const guiColors = {
    "color-scheme": "light",
    "ui-primary":
        "color-mix(in srgb, rgb(255, 255, 255) 98%, var(--looks-secondary))",
    "ui-secondary":
        "color-mix(in srgb, rgb(255, 255, 255) 98%, var(--looks-secondary))",
    "ui-tertiary":
        "color-mix(in srgb, rgb(255, 255, 255) 98%, var(--looks-secondary))",

    "ui-modal-overlay":
        "color-mix(in srgb, rgba(130, 130, 130, 0.8) 98%, var(--looks-secondary))",
    "ui-modal-background": "hsla(0, 100%, 100%, 1)",
    "ui-modal-foreground": "rgb(117, 117, 117)",
    "ui-modal-header-background":
        "#ffffff",
    "ui-modal-header-foreground": "rgb(0, 0, 0)",

    "ui-white": "rgb(255, 255, 255)",
    "ui-white-dim":
        "hsla(0, 100%, 100%, 0.75)",
    "ui-white-transparent":
        "hsla(0, 100%, 100%, 0.25)",
    "ui-transparent":
        "hsla(0, 100%, 100%, 0)",

    "ui-black-transparent":
        "hsla(0, 0%, 0%, 0.15)",

    "text-primary": "hsla(225, 15%, 40%, 1)",
    "text-primary-transparent": "hsla(225, 15%, 40%, 0.75)",

    "motion-primary": "hsla(215, 100%, 75%, 1)",
    "motion-primary-transparent": "hsla(215, 100%, 75%, 0.9)",
    "motion-tertiary": "hsla(215, 60%, 65%, 1)",

    "looks-secondary": "hsla(260, 60%, 72%, 1)",
    "looks-transparent": "hsla(260, 60%, 72%, 0.35)",
    "looks-light-transparent": "hsla(260, 60%, 72%, 0.15)",
    "looks-secondary-dark": "hsla(260, 42%, 62%, 1)",

    "red-primary": "hsla(20, 100%, 65%, 1)",
    "red-tertiary": "hsla(20, 100%, 55%, 1)",

    "sound-primary": "hsla(300, 53%, 72%, 1)",
    "sound-tertiary": "hsla(300, 48%, 62%, 1)",

    "control-primary": "hsla(38, 100%, 72%, 1)",

    "data-primary": "hsla(30, 100%, 70%, 1)",

    "pen-primary": "hsla(163, 85%, 68%, 1)",
    "pen-transparent": "hsla(163, 85%, 68%, 0.25)",
    "pen-tertiary": "hsla(163, 86%, 58%, 1)",

    "error-primary": "hsla(30, 100%, 68%, 1)",
    "error-light": "hsla(30, 100%, 78%, 1)",
    "error-transparent": "hsla(30, 100%, 68%, 0.25)",

    "extensions-primary": "hsla(163, 85%, 68%, 1)",
    "extensions-tertiary": "hsla(163, 85%, 58%, 1)",
    "extensions-transparent": "hsla(163, 85%, 68%, 0.35)",
    "extensions-light": "hsla(163, 57%, 85%, 1)",

    "drop-highlight": "hsla(215, 100%, 85%, 1)",

    "menu-bar-background":
        "color-mix(in srgb, rgb(255, 255, 255) 98%, var(--looks-secondary))",
    "menu-bar-background-image": "none",
    "icon-style": "brightness(0.2)",
    "menu-bar-feedback": "#606060",
    "menu-bar-foreground": "#7d7d7d",

    "assets-background": "#ffffff",

    "input-background": "#ffffff",

    "popover-background": "#ffffff",

    shadow: "hsla(0, 0%, 0%, 0.05)",

    "badge-background": "#dbebff",
    "badge-border": "#b9d6ff",

    "fullscreen-background": "#ffffff",
    "fullscreen-accent": "#e8edf1",

    "page-background": "#ffffff",
    "page-foreground": "#000000",

    "project-title-inactive": "var(--ui-white-transparent)",
    "project-title-hover": "#ffffff7f",

    "link-color": "#2255dd",

    "filter-icon-black": "none",
    "filter-icon-gray": "grayscale(100%)",
    "filter-icon-white": "none",

    "paint-ui-pane-border": "var(--ui-black-transparent)",
    "paint-text-primary": "var(--text-primary)",
    "paint-form-border": "var(--ui-black-transparent)",
    "paint-looks-secondary": "var(--looks-secondary)",
    "paint-looks-transparent": "var(--looks-transparent)",
    "paint-input-background": "var(--input-background)",
    "paint-popover-background": "var(--popover-background)",
    "paint-filter-icon-gray": "none",
};

const blockColors = {};

export {
    guiColors,
    blockColors
};