//主要结构是我做的，不过后期的一些奇怪的API互动，Redux管理还是交给了AI，我不擅长直接过于抽象化的东西...

import { defineMessages, FormattedMessage, intlShape, injectIntl, useRef } from 'react-intl';
import React from 'react';
import Modal from '../../containers/modal.jsx';
import PropTypes from 'prop-types';
import Box from '../box/box.jsx';
import { setTheme } from '../../reducers/theme.js';
import { Theme } from '../../lib/themes/index.js';
import { persistTheme } from '../../lib/themes/themePersistance.js';
import { connect } from 'react-redux';
import styles from './custom-theme.css';
import classNames from 'classnames';
import {
    customGUITheme,
    customBlockColors,
    setColorTo,
    getColorOf,
    saveColors
} from "../../lib/themes/custom/custom.js"

function hexToRgb(hex) {
    // 去除 # 符号
    hex = hex.replace('#', '');

    // 处理 3 位简写
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
}

function rgbToHex(r, g, b) {
    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* eslint-disable react/no-multi-comp */
const messages = defineMessages({
    title: {
        defaultMessage: 'Costom Theme',
        description: 'Title of custom theme modal',
        id: 'tw.customTheme.title'
    }
});

const SelectBox = ({ value, onChangeColor, title, intro, id, ...props }) => (
    <>
        <div className={styles.header}>
            <div className={styles.divider} />
        </div>

        <div className={styles.titleBox}>
            <div>
                <span className={styles.title}>{title}</span><br />
                <span>{intro}</span>
            </div>

            <input
                className={styles.colorInput}
                type='color'
                defaultValue={value}
                onChange={(e) => onChangeColor(e.target.value)}
            />
        </div>
    </>
)
const onThemeColorChange = (value, id) => {
    const hex = hexToRgb(value);
    setColorTo(
        "motion-primary", value
    );
    setColorTo(
        "motion-primary-transparent", value + "e6" //透明度
    );
    setColorTo(
        "motion-tertiary", rgbToHex(hex.r, hex.g - 51, hex.b)
    );

    setColorTo(
        "looks-secondary", value
    );
    setColorTo(
        "looks-transparent", rgbToHex(hex.r, hex.g - 34, hex.b - 85) + "59"
    );
    setColorTo(
        "looks-light-transparent", rgbToHex(hex.r, hex.g - 51, hex.b - 119) + "26"
    );
    setColorTo(
        "looks-secondary-dark", rgbToHex(hex.r + 30, hex.g - 51, hex.b - 50)
    );
    setColorTo(
        "extensions-primary", value
    );
    setColorTo(
        "extensions-tertiary", rgbToHex(hex.r + 30, hex.g - 51, hex.b - 50)
    );
    setColorTo(
        "extensions-tertiary", rgbToHex(hex.r + 30, hex.g - 90, hex.b - 90) + "59"
    );
    setColorTo(
        "extensions-light", rgbToHex(hex.r + 30, hex.g + 10, hex.b + 10)
    );
    setColorTo(
        "drop-highlight", rgbToHex(hex.r + 30, hex.g + 10, hex.b + 10)
    );
    setColorTo(
        "checkboxActiveBackground", value
    );
}
const ThemeColor = props => (
    <SelectBox
        {...props}
        id="main-color"
        value={customGUITheme['motion-primary'] || '#ff4c4c'}
        title={
            <FormattedMessage
                defaultMessage="Theme Color"
                description="gui-theme-color"
                id="tw.customTheme.maincolor"
            />
        }
        intro={
            <FormattedMessage
                defaultMessage="Choose the color you like, and other colors will be automatically filled in"
                description="gui-theme-color-intro"
                id="tw.customTheme.maincolor.introduction"
            />
        }
        onChangeColor={(e) => {
            onThemeColorChange(
                e, "main-theme"
            )
        }}
    />
)
SelectBox.prototype = {
    title: PropTypes.string,
    intro: PropTypes.string,
    id: PropTypes.string,
}

const updateColor = (currentTheme, onChangeTheme) => {
    saveColors();
    const newTheme = currentTheme.set('accent', 'custom');
    onChangeTheme(newTheme);
}
const CustomModalComponent = props => (
    <Modal
        className={styles.modalContent}
        onRequestClose={props.onClose}
        contentLabel={props.intl.formatMessage(messages.title)}
        id="customtheme"
    >
        <Box className={styles.body}>
            <div className={styles.content}>
                <FormattedMessage
                    defaultMessage="You can customize the theme colors for the interface. Enter your preferred color below and click 'Apply' to update your theme."
                    description="introduction of custom theme modal"
                    id="tw.customTheme.introduction"
                />
                <br />
                <ThemeColor />
            </div>
            <div className={styles.apply}>
                <button
                    className={styles.button}
                    onClick={() => updateColor(props.theme, props.onChangeTheme)}
                >
                    <FormattedMessage
                        defaultMessage="Apply"
                        description="Apply Button"
                        id="tw.customTheme.apply"
                    />
                </button>
            </div>
        </Box>

    </Modal>
);

CustomModalComponent.propTypes = {
    intl: intlShape,
    onClose: PropTypes.func,
    theme: PropTypes.instanceOf(Theme)
};

const mapStateToProps = state => ({
    theme: state.scratchGui.theme.theme
});

const mapDispatchToProps = dispatch => ({
    onChangeTheme: theme => {
        dispatch(setTheme(theme));
        persistTheme(theme);
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(injectIntl(CustomModalComponent));
