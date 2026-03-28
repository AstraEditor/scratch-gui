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
import isScratchDesktop from './isScratchDesktop';

// 在 Desktop 模式下使用本地协议，否则使用在线版本
const getExtensionEditorUrl = () => {
    if (isScratchDesktop()) {
        return 'tw-extension-editor://./index.html';
    }
    return 'https://editors.astras.top/scratch-extension-editor/';
};

const EXTENSION_EDITOR_URL = 'https://editors.astras.top/scratch-extension-editor/';
// const EXTENSION_EDITOR_URL = 'http://192.168.1.7:3000/';

const HOT_RELOAD_MESSAGE_TYPE = 'astra-extension-hot-reload';

const ExtensionEditorHotReloadHOC = function (WrappedComponent) {
    class ExtensionEditorHotReloadComponent extends React.Component {
        constructor(props) {
            super(props);
            this.handleOpenExtensionEditor = this.handleOpenExtensionEditor.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
            this.extensionEditorWindow = null;
        }

        componentDidMount() {
            window.addEventListener('message', this.handleMessage);
        }

        componentWillUnmount() {
            window.removeEventListener('message', this.handleMessage);
        }

        handleOpenExtensionEditor() {
            // 打开扩展编辑器窗口
            this.extensionEditorWindow = window.open(
                getExtensionEditorUrl(),
                'astra-extension-editor',
                'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no'
            );
        }

        async handleMessage(e) {
            // 安全检查：确保消息来自预期的源
            // 在生产环境中应该检查 e.origin
            
            const data = e.data;
            
            // 检查消息类型
            if (data.type !== HOT_RELOAD_MESSAGE_TYPE) {
                return;
            }

            const { extensionId, code } = data;
            
            if (!extensionId || !code) {
                log.error('Hot reload: missing extensionId or code');
                return;
            }

            try {
                log.log(`Hot reload: reloading extension ${extensionId}`);
                
                // 卸载旧扩展（如果存在），保留积木用于热重载
                if (this.props.vm.extensionManager.isExtensionLoaded(extensionId)) {
                    this.props.vm.extensionManager.unloadExtension(extensionId, {
                        preserveBlocks: true,  // 保留积木，不删除工作区中的积木
                        skipConfirm: true      // 跳过确认对话框
                    });
                }

                // 创建 data URL 加载扩展
                const dataUrl = `data:application/javascript,${encodeURIComponent(code)}`;
                
                // 加载新扩展（true 表示信任此扩展）
                await this.props.vm.extensionManager.loadExtensionURL(dataUrl, true);
                
                // 刷新工作区以更新积木定义
                this.props.vm.emitWorkspaceUpdate();
                
                log.log(`Hot reload: extension ${extensionId} loaded successfully`);
                
                // 通知扩展编辑器窗口加载成功
                if (this.extensionEditorWindow && !this.extensionEditorWindow.closed) {
                    this.extensionEditorWindow.postMessage({
                        type: 'astra-extension-hot-reload-result',
                        success: true
                    }, '*');
                }
            } catch (error) {
                log.error('Hot reload failed:', error);
                
                // 通知扩展编辑器窗口加载失败
                if (this.extensionEditorWindow && !this.extensionEditorWindow.closed) {
                    this.extensionEditorWindow.postMessage({
                        type: 'astra-extension-hot-reload-result',
                        success: false,
                        error: error.message
                    }, '*');
                }
            }
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
        vm: PropTypes.shape({
            extensionManager: PropTypes.shape({
                isExtensionLoaded: PropTypes.func,
                unloadExtension: PropTypes.func,
                loadExtensionURL: PropTypes.func
            }),
            emitWorkspaceUpdate: PropTypes.func
        })
    };

    const mapStateToProps = state => ({
        vm: state.scratchGui.vm
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
    EXTENSION_EDITOR_URL,
    getExtensionEditorUrl
};
