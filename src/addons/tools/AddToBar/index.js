import { getSetting } from '../AEsettings/index.js';
import SideBar from '../../ui/side-bar/side-bar.js';

function isVSCodeLayoutEnabled() {
    return getSetting('EnableVSCodeLayout');
}

const TAB_BUTTON_CLASS = 'ae-tab-button';
const CONTAINER_CLASS = 'ae-addons-list';

let stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const el = document.createElement('style');
    el.textContent = `
.${TAB_BUTTON_CLASS} {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 0.5rem;
  white-space: nowrap;
  padding: 0.2rem 0.5rem;
  font-family: inherit;
  font-size: 12px;
  font-weight: bold;
  background-color: var(--ui-white);
  border: 1px solid var(--ui-black-transparent);
  color: var(--text-primary);
  border-radius: 4px;
  height: 1.5rem;
  margin-top: auto !important;
  margin-bottom: auto !important;
}
.${TAB_BUTTON_CLASS}:hover {
  border-color: var(--motion-primary);
}

/* ── Base container (horizontal, for non-VSCode layout) ── */
.${CONTAINER_CLASS} {
  display: flex;
  align-items: center;
  margin: auto 0;
  gap: 5px;
}

/* ── VSCode layout: container (column, fits the 41px sidebar) ── */
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} {
  flex-direction: column !important;
  gap: 0 !important;
  margin: 0 auto !important;
  width: 100%;
  flex-shrink: 0;
}

/* ── VSCode layout: icon tab button ── */
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} .${TAB_BUTTON_CLASS} {
  width: 40px;
  height: 30px;
  font-size: 0;
  background-color: #00000000;
  border: 0;
  border-radius: 0 !important;
  margin: 0 !important;
  padding: 20px 0 !important;
  gap: 0;
  flex-direction: column;
  position: relative;
}
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} .${TAB_BUTTON_CLASS}:hover {
  border-color: transparent;
}
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} .${TAB_BUTTON_CLASS} img {
  width: 24px;
  height: 22px;
  margin: 0 !important;
  filter: grayscale(100%);
}
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} .${TAB_BUTTON_CLASS}:hover img {
  filter: brightness(150%) grayscale(100%);
  -webkit-filter: brightness(150%) grayscale(100%);
}
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} .${TAB_BUTTON_CLASS}.is-selected {
  background-color: var(--ui-white) !important;
  box-shadow: inset 3px 0px 0px 0px var(--looks-secondary) !important;
}
[class*="tabs"][class*="vscodeList"] .${CONTAINER_CLASS} .${TAB_BUTTON_CLASS}.is-selected img {
  filter: grayscale(0%);
}
`;
    document.head.appendChild(el);
}

/**
 * Centralized addon button injection.
 * Automatically handles re-injection on DOM refresh (project load, layout change, etc.)
 *
 * In VSCode layout: creates an icon tab button in the tab bar with SideBar integration.
 * In non-VSCode layout: creates a text button in the specified container.
 *
 * @param {object} addon - the addon's tab API object
 * @param {object} config
 * @param {string} config.id - unique SideBar plugin ID
 * @param {string|function} config.icon - icon URL or function that returns one
 * @param {string} config.text - button label for non-VSCode layout
 * @param {boolean} [config.vscOnly] - if true, skip non-VSCode button creation (VSCode only)
 * @param {function} [config.getContent] - returns a DOM element for SideBar content (VSCode only)
 * @param {function} [config.onActivate] - called when SideBar activates this addon (VSCode only)
 * @param {function} [config.onDeactivate] - called when SideBar deactivates this addon (VSCode only)
 * @param {function} [config.onClick] - called when button is clicked in non-VSCode layout
 */
export default async function AddToBar(addon, config) {
    injectStyles();
    const { id, icon, text, vscOnly, getContent, onActivate, onDeactivate, onClick } = config;
    const vscode = isVSCodeLayoutEnabled();

    // vscOnly: skip entirely when not in VSCode layout
    if (vscOnly && !vscode) return;
    const tabListSelector = '[class*="react-tabs_react-tabs__tab-list"]';
    const tabAddonListSelector = CONTAINER_CLASS;

    // Create button
    const button = vscode
        ? document.createElement('li')
        : document.createElement('button');

    button.className = addon.tab.scratchClass('menu-bar_menu-bar-button', {
        others: TAB_BUTTON_CLASS
    });

    if (vscode) {
        const img = document.createElement('img');
        img.src = typeof icon === 'function' ? icon() : icon;
        img.draggable = false;
        img.alt = text;
        button.appendChild(img);

        const enableEffect = () => {
            button.classList.add('is-selected');
            button.setAttribute('aria-selected', 'true');
        };
        const unableEffect = () => {
            button.classList.remove('is-selected');
            button.setAttribute('aria-selected', 'false');
        };

        button.onclick = () => {
            if (SideBar.getActivePlugin() === id) {
                SideBar.close();
                unableEffect();
                if (onDeactivate) onDeactivate();
            } else {
                if (getContent) {
                    SideBar.register(id, getContent(), {
                        onActivate: () => {
                            enableEffect();
                            if (onActivate) onActivate();
                        },
                        onDeactivate: () => {
                            unableEffect();
                            if (onDeactivate) onDeactivate();
                        }
                    });
                }
                SideBar.switchTo(id);
                SideBar.open();
                enableEffect();
            }
        };
    } else {
        button.textContent = text;
        button.title = text;
        button.addEventListener('click', () => {
            if (onClick) onClick();
        });
    }

    addon.tab.displayNoneWhileDisabled(button);

    while (true) {
        const tabs = await addon.tab.waitForElement(tabListSelector, {
            markAsSeen: true,
            reduxEvents: ['scratch-gui/mode/SET_PLAYER', 'fontsLoaded/SET_FONTS_LOADED', 'scratch-gui/locales/SELECT_LOCALE'],
            reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
        });
        let tab = document.querySelector(`.${tabAddonListSelector}`);
        if (!tab) {
            tab = document.createElement('div');
            tab.className = tabAddonListSelector;
            tab.appendChild(button);
            if (tabs) tabs.appendChild(tab);
        } else {
            tab.appendChild(button);
        }
    }
}
