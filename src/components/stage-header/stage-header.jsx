import classNames from 'classnames';
import { defineMessages, injectIntl, intlShape } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import VM from 'scratch-vm';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import Controls from '../../containers/controls.jsx';
import { getStageDimensions } from '../../lib/screen-utils';
import { STAGE_DISPLAY_SIZES, STAGE_SIZE_MODES } from '../../lib/layout-constants';

import fullScreenIcon from './icon--fullscreen.svg';
import unFullScreenIcon from './icon--unfullscreen.svg';
import settingsIcon from './icon--settings.svg';

import styles from './stage-header.css';

import FullscreenAPI from '../../lib/tw-fullscreen-api';

const messages = defineMessages({
    fullScreenMessage: {
        defaultMessage: 'Enter full screen mode',
        description: 'Button to change stage size to full screen',
        id: 'gui.stageHeader.stageSizeFull'
    },
    unFullScreenMessage: {
        defaultMessage: 'Exit full screen mode',
        description: 'Button to get out of full screen mode',
        id: 'gui.stageHeader.stageSizeUnFull'
    },
    fullscreenControl: {
        defaultMessage: 'Full Screen Control',
        description: 'Button to enter/exit full screen mode',
        id: 'gui.stageHeader.fullscreenControl'
    },
    openSettingsMessage: {
        defaultMessage: 'Open advanced settings',
        description: 'Button to open advanced settings in embeds',
        id: 'tw.openAdvanced'
    }
});

const enableSettingsButton = new URLSearchParams(location.search).has('settings-button');

const StageHeaderComponent = function (props) {
    const {
        customStageSize,
        isFullScreen,
        isPlayerOnly,
        onKeyPress,
        onSetStageFullScreen,
        onSetStageUnFullScreen,
        onOpenSettings,
        isEmbedded,
        stageSize,
        vm
    } = props;

    const stageDimensions = getStageDimensions(stageSize, customStageSize, isFullScreen || isEmbedded);

    // 渲染全屏或嵌入模式下的头部
    if (isFullScreen || isEmbedded) {
        const settingsButton = isEmbedded && enableSettingsButton ? (
            <div className={classNames(styles.settingsButton, styles.unselectWrapper)}>
                <Button
                    className={styles.stageButton}
                    onClick={onOpenSettings}
                >
                    <img
                        alt={props.intl.formatMessage(messages.openSettingsMessage)}
                        className={styles.stageButtonIcon}
                        draggable={false}
                        src={settingsIcon}
                        title={props.intl.formatMessage(messages.openSettingsMessage)}
                    />
                </Button>
            </div>
        ) : null;

        const fullscreenButton = isFullScreen ? (
            <div className={styles.unselectWrapper}>
                <Button
                    className={styles.stageButton}
                    onClick={onSetStageUnFullScreen}
                    onKeyPress={onKeyPress}
                >
                    <img
                        alt={props.intl.formatMessage(messages.unFullScreenMessage)}
                        className={styles.stageButtonIcon}
                        draggable={false}
                        src={unFullScreenIcon}
                        title={props.intl.formatMessage(messages.fullscreenControl)}
                    />
                </Button>
            </div>
        ) : FullscreenAPI.available() ? (
            <div className={styles.unselectWrapper}>
                <Button
                    className={styles.stageButton}
                    onClick={onSetStageFullScreen}
                >
                    <img
                        alt={props.intl.formatMessage(messages.fullScreenMessage)}
                        className={styles.stageButtonIcon}
                        draggable={false}
                        src={fullScreenIcon}
                        title={props.intl.formatMessage(messages.fullscreenControl)}
                    />
                </Button>
            </div>
        ) : null;

        return (
            <Box
                className={classNames(styles.stageHeaderWrapperOverlay, {
                    [styles.embedded]: isEmbedded
                })}
            >
                <Box
                    className={styles.stageMenuWrapper}
                    style={{ width: stageDimensions.width }}
                >
                    <Controls vm={vm} />
                    <div
                        className={styles.fullscreenButtonsRow}
                        key="fullscreen"
                    >
                        {settingsButton}
                        {fullscreenButton}
                    </div>
                </Box>
            </Box>
        );
    }

    // 渲染普通模式下的头部
    return (
        <Box
            className={styles.stageHeaderWrapper}
            style={{ minWidth: `${stageDimensions.width + 2}px` }}
        >
            <Box className={styles.stageMenuWrapper}>
                <Controls vm={vm} />
                <div
                    className={styles.stageSizeRow}
                    key="editor"
                >
                    <div>
                        <Button
                            className={styles.stageButton}
                            onClick={onSetStageFullScreen}
                        >
                            <img
                                alt={props.intl.formatMessage(messages.fullScreenMessage)}
                                className={styles.stageButtonIcon}
                                draggable={false}
                                src={fullScreenIcon}
                                title={props.intl.formatMessage(messages.fullscreenControl)}
                            />
                        </Button>
                    </div>
                </div>
            </Box>
        </Box>
    );
};

const mapStateToProps = state => ({
    stageSizeMode: state.scratchGui.stageSize.stageSize
});

StageHeaderComponent.propTypes = {
    intl: intlShape,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    isFullScreen: PropTypes.bool.isRequired,
    isPlayerOnly: PropTypes.bool.isRequired,
    onKeyPress: PropTypes.func.isRequired,
    onSetStageFullScreen: PropTypes.func.isRequired,
    onSetStageUnFullScreen: PropTypes.func.isRequired,
    onOpenSettings: PropTypes.func.isRequired,
    isEmbedded: PropTypes.bool.isRequired,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)),
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    vm: PropTypes.instanceOf(VM).isRequired
};

StageHeaderComponent.defaultProps = {
    stageSizeMode: STAGE_SIZE_MODES.large
};

export default injectIntl(connect(
    mapStateToProps
)(StageHeaderComponent));