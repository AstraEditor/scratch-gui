import {defineMessages, FormattedMessage, intlShape, injectIntl} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import bindAll from 'lodash.bindall';
import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import Input from '../forms/input.jsx';
import styles from './custom-theme-picker.css';

const BufferedInput = BufferedInputHOC(Input);

const messages = defineMessages({
    title: {
        defaultMessage: 'Custom Theme',
        description: 'Title of custom theme picker modal',
        id: 'tw.customThemePicker.title'
    },
    primaryColor: {
        defaultMessage: 'Background Color (Top Bar, Window Background)',
        description: 'Label for primary color picker',
        id: 'tw.customThemePicker.primaryColor'
    },
    secondaryColor: {
        defaultMessage: 'Accent Color (Highlight, Interface Background)',
        description: 'Label for secondary color picker',
        id: 'tw.customThemePicker.secondaryColor'
    },
    tertiaryColor: {
        defaultMessage: 'Tertiary Color',
        description: 'Label for tertiary color picker',
        id: 'tw.customThemePicker.tertiaryColor'
    },
    apply: {
        defaultMessage: 'Apply',
        description: 'Button to apply custom theme',
        id: 'tw.customThemePicker.apply'
    },
    cancel: {
        defaultMessage: 'Cancel',
        description: 'Button to cancel custom theme',
        id: 'tw.customThemePicker.cancel'
    },
    reset: {
        defaultMessage: 'Reset to Default',
        description: 'Button to reset colors to default',
        id: 'tw.customThemePicker.reset'
    },
    help: {
        defaultMessage: 'Choose custom colors for your theme. These colors will be used for the interface elements.',
        description: 'Help text for custom theme picker',
        id: 'tw.customThemePicker.help'
    }
});

