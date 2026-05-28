import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import VM from 'scratch-vm';
import { Theme } from '../../lib/themes';
import { validatePythonCode } from '../../lib/python-parser';
import { generateExtensionFromFiles } from '../../lib/python-extension-generator';
import { manuallyTrustExtension } from '../../containers/tw-security-manager.jsx';
import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';
import './monaco-editor.css';

let monaco = null;

const FILE_TYPE_COLORS = {
    js: { color: '#f7df1e', name: 'JavaScript' },
    py: { color: '#3776ab', name: 'Python' },
    glsl: { color: '#5c6bc0', name: 'GLSL' },
    frag: { color: '#5c6bc0', name: 'Fragment Shader' },
    vert: { color: '#5c6bc0', name: 'Vertex Shader' },
    json: { color: '#cbcb41', name: 'JSON' }
};

const DEFAULT_CODE = {
    js: `// JavaScript 代码示例
function hello() {
    console.log("Hello, World!");
}

hello();
`,
    py: `# Python 扩展示例
def awa(a, b):
    """示例函数：调用 qwq 并处理参数"""
    result = qwq()
    return a + b + result

def qwq():
    """辅助函数"""
    return 10

# 导出列表：只有 awa 会被创建为积木
__all__ = ["awa"]
`,
    glsl: `// GLSL 着色器示例
precision mediump float;

uniform float time;
uniform vec2 resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    gl_FragColor = vec4(uv.x, uv.y, 0.5, 1.0);
}
`,
    frag: `// Fragment Shader
precision mediump float;

uniform float time;
uniform vec2 resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    gl_FragColor = vec4(uv.x, uv.y, 0.5, 1.0);
}
`,
    vert: `// Vertex Shader
attribute vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`,
    json: `{
    "name": "示例配置",
    "version": "1.0.0",
    "settings": {
        "enabled": true,
        "count": 10
    }
}
`
};

const getFileExtension = filename => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

const getFileLanguage = extension => {
    const langMap = {
        js: 'javascript',
        py: 'python',
        glsl: 'glsl',
        frag: 'glsl',
        vert: 'glsl',
        json: 'json'
    };
    return langMap[extension] || 'plaintext';
};

const getFileTypeInfo = extension => {
    return FILE_TYPE_COLORS[extension] || { color: '#888', name: 'Unknown' };
};

const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

class MonacoEditorComponent extends React.Component {
    constructor(props) {
        super(props);
        this.containerRef = React.createRef();
        this.editor = null;
        this.state = {
            files: [
                { id: generateId(), name: 'extension.py', content: DEFAULT_CODE.py },
                { id: generateId(), name: 'script.js', content: DEFAULT_CODE.js },
                { id: generateId(), name: 'shader.glsl', content: DEFAULT_CODE.glsl },
                { id: generateId(), name: 'config.json', content: DEFAULT_CODE.json }
            ],
            activeFileId: null,
            isLoading: true,
            error: null,
            editingFileName: null,
            newFileName: '',
            showNewFileInput: false,
            blockGenerationStatus: null,
            pyodideLoading: false,
            pyodideReady: false,
            selectedFileIds: [],
            showFileSelectionModal: false
        };
    }

    async componentDidMount() {
        try {
            const monacoModule = await import('monaco-editor');
            monaco = monacoModule;
            this.setState({ isLoading: false });
            this.setupGLSLLanguage();
            if (this.state.files.length > 0) {
                this.setState({ activeFileId: this.state.files[0].id });
            }
        } catch (err) {
            console.error('Failed to load Monaco Editor:', err);
            this.setState({ isLoading: false, error: err.message });
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.activeFileId !== this.state.activeFileId) {
            this.updateEditorContent();
        }
        if (prevProps.theme !== this.props.theme && this.editor) {
            this.updateEditorTheme();
        }
        if (!prevState.isLoading && this.state.isLoading === false && !this.editor && this.containerRef.current) {
            this.initEditor();
        }
    }

