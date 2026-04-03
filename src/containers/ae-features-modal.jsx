import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import bindAll from 'lodash.bindall';
import { setUsername, setUsernameInvalid } from '../reducers/tw';
import { generateRandomUsername } from '../lib/tw-username';
import isScratchDesktop from '../lib/isScratchDesktop';
import { closeAeFeaturesModal } from '../reducers/modals';
import AeFeaturesComponent from '../components/ae-features-modal/ae-features-modal.jsx';
import version from '../lib/ae-version.js';


class aeFeaturesModal extends React.Component {
    constructor(props) {
        super(props);
        bindAll(this, [
            'handleKeyPress',
            'handleFocus',
            'handleOk',
            'handleCancel',
            'handleChange',
            'handleReset'
        ]);
        this.state = {
            value: this.props.username,
            valueValid: !this.props.usernameInvalid
        };
    }
    handleKeyPress(event) {
        if (event.key === 'Enter' && this.state.valueValid) {
            this.handleOk();
        }
    }
    handleFocus(event) {
        event.target.select();
    }
    handleOk() {
        this.props.onSetUsername(this.state.value);
    }
    handleCancel() {
        this.props.onClose();
    }
    handleChange(e) {
        this.setState({
            value: e.target.value,
            valueValid: e.target.checkValidity()
        });
    }
    handleReset() {
        const randomUsername = isScratchDesktop() ? 'player' : generateRandomUsername();
        this.props.onSetUsername(randomUsername);
    }
    render() {
        return (
            <AeFeaturesComponent
                mustChangeUsername={this.props.usernameInvalid}
                value={this.state.value}
                valueValid={this.state.valueValid}
                onKeyPress={this.handleKeyPress}
                onFocus={this.handleFocus}
                onOk={this.handleOk}
                onCancel={this.handleCancel}
                onChange={this.handleChange}
                onReset={this.handleReset}
            />
        )
    }

};

aeFeaturesModal.propTypes = {
    onClose: PropTypes.func,
    onSetUsername: PropTypes.func,
    username: PropTypes.string,
    usernameInvalid: PropTypes.bool
};

const mapDispatchToProps = dispatch => ({
    onClose: () => {
        dispatch(closeAeFeaturesModal());
        localStorage.setItem('ae:firstEnter', true);
        localStorage.setItem('ae:webBuild', version.webBuild)
    },
    onSetUsername: username => {
        dispatch(setUsername(username));
        dispatch(setUsernameInvalid(false));
    }
});
const mapStateToProps = state => ({
    username: state.scratchGui.tw.username,
    usernameInvalid: state.scratchGui.tw.usernameInvalid
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(aeFeaturesModal);