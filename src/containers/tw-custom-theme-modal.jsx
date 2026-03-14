import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {closeCustomTheme} from '../reducers/modals';
import CustomThemeModalComponent from '../components/ae-custom-theme/custom-theme.jsx';

const CustomThemeModal = props => (
    <CustomThemeModalComponent
        onClose={props.onClose}
    />
);

CustomThemeModal.propTypes = {
    onClose: PropTypes.func
};

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeCustomTheme())
});

export default connect(
    null,
    mapDispatchToProps
)(CustomThemeModal);