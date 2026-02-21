import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage, injectIntl, intlShape } from 'react-intl';
import { connect } from 'react-redux';
import { addTab, removeTab, activateTab, updateTabCode, setTabSaved } from '../../reducers/extension-editor-tabs';
import ExtensionEditor, { extensionEditorStorage, ExtensionEditorStorageContent, ExtensionEditorWizardPanel, BlockPreview } from 'scratch-extension-editor';
import VMScratchBlocks from '../../lib/blocks';
import { manuallyTrustExtension } from '../../containers/tw-security-manager.jsx';
import styles from './extension-editor-tabs.css';

import settingICON from '!../../lib/tw-recolor/build!./icon--settings.svg'

const messages = defineMessages({
    newTab: {
        defaultMessage: 'New Tab',
        description: 'Button to create a new tab',
        id: 'tw.extensionEditorTabs.newTab'
    },
    settings: {
        defaultMessage: 'Settings',
        description: 'Button to open settings',
        id: 'tw.extensionEditorTabs.settings'
    },
    welcomeTitle: {
        defaultMessage: 'Extension Editor',
        description: 'Title of the welcome screen',
        id: 'tw.extensionEditorTabs.welcomeTitle'
    },
    createNewExtension: {
        defaultMessage: 'Create New Extension',
        description: 'Button to create a new extension',
        id: 'tw.extensionEditorTabs.createNewExtension'
    },
    loadExistingExtension: {
        defaultMessage: 'Load Existing Extension',
        description: 'Button to load an existing extension',
        id: 'tw.extensionEditorTabs.loadExistingExtension'
    },
    noExtensionsFound: {
        defaultMessage: 'No saved extensions found',
        description: 'Message when no extensions are saved',
        id: 'tw.extensionEditorTabs.noExtensionsFound'
    },
    nameLabel: {
        defaultMessage: 'Extension Name',
        description: 'Label for extension name input',
        id: 'tw.extensionEditorTabs.nameLabel'
    },
    namePlaceholder: {
        defaultMessage: 'My Extension',
        description: 'Placeholder for extension name input',
        id: 'tw.extensionEditorTabs.namePlaceholder'
    },
    idLabel: {
        defaultMessage: 'Extension ID',
        description: 'Label for extension ID input',
        id: 'tw.extensionEditorTabs.idLabel'
    },
    idPlaceholder: {
        defaultMessage: 'myextension',
        description: 'Placeholder for extension ID input',
        id: 'tw.extensionEditorTabs.idPlaceholder'
    },
    idHint: {
        defaultMessage: 'Must be lowercase, no spaces, only letters, numbers, and underscores',
        description: 'Hint for extension ID input',
        id: 'tw.extensionEditorTabs.idHint'
    },
    colorLabel: {
        defaultMessage: 'Extension Color',
        description: 'Label for extension color picker',
        id: 'tw.extensionEditorTabs.colorLabel'
    },
    color1Label: {
        defaultMessage: 'Primary',
        description: 'Label for primary color',
        id: 'tw.extensionEditorTabs.color1Label'
    },
    color2Label: {
        defaultMessage: 'Secondary',
        description: 'Label for secondary color',
        id: 'tw.extensionEditorTabs.color2Label'
    },
    color3Label: {
        defaultMessage: 'Tertiary',
        description: 'Label for tertiary color',
        id: 'tw.extensionEditorTabs.color3Label'
    },
    closeButton: {
        defaultMessage: 'Close',
        description: 'Button to close the create form',
        id: 'tw.extensionEditorTabs.closeButton'
    },
    nextButton: {
        defaultMessage: 'Next',
        description: 'Button to go to next step',
        id: 'tw.extensionEditorTabs.nextButton'
    },
    backButton: {
        defaultMessage: 'Back',
        description: 'Button to go to previous step',
        id: 'tw.extensionEditorTabs.backButton'
    },
    createButton: {
        defaultMessage: 'Create',
        description: 'Button to create the extension',
        id: 'tw.extensionEditorTabs.createButton'
    },
    nameError: {
        defaultMessage: 'Please enter a name',
        description: 'Error message when name is empty',
        id: 'tw.extensionEditorTabs.nameError'
    },
    nameErrorInvalidClassName: {
        defaultMessage: 'Name must be a valid JavaScript class name (letters, numbers, underscores, dollar signs, not a reserved word)',
        description: 'Error message when name is not a valid JavaScript class name',
        id: 'tw.extensionEditorTabs.nameErrorInvalidClassName'
    },
    idError: {
        defaultMessage: 'Please enter a valid ID (lowercase letters, numbers, and underscores only)',
        description: 'Error message when ID is invalid',
        id: 'tw.extensionEditorTabs.idError'
    },
    nowName: {
        defaultMessage: 'Extension Name: ',
        description: 'message about extension name on id input',
        id: 'tw.extensionEditorTabs.nowname'
    },
    export: {
        defaultMessage: 'Export',
        description: 'Button to export extension as file',
        id: 'tw.extensionEditorTabs.export'
    },
    runExtension: {
        defaultMessage: 'Run Extension',
        description: 'Button to run the current extension in the VM',
        id: 'tw.extensionEditorTabs.runExtension'
    },
    loadExtension: {
        defaultMessage: 'Load Extension',
        description: 'Load extension button',
        id: 'tw.extensionEditorTabs.loadExtension'
    },
    importExtension: {
        defaultMessage: 'Import extension from file',
        description: 'Import extension from file',
        id: 'tw.extensionEditorTabs.importExtension'
    },
    manageStorage: {
        defaultMessage: 'Manage Storage',
        description: 'Manage IndexedDB storage',
        id: 'tw.extensionEditorTabs.manageStorage'
    },
    storedExtensions: {
        defaultMessage: 'Stored Extensions',
        description: 'Stored extensions title',
        id: 'tw.extensionEditorTabs.storedExtensions'
    },
    deleteExtension: {
        defaultMessage: 'Delete',
        description: 'Delete extension button',
        id: 'tw.extensionEditorTabs.deleteExtension'
    },
    clearAll: {
        defaultMessage: 'Clear All',
        description: 'Clear all stored extensions',
        id: 'tw.extensionEditorTabs.clearAll'
    },
    noStoredExtensions: {
        defaultMessage: 'No stored extensions',
        description: 'No stored extensions message',
        id: 'tw.extensionEditorTabs.noStoredExtensions'
    },
    lastModified: {
        defaultMessage: 'Last modified: ',
        description: 'Last modified label',
        id: 'tw.extensionEditorTabs.lastModified'
    },
    back: {
        defaultMessage: 'Back',
        description: 'Back button',
        id: 'tw.extensionEditorTabs.back'
    },
    wizardTitle: {
        defaultMessage: 'Wizard',
        description: 'Wizard title',
        id: 'tw.extensionEditorTabs.wizardTitle'
    }
});

