import React from 'react';
import PropTypes from 'prop-types';
import styles from './data-url.css';

const decodeDataURI = dataURI => {
    const delimeter = dataURI.indexOf(',');
    if (delimeter === -1) {
        return dataURI;
    }
    const contentType = dataURI.substring(0, delimeter);
    const data = dataURI.substring(delimeter + 1);
    if (contentType.endsWith(';base64')) {
        try {
            // 获取原始字节的字符串表示
            const binaryString = atob(data);

            // 转换为 Uint8Array 字节数组
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // UTF-8 解码器
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(bytes);
        } catch (e) {
            return dataURI;
        }
    }
    try {
        return decodeURIComponent(data);
    } catch (e) {
        return dataURI;
    }
};

const DataURL = props => (
    <textarea
        className={styles.code}
        value={decodeDataURI(props.url)}
        readOnly
        spellCheck={false}
        autoComplete="off"
    />
);

DataURL.propTypes = {
    url: PropTypes.string.isRequired
};

export default DataURL;
