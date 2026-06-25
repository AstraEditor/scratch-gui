import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import { connect } from 'react-redux';
import log from '../lib/log';
import CustomExtensionModalComponent from '../components/tw-custom-extension-modal/custom-extension-modal.jsx';
import { closeCustomExtensionModal, openPreviewExt } from '../reducers/modals';
import { setPreviewExtData } from '../reducers/ae-preview-ext-data';
import { manuallyTrustExtension, isTrustedExtension } from './tw-security-manager.jsx';
import { getPersistedUnsandboxed, setPersistedUnsandboxed } from '../lib/tw-persisted-unsandboxed.js';
import AddonHooks from '../addons/hooks';
import { get } from '../lib/settings.js'
/**
 * @param {Blob} blob Blob
 * @returns {Promise<string>} data: uri
 */
const readAsDataURL = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read extension as data URL: ${reader.error}`));
    reader.readAsDataURL(blob);
});


class CustomExtensionModal extends React.Component {
    constructor(props) {
        super(props);

        bindAll(this, [
            'handleChangeFiles',
            'handleChangeURL',
            'handleClose',
            'handleKeyDown',
            'handleLoadExtension',
            'handleSwitchToFile',
            'handleSwitchToURL',
            'handleSwitchToText',
            'handleChangeText',
            'handleDragOver',
            'handleDragLeave',
            'handleDrop',
            'handleChangeUnsandboxed',
            'getSVG',
            'updatePreview'
        ]);

        this.state = {
            type: 'url',
            url: '',
            files: null,
            text: '',
            unsandboxed: getPersistedUnsandboxed(),
            svgList: [],
            urls: ""
        };
    }

    /**
     * @returns {Promise<string[]>} List of extension URLs to load.
     */
    getExtensionURLs() {
        if (this.state.type === 'url') {
            return Promise.resolve([
                this.state.url
            ]);
        }

        if (this.state.type === 'file') {
            const files = Array.from(this.state.files);
            return Promise.all(files.map(readAsDataURL));
        }

        if (this.state.type === 'text') {
            return Promise.resolve([
                `data:application/javascript,${encodeURIComponent(this.state.text)}`
            ]);
        }

        return Promise.reject(new Error('Unknown type'));
    }

    hasValidInput() {
        if (this.state.type === 'url') {
            try {
                const parsed = new URL(this.state.url);
                return (
                    parsed.protocol === 'https:' ||
                    parsed.protocol === 'http:' ||
                    parsed.protocol === 'data:'
                );
            } catch (e) {
                return false;
            }
        }

        if (this.state.type === 'file') {
            return !!this.state.files;
        }

        if (this.state.type === 'text') {
            return !!this.state.text;
        }

        return false;
    }

    handleChangeFiles(files) {
        this.setState({
            files
        }, () => {
            this.updatePreview();
        });
    }

    handleChangeURL(e) {
        this.setState({
            url: e.target.value
        });
    }

    handleClose() {
        this.props.onClose();
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && this.hasValidInput()) {
            e.preventDefault();
            this.handleLoadExtension();
        }
    }

    async handleLoadExtension() {
        try {
            const urls = await this.getExtensionURLs();

            if (this.state.type !== 'url') {
                setPersistedUnsandboxed(this.state.unsandboxed);
                if (this.state.unsandboxed) {
                    for (const url of urls) {
                        manuallyTrustExtension(url);
                    }
                }
            }

            const loadedExtensions = [];

            document.addEventListener('loadExtensionDone', e => {
                if (e.detail.state === 'error') {
                    alert(e.detail.info);
                }
            }, { once: true });

            for (const originalUrl of urls) {
                const candidateUrls = [originalUrl];

                let loaded = false;
                let lastError = null;
                for (const candidateUrl of candidateUrls) {
                    try {
                        const loadPromise = this.props.vm.extensionManager.loadExtensionURL(candidateUrl);
                        await Promise.race([loadPromise]);
                        loadedExtensions.push(candidateUrl);
                        loaded = true;
                        break;
                    } catch (err) {
                        lastError = err;
                    }
                }

                if (!loaded) {
                    alert(`Failed to load extension: ${String(lastError || '')}`);
                    console.error('Failed to load extension:', lastError);
                }
            }
        } catch (err) {
            alert(`Failed to load extension(s)`);
            console.error('Error:', err);
        }
        this.handleClose();
    }
    async getSVG() {
        try {
            const urls = await this.getExtensionURLs();
            if (this.state.type === 'url') return;

            const workspace = AddonHooks.blocklyWorkspace;

            if (!workspace) {
                throw new Error('Blockly workspace not available');
            }

            const svgs = [];

            for (const url of urls) {
                const previousLength = this.props.vm.runtime._blockInfo.length;

                setPersistedUnsandboxed(this.state.unsandboxed);
                if (this.state.unsandboxed) {
                    manuallyTrustExtension(url);
                }

                try {
                    await this.props.vm.extensionManager.loadExtensionURL(url);
                } catch (err) {
                    console.warn(`扩展加载失败: ${url}`, err);
                    continue;
                }

                const currentBlockInfo = this.props.vm.runtime._blockInfo;

                if (currentBlockInfo.length === previousLength) {
                    console.warn("扩展已存在或加载失败喵~");
                    continue;
                }


                const newExtensions = [];
                for (let i = previousLength; i < currentBlockInfo.length; i++) {
                    newExtensions.push(currentBlockInfo[i]);
                }

                for (const extInfo of newExtensions) {
                    console.log(extInfo);
                    const color = extInfo.color1;
                    for (const blockInfo of extInfo.blocks) {
                        let fullOpcode = "";
                        if (blockInfo.info.opcode == undefined) {
                            continue;
                        }
                        if (blockInfo.info.blockType == "label") {
                            fullOpcode = {
                                isSVG: true,
                                data: `
                                <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                                    <g>
                                        <text xml:space="preserve" text-anchor="start" font-family="Consolas, 'Courier New', monospace, 'MiSans'" font-size="24" id="svg_1" y="20" x="-590" stroke-width="0" stroke="#888" fill=${color}>
                                            ${blockInfo.info.text}
                                        </text>
                                        <line  y2="30" x2="0" y1="30" x1="255" stroke=${color} fill="none"/>
                                    </g>
                                </svg>
                                `
                            }
                        } else {
                            fullOpcode = extInfo.id + '_' + blockInfo.info.opcode;
                        }
                        try {
                            if (fullOpcode.isSVG) {
                                svgs.push(fullOpcode.data)
                            } else {
                                const block = workspace.newBlock(fullOpcode);
                                block.initSvg();
                                block.render();
                                const svg = block.getSvgRoot().outerHTML;
                                svgs.push(svg);
                                block.dispose();
                            }
                        } catch (e) {
                            console.warn(`Block render failed: ${fullOpcode}`, e);
                        }
                    }
                }


                for (const extInfo of newExtensions) {
                    await this.props.vm.extensionManager.unloadExtension(extInfo.id);
                }
            }

            this.setState({ svgList: svgs });

        } catch (err) {
            log.error(err);
            this.setState({ svgList: [] });
        }
    }

    async updatePreview() {
        if (!get('showPreview')) return
        if (!this.hasValidInput()) {
            this.setState({ svgList: [] });
            return;
        }
        await this.getSVG();

    }


    handleSwitchToFile() {
        this.setState({
            type: 'file'
        });
    }

    handleSwitchToURL() {
        this.setState({
            type: 'url'
        });
    }

    handleSwitchToText() {
        this.setState({
            type: 'text'
        });
    }

    handleChangeText(e) {
        this.setState({
            text: e.target.value
        }, () => {
            this.updatePreview();
        });
    }

    handleDragOver(e) {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    }

    handleDragLeave() {

    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) {
            e.preventDefault();
            this.setState({
                type: 'file',
                files
            }, () => {
                this.updatePreview();
            });
        }
    }

    isUnsandboxed() {
        if (this.state.type === 'url') {
            return isTrustedExtension(this.state.url);
        }
        return this.state.unsandboxed;
    }

    canChangeUnsandboxed() {
        return this.state.type !== 'url';
    }

    handleChangeUnsandboxed(e) {
        this.setState({
            unsandboxed: e.target.checked
        });
    }

    render() {
        return (
            <CustomExtensionModalComponent
                canLoadExtension={this.hasValidInput()}
                type={this.state.type}
                onSwitchToFile={this.handleSwitchToFile}
                onSwitchToURL={this.handleSwitchToURL}
                onSwitchToText={this.handleSwitchToText}
                files={this.state.files}
                onChangeFiles={this.handleChangeFiles}
                onDragOver={this.handleDragOver}
                onDragLeave={this.handleDragLeave}
                onDrop={this.handleDrop}
                url={this.state.url}
                onChangeURL={this.handleChangeURL}
                onKeyDown={this.handleKeyDown}
                text={this.state.text}
                onChangeText={this.handleChangeText}
                unsandboxed={this.isUnsandboxed()}
                onChangeUnsandboxed={this.canChangeUnsandboxed() ? this.handleChangeUnsandboxed : null}
                onLoadExtension={this.handleLoadExtension}
                onGetSVG={this.getSVG}
                dispatch={this.props.dispatch}
                onClose={this.handleClose}
                svgList={this.state.svgList}
                showPreview={get('EnableExtensionPreview')}
            />
        );
    }
}

CustomExtensionModal.propTypes = {
    onClose: PropTypes.func,
    vm: PropTypes.shape({
        extensionManager: PropTypes.shape({
            loadExtensionURL: PropTypes.func
        })
    })
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeCustomExtensionModal()),
    dispatch
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CustomExtensionModal);
