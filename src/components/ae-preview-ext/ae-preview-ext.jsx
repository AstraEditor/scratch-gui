import { defineMessages, FormattedMessage, intlShape, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import Modal from '../../containers/modal.jsx';
import styles from './ae-preview-ext.css';

// 定义翻译消息
const messages = defineMessages({
        title: {
                defaultMessage: 'Preview Extension',
                description: 'Title of Preview Extension modal',
                id: 'tw.previewextension.title'
        }
});

// 展示组件
const PreviewExtComponent = props => (
        <Modal
                className={styles.modalContent}
                onRequestClose={props.onClose}
                contentLabel={props.intl.formatMessage(messages.title)}
                id="previewExt"
        >
                {/* Modal 内容 */}
                <div className={styles.body}>
                        {props.svgList && props.svgList.length > 0 ? (
                                <div className={styles.svgList}>
                                        {props.svgList.map((svg, index) => (
                                                <div
                                                        key={index}
                                                        className={styles.svgItem}
                                                        dangerouslySetInnerHTML={{ __html: `<svg className=svgBlock>` + svg + "</svg>" }}
                                                />
                                        ))}
                                </div>
                        ) : (
                                <FormattedMessage
                                        defaultMessage="No blocks to preview"
                                        id="tw.previewextension.noblocks"
                                />
                        )}
                </div>
        </Modal>
);

PreviewExtComponent.propTypes = {
        intl: intlShape,
        onClose: PropTypes.func.isRequired,
        svgList: PropTypes.array
};

export default injectIntl(PreviewExtComponent);