    setupGLSLLanguage() {
        if (!monaco) return;

        monaco.languages.register({ id: 'glsl' });

        monaco.languages.setMonarchTokensProvider('glsl', {
            keywords: [
                'attribute', 'const', 'uniform', 'varying', 'break', 'continue', 'do',
                'for', 'while', 'if', 'else', 'in', 'out', 'inout', 'float', 'int', 'void',
                'bool', 'true', 'false', 'lowp', 'mediump', 'highp', 'precision', 'invariant',
                'discard', 'return', 'mat2', 'mat3', 'mat4', 'vec2', 'vec3', 'vec4', 'ivec2',
                'ivec3', 'ivec4', 'bvec2', 'bvec3', 'bvec4', 'sampler2D', 'samplerCube',
                'struct', 'gl_Position', 'gl_FragColor', 'gl_FragCoord', 'gl_PointSize'
            ],
            typeKeywords: [
                'float', 'int', 'void', 'bool', 'mat2', 'mat3', 'mat4',
                'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4',
                'bvec2', 'bvec3', 'bvec4', 'sampler2D', 'samplerCube'
            ],
            operators: [
                '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
                '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
                '<<', '>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>='
            ],
            symbols: /[=><!~?:&|+\-*\/\^%]+/,
            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
            tokenizer: {
                root: [
                    [/[a-zA-Z_]\w*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@typeKeywords': 'type',
                            '@default': 'identifier'
                        }
                    }],
                    { include: '@whitespace' },
                    [/[{}()\[\]]/, '@brackets'],
                    [/[<>](?!@symbols)/, '@brackets'],
                    [/@symbols/, {
                        cases: {
                            '@operators': 'operator',
                            '@default': ''
                        }
                    }],
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/0[xX][0-9a-fA-F]+/, 'number.hex'],
                    [/\d+/, 'number'],
                    [/[;,.]/, 'delimiter'],
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],
                    [/"/, 'string', '@string'],
                    [/'[^\\']'/, 'string'],
                    [/'/, 'string.invalid']
                ],
                whitespace: [
                    [/[ \t\r\n]+/, 'white'],
                    [/\/\*/, 'comment', '@comment'],
                    [/\/\/.*$/, 'comment']
                ],
                comment: [
                    [/[^\/*]+/, 'comment'],
                    [/\*\//, 'comment', '@pop'],
                    [/[/*]/, 'comment']
                ],
                string: [
                    [/[^\\"]+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/"/, 'string', '@pop']
                ]
            }
        });

        monaco.languages.setLanguageConfiguration('glsl', {
            comments: {
                lineComment: '//',
                blockComment: ['/*', '*/']
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ],
            surroundingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        });
    }

    getEditorTheme() {
        if (this.props.theme && this.props.theme.isDark()) {
            return 'vs-dark';
        }
        return 'vs';
    }

    updateEditorTheme() {
        if (this.editor) {
            monaco.editor.setTheme(this.getEditorTheme());
        }
    }

    initEditor() {
        const activeFile = this.state.files.find(f => f.id === this.state.activeFileId);
        if (this.containerRef.current && !this.editor && monaco) {
            const extension = activeFile ? getFileExtension(activeFile.name) : 'js';
            this.editor = monaco.editor.create(this.containerRef.current, {
                value: activeFile ? activeFile.content : '',
                language: getFileLanguage(extension),
                theme: this.getEditorTheme(),
                minimap: {
                    enabled: true,
                    scale: 1,
                    showSlider: 'mouseover',
                    renderCharacters: true,
                    maxColumn: 120
                },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
                folding: true,
                foldingStrategy: 'auto',
                showFoldingControls: 'mouseover',
                matchBrackets: 'always',
                autoIndent: 'advanced',
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                snippetSuggestions: 'inline',
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: false
                },
                parameterHints: {
                    enabled: true
                },
                hover: {
                    enabled: true,
                    delay: 300
                },
                contextmenu: true,
                find: {
                    addExtraSpaceOnTop: false,
                    autoFindInSelection: 'multiline',
                    seedSearchStringFromSelection: 'selection'
                },
                glyphMargin: true,
                fixedOverflowWidgets: true,
                renderLineHighlight: 'all',
                scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalHasArrows: false,
                    horizontalHasArrows: false,
                    verticalScrollbarSize: 14,
                    horizontalScrollbarSize: 14,
                    arrowSize: 30,
                    useShadows: true
                },
                overviewRulerBorder: true,
                overviewRulerLanes: 3,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true
            });

            this.editor.onDidChangeModelContent(() => {
                const value = this.editor.getValue();
                this.updateFileContent(this.state.activeFileId, value);
            });
        }
    }

    updateEditorContent() {
        if (!this.editor || !monaco) return;

        const activeFile = this.state.files.find(f => f.id === this.state.activeFileId);
        if (activeFile) {
            const extension = getFileExtension(activeFile.name);
            const oldModel = this.editor.getModel();
            const newModel = monaco.editor.createModel(
                activeFile.content,
                getFileLanguage(extension)
            );
            this.editor.setModel(newModel);
            if (oldModel) {
                oldModel.dispose();
            }
        }
    }

    updateFileContent = (fileId, content) => {
        this.setState(prevState => ({
            files: prevState.files.map(f =>
                f.id === fileId ? { ...f, content } : f
            ),
            blockGenerationStatus: null
        }));
    };

    selectFile = (fileId) => {
        this.setState({ activeFileId: fileId, editingFileName: null, blockGenerationStatus: null });
    };

    createNewFile = () => {
        this.setState({ showNewFileInput: true, newFileName: '' });
    };

    handleNewFileNameChange = (e) => {
        this.setState({ newFileName: e.target.value });
    };

    handleNewFileSubmit = () => {
        const { newFileName } = this.state;
        if (!newFileName.trim()) return;

        const extension = getFileExtension(newFileName);
        const defaultContent = DEFAULT_CODE[extension] || '';
        const newFile = {
            id: generateId(),
            name: newFileName.trim(),
            content: defaultContent
        };

        this.setState(prevState => ({
            files: [...prevState.files, newFile],
            activeFileId: newFile.id,
            showNewFileInput: false,
            newFileName: ''
        }));
    };

    handleNewFileCancel = () => {
        this.setState({ showNewFileInput: false, newFileName: '' });
    };

    startRenameFile = (fileId) => {
        const file = this.state.files.find(f => f.id === fileId);
        this.setState({ editingFileName: fileId, newFileName: file.name });
    };

    handleRenameSubmit = () => {
        const { editingFileName, newFileName } = this.state;
        if (!newFileName.trim()) return;

        this.setState(prevState => ({
            files: prevState.files.map(f =>
                f.id === editingFileName ? { ...f, name: newFileName.trim() } : f
            ),
            editingFileName: null,
            newFileName: ''
        }));
    };

    handleRenameCancel = () => {
        this.setState({ editingFileName: null, newFileName: '' });
    };

    deleteFile = (fileId) => {
        this.setState(prevState => {
            const newFiles = prevState.files.filter(f => f.id !== fileId);
            let newActiveFileId = prevState.activeFileId;
            if (prevState.activeFileId === fileId) {
                newActiveFileId = newFiles.length > 0 ? newFiles[0].id : null;
            }
            const newSelectedFileIds = prevState.selectedFileIds.filter(id => id !== fileId);
            return {
                files: newFiles,
                activeFileId: newActiveFileId,
                blockGenerationStatus: null,
                selectedFileIds: newSelectedFileIds
            };
        });
    };

    toggleFileSelection = (fileId) => {
        this.setState(prevState => {
            const isSelected = prevState.selectedFileIds.includes(fileId);
            if (isSelected) {
                return {
                    selectedFileIds: prevState.selectedFileIds.filter(id => id !== fileId)
                };
            } else {
                return {
                    selectedFileIds: [...prevState.selectedFileIds, fileId]
                };
            }
        });
    };

    openFileSelectionModal = () => {
        const pythonFiles = this.state.files.filter(f => f.name.endsWith('.py'));
        if (pythonFiles.length === 0) {
            this.setState({
                blockGenerationStatus: {
                    type: 'error',
                    message: '没有 Python 文件可供生成积木'
                }
            });
            return;
        }
        this.setState({ showFileSelectionModal: true });
    };

    closeFileSelectionModal = () => {
        this.setState({ showFileSelectionModal: false });
    };

    confirmFileSelectionAndGenerate = async () => {
        this.setState({ showFileSelectionModal: false });
        await this.generateBlocks();
    };

    generateBlocks = async () => {
        const selectedFiles = this.state.files.filter(f => this.state.selectedFileIds.includes(f.id));
        
        if (selectedFiles.length === 0) {
            this.setState({
                blockGenerationStatus: {
                    type: 'error',
                    message: '请先选择要生成积木的 Python 文件'
                }
            });
            return;
        }

        this.setState({
            blockGenerationStatus: {
                type: 'loading',
                message: '正在生成扩展...'
            }
        });

        const filesForGeneration = selectedFiles.map(f => ({
            name: f.name,
            content: f.content
        }));

        const result = generateExtensionFromFiles(filesForGeneration);
        
        if (!result.success) {
            this.setState({
                blockGenerationStatus: {
                    type: 'error',
                    message: result.error
                }
            });
            return;
        }

        const { extension: extInfo } = result;

        if (!this.props.vm || !this.props.vm.extensionManager) {
            this.setState({
                blockGenerationStatus: {
                    type: 'error',
                    message: 'VM 未初始化，无法加载扩展'
                }
            });
            return;
        }

        try {
            const vm = this.props.vm;
            
            if (vm.extensionManager.isExtensionLoaded('pythonBlocks')) {
                console.log('Unloading existing Python extension');
                vm.extensionManager.unloadExtension('pythonBlocks');
            }
            
            const threads = [...vm.runtime.threads];
            for (const thread of threads) {
                vm.runtime.stopThread(thread);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));

            const wrappedCode = `
(function() {
    ${extInfo.extensionCode}
})();
`;
            const dataUrl = `data:application/javascript,${encodeURIComponent(wrappedCode)}`;
            
            manuallyTrustExtension(dataUrl);
            
            await vm.extensionManager.loadExtensionURL(dataUrl);
            
            setTimeout(() => {
                vm.refreshWorkspace();
                vm.emitWorkspaceUpdate();
            }, 100);

            this.setState({
                blockGenerationStatus: {
                    type: 'success',
                    message: `成功加载扩展！从 ${extInfo.fileCount} 个文件生成 ${extInfo.blockCount} 个积木`,
                    extensionId: extInfo.extensionId
                }
            });

        } catch (error) {
            console.error('Failed to load extension:', error);
            this.setState({
                blockGenerationStatus: {
                    type: 'error',
                    message: `加载扩展失败: ${error.message || '未知错误'}`
                }
            });
        }
    };

    getThemeColors() {
        const isDark = this.props.theme ? this.props.theme.isDark() : true;
        const guiColors = this.props.theme ? this.props.theme.getGuiColors() : {};
        
        return {
            bg: isDark ? '#1e1e1e' : '#ffffff',
            bgSecondary: isDark ? '#252526' : '#f3f3f3',
            bgTertiary: isDark ? '#2d2d2d' : '#e8e8e8',
            text: isDark ? '#cccccc' : '#333333',
            textSecondary: isDark ? '#858585' : '#666666',
            border: isDark ? '#3c3c3c' : '#ddd',
            accent: guiColors['accent-primary'] || (isDark ? '#855cd6' : '#4c97ff'),
            hover: isDark ? '#37373d' : '#f0f0f0',
            success: '#4caf50',
            warning: '#ff9800',
            error: '#f44336'
        };
    }

    componentWillUnmount() {
        if (this.editor) {
            this.editor.dispose();
        }
    }

    render() {
        const colors = this.getThemeColors();

        const containerStyle = {
            display: 'flex',
            height: '100%',
            width: '100%',
            backgroundColor: colors.bg,
            color: colors.text
        };

        const sidebarStyle = {
            width: '200px',
            backgroundColor: colors.bgSecondary,
            borderRight: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        };

        const sidebarHeaderStyle = {
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.bgTertiary
        };

        const fileListStyle = {
            flex: 1,
            overflow: 'auto',
            padding: '8px 0'
        };

        const fileItemStyle = (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            cursor: 'pointer',
            backgroundColor: isActive ? colors.hover : 'transparent',
            borderLeft: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
            transition: 'background-color 0.15s'
        });

        const fileIconStyle = (color) => ({
            width: '16px',
            height: '16px',
            borderRadius: '3px',
            backgroundColor: color,
            marginRight: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            color: color === '#f7df1e' || color === '#cbcb41' ? '#000' : '#fff'
        });

        const fileNameStyle = {
            flex: 1,
            fontSize: '13px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        };

        const fileActionsStyle = {
            display: 'flex',
            gap: '4px',
            opacity: 0,
            transition: 'opacity 0.15s'
        };

        const fileActionButtonStyle = {
            padding: '2px 4px',
            fontSize: '12px',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: colors.textSecondary
        };

        const newFileButtonStyle = {
            padding: '8px 16px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            backgroundColor: colors.bgSecondary,
            color: colors.textSecondary,
            fontSize: '13px',
            transition: 'background-color 0.15s'
        };

        const inputStyle = {
            width: '100%',
            padding: '6px 8px',
            fontSize: '13px',
            border: `1px solid ${colors.accent}`,
            borderRadius: '3px',
            backgroundColor: colors.bg,
            color: colors.text,
            outline: 'none'
        };

        const editorAreaStyle = {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        };

        const editorHeaderStyle = {
            padding: '8px 16px',
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.bgTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
        };

        const editorContainerStyle = {
            flex: 1,
            overflow: 'hidden'
        };

        const loadingStyle = {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: colors.text,
            fontSize: '1rem'
        };

        const errorStyle = {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#ff6680',
            fontSize: '1rem',
            padding: '1rem',
            textAlign: 'center'
        };

        const generateButtonStyle = {
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        };

        const statusMessageStyle = (type) => ({
            padding: '8px 16px',
            fontSize: '12px',
            backgroundColor: type === 'success' ? 'rgba(76, 175, 80, 0.2)' 
                : type === 'warning' ? 'rgba(255, 152, 0, 0.2)' 
                : type === 'loading' ? 'rgba(33, 150, 243, 0.2)'
                : 'rgba(244, 67, 54, 0.2)',
            color: type === 'success' ? colors.success 
                : type === 'warning' ? colors.warning 
                : type === 'loading' ? '#2196f3'
                : colors.error,
            borderBottom: `1px solid ${colors.border}`
        });

        if (this.state.isLoading) {
            return (
                <div style={containerStyle}>
                    <div style={loadingStyle}>
                        <FormattedMessage
                            defaultMessage="Loading editor..."
                            description="Loading message for Monaco Editor"
                            id="gui.monacoEditor.loading"
                        />
                    </div>
                </div>
            );
        }

        if (this.state.error) {
            return (
                <div style={containerStyle}>
                    <div style={errorStyle}>
                        <FormattedMessage
                            defaultMessage="Failed to load editor: {error}"
                            description="Error message for Monaco Editor"
                            id="gui.monacoEditor.error"
                            values={{ error: this.state.error }}
                        />
                    </div>
                </div>
            );
        }

        const activeFile = this.state.files.find(f => f.id === this.state.activeFileId);
        const activeExtension = activeFile ? getFileExtension(activeFile.name) : '';
        const isPythonFile = activeExtension === 'py';

        return (
            <React.Fragment>
            <div style={containerStyle}>
                <div style={sidebarStyle}>
                    <div style={sidebarHeaderStyle}>
                        <span style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>
                            <FormattedMessage
                                defaultMessage="FILES"
                                description="Header for file panel"
                                id="gui.monacoEditor.filesHeader"
                            />
                        </span>
                    </div>
                    <div style={fileListStyle}>
                        {this.state.files.map(file => {
                            const extension = getFileExtension(file.name);
                            const typeInfo = getFileTypeInfo(extension);
                            const isActive = file.id === this.state.activeFileId;
                            const isEditing = file.id === this.state.editingFileName;

                            return (
                                <div
                                    key={file.id}
                                    style={fileItemStyle(isActive)}
                                    onClick={() => !isEditing && this.selectFile(file.id)}
                                    onMouseEnter={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = colors.hover;
                                        const actionsEl = e.currentTarget.querySelector('.file-actions');
                                        if (actionsEl) actionsEl.style.opacity = '1';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                        const actionsEl = e.currentTarget.querySelector('.file-actions');
                                        if (actionsEl) actionsEl.style.opacity = '0';
                                    }}
                                >
                                    <div style={fileIconStyle(typeInfo.color)}>
                                        {extension.toUpperCase().slice(0, 2)}
                                    </div>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={this.state.newFileName}
                                            onChange={this.handleNewFileNameChange}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') this.handleRenameSubmit();
                                                if (e.key === 'Escape') this.handleRenameCancel();
                                            }}
                                            onBlur={this.handleRenameSubmit}
                                            autoFocus
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                    ) : (
                                        <span style={fileNameStyle}>{file.name}</span>
                                    )}
                                    {!isEditing && (
                                        <div className="file-actions" style={fileActionsStyle}>
                                            <button
                                                style={fileActionButtonStyle}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    this.startRenameFile(file.id);
                                                }}
                                                title="Rename"
                                            >
                                                ✎
                                            </button>
                                            <button
                                                style={fileActionButtonStyle}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    this.deleteFile(file.id);
                                                }}
                                                title="Delete"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {this.state.showNewFileInput ? (
                        <div style={{ padding: '8px 12px', borderTop: `1px solid ${colors.border}` }}>
                            <input
                                type="text"
                                placeholder="filename.py / filename.js / filename.json"
                                value={this.state.newFileName}
                                onChange={this.handleNewFileNameChange}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') this.handleNewFileSubmit();
                                    if (e.key === 'Escape') this.handleNewFileCancel();
                                }}
                                autoFocus
                                style={inputStyle}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                    onClick={this.handleNewFileSubmit}
                                    style={{
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        backgroundColor: colors.accent,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FormattedMessage
                                        defaultMessage="Create"
                                        description="Create file button"
                                        id="gui.monacoEditor.createFile"
                                    />
                                </button>
                                <button
                                    onClick={this.handleNewFileCancel}
                                    style={{
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        backgroundColor: 'transparent',
                                        color: colors.textSecondary,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '3px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FormattedMessage
                                        defaultMessage="Cancel"
                                        description="Cancel button"
                                        id="gui.monacoEditor.cancel"
                                    />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            style={newFileButtonStyle}
                            onClick={this.createNewFile}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bgSecondary}
                        >
                            <span style={{ fontSize: '16px' }}>+</span>
                            <FormattedMessage
                                defaultMessage="New File"
                                description="New file button"
                                id="gui.monacoEditor.newFile"
                            />
                        </div>
                    )}
                </div>
                <div style={editorAreaStyle}>
                    {activeFile && (
                        <div style={editorHeaderStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={fileIconStyle(getFileTypeInfo(activeExtension).color)}>
                                    {activeExtension.toUpperCase().slice(0, 2)}
                                </div>
                                <span style={{ fontSize: '13px' }}>{activeFile.name}</span>
                            </div>
                            <button
                                style={generateButtonStyle}
                                onClick={this.openFileSelectionModal}
                                title="选择 Python 文件生成 Scratch 积木"
                            >
                                <FormattedMessage
                                    defaultMessage="生成积木"
                                    description="Generate blocks button"
                                    id="gui.monacoEditor.generateBlocks"
                                />
                            </button>
                        </div>
                    )}
                    {this.state.blockGenerationStatus && (
                        <div style={statusMessageStyle(this.state.blockGenerationStatus.type)}>
                            {this.state.blockGenerationStatus.message}
                        </div>
                    )}
                    <div
                        ref={this.containerRef}
                        style={editorContainerStyle}
                    />
                </div>
            </div>
            {this.state.showFileSelectionModal && this.renderFileSelectionModal()}
            </React.Fragment>
        );
    }

    renderFileSelectionModal = () => {
        const colors = this.getThemeColors();
        const pythonFiles = this.state.files.filter(f => f.name.endsWith('.py'));
        const allSelected = pythonFiles.length > 0 && this.state.selectedFileIds.length === pythonFiles.length;

        const modalBodyStyle = {
            padding: '12px',
            maxHeight: '280px',
            overflowY: 'auto'
        };

        const fileItemStyle = {
            display: 'flex',
            alignItems: 'center',
            padding: '8px 10px',
            marginBottom: '6px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
            border: `1px solid ${colors.border}`
        };

        const checkboxStyle = {
            marginRight: '10px',
            width: '16px',
            height: '16px',
            cursor: 'pointer',
            accentColor: '#66ccff'
        };

        const fileNameStyle = {
            fontSize: '13px',
            fontWeight: '500',
            color: colors.text
        };

        const functionCountStyle = {
            fontSize: '11px',
            color: colors.textSecondary,
            marginLeft: '8px'
        };

        const headerStyle = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            borderBottom: `1px solid ${colors.border}`
        };

        const selectAllButtonStyle = {
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            background: allSelected ? '#66ccff' : 'transparent',
            border: `1px solid ${allSelected ? '#66ccff' : colors.border}`,
            color: allSelected ? '#fff' : colors.textSecondary,
            borderRadius: '4px'
        };

        const buttonRowStyle = {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '12px',
            borderTop: `1px solid ${colors.border}`
        };

        const cancelButtonStyle = {
            padding: '6px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            color: colors.textSecondary,
            borderRadius: '4px'
        };

        const confirmButtonStyle = {
            padding: '6px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            background: '#66ccff',
            border: 'none',
            color: '#fff',
            borderRadius: '4px',
            fontWeight: '500'
        };

        const selectAllPythonFiles = () => {
            if (allSelected) {
                this.setState({ selectedFileIds: [] });
            } else {
                this.setState({ selectedFileIds: pythonFiles.map(f => f.id) });
            }
        };

        return (
            <Modal
                className="file-selection-modal"
                contentLabel="选择 Python 文件"
                onRequestClose={this.closeFileSelectionModal}
                id="fileSelectionModal"
            >
                <Box style={{ background: colors.bgSecondary }}>
                    <div style={headerStyle}>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                            选择要生成积木的 Python 文件
                        </span>
                        <button style={selectAllButtonStyle} onClick={selectAllPythonFiles}>
                            {allSelected ? '取消全选' : '全选'}
                        </button>
                    </div>
                    <div style={modalBodyStyle}>
                        {pythonFiles.map(file => {
                            const isSelected = this.state.selectedFileIds.includes(file.id);
                            const validationResult = validatePythonCode(file.content);
                            const funcCount = validationResult?.parseResult?.exportedFunctions?.length || 0;

                            return (
                                <div
                                    key={file.id}
                                    style={{
                                        ...fileItemStyle,
                                        backgroundColor: isSelected ? 'rgba(102, 204, 255, 0.15)' : colors.bgSecondary
                                    }}
                                    onClick={() => this.toggleFileSelection(file.id)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => this.toggleFileSelection(file.id)}
                                        style={checkboxStyle}
                                    />
                                    <span style={fileNameStyle}>{file.name}</span>
                                    <span style={functionCountStyle}>
                                        {funcCount > 0 ? `${funcCount} 函数` : '无导出'}
                                    </span>
                                </div>
                            );
                        })}
                        {pythonFiles.length === 0 && (
                            <p style={{ color: colors.textSecondary, textAlign: 'center', padding: '20px' }}>
                                没有 Python 文件
                            </p>
                        )}
                    </div>
                    <div style={buttonRowStyle}>
                        <button style={cancelButtonStyle} onClick={this.closeFileSelectionModal}>
                            取消
                        </button>
                        <button 
                            style={{
                                ...confirmButtonStyle,
                                opacity: this.state.selectedFileIds.length > 0 ? 1 : 0.5,
                                cursor: this.state.selectedFileIds.length > 0 ? 'pointer' : 'not-allowed'
                            }}
                            onClick={this.state.selectedFileIds.length > 0 ? this.confirmFileSelectionAndGenerate : undefined}
                            disabled={this.state.selectedFileIds.length === 0}
                        >
                            生成 ({this.state.selectedFileIds.length})
                        </button>
                    </div>
                </Box>
            </Modal>
        );
    };
}

MonacoEditorComponent.propTypes = {
    intl: intlShape.isRequired,
    theme: PropTypes.instanceOf(Theme),
    vm: PropTypes.instanceOf(VM),
    onBlocksGenerated: PropTypes.func
};

MonacoEditorComponent.defaultProps = {
    theme: Theme.dark,
    onBlocksGenerated: null
};

export default injectIntl(MonacoEditorComponent);