const CODE_STATE_DEBOUNCE_MS = 120;
const AUTO_SAVE_DEBOUNCE_MS = 900;
const AUTO_RUN_DEBOUNCE_MS = 180;

class ExtensionEditorTabs extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showCreateForm: false,
            currentStep: 0,
            createForm: {
                name: '',
                id: '',
                color1: '#FF6680',
                color2: '#FF4D6A',
                color3: '#CC3D55'
            },
            errors: {
                name: '',
                id: ''
            },
            savedExtensions: [],
            isLoadingExtension: false,
            loadError: null,
            loadedExtensionIds: {}, // 记录每个标签卡已加载的扩展ID {tabId: extensionId}
            previewRevisionByTab: {}, // 每次成功加载扩展后递增，用于驱动预览刷新
            showStorageManager: false, // 显示存储管理器
            blocksPanelMode: 'preview' // blocksPanel 显示模式: 'preview' (积木预览) 或 'wizard' (向导)
        };
        this.latestCodeByTab = {};
        this.lastDispatchedCodeByTab = {};
        this.codeUpdateTimers = {};
        this.autoSaveTimers = {};
        this.cachedScratchBlocksVm = null;
        this.cachedScratchBlocks = null;
        this.isRunningExtension = false;
        this.pendingRunRequest = null;
        this.runRequestSequence = 0;
        this.latestRequestedRunByTab = {};
        this.workspaceRefreshTimeout = null;
        this.autoRunDebounce = null;
        this.fileInputRef = React.createRef();
    }
    componentDidMount() {
        this.loadSavedExtensions();
    }
    componentDidUpdate(prevProps, prevState) {
        // When switching to extension editor tab
        if (prevProps.activeTabIndex !== this.props.activeTabIndex && this.props.activeTabIndex === 3) {
            // BlockPreview component will handle this automatically
        }
    }
    componentWillUnmount() {
        if (this.flyoutUpdateTimeout) {
            clearTimeout(this.flyoutUpdateTimeout);
        }
        this.clearTimeoutMap(this.codeUpdateTimers);
        this.clearTimeoutMap(this.autoSaveTimers);
        if (this.workspaceRefreshTimeout) clearTimeout(this.workspaceRefreshTimeout);
        if (this.autoRunDebounce) clearTimeout(this.autoRunDebounce);
    }
    clearTimeoutMap(map) {
        for (const key of Object.keys(map)) {
            clearTimeout(map[key]);
            delete map[key];
        }
    }
    clearTimer(map, key) {
        if (map[key]) {
            clearTimeout(map[key]);
            delete map[key];
        }
    }
    scheduleWorkspaceRefresh() {
        if (this.workspaceRefreshTimeout) clearTimeout(this.workspaceRefreshTimeout);
        this.workspaceRefreshTimeout = setTimeout(() => {
            this.workspaceRefreshTimeout = null;
            if (this.props.vm) {
                this.props.vm.refreshWorkspace();
                this.props.vm.emitWorkspaceUpdate();
            }
        }, 60);
    }
    async loadSavedExtensions() {
        const defaultCreateFormState = {
            showCreateForm: true,
            currentStep: 0,
            createForm: {
                name: '',
                id: '',
                color1: '#FF6680',
                color2: '#FF4D6A',
                color3: '#CC3D55'
            },
            errors: { name: '', id: '' }
        };
        try {
            const extensions = await extensionEditorStorage.getAllExtensions();
            this.setState({
                ...defaultCreateFormState,
                savedExtensions: extensions
            });
        } catch (error) {
            console.error('Failed to load saved extensions:', error);
            this.setState(defaultCreateFormState);
        }
    }
    createNewTab = () => {
        this.setState({
            showCreateForm: true,
            currentStep: 0,
            createForm: {
                name: '',
                id: '',
                color1: '#FF6680',
                color2: '#FF4D6A',
                color3: '#CC3D55'
            },
            errors: { name: '', id: '' }
        });
    };
    handleNextStep = () => {
        if (this.validateCurrentStep()) {
            this.setState({ currentStep: this.state.currentStep + 1 });
        }
    };
    handlePrevStep = () => {
        if (this.state.currentStep > 0) {
            this.setState({ currentStep: this.state.currentStep - 1 });
        }
    };
    isValidClassName(name) { // 复制的
        if (!/^[A-Z_a-z$][\w$]*$/.test(name)) {
            return false;
        }
        const reservedWords = [
            'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch',
            'char', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
            'double', 'else', 'enum', 'eval', 'export', 'extends', 'false', 'final',
            'finally', 'float', 'for', 'function', 'goto', 'if', 'implements', 'import',
            'in', 'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new',
            'null', 'package', 'private', 'protected', 'public', 'return', 'short',
            'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
            'transient', 'true', 'try', 'typeof', 'var', 'void', 'volatile', 'while',
            'with', 'yield'
        ];
        if (reservedWords.includes(name)) {
            return false;
        }
        const futureReservedWords = [
            'enum', 'implements', 'interface', 'let', 'package', 'private',
            'protected', 'public', 'static', 'yield'
        ];
        if (futureReservedWords.includes(name)) {
            return false;
        }
        return true;
    }
    validateCurrentStep = () => {
        if (this.state.currentStep === 1) {
            // Step 2: Name
            if (!this.state.createForm.name.trim()) {
                this.setState({ errors: { name: this.props.intl.formatMessage(messages.nameError), id: '' } });
                return false;
            } else if (!this.isValidClassName(this.state.createForm.name)) {
                this.setState({ errors: { name: this.props.intl.formatMessage(messages.nameErrorInvalidClassName), id: '' } });
                return false;
            }
        } else if (this.state.currentStep === 2) {
            // Step 3: ID
            if (!this.state.createForm.id.trim()) {
                this.setState({ errors: { name: '', id: this.props.intl.formatMessage(messages.idError) } });
                return false;
            } else if (!/^[a-z0-9_]+$/.test(this.state.createForm.id)) {
                this.setState({ errors: { name: '', id: this.props.intl.formatMessage(messages.idError) } });
                return false;
            }
        }
        return true;
    };
    handleCreateFormChange = (field, value) => {
        if (field === 'name') {
            // Auto-generate ID from name when name changes
            const autoGeneratedId = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            this.setState({
                createForm: { ...this.state.createForm, name: value, id: autoGeneratedId },
                errors: { ...this.state.errors, name: '', id: '' }
            });
        } else if (field === 'id') {
            this.setState({
                createForm: { ...this.state.createForm, [field]: value },
                errors: { ...this.state.errors, [field]: '' }
            });
        } else {
            this.setState({ createForm: { ...this.state.createForm, [field]: value } });
        }
    };
    handleCreateExtension = () => {
        if (this.validateCurrentStep()) {
            const id = extensionEditorStorage.generateId();
            const code = this.generateExtensionCode({
                name: this.state.createForm.name,
                id: this.state.createForm.id,
                color1: this.state.createForm.color1,
                color2: this.generateSecondaryColor(this.state.createForm.color1),
                color3: this.generateTertiaryColor(this.state.createForm.color1)
            });
            this.props.addTab({
                id: id,
                name: this.state.createForm.name,
                code: code,
                isSaved: false
            });
            this.setState({
                showCreateForm: false,
                currentStep: 0,
                createForm: {
                    name: '',
                    id: '',
                    color1: '#FF6680',
                    color2: '#FF4D6A',
                    color3: '#CC3D55'
                },
                errors: { name: '', id: '' }
            });
        }
    };
    generateSecondaryColor(hex) {
        // Generate a darker shade of the primary color
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `#${Math.max(0, r - 30).toString(16).padStart(2, '0')}${Math.max(0, g - 30).toString(16).padStart(2, '0')}${Math.max(0, b - 30).toString(16).padStart(2, '0')}`;
    }
    generateTertiaryColor(hex) {
        // Generate an even darker shade of the primary color
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `#${Math.max(0, r - 60).toString(16).padStart(2, '0')}${Math.max(0, g - 60).toString(16).padStart(2, '0')}${Math.max(0, b - 60).toString(16).padStart(2, '0')}`;
    }
    handleCancelCreate = () => {
        this.setState({
            showCreateForm: false,
            currentStep: 0,
            createForm: {
                name: '',
                id: '',
                color1: '#FF6680',
                color2: '#FF4D6A',
                color3: '#CC3D55'
            },
            errors: { name: '', id: '' }
        });
    };
    handleLoadExtension = () => {
        if (this.fileInputRef.current) {
            this.fileInputRef.current.click();
        }
    };
    handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const content = await file.text();
            const idMatch = content.match(/id:\s*['"]([^'"]+)['"]/);
            const nameMatch = content.match(/Name:\s*([^\n]+)/);
            const extensionId = idMatch ? idMatch[1] : `ext_${Date.now()}`;
            const extensionName = nameMatch ? nameMatch[1].trim() : file.name.replace('.js', '');
            this.props.addTab({
                id: extensionId,
                name: extensionName,
                code: content,
                isSaved: true
            });
            this.props.activateTab(extensionId);
            this.setState({ showCreateForm: false });
        } catch (error) {
            console.error('Failed to load extension file:', error);
            alert(this.props.intl.formatMessage(messages.loadFailed) || 'Failed to load extension file');
        }
        event.target.value = '';
    };
    handleOpenStorageManager = async () => {
        try {
            const extensions = await extensionEditorStorage.getAllExtensions();
            this.setState({
                showStorageManager: true,
                showCreateForm: false,
                currentStep: 0,
                savedExtensions: extensions
            });
        } catch (error) {
            console.error('Failed to load saved extensions:', error);
        }
    };
    handleCloseStorageManager = () => {
        this.setState({ showStorageManager: false });
    };
    handleLoadFromStorage = async (extension) => {
        try {
            console.log('Loading extension from storage:', extension);
            if (!extension || !extension.id || !extension.name || !extension.code) {
                console.error('Invalid extension object:', extension);
                alert('Invalid extension data');
                return;
            }
            let newExtensionId = extension.id;
            let existingTab = this.props.tabs.find(tab => tab.id === newExtensionId);
            let counter = 1;
            while (existingTab) {
                newExtensionId = `${extension.id}_${counter}`;
                existingTab = this.props.tabs.find(tab => tab.id === newExtensionId);
                counter++;
            }
            let finalCode = extension.code;
            if (newExtensionId !== extension.id) {
                finalCode = finalCode.replace(
                    /id:\s*['"]([^'"]+)['"]/,
                    `id: '${newExtensionId}'`
                );
                console.log('Updated extension ID in code from', extension.id, 'to', newExtensionId);
            }
            this.props.addTab({
                id: newExtensionId,
                name: extension.name,
                code: finalCode,
                isSaved: true
            });
            this.props.activateTab(newExtensionId);
            this.setState({ showStorageManager: false });
            console.log('Extension loaded successfully with ID:', newExtensionId);
        } catch (error) {
            console.error('Failed to load extension from storage:', error);
            alert('Failed to load extension: ' + error.message);
        }
    };
    handleDeleteFromStorage = async (extensionId) => {
        try {
            await extensionEditorStorage.deleteExtension(extensionId);
            const extensions = await extensionEditorStorage.getAllExtensions();
            this.setState({ savedExtensions: extensions });
        } catch (error) {
            console.error('Failed to delete extension:', error);
        }
    };
    handleClearAllStorage = async () => {
        if (!confirm(this.props.intl.formatMessage(messages.clearAll) + '?')) {
            return;
        }
        try {
            if (typeof extensionEditorStorage.clearAllExtensions === 'function') {
                await extensionEditorStorage.clearAllExtensions();
            } else {
                for (const extension of this.state.savedExtensions) {
                    await extensionEditorStorage.deleteExtension(extension.id);
                }
            }
            this.setState({ savedExtensions: [] });
        } catch (error) {
            console.error('Failed to clear storage:', error);
        }
    };
    handleToggleWizardPanel = () => {
        this.setState(prevState => ({
            blocksPanelMode: prevState.blocksPanelMode === 'wizard' ? 'preview' : 'wizard'
        }));
    };
    renderWizardPanel = () => {
        return <ExtensionEditorWizardPanel intl={this.props.intl} />;
    };
    generateExtensionCode = (config) => {
        const { name, id, color1, color2, color3 } = config;
        return `// Name: ${name}
// Description: A Extensions named ${name}
// ID: ${id}
// By: You Name <Personal Web>
// License: MPL-2.0

(function (Scratch) {
    "use strict";
    class ${this.toClassName(id)} {
        constructor(runtime) {
            this.runtime = runtime;
        }
        getInfo() {
            return {
                id: '${id}',
                name: '${name}',
                color1: '${color1}',
                color2: '${color2}',
                color3: '${color3}',
                blocks: [
                    {
                    opcode: 'hello',
                    blockType: 'command',
                    text: 'Hello [MESSAGE]',
                    arguments: {
                        MESSAGE: {
                        type: 'string',
                        defaultValue: 'World'
                        }
                    }
                    },
                    {
                    opcode: 'getRandomNumber',
                    blockType: 'reporter',
                    text: 'Random [MIN] to [MAX]',
                    arguments: {
                        MIN: {
                        type: 'number',
                        defaultValue: 1
                        },
                        MAX: {
                        type: 'number',
                        defaultValue: 100
                        }
                    }
                    }
                ]
            };
        }
        hello(args) {
            console.log('Hello, ' + args.MESSAGE);
        }
        getRandomNumber(args) {
            const min = args.MIN;
            const max = args.MAX;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
    Scratch.extensions.register(new ${this.toClassName(id)}());
})(Scratch);
`;
    };
    toClassName(id) {
        // Convert ID to class name (e.g., 'my_extension' -> 'MyExtension')
        return id
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
    getTabCode(tabId) {
        if (!tabId) return '';
        if (Object.prototype.hasOwnProperty.call(this.latestCodeByTab, tabId)) {
            return this.latestCodeByTab[tabId];
        }
        const tab = this.props.tabs.find(t => t.id === tabId);
        return tab ? tab.code : '';
    }
    scheduleCodeUpdate(tabId, code) {
        this.clearTimer(this.codeUpdateTimers, tabId);
        this.codeUpdateTimers[tabId] = setTimeout(() => {
            this.codeUpdateTimers[tabId] = null;
            delete this.codeUpdateTimers[tabId];
            if (this.lastDispatchedCodeByTab[tabId] === code) return;
            this.lastDispatchedCodeByTab[tabId] = code;
            this.props.updateTabCode(tabId, code);
        }, CODE_STATE_DEBOUNCE_MS);
    }
    flushCodeUpdate(tabId) {
        if (!tabId) return;
        this.clearTimer(this.codeUpdateTimers, tabId);
        const code = this.getTabCode(tabId);
        if (this.lastDispatchedCodeByTab[tabId] === code) return;
        this.lastDispatchedCodeByTab[tabId] = code;
        this.props.updateTabCode(tabId, code);
    }
    scheduleAutoSave(tab, code) {
        const tabId = tab.id;
        this.clearTimer(this.autoSaveTimers, tabId);
        this.autoSaveTimers[tabId] = setTimeout(() => {
            this.autoSaveTimers[tabId] = null;
            delete this.autoSaveTimers[tabId];
            const latestCode = this.getTabCode(tabId);
            if (latestCode !== code) return;
            extensionEditorStorage.saveExtension({
                id: tab.id,
                name: tab.name,
                code: latestCode,
                createdAt: tab.createdAt,
                updatedAt: Date.now()
            }).then(() => {
                this.props.setTabSaved(tab.id, true);
            }).catch(error => {
                console.error('Failed to auto-save extension:', error);
            });
        }, AUTO_SAVE_DEBOUNCE_MS);
    }
    flushPendingForTab(tabId) {
        if (!tabId) return;
        this.flushCodeUpdate(tabId);
        this.clearTimer(this.autoSaveTimers, tabId);
    }
    clearTabCaches(tabId) {
        this.clearTimer(this.codeUpdateTimers, tabId);
        this.clearTimer(this.autoSaveTimers, tabId);
        delete this.latestCodeByTab[tabId];
        delete this.lastDispatchedCodeByTab[tabId];
        delete this.latestRequestedRunByTab[tabId];
    }
    queueRunExtension({tabId, code, showLoading}) {
        const requestId = ++this.runRequestSequence;
        this.latestRequestedRunByTab[tabId] = requestId;
        this.pendingRunRequest = {tabId, code, showLoading: Boolean(showLoading), requestId};
        if (!this.isRunningExtension) {
            this.processRunQueue();
        }
    }
    async processRunQueue() {
        while (this.pendingRunRequest) {
            const request = this.pendingRunRequest;
            this.pendingRunRequest = null;
            this.isRunningExtension = true;
            try {
                await this.runExtensionNow(request);
            } finally {
                this.isRunningExtension = false;
            }
        }
    }
    async runExtensionNow({tabId, code, showLoading, requestId}) {
        if (!tabId || !code || !this.props.vm || !this.props.vm.extensionManager) return;
        if (this.latestRequestedRunByTab[tabId] !== requestId) return;
        const tab = this.props.tabs.find(t => t.id === tabId);
        if (!tab) return;

        const idMatch = code.match(/id:\s*['"]([^'"]+)['"]/);
        const newExtensionId = idMatch ? idMatch[1] : `ext_${Date.now()}`;

        if (showLoading) {
            this.setState({ isLoadingExtension: true, loadError: null });
        }

        try {
            if (this.props.vm.runtime) {
                const oldExtensionId = this.state.loadedExtensionIds[tabId];
                if (oldExtensionId && this.props.vm.extensionManager.isExtensionLoaded(oldExtensionId)) {
                    this.props.vm.extensionManager.unloadExtension(oldExtensionId);
                }
                if (this.props.vm.extensionManager.isExtensionLoaded(newExtensionId)) {
                    this.props.vm.extensionManager.unloadExtension(newExtensionId);
                }

                const threads = [...this.props.vm.runtime.threads];
                for (const thread of threads) {
                    this.props.vm.runtime.stopThread(thread);
                }

                await new Promise(resolve => setTimeout(resolve, 40));
            }

            if (this.latestRequestedRunByTab[tabId] !== requestId) {
                return;
            }
            const wrappedCode = `
                    (function() {
                        ${code}
                    })();
                `;
            const dataUrl = `data:application/javascript,${encodeURIComponent(wrappedCode)}`;
            manuallyTrustExtension(dataUrl);
            await this.props.vm.extensionManager.loadExtensionURL(dataUrl);

            // 只提交最新一次请求的结果，避免高频编辑时旧结果覆盖新结果。
            if (this.latestRequestedRunByTab[tabId] !== requestId) {
                return;
            }
            // 标签已被关闭时跳过提交。
            if (!this.props.tabs.some(t => t.id === tabId)) {
                return;
            }

            this.scheduleWorkspaceRefresh();

            this.setState(prevState => ({
                loadedExtensionIds: {
                    ...prevState.loadedExtensionIds,
                    [tabId]: newExtensionId
                },
                previewRevisionByTab: {
                    ...prevState.previewRevisionByTab,
                    [tabId]: (prevState.previewRevisionByTab[tabId] || 0) + 1
                },
                isLoadingExtension: showLoading ? false : prevState.isLoadingExtension,
                loadError: null
            }));
        } catch (error) {
            console.error('Failed to load extension:', error);
            if (this.latestRequestedRunByTab[tabId] !== requestId) {
                return;
            }
            this.setState({
                isLoadingExtension: showLoading ? false : this.state.isLoadingExtension,
                loadError: error.message || '加载扩展失败'
            });
        }
    }
    handleTabClick = (tabId) => {
        if (tabId !== this.props.activeTabId) {
            this.flushPendingForTab(this.props.activeTabId);
            // 在切换标签卡之前，卸载当前标签卡的扩展
            this.unloadCurrentTabExtension();
            this.props.activateTab(tabId);
        }
    };
    unloadCurrentTabExtension = () => {
        const activeTab = this.getActiveTab();
        if (!activeTab) return;
        const extensionId = this.state.loadedExtensionIds[activeTab.id];
        if (!extensionId) return;
        if (this.props.vm && this.props.vm.extensionManager && this.props.vm.runtime) {
            if (this.props.vm.extensionManager.isExtensionLoaded(extensionId)) {
                console.log('Unloading extension when switching tab:', extensionId);
                // 停止所有线程，防止运行中的积木引用已卸载的扩展
                const threads = [...this.props.vm.runtime.threads];
                for (const thread of threads) {
                    this.props.vm.runtime.stopThread(thread);
                }
                // 卸载扩展，让VM自动处理内部状态的清理
                this.props.vm.extensionManager.unloadExtension(extensionId);
                // 触发主编辑器的workspace更新
                this.scheduleWorkspaceRefresh();
                console.log('Unloaded extension:', extensionId);
            }
        }
    };
    handleTabClose = (tabId, event) => {
        event.stopPropagation();
        this.flushPendingForTab(tabId);
        // 卸载该标签卡的扩展
        const extensionId = this.state.loadedExtensionIds[tabId];
        if (extensionId && this.props.vm && this.props.vm.extensionManager && this.props.vm.runtime) {
            if (this.props.vm.extensionManager.isExtensionLoaded(extensionId)) {
                console.log('Unloading extension when closing tab:', extensionId);
                // 停止所有线程，防止运行中的积木引用已卸载的扩展
                const threads = [...this.props.vm.runtime.threads];
                for (const thread of threads) {
                    this.props.vm.runtime.stopThread(thread);
                }
                // 卸载扩展，让VM自动处理内部状态的清理
                this.props.vm.extensionManager.unloadExtension(extensionId);
                // 触发主编辑器的workspace更新
                this.scheduleWorkspaceRefresh();
                console.log('Unloaded extension:', extensionId);
            }
        }
        // 从记录中删除
        const newLoadedIds = { ...this.state.loadedExtensionIds };
        delete newLoadedIds[tabId];
        this.clearTabCaches(tabId);
        this.setState({ loadedExtensionIds: newLoadedIds });
        this.props.removeTab(tabId);
    };
    handleCodeChange = (code) => {
        const activeTab = this.getActiveTab();
        if (!activeTab) return;

        const tabId = activeTab.id;
        this.latestCodeByTab[tabId] = code;
        if (activeTab.isSaved) {
            this.props.setTabSaved(tabId, false);
        }
        this.scheduleCodeUpdate(tabId, code);
        this.scheduleAutoSave(activeTab, code);
    };
    handleAutoRunRequest = (code) => {
        const activeTab = this.getActiveTab();
        if (!activeTab) return;
        const tabId = activeTab.id;
        const latestCode = typeof code === 'string' ? code : this.getTabCode(tabId);
        if (!latestCode) return;

        this.latestCodeByTab[tabId] = latestCode;
        if (this.isRunningExtension) {
            if (this.autoRunDebounce) {
                clearTimeout(this.autoRunDebounce);
                this.autoRunDebounce = null;
            }
            this.queueRunExtension({
                tabId,
                code: latestCode,
                showLoading: false
            });
            return;
        }
        if (this.autoRunDebounce) clearTimeout(this.autoRunDebounce);
        this.autoRunDebounce = setTimeout(() => {
            this.autoRunDebounce = null;
            const currentTab = this.getActiveTab();
            if (!currentTab || currentTab.id !== tabId) return;
            this.queueRunExtension({
                tabId,
                code: this.getTabCode(tabId),
                showLoading: false
            });
        }, AUTO_RUN_DEBOUNCE_MS);
    };
    handleExport = async () => {
        const activeTab = this.getActiveTab();
        if (!activeTab) return;
        const blob = new Blob([this.getTabCode(activeTab.id)], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTab.name}.js`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    handleRunExtension = async () => {
        const activeTab = this.getActiveTab();
        if (!activeTab) return;
        const code = this.getTabCode(activeTab.id);
        if (!code) return;
        this.queueRunExtension({
            tabId: activeTab.id,
            code,
            showLoading: true
        });
    };
    getActiveTab() {
        return this.props.tabs.find(tab => tab.id === this.props.activeTabId);
    }

    getScratchBlocks() {
        if (!this.props.vm) return null;
        if (this.cachedScratchBlocksVm === this.props.vm && this.cachedScratchBlocks) {
            return this.cachedScratchBlocks;
        }
        try {
            this.cachedScratchBlocksVm = this.props.vm;
            this.cachedScratchBlocks = VMScratchBlocks(this.props.vm, false);
            return this.cachedScratchBlocks;
        } catch (e) {
            this.cachedScratchBlocksVm = null;
            this.cachedScratchBlocks = null;
            return null;
        }
    }

    render() {
        const activeTab = this.getActiveTab();
        const code = activeTab ? this.getTabCode(activeTab.id) : '';
        const editorThemeMode = this.props.theme &&
            typeof this.props.theme.isDark === 'function' &&
            this.props.theme.isDark() ? 'dark' : 'light';
        return (
            <div className={styles.container}>
                <div className={styles.tabBar}>
                    <div className={styles.tabs}>
                        {this.props.tabs.map(tab => (
                            <div
                                key={tab.id}
                                className={`${styles.tab} ${tab.id === this.props.activeTabId ? styles.active : ''}`}
                                onClick={() => this.handleTabClick(tab.id)}
                            >
                                <span className={styles.tabName}>
                                    {tab.name}
                                    {!tab.isSaved && <span className={styles.unsavedIndicator}>●</span>}
                                </span>
                                <button
                                    className={styles.tabCloseButton}
                                    onClick={(e) => this.handleTabClose(tab.id, e)}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            className={styles.newTabButton}
                            onClick={this.createNewTab}
                            title={this.props.intl.formatMessage(messages.newTab)}
                        >
                            +
                        </button>
                    </div>
                    {activeTab && (
                        <div className={styles.toolbar}>
                            <button
                                className={styles.toolbarButton}
                                onClick={this.handleRunExtension}
                                title={this.props.intl.formatMessage(messages.runExtension)}
                            >
                                <FormattedMessage {...messages.runExtension} />
                            </button>
                            <button
                                className={styles.toolbarButton}
                                onClick={this.handleExport}
                                title={this.props.intl.formatMessage(messages.export)}
                            >
                                <FormattedMessage {...messages.export} />
                            </button>
                            <button
                                className={styles.toolbarButtonSetting}
                                onClick={this.props.onOpenExtensionEditorSettings}
                                title={this.props.intl.formatMessage(messages.settings)}
                            >
                                <img style={{
                                    filter: 'grayscale(100%)'
                                }}
                                src={settingICON()} draggable={false} />
                            </button>
                        </div>
                    )}
                </div>
                <div className={styles.editorContainer}>
                    <div className={styles.editorContent}>
                        {this.state.showCreateForm ? (
                            this.renderCreateForm()
                        ) : null}
                        {this.state.showStorageManager ? (
                            <div className={styles.createForm}>
                                <ExtensionEditorStorageContent
                                    intl={this.props.intl}
                                    savedExtensions={this.state.savedExtensions}
                                    onClose={this.handleCloseStorageManager}
                                    onLoadFromStorage={this.handleLoadFromStorage}
                                    onDeleteFromStorage={this.handleDeleteFromStorage}
                                    onClearAllStorage={this.handleClearAllStorage}
                                />
                            </div>
                        ) : null}
                        {!this.state.showCreateForm && !this.state.showStorageManager && (
                            <div className={styles.workArea}>
                                <div className={styles.blocksPanel}>
                                    {this.state.blocksPanelMode === 'wizard' ? (
                                        this.renderWizardPanel()
                                    ) : (
                                        <BlockPreview
                                            intl={this.props.intl}
                                            vm={this.props.vm}
                                            ScratchBlocks={this.getScratchBlocks()}
                                            blocksMediaPath={this.props.blocksMediaPath}
                                            loadedExtensionId={activeTab ? this.state.loadedExtensionIds[activeTab.id] : null}
                                            previewRevision={activeTab ? this.state.previewRevisionByTab[activeTab.id] || 0 : 0}
                                            extensionCode={code}
                                            isLoading={this.state.isLoadingExtension}
                                            loadError={this.state.loadError}
                                            activeTabId={this.props.activeTabId}
                                        />
                                    )}
                                </div>
                                <div className={styles.codePanel}>
                                    {activeTab ? (
                                        <ExtensionEditor
                                            key={activeTab.id}
                                            vm={this.props.vm}
                                            initialCode={code}
                                            onCodeChange={this.handleCodeChange}
                                            onAutoRunRequest={this.handleAutoRunRequest}
                                            onOpenExtensionEditorSettings={this.props.onOpenExtensionEditorSettings}
                                            fontSize={this.props.fontSize}
                                            onFontSizeChange={this.props.onFontSizeChange}
                                            themeMode={editorThemeMode}
                                            onToggleWizard={this.handleToggleWizardPanel}
                                            wizardActive={this.state.blocksPanelMode === 'wizard'}
                                            intl={this.props.intl}
                                        />
                                    ) : (
                                        <div className={styles.emptyState}>
                                            <h2><FormattedMessage {...messages.welcomeTitle} /></h2>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    renderCreateForm() {
        return (
            <div className={styles.createForm}>
                <button
                    className={styles.closeButton}
                    onClick={this.handleCancelCreate}
                    title={this.props.intl.formatMessage(messages.closeButton)}
                >
                    ✕
                </button>
                <div className={styles.createFormContent}>
                    <div className={styles.stepsProgress}>
                        <div
                            className={styles.stepsProgressBar}
                            style={{ width: `${this.state.currentStep === 0 ? 0 : this.state.currentStep === 1 ? 25 : this.state.currentStep === 2 ? 50 : this.state.currentStep === 3 ? 75 : 100}%` }}
                        />
                    </div>
                    {this.renderStepContent()}
                </div>
                <div className={styles.createFormActions}>
                    {this.state.currentStep > 0 && this.state.currentStep !== 4 && (
                        <button
                            className={styles.backButton}
                            onClick={this.handlePrevStep}
                        >
                            <FormattedMessage {...messages.backButton} />
                        </button>
                    )}
                    {this.state.currentStep === 1 && (
                        <button
                            className={styles.nextButton}
                            onClick={this.handleNextStep}
                            disabled={!this.state.createForm.name.trim()}
                        >
                            <FormattedMessage {...messages.nextButton} />
                        </button>
                    )}
                    {this.state.currentStep === 2 && (
                        <button
                            className={styles.nextButton}
                            onClick={this.handleNextStep}
                            disabled={!this.state.createForm.name.trim() || !this.state.createForm.id.trim()}
                        >
                            <FormattedMessage {...messages.nextButton} />
                        </button>
                    )}
                    {this.state.currentStep === 3 && (
                        <button
                            className={styles.createButton}
                            onClick={this.handleCreateExtension}
                            disabled={!this.state.createForm.name.trim() || !this.state.createForm.id.trim()}
                        >
                            <FormattedMessage {...messages.createButton} />
                        </button>
                    )}
                </div>
            </div>
        );
    }
    renderStepContent() {
        switch (this.state.currentStep) {
            case 0:
                return (
                    <div className={styles.stepContent}>
                        <div className={styles.welcomeActions}>
                            <button
                                className={styles.welcomeButton}
                                onClick={() => this.setState({ currentStep: 1 })}
                            >
                                <FormattedMessage {...messages.createNewExtension} />
                            </button>
                            <button
                                className={styles.welcomeButton}
                                onClick={this.handleLoadExtension}
                            >
                                <FormattedMessage {...messages.loadExtension} />
                            </button>
                            <button
                                className={styles.welcomeButton}
                                onClick={this.handleOpenStorageManager}
                            >
                                <FormattedMessage {...messages.manageStorage} />
                            </button>
                        </div>
                        <input
                            ref={this.fileInputRef}
                            type="file"
                            accept=".js, application/javascript, text/javascript"
                            style={{ display: 'none' }}
                            onChange={this.handleFileSelect}
                        />
                    </div>
                );
            case 1:
                return (
                    <div className={styles.stepContent}>
                        <h3><FormattedMessage {...messages.nameLabel} /></h3>
                        <input
                            type="text"
                            className={styles.formInput}
                            placeholder={this.props.intl.formatMessage(messages.namePlaceholder)}
                            value={this.state.createForm.name}
                            onChange={(e) => this.handleCreateFormChange('name', e.target.value)}
                            autoFocus
                        />
                        {this.state.errors.name && (
                            <div className={styles.formError}>{this.state.errors.name}</div>
                        )}
                    </div>
                );
            case 2:
                return (
                    <div className={styles.stepContent}>
                        <h3><FormattedMessage {...messages.idLabel} /></h3>
                        <div className={styles.nowName}>
                            <FormattedMessage {...messages.nowName}></FormattedMessage>{this.state.createForm.name}
                        </div>
                        <input
                            type="text"
                            className={styles.formInput}
                            placeholder={this.props.intl.formatMessage(messages.idPlaceholder)}
                            value={this.state.createForm.id}
                            onChange={(e) => this.handleCreateFormChange('id', e.target.value)}
                            autoFocus
                        />
                        <div className={styles.formHint}>
                            <FormattedMessage {...messages.idHint} />
                        </div>
                        {this.state.errors.id && (
                            <div className={styles.formError}>{this.state.errors.id}</div>
                        )}
                    </div>
                );
            case 3:
                return (
                    <div className={styles.stepContent}>
                        <h3><FormattedMessage {...messages.colorLabel} /></h3>
                        <div className={styles.colorPickers}>
                            <div className={styles.colorPicker}>
                                <label className={styles.colorLabel}>
                                    <FormattedMessage {...messages.color1Label} />
                                </label>
                                <input
                                    type="color"
                                    className={styles.colorInput}
                                    value={this.state.createForm.color1}
                                    onChange={(e) => this.handleCreateFormChange('color1', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }
}

ExtensionEditorTabs.propTypes = {
    intl: intlShape.isRequired,
    vm: PropTypes.object,
    blocksMediaPath: PropTypes.string,
    tabs: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        code: PropTypes.string.isRequired,
        isSaved: PropTypes.bool.isRequired,
        createdAt: PropTypes.number,
        updatedAt: PropTypes.number
    })).isRequired,
    activeTabId: PropTypes.string,
    activeTabIndex: PropTypes.number.isRequired,
    addTab: PropTypes.func.isRequired,
    removeTab: PropTypes.func.isRequired,
    activateTab: PropTypes.func.isRequired,
    updateTabCode: PropTypes.func.isRequired,
    setTabSaved: PropTypes.func.isRequired,
    openExtensionEditorCreate: PropTypes.func.isRequired,
    onOpenExtensionEditorSettings: PropTypes.func,
    theme: PropTypes.object,
    fontSize: PropTypes.number,
    onFontSizeChange: PropTypes.func
};

const mapStateToProps = state => ({
    tabs: state.scratchGui.extensionEditorTabs.tabs,
    activeTabId: state.scratchGui.extensionEditorTabs.activeTabId,
    theme: state.scratchGui.theme.theme,
    fontSize: state.scratchGui.extensionEditor.fontSize,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex
});

const mapDispatchToProps = dispatch => ({
    addTab: (tab) => dispatch(addTab(tab)),
    removeTab: (tabId) => dispatch(removeTab(tabId)),
    activateTab: (tabId) => dispatch(activateTab(tabId)),
    updateTabCode: (tabId, code) => dispatch(updateTabCode(tabId, code)),
    setTabSaved: (tabId, isSaved) => dispatch(setTabSaved(tabId, isSaved)),
    openExtensionEditorCreate: () => dispatch(openExtensionEditorCreate())
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(ExtensionEditorTabs));
