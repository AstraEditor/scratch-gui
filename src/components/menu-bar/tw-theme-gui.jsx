import PropTypes from "prop-types";
import classNames from "classnames";
import React, { Children } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";

import { MenuItem, Submenu } from "../menu/menu.jsx";
import {
    GUI_DARK,
    GUI_DEEKDARK,
    GUI_LIGHT,
    GUI_MODERNWHITE,
    Theme,
} from "../../lib/themes/index.js";
import {
    closeSettingsMenu,
    openGUIAccentMenu,
    accentMenuOpen,
} from "../../reducers/menus.js";
import check from "./check.svg";
import { setTheme } from "../../reducers/theme.js";
import { persistTheme } from "../../lib/themes/themePersistance.js";
import lightModeIcon from "./tw-sun.svg";
import darkModeIcon from "./tw-moon.svg";
import styles from "./settings-menu.css";
import dropdownCaret from "./dropdown-caret.svg";

const ThemeOption = ({ color, theme, onChangeTheme, children }) => {
    return (
        <MenuItem onClick={() => onChangeTheme(theme.set("gui", color))}>
            <div className={styles.option}>
                <img
                    className={classNames(styles.check, {
                        [styles.selected]: theme.gui === color,
                    })}
                    width={15}
                    height={12}
                    src={check}
                    draggable={false}
                />
                {children}
            </div>
        </MenuItem>
    );
};

const GuiThemeMenu = ({ isOpen, onOpen, onChangeTheme, theme, isRtl }) => (
    <MenuItem expanded={isOpen}>
        <div
            className={styles.option}
            // eslint-disable-next-line react/jsx-no-bind
            onClick={onOpen}
        >
            <img
                src={
                    theme.gui === GUI_DARK
                        ? darkModeIcon
                        : theme.gui === GUI_DEEKDARK ? darkModeIcon: lightModeIcon
                }
                draggable={false}
                width={24}
                height={24}
                style={{
                    filter: "var(--icon-style)",
                }}
            />
            <span className={styles.submenuLabel}>
                <FormattedMessage
                    defaultMessage="GUI Accent"
                    description="Menu to change color scheme"
                    id="tw.guiAccent"
                />
            </span>
            <img
                className={styles.expandCaret}
                src={dropdownCaret}
                draggable={false}
            />
        </div>
        <Submenu place={isRtl ? "left" : "right"}>
            <span className={styles.submenuLabel}>
                <ThemeOption
                    color={GUI_LIGHT}
                    theme={theme}
                    onChangeTheme={onChangeTheme}
                >
                    <FormattedMessage
                        defaultMessage="Light"
                        description="Menu item to change color scheme to light (it is currently dark)"
                        id="tw.darkMode"
                    />
                </ThemeOption>
                <ThemeOption
                    color={GUI_MODERNWHITE}
                    theme={theme}
                    onChangeTheme={onChangeTheme}
                >
                    <FormattedMessage
                        defaultMessage="Modern Light"
                        description="Menu item to change color scheme to dark (it is currently light)"
                        id="tw.modernLightMode"
                    />
                </ThemeOption>
                <ThemeOption
                    color={GUI_DARK}
                    theme={theme}
                    onChangeTheme={onChangeTheme}
                >
                    <FormattedMessage
                        defaultMessage="Dark"
                        description="Menu item to change color scheme to dark (it is currently light)"
                        id="tw.lightMode"
                    />
                </ThemeOption>
                <ThemeOption
                    color={GUI_DEEKDARK}
                    theme={theme}
                    onChangeTheme={onChangeTheme}
                >
                    <FormattedMessage
                        defaultMessage="Deep Dark"
                        description="Menu item to change color scheme to dark (it is currently light)"
                        id="tw.deepDarkMode"
                    />
                </ThemeOption>
            </span>
        </Submenu>
    </MenuItem>
);

GuiThemeMenu.propTypes = {
    isOpen: PropTypes.bool,
    isRtl: PropTypes.bool,
    onChangeTheme: PropTypes.func,
    theme: PropTypes.instanceOf(Theme),
};

const mapStateToProps = (state) => ({
    isOpen: accentMenuOpen(state),
    isRtl: state.locales.isRtl,
    theme: state.scratchGui.theme.theme,
});

const mapDispatchToProps = (dispatch) => ({
    onChangeTheme: (theme) => {
        dispatch(setTheme(theme));
        dispatch(closeSettingsMenu());
        persistTheme(theme);
    },
    onOpen: () => dispatch(openGUIAccentMenu()),
});

export default connect(mapStateToProps, mapDispatchToProps)(GuiThemeMenu);
