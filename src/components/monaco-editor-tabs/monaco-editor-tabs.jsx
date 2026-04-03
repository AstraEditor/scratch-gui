import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { defineMessages, injectIntl } from 'react-intl';
import MonacoIDE from 'scratch-monaco-editor';
import {
    addTab,
    removeTab,
    activateTab,
    updateTabCode,
    updateTabName,
    setTabSaved
} from '../../reducers/monaco-editor-tabs';
import styles from './monaco-editor-tabs.css';

const messages = defineMessages({
    addTab: {
        defaultMessage: 'New File',
        description: 'Button to add a new file tab',
        id: 'gui.monacoEditor.addTab'
    },
    save: {
        defaultMessage: 'Save',
        description: 'Button to save current file',
        id: 'gui.monacoEditor.save'
    },
    close: {
        defaultMessage: 'Close',
        description: 'Button to close current tab',
        id: 'gui.monacoEditor.close'
    }
});

class MonacoEditorTabs extends React.Component {
    constructor(props) {
        super(props);
        this.ideRef = React.createRef();
        this.state = {
            showTerminal: false
        };
    }

    componentDidMount() {
        // 如果没有标签，创建一个默认标签
        if (this.props.tabs.length === 0) {
            this.createNewTab();
        }
    }

    handleAddTab = () => {
        this.createNewTab();
    };

    createNewTab = () => {
        const tabId = `tab_${Date.now()}`;
        const tab = {
            id: tabId,
            name: `untitled_${this.props.tabs.length + 1}.js`,
            code: '// New file\n',
            isSaved: false
        };
        this.props.addTab(tab);
    };

    handleRemoveTab = (tabId) => {
        this.props.removeTab(tabId);
    };

    handleTabClick = (tabId) => {
        this.props.activateTab(tabId);
    };

    handleCodeChange = (path, content) => {
        if (this.props.activeTabId) {
            this.props.updateTabCode(this.props.activeTabId, content);
        }
    };

    handleSave = () => {
        if (this.props.activeTabId) {
            const activeTab = this.props.tabs.find(tab => tab.id === this.props.activeTabId);
            if (activeTab) {
                // 这里可以添加保存到服务器的逻辑
                console.log('Saving file:', activeTab.name);
                this.props.setTabSaved(this.props.activeTabId, true);
            }
        }
    };

    handleRun = () => {
        if (this.ideRef.current) {
            const content = this.ideRef.current.getContent();
            console.log('Running code:', content);
            // 这里可以添加代码执行逻辑
        }
    };

    handleToggleTerminal = () => {
        this.setState(prevState => ({
            showTerminal: !prevState.showTerminal
        }));
    };

    handleTerminalCommand = (cmd, args) => {
        console.log('Terminal command:', cmd, args);
        // 这里可以添加终端命令处理逻辑
    };

    getActiveTab() {
        return this.props.tabs.find(tab => tab.id === this.props.activeTabId);
    }

    render() {
        const { intl, tabs, activeTabId } = this.props;
        const activeTab = this.getActiveTab();

        // 将 tabs 转换为 scratch-monaco-editor 需要的格式
        const files = tabs.map(tab => ({
            name: tab.name,
            path: tab.name,
            content: tab.code
        }));

        return (
            <div className={styles.container}>
                {/* 标签栏 */}
                <div className={styles.tabBar}>
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className={`${styles.tab} ${tab.id === activeTabId ? styles.activeTab : ''}`}
                            onClick={() => this.handleTabClick(tab.id)}
                        >
                            <span className={styles.tabName}>
                                {tab.name}
                                {!tab.isSaved && <span className={styles.unsaved}>●</span>}
                            </span>
                            <button
                                className={styles.closeButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    this.handleRemoveTab(tab.id);
                                }}
                                title={intl.formatMessage(messages.close)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <button
                        className={styles.addTabButton}
                        onClick={this.handleAddTab}
                        title={intl.formatMessage(messages.addTab)}
                    >
                        +
                    </button>
                </div>

                {/* 工具栏 */}
                <div className={styles.toolbar}>
                    <button
                        className={styles.toolbarButton}
                        onClick={this.handleSave}
                        title={intl.formatMessage(messages.save)}
                    >
                        💾 {intl.formatMessage(messages.save)}
                    </button>
                    <button
                        className={styles.toolbarButton}
                        onClick={this.handleRun}
                        title="Run Code"
                    >
                        ▶ Run
                    </button>
                    <div className={styles.spacer} />
                    <button
                        className={styles.toolbarButton}
                        onClick={this.handleToggleTerminal}
                        title={this.state.showTerminal ? 'Hide Terminal' : 'Show Terminal'}
                    >
                        {this.state.showTerminal ? '📺 Hide' : '📺 Terminal'}
                    </button>
                </div>

                {/* 编辑器区域 */}
                <div className={styles.editorArea}>
                    {activeTab ? (
                        <MonacoIDE
                            ref={this.ideRef}
                            initialFiles={files}
                            activeFile={activeTab.name}
                            theme="vs-dark"
                            fontSize={fontSize || 14}
                            showMinimap={true}
                            wordWrap="off"
                            tabSize={4}
                            showFileList={true}
                            fileListWidth={200}
                            showTerminal={this.state.showTerminal}
                            showTerminalButton={false}
                            onFileChange={(file) => {
                                // 处理文件切换
                            }}
                            onFileContentChange={this.handleCodeChange}
                            onFileAdd={(file) => {
                                this.props.addTab({
                                    id: `tab_${Date.now()}`,
                                    name: file.name,
                                    code: file.content,
                                    isSaved: false
                                });
                            }}
                            onFileDelete={(file) => {
                                const tab = this.props.tabs.find(t => t.name === file.name);
                                if (tab) {
                                    this.props.removeTab(tab.id);
                                }
                            }}
                            onFileRename={(file, newName) => {
                                const tab = this.props.tabs.find(t => t.name === file.name);
                                if (tab) {
                                    this.props.updateTabName(tab.id, newName);
                                }
                            }}
                            onTerminalCommand={this.handleTerminalCommand}
                        />
                    ) : (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>📝</div>
                            <div className={styles.emptyTitle}>No open files</div>
                            <div className={styles.emptyDescription}>
                                Click the + button to create a new file
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

MonacoEditorTabs.propTypes = {
    tabs: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            code: PropTypes.string.isRequired,
            isSaved: PropTypes.bool.isRequired
        })
    ),
    activeTabId: PropTypes.string,
    addTab: PropTypes.func.isRequired,
    removeTab: PropTypes.func.isRequired,
    activateTab: PropTypes.func.isRequired,
    updateTabCode: PropTypes.func.isRequired,
    updateTabName: PropTypes.func.isRequired,
    setTabSaved: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    tabs: state.monacoEditorTabs ? state.monacoEditorTabs.tabs : [],
    activeTabId: state.monacoEditorTabs ? state.monacoEditorTabs.activeTabId : null
});

const mapDispatchToProps = dispatch => ({
    addTab: tab => dispatch(addTab(tab)),
    removeTab: tabId => dispatch(removeTab(tabId)),
    activateTab: tabId => dispatch(activateTab(tabId)),
    updateTabCode: (tabId, code) => dispatch(updateTabCode(tabId, code)),
    updateTabName: (tabId, name) => dispatch(updateTabName(tabId, name)),
    setTabSaved: (tabId, isSaved) => dispatch(setTabSaved(tabId, isSaved))
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(MonacoEditorTabs));