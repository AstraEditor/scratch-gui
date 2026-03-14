import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { closeReadme } from '../reducers/modals';
import ReadmeComponent from '../components/ae-readme/ae-readme.jsx';

// 容器组件
const readme = props => (
        <ReadmeComponent
                vm={props.vm}
                onClose={props.onClose}
        />
);

readme.propTypes = {
        vm: PropTypes.shape({
                editingTarget: PropTypes.shape({
                        comments: PropTypes.object
                })
        }).isRequired,
        onClose: PropTypes.func
};

// 连接 Redux
const mapStateToProps = state => ({
        vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
        onClose: () => dispatch(closeReadme())
});

export default connect(
        mapStateToProps, 
        mapDispatchToProps
)(readme);