class UnwrappedCustomThemePicker extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handlePrimaryColorChange',
            'handleSecondaryColorChange', 
            'handleTertiaryColorChange',
            'handleApply',
            'handleCancel',
            'handleReset',
            'handlePreview',
            'handlePreviewDebounced'
        ]);
        
        this.state = {
            primaryColor: props.currentThemeColors.primary || '#ff4c4c',
            secondaryColor: props.currentThemeColors.secondary || '#ff4c4c',
            tertiaryColor: props.currentThemeColors.tertiary || props.currentThemeColors.tertiaryColor || '#cc3333'
        };
        
        // Debounce timer for preview updates
        this.previewTimer = null;
    }
    
    componentWillUnmount () {
        // Clear timer on unmount
        if (this.previewTimer) {
            clearTimeout(this.previewTimer);
        }
    }

    handlePrimaryColorChange (value) {
        this.setState({primaryColor: value});
        this.handlePreviewDebounced();
    }

    handleSecondaryColorChange (value) {
        this.setState({secondaryColor: value});
        this.handlePreviewDebounced();
    }

    handleTertiaryColorChange (value) {
        this.setState({tertiaryColor: value || '#cc3333'});
        this.handlePreviewDebounced();
    }

    handlePreviewDebounced () {
        // Clear existing timer
        if (this.previewTimer) {
            clearTimeout(this.previewTimer);
        }
        
        // Set new timer for preview update
        this.previewTimer = setTimeout(() => {
            this.handlePreview();
        }, 300); // 300ms delay
    }

    handlePreview () {
        if (!this.state.previewActive) {
            this.setState({previewActive: true});
        }
        
        // Preview the theme colors
        const previewColors = {
            primary: this.state.primaryColor,
            secondary: this.state.secondaryColor,
            tertiary: this.state.tertiaryColor || '#cc3333'
        };
        
        if (this.props.onPreview) {
            this.props.onPreview(previewColors);
        }
    }

    handleApply () {
        const customColors = {
            primary: this.state.primaryColor,
            secondary: this.state.secondaryColor,
            tertiary: this.state.tertiaryColor || '#cc3333'
        };
        
        console.log('Applying custom colors:', customColors);
        
        if (this.props.onApply) {
            this.props.onApply(customColors);
        }
        
        this.props.onRequestClose();
    }

    handleCancel () {
        // Reset to original colors
        if (this.props.onCancel) {
            this.props.onCancel();
        }
        
        this.props.onRequestClose();
    }

    handleReset () {
        const defaultColors = {
            primary: '#0a0a0a',
            secondary: '#ff4c4c',
            tertiary: '#cc3333'
        };
        
        this.setState({
            primaryColor: defaultColors.primary,
            secondaryColor: defaultColors.secondary,
            tertiaryColor: defaultColors.tertiary
        });
        
        this.handlePreview();
    }

    render () {
        return (
            <Modal
                className={styles.modalContent}
                onRequestClose={this.handleCancel}
                contentLabel={this.props.intl.formatMessage(messages.title)}
                id="customThemePicker"
            >
                <Box className={styles.body}>
                    <div className={styles.header}>
                        <FormattedMessage {...messages.title} />
                    </div>
                    
                    <div className={styles.helpText}>
                        <FormattedMessage {...messages.help} />
                    </div>

                    <div className={styles.colorPickers}>
                        <div className={styles.colorPicker}>
                            <label className={styles.colorLabel}>
                                <FormattedMessage {...messages.primaryColor} />
                            </label>
                            <div className={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={this.state.primaryColor}
                                    onChange={e => this.handlePrimaryColorChange(e.target.value)}
                                    className={styles.colorInput}
                                />
                                <BufferedInput
                                    value={this.state.primaryColor}
                                    onSubmit={this.handlePrimaryColorChange}
                                    className={styles.colorTextInput}
                                    placeholder="#ff4c4c"
                                />
                            </div>
                        </div>

                        <div className={styles.colorPicker}>
                            <label className={styles.colorLabel}>
                                <FormattedMessage {...messages.secondaryColor} />
                            </label>
                            <div className={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={this.state.secondaryColor}
                                    onChange={e => this.handleSecondaryColorChange(e.target.value)}
                                    className={styles.colorInput}
                                />
                                <BufferedInput
                                    value={this.state.secondaryColor}
                                    onSubmit={this.handleSecondaryColorChange}
                                    className={styles.colorTextInput}
                                    placeholder="#ff4c4c"
                                />
                            </div>
                        </div>

                        <div className={styles.colorPicker}>
                            <label className={styles.colorLabel}>
                                <FormattedMessage {...messages.tertiaryColor} />
                            </label>
                            <div className={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={this.state.tertiaryColor}
                                    onChange={e => this.handleTertiaryColorChange(e.target.value)}
                                    className={styles.colorInput}
                                />
                                <BufferedInput
                                    value={this.state.tertiaryColor}
                                    onSubmit={this.handleTertiaryColorChange}
                                    className={styles.colorTextInput}
                                    placeholder="#cc3333"
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.previewSection}>
                        <div className={styles.previewLabel}>
                            <FormattedMessage
                                defaultMessage="Preview"
                                description="Label for color preview section"
                                id="tw.customThemePicker.preview"
                            />
                        </div>
                        <div className={styles.previewColors}>
                            <div 
                                className={styles.previewColor}
                                style={{backgroundColor: this.state.primaryColor}}
                                title={this.state.primaryColor}
                            />
                            <div 
                                className={styles.previewColor}
                                style={{backgroundColor: this.state.secondaryColor}}
                                title={this.state.secondaryColor}
                            />
                            <div 
                                className={styles.previewColor}
                                style={{backgroundColor: this.state.tertiaryColor}}
                                title={this.state.tertiaryColor}
                            />
                        </div>
                    </div>

                    <div className={styles.buttons}>
                        <button
                            className={classNames(styles.button, styles.resetButton)}
                            onClick={this.handleReset}
                        >
                            <FormattedMessage {...messages.reset} />
                        </button>
                        <div className={styles.spacer} />
                        <button
                            className={classNames(styles.button, styles.cancelButton)}
                            onClick={this.handleCancel}
                        >
                            <FormattedMessage {...messages.cancel} />
                        </button>
                        <button
                            className={classNames(styles.button, styles.applyButton)}
                            onClick={this.handleApply}
                        >
                            <FormattedMessage {...messages.apply} />
                        </button>
                    </div>
                </Box>
            </Modal>
        );
    }
}

UnwrappedCustomThemePicker.propTypes = {
    intl: intlShape,
    onRequestClose: PropTypes.func.isRequired,
    onApply: PropTypes.func,
    onCancel: PropTypes.func,
    onPreview: PropTypes.func,
    currentThemeColors: PropTypes.shape({
        primary: PropTypes.string,
        secondary: PropTypes.string,
        tertiary: PropTypes.string
    })
};

UnwrappedCustomThemePicker.defaultProps = {
    currentThemeColors: {
        primary: '#ff4c4c',
        secondary: '#ff4c4c',
        tertiary: '#cc3333'
    }
};

export default injectIntl(UnwrappedCustomThemePicker);