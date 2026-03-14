import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { closePreviewExt } from '../reducers/modals';
import PreviewExtComponent from '../components/ae-preview-ext/ae-preview-ext.jsx';
import { setPreviewExtData } from '../reducers/ae-preview-ext-data';

const PreviewExt = props => (
        <PreviewExtComponent
                onClose={props.onClose}
                svgList={props.svgList}
        />
);

PreviewExt.propTypes = {
        onClose: PropTypes.func,
        svgList: PropTypes.array
};

// 连接 Redux
const mapDispatchToProps = dispatch => ({
        onClose: () => {
                dispatch(closePreviewExt());
                dispatch(setPreviewExtData(null));  // 关闭时清空数据
        }
});

const mapStateToProps = state => ({
        svgList: state.scratchGui.aePreviewExtData?.data || null
});

export default connect(
        mapStateToProps,
        mapDispatchToProps
)(PreviewExt);