/**
 * 扩展编辑器热重载集成
 * 
 * 监听来自 scratch-extension-editor 窗口的热重载消息，
 * 卸载旧扩展并加载新扩展
 */

import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import log from './log';

const DEFAULT_EXTENSION_EDITOR_URL = 'https://editors.astras.top/scratch-extension-editor/';

const HOT_RELOAD_MESSAGE_TYPE = 'astra-extension-hot-reload';

const debugHotReload = (stage, payload = {}) => {
    console.log('[hot-reload][gui]', stage, payload);
    if (typeof HotReloadDebug !== 'undefined' && HotReloadDebug && HotReloadDebug.log) {
        HotReloadDebug.log(stage, payload);
    }
};

const ExtensionEditorHotReloadHOC = function (WrappedComponent) {
    class ExtensionEditorHotReloadComponent extends React.Component {
        constructor(props) {
            super(props);
            this.handleOpenExtensionEditor = this.handleOpenExtensionEditor.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
            this.handleHotReloadData = this.handleHotReloadData.bind(this);
            this.extensionEditorWindow = null;
        }

        componentDidMount() {
            window.addEventListener('message', this.handleMessage);
            if (typeof EditorPreload !== 'undefined' && EditorPreload.setExtensionEditorHotReloadHandler) {
                EditorPreload.setExtensionEditorHotReloadHandler(this.handleHotReloadData);
            }
        }

        componentWillUnmount() {
            window.removeEventListener('message', this.handleMessage);
            if (typeof EditorPreload !== 'undefined' && EditorPreload.setExtensionEditorHotReloadHandler) {
                EditorPreload.setExtensionEditorHotReloadHandler(null);
            }
        }

        handleOpenExtensionEditor() {
            const url = this.props.extensioneditorurl || DEFAULT_EXTENSION_EDITOR_URL;
            console.log('[ExtensionEditor] Opening URL:', url);
            
            // 在 Desktop 环境中使用 IPC 打开窗口
            if (typeof EditorPreload !== 'undefined' && EditorPreload.openExtensionEditor) {
                console.log('[ExtensionEditor] Using IPC to open window');
                EditorPreload.openExtensionEditor();
                return;
            }
            
            // 回退：使用 window.open（在线版本）
            this.extensionEditorWindow = window.open(
                url,
                'astra-extension-editor',
                'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no'
            );
        }

        async handleHotReloadData(data) {
            if (data.type !== HOT_RELOAD_MESSAGE_TYPE) {
                return null;
            }

            const { extensionId, code } = data;
            const loadedExtensionIds = this.props.vm &&
                this.props.vm.extensionManager &&
                this.props.vm.extensionManager._loadedExtensions &&
                typeof this.props.vm.extensionManager._loadedExtensions.keys === 'function'
                ? Array.from(this.props.vm.extensionManager._loadedExtensions.keys())
                : [];

            debugHotReload('gui-hot-reload-received', {
                extensionId,
                codeLength: typeof code === 'string' ? code.length : null,
                loadedExtensionIds
            });
            
            if (!extensionId || !code) {
                log.error('Hot reload: missing extensionId or code');
                debugHotReload('gui-hot-reload-missing-data', {
                    extensionId,
                    hasCode: !!code
                });
                return {
                    success: false,
                    error: 'Missing extensionId or code'
                };
            }

            try {
                log.log(`Hot reload: reloading extension ${extensionId}`);
                debugHotReload('gui-hot-reload-start', {
                    extensionId,
                    wasLoaded: this.props.vm.extensionManager.isExtensionLoaded(extensionId)
                });
                
                // 卸载旧扩展（如果存在），保留积木用于热重载
                if (this.props.vm.extensionManager.isExtensionLoaded(extensionId)) {
                    this.props.vm.extensionManager.unloadExtension(extensionId, {
                        preserveBlocks: true,  // 保留积木，不删除工作区中的积木
                        skipConfirm: true      // 跳过确认对话框
                    });
                    debugHotReload('gui-hot-reload-after-unload', {
                        extensionId,
                        stillLoaded: this.props.vm.extensionManager.isExtensionLoaded(extensionId)
                    });
                }

                // 创建 data URL 加载扩展
                const dataUrl = `data:application/javascript,${encodeURIComponent(code)}`;
                debugHotReload('gui-hot-reload-before-load', {
                    extensionId,
                    dataUrlLength: dataUrl.length
                });
                
                // 加载新扩展（true 表示信任此扩展）
                await this.props.vm.extensionManager.loadExtensionURL(dataUrl, true);
                debugHotReload('gui-hot-reload-after-load', {
                    extensionId,
                    isLoaded: this.props.vm.extensionManager.isExtensionLoaded(extensionId),
                    loadedExtensionIds: this.props.vm.extensionManager._loadedExtensions &&
                        typeof this.props.vm.extensionManager._loadedExtensions.keys === 'function'
                        ? Array.from(this.props.vm.extensionManager._loadedExtensions.keys())
                        : []
                });

                // Force block metadata/toolbox refresh after preserveBlocks hot reload.
                if (this.props.vm.extensionManager.refreshBlocks) {
                    await this.props.vm.extensionManager.refreshBlocks(extensionId);
                    debugHotReload('gui-hot-reload-after-refresh-blocks', {
                        extensionId
                    });
                }
                
                // 刷新工作区以更新积木定义
                this.props.vm.emitWorkspaceUpdate();
                debugHotReload('gui-hot-reload-workspace-updated', {
                    extensionId
                });
                
                log.log(`Hot reload: extension ${extensionId} loaded successfully`);
                debugHotReload('gui-hot-reload-success', {
                    extensionId
                });
                
                // 通知扩展编辑器窗口加载成功
                if (this.extensionEditorWindow && !this.extensionEditorWindow.closed) {
                    this.extensionEditorWindow.postMessage({
                        type: 'astra-extension-hot-reload-result',
                        success: true
                    }, '*');
                }

                return {
                    success: true
                };
            } catch (error) {
                log.error('Hot reload failed:', error);
                debugHotReload('gui-hot-reload-error', {
                    extensionId,
                    error: error && error.message,
                    stack: error && error.stack
                });
                
                // 通知扩展编辑器窗口加载失败
                if (this.extensionEditorWindow && !this.extensionEditorWindow.closed) {
                    this.extensionEditorWindow.postMessage({
                        type: 'astra-extension-hot-reload-result',
                        success: false,
                        error: error.message
                    }, '*');
                }

                return {
                    success: false,
                    error: error.message
                };
            }
        }

        async handleMessage(e) {
            // 安全检查：确保消息来自预期的源
            // 在生产环境中应该检查 e.origin
            return this.handleHotReloadData(e.data);
        }

        render() {
            return (
                <WrappedComponent
                    onOpenExtensionEditor={this.handleOpenExtensionEditor}
                    {...this.props}
                />
            );
        }
    }

    ExtensionEditorHotReloadComponent.propTypes = {
        extensioneditorurl: PropTypes.string,
        vm: PropTypes.shape({
            extensionManager: PropTypes.shape({
                isExtensionLoaded: PropTypes.func,
                unloadExtension: PropTypes.func,
                loadExtensionURL: PropTypes.func
            }),
            emitWorkspaceUpdate: PropTypes.func
        })
    };

    const mapStateToProps = (state, ownProps) => ({
        vm: state.scratchGui.vm,
        extensioneditorurl: ownProps.extensioneditorurl
    });

    const mapDispatchToProps = () => ({});

    return connect(
        mapStateToProps,
        mapDispatchToProps
    )(ExtensionEditorHotReloadComponent);
};

export {
    ExtensionEditorHotReloadHOC as default,
    HOT_RELOAD_MESSAGE_TYPE,
    DEFAULT_EXTENSION_EDITOR_URL
};
