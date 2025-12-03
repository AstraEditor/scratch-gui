import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';

import Modal from '../modal/modal.jsx';
import TargetPane from '../../containers/target-pane.jsx';
import Box from '../box/box.jsx';
import messages from './sprite-modal-messages.js';

import styles from './sprite-modal.css';

const SpriteModal = ({
    isOpen,
    editingTarget,
    fileInputRef,
    hoveredTarget,
    spriteLibraryVisible,
    stage,
    stageSize,
    sprites,
    vm,
    onRequestClose,
    onActivateBlocksTab,
    onChangeSpriteDirection,
    onChangeSpriteName,
    onChangeSpriteRotationStyle,
    onChangeSpriteSize,
    onChangeSpriteVisibility,
    onChangeSpriteX,
    onChangeSpriteY,
    onDeleteSprite,
    onDrop,
    onDuplicateSprite,
    onExportSprite,
    onFileUploadClick,
    onNewSpriteClick,
    onPaintSpriteClick,
    onRequestCloseSpriteLibrary,
    onSelectSprite,
    onSpriteUpload,
    onSurpriseSpriteClick,
    raiseSprites,
    customStageSize,
    intl,
    ...modalProps
}) => {
    // 计算舞台尺寸
    const getStageDimensions = () => {
        if (customStageSize) {
            return { width: customStageSize.width, height: customStageSize.height };
        }
        
        switch (stageSize) {
            case 'large':
                return { width: 720, height: 540 };
            case 'small':
                return { width: 240, height: 180 };
            default:
                return { width: 480, height: 360 };
        }
    };

    const stageDimensions = getStageDimensions();
    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            contentLabel={intl.formatMessage(messages.title)}
            className={styles.spriteModal}
            hideCloseButton={true}
            style={{
                content: {
                    width: `${stageDimensions.width + 40}px`, // 与舞台宽度相等
                    height: `${Math.floor((stageDimensions.height + 100) * 0.7)}px`, // 舞台高度的70%
                    minWidth: `${stageDimensions.width + 40}px`,
                    minHeight: `${Math.floor((stageDimensions.height + 100) * 0.7)}px`,
                    maxWidth: `${stageDimensions.width + 40}px`,
                    maxHeight: `${Math.floor((stageDimensions.height + 100) * 0.7)}px`,
                    transform: `translate(${window.innerWidth - stageDimensions.width - 60}px, ${window.innerHeight - Math.floor((stageDimensions.height + 100) * 0.7) - 40}px)` // 右下角位置
                }
            }}
            {...modalProps}
        >
            <Box
                className={styles.spriteContainer}
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden'
                }}
            >
                <TargetPane
                    editingTarget={editingTarget}
                    fileInputRef={fileInputRef}
                    hoveredTarget={hoveredTarget}
                    spriteLibraryVisible={spriteLibraryVisible}
                    stage={stage}
                    stageSize={stageSize}
                    sprites={sprites}
                    vm={vm}
                    onActivateBlocksTab={onActivateBlocksTab}
                    onChangeSpriteDirection={onChangeSpriteDirection}
                    onChangeSpriteName={onChangeSpriteName}
                    onChangeSpriteRotationStyle={onChangeSpriteRotationStyle}
                    onChangeSpriteSize={onChangeSpriteSize}
                    onChangeSpriteVisibility={onChangeSpriteVisibility}
                    onChangeSpriteX={onChangeSpriteX}
                    onChangeSpriteY={onChangeSpriteY}
                    onDeleteSprite={onDeleteSprite}
                    onDrop={onDrop}
                    onDuplicateSprite={onDuplicateSprite}
                    onExportSprite={onExportSprite}
                    onFileUploadClick={onFileUploadClick}
                    onNewSpriteClick={onNewSpriteClick}
                    onPaintSpriteClick={onPaintSpriteClick}
                    onRequestCloseSpriteLibrary={onRequestCloseSpriteLibrary}
                    onSelectSprite={onSelectSprite}
                    onSpriteUpload={onSpriteUpload}
                    onSurpriseSpriteClick={onSurpriseSpriteClick}
                    raiseSprites={raiseSprites}
                />
            </Box>
        </Modal>
    );
};

SpriteModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    editingTarget: PropTypes.string,
    fileInputRef: PropTypes.object,
    hoveredTarget: PropTypes.shape({
        hoveredSprite: PropTypes.string,
        receivedProps: PropTypes.bool
    }),
    spriteLibraryVisible: PropTypes.bool,
    stage: PropTypes.shape({
        costume: PropTypes.shape({
            url: PropTypes.string,
            name: PropTypes.string,
            bitmapResolution: PropTypes.number,
            rotationCenterX: PropTypes.number,
            rotationCenterY: PropTypes.number
        }),
        width: PropTypes.number,
        height: PropTypes.number,
        direction: PropTypes.number,
        draggable: PropTypes.bool,
        rotationStyle: PropTypes.string,
        visible: PropTypes.bool,
        x: PropTypes.number,
        y: PropTypes.number,
        size: PropTypes.number
    }),
    stageSize: PropTypes.string.isRequired,
    sprites: PropTypes.arrayOf(PropTypes.shape({
        costume: PropTypes.shape({
            url: PropTypes.string,
            name: PropTypes.string,
            bitmapResolution: PropTypes.number,
            rotationCenterX: PropTypes.number,
            rotationCenterY: PropTypes.number
        }),
        width: PropTypes.number,
        height: PropTypes.number,
        direction: PropTypes.number,
        draggable: PropTypes.bool,
        rotationStyle: PropTypes.string,
        visible: PropTypes.bool,
        x: PropTypes.number,
        y: PropTypes.number,
        size: PropTypes.number,
        name: PropTypes.string,
        id: PropTypes.string
    })),
    vm: PropTypes.object.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    onActivateBlocksTab: PropTypes.func,
    onChangeSpriteDirection: PropTypes.func,
    onChangeSpriteName: PropTypes.func,
    onChangeSpriteRotationStyle: PropTypes.func,
    onChangeSpriteSize: PropTypes.func,
    onChangeSpriteVisibility: PropTypes.func,
    onChangeSpriteX: PropTypes.func,
    onChangeSpriteY: PropTypes.func,
    onDeleteSprite: PropTypes.func,
    onDrop: PropTypes.func,
    onDuplicateSprite: PropTypes.func,
    onExportSprite: PropTypes.func,
    onFileUploadClick: PropTypes.func,
    onNewSpriteClick: PropTypes.func,
    onPaintSpriteClick: PropTypes.func,
    onRequestCloseSpriteLibrary: PropTypes.func,
    onSelectSprite: PropTypes.func,
    onSpriteUpload: PropTypes.func,
    onSurpriseSpriteClick: PropTypes.func,
    raiseSprites: PropTypes.func,
    intl: intlShape.isRequired
};

SpriteModal.defaultProps = {
    editingTarget: null,
    fileInputRef: null,
    hoveredTarget: null,
    spriteLibraryVisible: false,
    stage: null,
    sprites: [],
    customStageSize: null,
    onActivateBlocksTab: () => {},
    onChangeSpriteDirection: () => {},
    onChangeSpriteName: () => {},
    onChangeSpriteRotationStyle: () => {},
    onChangeSpriteSize: () => {},
    onChangeSpriteVisibility: () => {},
    onChangeSpriteX: () => {},
    onChangeSpriteY: () => {},
    onDeleteSprite: () => {},
    onDrop: () => {},
    onDuplicateSprite: () => {},
    onExportSprite: () => {},
    onFileUploadClick: () => {},
    onNewSpriteClick: () => {},
    onPaintSpriteClick: () => {},
    onRequestCloseSpriteLibrary: () => {},
    onSelectSprite: () => {},
    onSpriteUpload: () => {},
    onSurpriseSpriteClick: () => {},
    raiseSprites: () => {}
};

export default injectIntl(SpriteModal);