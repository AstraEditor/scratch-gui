import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import VM from 'scratch-vm';

import messages from './stage-modal-messages.js';

import Modal from '../modal/modal.jsx';
import StageWrapper from '../../containers/stage-wrapper.jsx';
import Alerts from '../../containers/alerts.jsx';
import Box from '../box/box.jsx';
import { getStageDimensions } from '../../lib/screen-utils.js';

import styles from './stage-modal.css';

const StageModal = ({
    isOpen,
    isFullScreen,
    isRendererSupported,
    isRtl,
    loading,
    stageSize,
    vm,
    alertsVisible,
    onRequestClose,
    customStageSize,
    intl,
    ...modalProps
}) => {
    const stageDimensions = getStageDimensions(stageSize, customStageSize, isFullScreen);
    
    // 计算合适的初始大小
    const getInitialSize = () => {
        if (isFullScreen) {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        }
        
        const padding = 40;
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight * 0.8;
        
        return {
            width: Math.min(stageDimensions.width + padding, maxWidth),
            height: Math.min(stageDimensions.height + padding + 60, maxHeight) // +60 for header
        };
    };

    const initialSize = getInitialSize();

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            contentLabel={intl.formatMessage(messages.title)}
            className={styles.stageModal}
            disableResize={false}
            disableResizeOnly={true}
            hideCloseButton={true}
            style={{
                content: {
                    width: `${stageDimensions.width + 40}px`, // 加上padding
                    height: `${stageDimensions.height + 100}px`, // 加上header和padding
                    minWidth: `${stageDimensions.width + 40}px`,
                    minHeight: `${stageDimensions.height + 100}px`,
                    maxWidth: `${stageDimensions.width + 40}px`,
                    maxHeight: `${stageDimensions.height + 100}px`,
                    resize: 'none !important',
                    overflow: 'hidden !important',
                    userSelect: 'none !important',
                    transform: `translate(${window.innerWidth - stageDimensions.width - 60}px, 70px)` // 右上角位置，向下50px
                }
            }}
            {...modalProps}
        >
            <Box
                className={styles.stageContainer}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    boxSizing: 'border-box'
                }}
            >
                <StageWrapper
                    isFullScreen={false} // Modal内部不使用全屏模式
                    isEmbedded={false}
                    isRendererSupported={isRendererSupported}
                    isRtl={isRtl}
                    loading={loading}
                    stageSize={stageSize}
                    vm={vm}
                    customStageSize={customStageSize}
                >
                    {alertsVisible ? (
                        <Alerts className={styles.alertsContainer} />
                    ) : null}
                </StageWrapper>
            </Box>
        </Modal>
    );
};

StageModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    isFullScreen: PropTypes.bool,
    isRendererSupported: PropTypes.bool.isRequired,
    isRtl: PropTypes.bool,
    loading: PropTypes.bool,
    stageSize: PropTypes.string.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired,
    alertsVisible: PropTypes.bool,
    onRequestClose: PropTypes.func.isRequired,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    intl: intlShape.isRequired
};

StageModal.defaultProps = {
    isFullScreen: false,
    isRtl: false,
    loading: false,
    alertsVisible: false,
    customStageSize: null
};

export default injectIntl(StageModal);