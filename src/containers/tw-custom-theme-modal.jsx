import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {setTheme} from '../reducers/theme.js';
import {persistTheme} from '../lib/themes/themePersistance.js';
import {closeCustomThemeModal} from '../reducers/modals.js';
import {updateCustomColors, getCustomColors, Theme, ACCENT_CUSTOM} from '../lib/themes/index.js';
import CustomThemePicker from '../components/tw-custom-theme-picker/custom-theme-picker.jsx';

const CustomThemeModal = ({
    isOpen,
    currentTheme,
    setTheme,
    persistTheme,
    updateCustomColors,
    closeCustomThemeModal
}) => {
    if (!isOpen) return null;

    const handleApply = (colors) => {
        // Save custom colors to localStorage for persistence first
        try {
            localStorage.setItem('tw:custom-theme-colors', JSON.stringify(colors));
        } catch (e) {
            // ignore errors
        }
        
        // Update custom colors in the theme system
        updateCustomColors(colors);
        
        // Force re-render by creating a new theme with custom accent
        const newTheme = currentTheme.set('accent', ACCENT_CUSTOM);
        
        // Apply and persist the new theme
        setTheme(newTheme);
        persistTheme(newTheme);
        
        // Force theme re-application by triggering a manual update
        setTimeout(() => {
            // Re-apply the theme to ensure colors are updated
            setTheme(newTheme);
            
            // Close modal after applying theme
            closeCustomThemeModal();
        }, 100);
    };

    const handleCancel = () => {
        // Restore previous custom colors if they exist
        try {
            const savedColors = localStorage.getItem('tw:custom-theme-colors');
            if (savedColors) {
                const colors = JSON.parse(savedColors);
                updateCustomColors(colors);
            }
        } catch (e) {
            // ignore errors
        }
        
        closeCustomThemeModal();
    };

    const handlePreview = (colors) => {
        // Update custom colors for preview
        updateCustomColors(colors);
        
        // Create a new theme with custom accent for preview
        const previewTheme = currentTheme.set('accent', ACCENT_CUSTOM);
        
        // Apply the preview theme (without persisting)
        setTheme(previewTheme);
    };

    // Get current custom colors or defaults
    const getCurrentColors = () => {
        try {
            const savedColors = localStorage.getItem('tw:custom-theme-colors');
            if (savedColors) {
                return JSON.parse(savedColors);
            }
        } catch (e) {
            // ignore errors
        }
        
        return getCustomColors();
    };

    return (
        <CustomThemePicker
            onRequestClose={closeCustomThemeModal}
            onApply={handleApply}
            onCancel={handleCancel}
            onPreview={handlePreview}
            currentThemeColors={getCurrentColors()}
        />
    );
};

const mapStateToProps = state => ({
    isOpen: state.scratchGui.modals.customTheme,
    currentTheme: state.scratchGui.theme.theme
});

const mapDispatchToProps = dispatch => ({
    setTheme: theme => dispatch(setTheme(theme)),
    persistTheme: theme => persistTheme(theme),
    updateCustomColors: colors => updateCustomColors(colors),
    closeCustomThemeModal: () => dispatch(closeCustomThemeModal())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CustomThemeModal);