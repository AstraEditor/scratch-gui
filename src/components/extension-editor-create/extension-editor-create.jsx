import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {connect} from 'react-redux';
import {closeExtensionEditorCreate} from '../../reducers/modals';
import Modal from '../modal/modal.jsx';
import Box from '../box/box.jsx';
import {ExtensionEditorCreateContent} from 'scratch-extension-editor';

const messages = defineMessages({
    title: {
        defaultMessage: 'Create New Extension',
        description: 'Title of the create extension modal',
        id: 'tw.extensionEditorCreate.title'
    },
    nameError: {
        defaultMessage: 'Please enter a name',
        description: 'Error message when name is empty',
        id: 'tw.extensionEditorCreate.nameError'
    },
    idError: {
        defaultMessage: 'Please enter a valid ID (lowercase letters, numbers, and underscores only)',
        description: 'Error message when ID is invalid',
        id: 'tw.extensionEditorCreate.idError'
    }
});

class ExtensionEditorCreate extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: '',
            id: '',
            color1: '#FF6680',
            color2: '#FF4D6A',
            color3: '#CC3D55',
            errors: {
                name: '',
                id: ''
            }
        };
    }

    handleNameChange = (name, newId) => {
        this.setState({ 
            name, 
            id: newId, 
            errors: { ...this.state.errors, name: '', id: '' } 
        });
    };

    handleIdChange = (id) => {
        this.setState({ id, errors: { ...this.state.errors, id: '' } });
    };

    handleColorChange = (colorKey, color) => {
        this.setState({ [colorKey]: color });
    };

    validate = () => {
        const errors = {
            name: '',
            id: ''
        };

        if (!this.state.name.trim()) {
            errors.name = this.props.intl.formatMessage(messages.nameError);
        }

        if (!this.state.id.trim()) {
            errors.id = this.props.intl.formatMessage(messages.idError);
        } else if (!/^[a-z0-9_]+$/.test(this.state.id)) {
            errors.id = this.props.intl.formatMessage(messages.idError);
        }

        this.setState({ errors });

        return !errors.name && !errors.id;
    };

    handleCreate = () => {
        if (this.validate()) {
            this.props.onCreate({
                name: this.state.name,
                id: this.state.id,
                colors: {
                    color1: this.state.color1,
                    color2: this.state.color2,
                    color3: this.state.color3
                }
            });
            this.props.onClose();
        }
    };

    handleCancel = () => {
        this.props.onClose();
    };

    render() {
        return (
            <Modal
                contentLabel={this.props.intl.formatMessage(messages.title)}
                onRequestClose={this.props.onClose}
            >
                <Box>
                    <ExtensionEditorCreateContent
                        name={this.state.name}
                        id={this.state.id}
                        colors={{
                            color1: this.state.color1,
                            color2: this.state.color2,
                            color3: this.state.color3
                        }}
                        errors={this.state.errors}
                        onNameChange={this.handleNameChange}
                        onIdChange={this.handleIdChange}
                        onColorChange={this.handleColorChange}
                        onCreate={this.handleCreate}
                        onCancel={this.handleCancel}
                    />
                </Box>
            </Modal>
        );
    }
}

ExtensionEditorCreate.propTypes = {
    intl: intlShape,
    onClose: PropTypes.func,
    onCreate: PropTypes.func
};

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeExtensionEditorCreate())
});

export default injectIntl(connect(
    null,
    mapDispatchToProps
)(ExtensionEditorCreate));