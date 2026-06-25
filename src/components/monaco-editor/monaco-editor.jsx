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
import classNames from 'classnames';
import styles from './monaco-editor.css';

let monaco = null;

const FILE_TYPE_COLORS = {
    js: { color: '#f7df1e', name: 'JavaScript' },
    py: { color: '#3776ab', name: 'Python' },
    glsl: { color: '#5c6bc0', name: 'GLSL' },
    frag: { color: '#5c6bc0', name: 'Fragment Shader' },
    vert: { color: '#5c6bc0', name: 'Vertex Shader' },
    json: { color: '#cbcb41', name: 'JSON' }
};

const getDefaultCode = (locale, extension) => {
    const isZh = locale && (locale.startsWith('zh') || locale === 'zh-cn' || locale === 'zh-tw');
    
    const codes = {
        js: isZh ? `// JavaScript 代码示例
function hello() {
    console.log("你好，世界！");
}

hello();
` : `// JavaScript code example
function hello() {
    console.log("Hello, World!");
}

hello();
`,
        py: isZh ? `# ============================================
# Python 扩展开发入门指南
# ============================================
# 本文件将教你如何在 Scratch 中使用 Python 功能
# 
# 【重要提示】
# 1. 运行 Python 积木前，必须先执行 "init python" 积木，首次初始化需要联网，而且初始化可能会导致些许卡顿，这是内置库正在加载与编译
# 2. 使用 "init success?" 检查是否初始化完成，初始化完成之后才可以执行代码
# 3. 只有 __all__ 列表中的函数才会生成积木
# ============================================

import json
from pyodide.http import pyfetch

# ============================================
# 第一部分：JSON 数据处理
# ============================================
# JSON 是最常用的数据交换格式，学会处理 JSON 很重要

def json_get(data_str, key):
    """
    从 JSON 数据中获取指定键的值
    
    使用场景：
    - 解析 API 返回的数据
    - 读取配置文件
    - 处理游戏存档数据
    
    参数：
        data_str: JSON 字符串，例如 '{"name":"小明","score":100}'
        key: 要获取的键名，例如 "name"
    
    返回：
        键对应的值（字符串形式）
    
    Scratch 使用示例：
        说 (json_get '{"name":"小明"}' 'name')
        → 显示 "小明"
    """
    data = json.loads(data_str)
    value = data.get(key)
    return str(value) if value is not None else "未找到"


def json_set(data_str, key, value):
    """
    在 JSON 数据中设置或更新一个键值
    
    使用场景：
    - 修改配置数据
    - 更新游戏状态
    - 构建要发送的数据
    
    参数：
        data_str: 原始 JSON 字符串
        key: 要设置的键名
        value: 要设置的值
    
    返回：
        更新后的 JSON 字符串
    
    Scratch 使用示例：
        设 [data] 为 (json_set '{"name":"小明"}' 'age' '18')
        → data 变为 '{"name":"小明","age":"18"}'
    """
    data = json.loads(data_str)
    data[key] = value
    return json.dumps(data)


# ============================================
# 第二部分：网络请求（GET）
# ============================================
# 通过 HTTP GET 请求获取网络数据
# 注意：只能访问允许跨域的 API

async def http_get(url):
    """
    发送 HTTP GET 请求并获取响应内容
    
    使用场景：
    - 获取天气数据
    - 获取随机笑话、名言
    - 获取游戏排行榜
    
    参数：
        url: 要请求的网址
    
    返回：
        响应内容（字符串）
    
    Scratch 使用示例：
        当绿旗被点击
        init python
        等待直到 <init success?>
        设 [response] 为 (http_get 'https://api.example.com/data')
    
    推荐的免费 API：
    - 随机名言：https://api.quotable.io/random
    - 随机笑话：https://official-joke-api.appspot.com/random_joke
    """
    try:
        response = await pyfetch(url)
        content = await response.string()
        return content
    except Exception as e:
        return f"请求失败: {str(e)}"


async def http_get_json(url):
    """
    发送 GET 请求并直接返回解析后的 JSON 对象
    
    使用场景：
    - 直接获取 API 返回的 JSON 数据
    - 无需再调用 json_get 解析
    
    参数：
        url: 返回 JSON 数据的 API 地址
    
    返回：
        解析后的 JSON 数据（字符串形式）
    
    Scratch 使用示例：
        设 [data] 为 (http_get_json 'https://api.example.com/json')
        设 [name] 为 (json_get [data] 'name')
    """
    try:
        response = await pyfetch(url)
        data = await response.json()
        return json.dumps(data)
    except Exception as e:
        return f"请求失败: {str(e)}"


# ============================================
# 导出列表
# ============================================
# 只有写在这里的函数才会变成 Scratch 积木
# 你可以添加更多函数到这个列表中

__all__ = [
    "json_get",
    "json_set",
    "http_get",
    "http_get_json"
]

# ============================================
# 扩展阅读：如何添加自己的函数
# ============================================
# 
# 1. 定义函数：
#    def my_function(param1, param2):
#        # 你的代码
#        return result
#
# 2. 添加到 __all__：
#    __all__ = ["json_get", "my_function"]
#
# 3. 函数类型说明：
#    - 返回值的函数 → 报告积木（圆形）
#    - 返回 True/False → 布尔积木（六边形）
#    - 不返回值 → 命令积木（方形）
#
# 4. async 函数说明：
#    - 使用 async def 定义的函数可以等待网络请求
#    - Scratch 会自动处理异步
# ============================================
` : `# ============================================
# Python Extension Development Guide
# ============================================
# This file teaches you how to use Python in Scratch
# 
# 【IMPORTANT NOTES】
# 1. Before running Python blocks, you must execute the "init python" block first. Initial initialization requires internet, and may cause slight lag as built-in libraries are loading and compiling
# 2. Use "init success?" to check if initialization is complete. Code can only be executed after initialization
# 3. Only functions in the __all__ list will generate blocks
# ============================================

import json
from pyodide.http import pyfetch

# ============================================
# Part 1: JSON Data Processing
# ============================================
# JSON is the most common data exchange format, learning to handle JSON is important

def json_get(data_str, key):
    """
    Get a value from JSON data by key
    
    Use cases:
    - Parse API returned data
    - Read configuration files
    - Process game save data
    
    Parameters:
        data_str: JSON string, e.g. '{"name":"John","score":100}'
        key: Key name to get, e.g. "name"
    
    Returns:
        The value corresponding to the key (as string)
    
    Scratch usage example:
        say (json_get '{"name":"John"}' 'name')
        → displays "John"
    """
    data = json.loads(data_str)
    value = data.get(key)
    return str(value) if value is not None else "Not found"


def json_set(data_str, key, value):
    """
    Set or update a key-value pair in JSON data
    
    Use cases:
    - Modify configuration data
    - Update game state
    - Build data to send
    
    Parameters:
        data_str: Original JSON string
        key: Key name to set
        value: Value to set
    
    Returns:
        Updated JSON string
    
    Scratch usage example:
        set [data] to (json_set '{"name":"John"}' 'age' '18')
        → data becomes '{"name":"John","age":"18"}'
    """
    data = json.loads(data_str)
    data[key] = value
    return json.dumps(data)


# ============================================
# Part 2: Network Requests (GET)
# ============================================
# Get network data via HTTP GET requests
# Note: Only APIs that allow CORS can be accessed

async def http_get(url):
    """
    Send HTTP GET request and get response content
    
    Use cases:
    - Get weather data
    - Get random jokes, quotes
    - Get game leaderboards
    
    Parameters:
        url: URL to request
    
    Returns:
        Response content (string)
    
    Scratch usage example:
        when green flag clicked
        init python
        wait until <init success?>
        set [response] to (http_get 'https://api.example.com/data')
    
    Recommended free APIs:
    - Random quotes: https://api.quotable.io/random
    - Random jokes: https://official-joke-api.appspot.com/random_joke
    """
    try:
        response = await pyfetch(url)
        content = await response.string()
        return content
    except Exception as e:
        return f"Request failed: {str(e)}"


async def http_get_json(url):
    """
    Send GET request and return parsed JSON object directly
    
    Use cases:
    - Get JSON data returned by API directly
    - No need to call json_get to parse
    
    Parameters:
        url: API address that returns JSON data
    
    Returns:
        Parsed JSON data (string form)
    
    Scratch usage example:
        set [data] to (http_get_json 'https://api.example.com/json')
        set [name] to (json_get [data] 'name')
    """
    try:
        response = await pyfetch(url)
        data = await response.json()
        return json.dumps(data)
    except Exception as e:
        return f"Request failed: {str(e)}"


# ============================================
# Export List
# ============================================
# Only functions listed here will become Scratch blocks
# You can add more functions to this list

__all__ = [
    "json_get",
    "json_set",
    "http_get",
    "http_get_json"
]

# ============================================
# Extended Reading: How to Add Your Own Functions
# ============================================
# 
# 1. Define function:
#    def my_function(param1, param2):
#        # your code
#        return result
#
# 2. Add to __all__:
#    __all__ = ["json_get", "my_function"]
#
# 3. Function type notes:
#    - Functions that return values → Reporter blocks (round)
#    - Functions that return True/False → Boolean blocks (hexagonal)
#    - Functions that don't return → Command blocks (square)
#
# 4. async function notes:
#    - Functions defined with async def can wait for network requests
#    - Scratch handles async automatically
# ============================================
`,
        glsl: `// GLSL shader example
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
        json: isZh ? `{
    "name": "示例配置",
    "version": "1.0.0",
    "settings": {
        "enabled": true,
        "count": 10
    }
}
` : `{
    "name": "Example Config",
    "version": "1.0.0",
    "settings": {
        "enabled": true,
        "count": 10
    }
}
`
    };
    
    return codes[extension] || '';
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
        this.saveTimeout = null;
        this.state = {
            files: [],
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
            showFileSelectionModal: false,
            showSettingsModal: false,
            fontSize: 14,
            editorSettings: {
                tabSize: 4,
                wordWrap: 'on',
                matchBrackets: 'always',
                minimapEnabled: true,
                lineNumbers: 'on',
                smoothScrolling: true,
                folding: true
            },
            projectLoaded: false
        };
    }

    loadFilesFromProject = () => {
        const vm = this.props.vm;
        if (!vm || !vm.runtime) return;

        try {
            const metadata = vm.runtime.getProjectMetadata();
            if (metadata && metadata.custom && metadata.custom.file) {
                const savedFiles = metadata.custom.file;
                if (Array.isArray(savedFiles) && savedFiles.length > 0) {
                    const files = savedFiles.map(f => ({
                        id: generateId(),
                        name: f.name,
                        content: f.content
                    }));
                    this.setState({
                        files,
                        activeFileId: files[0].id,
                        projectLoaded: true
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to load files from project:', e);
        }

        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
        this.setState({
            files: [],
            activeFileId: null,
            projectLoaded: true
        });
    };

    saveFilesToProject = () => {
        const vm = this.props.vm;
        if (!vm || !vm.runtime) return;

        const filesToSave = this.state.files.map(f => ({
            name: f.name,
            content: f.content
        }));

        try {
            vm.runtime.addCustomEntrie('file', filesToSave);
        } catch (e) {
            console.warn('Failed to save files to project:', e);
        }
    };

    scheduleSave = () => {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveFilesToProject();
        }, 500);
    };

    zoomIn = () => {
        this.setState(prevState => {
            const newSize = Math.min(prevState.fontSize + 2, 32);
            if (this.editor) {
                this.editor.updateOptions({ fontSize: newSize });
            }
            return { fontSize: newSize };
        });
    };

    zoomOut = () => {
        this.setState(prevState => {
            const newSize = Math.max(prevState.fontSize - 2, 8);
            if (this.editor) {
                this.editor.updateOptions({ fontSize: newSize });
            }
            return { fontSize: newSize };
        });
    };

    resetZoom = () => {
        if (this.editor) {
            this.editor.updateOptions({ fontSize: 14 });
        }
        this.setState({ fontSize: 14 });
    };

    getFiles = () => {
        return this.state.files.map(f => ({ id: f.id, name: f.name, content: f.content }));
    };

    getActiveFile = () => {
        const activeFile = this.state.files.find(f => f.id === this.state.activeFileId);
        return activeFile ? { id: activeFile.id, name: activeFile.name, content: activeFile.content } : null;
    };

    getPythonFiles = () => {
        return this.state.files
            .filter(f => f.name.endsWith('.py'))
            .map(f => ({ id: f.id, name: f.name, content: f.content }));
    };

    getFileByName = (fileName) => {
        const file = this.state.files.find(f => f.name === fileName);
        return file ? { id: file.id, name: file.name, content: file.content } : null;
    };

    getFileContent = (fileName) => {
        const file = this.state.files.find(f => f.name === fileName);
        return file ? file.content : null;
    };

    getFileNames = () => {
        return this.state.files.map(f => f.name);
    };

    componentDidMount() {
        window._editorApi = {
            getFiles: this.getFiles,
            getActiveFile: this.getActiveFile,
            getPythonFiles: this.getPythonFiles,
            getFileByName: this.getFileByName,
            getFileContent: this.getFileContent,
            getFileNames: this.getFileNames,
            zoomIn: this.zoomIn,
            zoomOut: this.zoomOut,
            resetZoom: this.resetZoom
        };
        if (this.props.onEditorReady) {
            this.props.onEditorReady(window._editorApi);
        }
        this.initMonaco();

        const vm = this.props.vm;
        if (vm && vm.runtime) {
            vm.runtime.on('PROJECT_LOADED', this.loadFilesFromProject);
            if (vm.runtime.getProjectMetadata()) {
                this.loadFilesFromProject();
            }
        }
    }

    async initMonaco() {
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
        if (!prevState.isLoading && this.state.isLoading === false && !this.editor && this.containerRef.current && this.state.files.length > 0) {
            this.initEditor();
        }
        if (!prevState.isLoading && this.state.isLoading === false && !this.editor && this.containerRef.current && prevState.files.length === 0 && this.state.files.length > 0) {
            this.initEditor();
        }

        if (prevState.files !== this.state.files && this.state.projectLoaded) {
            this.scheduleSave();
        }

        if (!prevProps.vm && this.props.vm && this.props.vm.runtime) {
            this.props.vm.runtime.on('PROJECT_LOADED', this.loadFilesFromProject);
            if (this.props.vm.runtime.getProjectMetadata()) {
                this.loadFilesFromProject();
            }
        }
    }

    componentWillUnmount() {
        const vm = this.props.vm;
        if (vm && vm.runtime) {
            vm.runtime.off('PROJECT_LOADED', this.loadFilesFromProject);
        }
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveFilesToProject();
        }
        if (this.editor) {
            this.editor.dispose();
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
        const isDark = this.props.theme && this.props.theme.isDark();
        const themeName = isDark ? 'scratch-dark' : 'scratch-light';

        // 每次都重新定义，确保 CSS 变量值为最新
        this.defineMonacoThemes();

        return themeName;
    }

    getCssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    // 将 CSS 颜色值（含 color-mix/rgb/hsl 等）解析为 Monaco 可接受的 #RRGGBB 格式
    resolveColor(cssColor) {
        if (!cssColor) return null;
        const el = this._colorEl || (this._colorEl = document.createElement('div'));
        el.style.color = cssColor;
        document.body.appendChild(el);
        const computed = getComputedStyle(el).color;
        document.body.removeChild(el);
        // "rgb(r, g, b)" -> "#rrggbb"
        const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return '#' + [match[1], match[2], match[3]]
                .map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
        }
        return null;
    }

    // 将颜色与背景色按 alpha 混合，返回 #RRGGBB
    blendColor(hexColor, alpha, bgHex) {
        if (!hexColor) return null;
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const br = parseInt(bgHex.slice(1, 3), 16);
        const bg = parseInt(bgHex.slice(3, 5), 16);
        const bb = parseInt(bgHex.slice(5, 7), 16);
        const mr = Math.round(r * alpha + br * (1 - alpha));
        const mg = Math.round(g * alpha + bg * (1 - alpha));
        const mb = Math.round(b * alpha + bb * (1 - alpha));
        return '#' + [mr, mg, mb].map(n => n.toString(16).padStart(2, '0')).join('');
    }

    defineMonacoThemes() {
        const looksSecondary = this.resolveColor(this.getCssVar('--looks-secondary')) || '#4C97FF';
        const looksSecondaryDark = this.resolveColor(this.getCssVar('--looks-secondary-dark')) || looksSecondary;
        const textPrimary = this.resolveColor(this.getCssVar('--text-primary')) || '#24292E';
        const uiPrimary = this.resolveColor(this.getCssVar('--ui-primary')) || '#FFFFFF';
        const uiSecondary = this.resolveColor(this.getCssVar('--ui-secondary')) || '#F6F8FA';
        const uiTertiary = this.resolveColor(this.getCssVar('--ui-tertiary')) || '#E1E4E8';

        // 亮色主题
        monaco.editor.defineTheme('scratch-light', {
            base: 'vs',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6A737D' },
                { token: 'keyword', foreground: 'D73A49' },
                { token: 'string', foreground: '032F62' },
                { token: 'number', foreground: '005CC5' },
                { token: 'type', foreground: '6F42C1' },
                { token: 'function', foreground: '6F42C1' },
                { token: 'variable', foreground: 'E36209' },
                { token: 'constant', foreground: '005CC5' },
                { token: 'identifier', foreground: textPrimary },
            ],
            colors: {
                'editor.background': uiPrimary,
                'editor.foreground': textPrimary,
                'editor.lineHighlightBackground': uiSecondary,
                'editor.lineHighlightBorder': 'transparent',
                'editor.selectionBackground': this.blendColor(looksSecondary, 0.25, uiPrimary),
                'editor.selectionHighlightBackground': this.blendColor(looksSecondary, 0.19, uiPrimary),
                'editor.inactiveSelectionBackground': uiTertiary,
                'editorCursor.foreground': textPrimary,
                'editorLineNumber.foreground': uiTertiary,
                'editorLineNumber.activeForeground': textPrimary,
                'editorIndentGuide.background': uiTertiary,
                'editorIndentGuide.activeBackground': looksSecondary,
                'editorBracketMatch.background': this.blendColor(looksSecondary, 0.13, uiPrimary),
                'editorBracketMatch.border': looksSecondary,
                'editorGutter.background': uiPrimary,
                'editorWhitespace.foreground': uiTertiary,
                'editorWidget.background': uiPrimary,
                'editorWidget.border': uiTertiary,
                'input.background': uiPrimary,
                'input.border': uiTertiary,
                'input.foreground': textPrimary,
                'editorOverviewRuler.border': 'transparent',
                'editorLink.activeForeground': looksSecondary,
                'scrollbar.shadow': 'transparent',
                'scrollbarSlider.background': this.blendColor(uiTertiary, 0.25, uiPrimary),
                'scrollbarSlider.hoverBackground': this.blendColor(uiTertiary, 0.4, uiPrimary),
                'scrollbarSlider.activeBackground': this.blendColor(looksSecondary, 0.25, uiPrimary),
                'scrollbarSlider.border': 'transparent',
                'minimap.findMatchHighlight': this.blendColor(looksSecondary, 0.31, uiPrimary),
                'minimap.background': uiPrimary,
                'minimap.selectionHighlight': this.blendColor(looksSecondary, 0.19, uiPrimary),
                'editorError.foreground': '#CF222E',
                'editorWarning.foreground': '#9A6700',
                'editorInfo.foreground': '#0550AE',
                'diffEditor.insertedTextBackground': this.blendColor('#2DA44E', 0.15, uiPrimary),
                'diffEditor.removedTextBackground': this.blendColor('#CF222E', 0.15, uiPrimary),
            }
        });

        // 暗色主题
        const darkBg = uiPrimary || '#0D1117';
        const darkSurface = uiSecondary || '#161B22';
        monaco.editor.defineTheme('scratch-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6A737D' },
                { token: 'keyword', foreground: 'F97583' },
                { token: 'string', foreground: 'A5D6FF' },
                { token: 'number', foreground: '79C0FF' },
                { token: 'type', foreground: 'D2A8FF' },
                { token: 'function', foreground: 'D2A8FF' },
                { token: 'variable', foreground: 'FFA657' },
                { token: 'constant', foreground: '79C0FF' },
                { token: 'identifier', foreground: '#E6EDF3' },
            ],
            colors: {
                'editor.background': darkBg,
                'editor.foreground': '#E6EDF3',
                'editor.lineHighlightBackground': darkSurface,
                'editor.lineHighlightBorder': 'transparent',
                'editor.selectionBackground': this.blendColor(looksSecondaryDark, 0.25, darkBg),
                'editor.selectionHighlightBackground': this.blendColor(looksSecondaryDark, 0.19, darkBg),
                'editor.inactiveSelectionBackground': uiTertiary || '#21262D',
                'editorCursor.foreground': '#E6EDF3',
                'editorLineNumber.foreground': '#484F58',
                'editorLineNumber.activeForeground': '#E6EDF3',
                'editorIndentGuide.background': '#21262D',
                'editorIndentGuide.activeBackground': looksSecondaryDark,
                'editorBracketMatch.background': this.blendColor(looksSecondaryDark, 0.13, darkBg),
                'editorBracketMatch.border': looksSecondaryDark,
                'editorGutter.background': darkBg,
                'editorWhitespace.foreground': '#21262D',
                'editorWidget.background': darkSurface,
                'editorWidget.border': uiTertiary || '#30363D',
                'input.background': darkSurface,
                'input.border': uiTertiary || '#30363D',
                'input.foreground': '#E6EDF3',
                'scrollbar.shadow': 'transparent',
                'scrollbarSlider.background': this.blendColor('#30363D', 0.4, darkBg),
                'scrollbarSlider.hoverBackground': this.blendColor('#30363D', 0.6, darkBg),
                'scrollbarSlider.activeBackground': this.blendColor(looksSecondaryDark, 0.25, darkBg),
                'scrollbarSlider.border': 'transparent',
                'minimap.findMatchHighlight': this.blendColor(looksSecondaryDark, 0.31, darkBg),
                'minimap.background': darkBg,
                'minimap.selectionHighlight': this.blendColor(looksSecondaryDark, 0.19, darkBg),
                'editorOverviewRuler.border': 'transparent',
                'editorLink.activeForeground': looksSecondaryDark,
                'editorError.foreground': '#F85149',
                'editorWarning.foreground': '#D29922',
                'editorInfo.foreground': '#58A6FF',
                'diffEditor.insertedTextBackground': this.blendColor('#3FB950', 0.15, darkBg),
                'diffEditor.removedTextBackground': this.blendColor('#F85149', 0.15, darkBg),
            }
        });
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
            const value = activeFile ? activeFile.content : '';
            this.editor = monaco.editor.create(this.containerRef.current, {
                value,
                language: getFileLanguage(extension),
                theme: this.getEditorTheme(),
                minimap: {
                    enabled: true,
                    scale: 1,
                    showSlider: 'mouseover',
                    renderCharacters: true,
                    maxColumn: 120
                },
                fontSize: this.state.fontSize,
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
        const { newFileName, files } = this.state;
        if (!newFileName.trim()) return;

        let finalName = newFileName.trim();
        const existingNames = files.map(f => f.name);
        
        if (existingNames.includes(finalName)) {
            const extension = getFileExtension(finalName);
            const baseName = extension ? finalName.slice(0, -(extension.length + 1)) : finalName;
            let counter = 1;
            while (existingNames.includes(`${baseName}_${counter}${extension ? '.' + extension : ''}`)) {
                counter++;
            }
            finalName = `${baseName}_${counter}${extension ? '.' + extension : ''}`;
        }

        const extension = getFileExtension(finalName);
        const locale = this.props.intl && this.props.intl.locale;
        const defaultContent = getDefaultCode(locale, extension);
        const newFile = {
            id: generateId(),
            name: finalName,
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
        const { editingFileName, newFileName, files } = this.state;
        if (!newFileName.trim()) return;

        let finalName = newFileName.trim();
        const existingNames = files.filter(f => f.id !== editingFileName).map(f => f.name);
        
        if (existingNames.includes(finalName)) {
            const extension = getFileExtension(finalName);
            const baseName = extension ? finalName.slice(0, -(extension.length + 1)) : finalName;
            let counter = 1;
            while (existingNames.includes(`${baseName}_${counter}${extension ? '.' + extension : ''}`)) {
                counter++;
            }
            finalName = `${baseName}_${counter}${extension ? '.' + extension : ''}`;
        }

        this.setState(prevState => ({
            files: prevState.files.map(f =>
                f.id === editingFileName ? { ...f, name: finalName } : f
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

    openSettingsModal = () => {
        this.setState({ showSettingsModal: true });
    };

    closeSettingsModal = () => {
        this.setState({ showSettingsModal: false });
    };

    updateEditorOption = (option, value) => {
        if (option === 'fontSize') {
            this.setState({ fontSize: value });
            if (this.editor) {
                this.editor.updateOptions({ fontSize: value });
            }
        } else if (option === 'minimapEnabled') {
            this.setState(prevState => ({
                editorSettings: { ...prevState.editorSettings, minimapEnabled: value }
            }));
            if (this.editor) {
                this.editor.updateOptions({ minimap: { enabled: value } });
            }
        } else {
            this.setState(prevState => ({
                editorSettings: { ...prevState.editorSettings, [option]: value }
            }));
            if (this.editor) {
                this.editor.updateOptions({ [option]: value });
            }
        }
    };

    renderSettingsModal = () => {
        const { editorSettings, fontSize } = this.state;

        return (
            <Modal
                className="settings-modal"
                contentLabel={this.props.intl.formatMessage({ id: 'gui.monacoEditor.settings' })}
                onRequestClose={this.closeSettingsModal}
                id="monacoSettingsModal"
            >
                <Box className={styles.settingsModalContent}>
                    <div className={styles.settingsSection}>
                        <span className={styles.settingsSectionTitle}>
                            <FormattedMessage
                                defaultMessage="Editor"
                                id="gui.monacoEditor.settingsEditor"
                            />
                        </span>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Font Size"
                                id="gui.monacoEditor.settingsFontSize"
                            />
                            </label>
                            <input
                                type="number"
                                className={styles.settingsNumber}
                                min={8}
                                max={32}
                                step={2}
                                value={fontSize}
                                onChange={e => {
                                    const val = parseInt(e.target.value, 10);
                                    if (val >= 8 && val <= 32) {
                                        this.updateEditorOption('fontSize', val);
                                    }
                                }}
                            />
                        </div>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Tab Size"
                                id="gui.monacoEditor.settingsTabSize"
                            />
                            </label>
                            <select
                                className={styles.settingsSelect}
                                value={editorSettings.tabSize}
                                onChange={e => this.updateEditorOption('tabSize', parseInt(e.target.value, 10))}
                            >
                                <option value={2}>2</option>
                                <option value={4}>4</option>
                                <option value={8}>8</option>
                            </select>
                        </div>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Word Wrap"
                                id="gui.monacoEditor.settingsWordWrap"
                            />
                            </label>
                            <input
                                type="checkbox"
                                className={styles.settingsCheckbox}
                                checked={editorSettings.wordWrap === 'on'}
                                onChange={e => this.updateEditorOption('wordWrap', e.target.checked ? 'on' : 'off')}
                            />
                        </div>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Bracket Matching"
                                id="gui.monacoEditor.settingsBracketMatching"
                            />
                            </label>
                            <select
                                className={styles.settingsSelect}
                                value={editorSettings.matchBrackets}
                                onChange={e => this.updateEditorOption('matchBrackets', e.target.value)}
                            >
                                <option value="always">Always</option>
                                <option value="near">Near</option>
                                <option value="never">Never</option>
                            </select>
                        </div>
                    </div>
                    <div className={styles.settingsSection}>
                        <span className={styles.settingsSectionTitle}>
                            <FormattedMessage
                                defaultMessage="View"
                                id="gui.monacoEditor.settingsView"
                            />
                        </span>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Minimap"
                                id="gui.monacoEditor.settingsMinimap"
                            />
                            </label>
                            <input
                                type="checkbox"
                                className={styles.settingsCheckbox}
                                checked={editorSettings.minimapEnabled}
                                onChange={e => this.updateEditorOption('minimapEnabled', e.target.checked)}
                            />
                        </div>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Line Numbers"
                                id="gui.monacoEditor.settingsLineNumbers"
                            />
                            </label>
                            <select
                                className={styles.settingsSelect}
                                value={editorSettings.lineNumbers}
                                onChange={e => this.updateEditorOption('lineNumbers', e.target.value)}
                            >
                                <option value="on">On</option>
                                <option value="off">Off</option>
                                <option value="relative">Relative</option>
                            </select>
                        </div>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Smooth Scrolling"
                                id="gui.monacoEditor.settingsSmoothScrolling"
                            />
                            </label>
                            <input
                                type="checkbox"
                                className={styles.settingsCheckbox}
                                checked={editorSettings.smoothScrolling}
                                onChange={e => this.updateEditorOption('smoothScrolling', e.target.checked)}
                            />
                        </div>
                        <div className={styles.settingsRow}>
                            <label className={styles.settingsLabel}>
                            <FormattedMessage
                                defaultMessage="Folding"
                                id="gui.monacoEditor.settingsFolding"
                            />
                            </label>
                            <input
                                type="checkbox"
                                className={styles.settingsCheckbox}
                                checked={editorSettings.folding}
                                onChange={e => this.updateEditorOption('folding', e.target.checked)}
                            />
                        </div>
                    </div>
                </Box>
            </Modal>
        );
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
                    message: 'Python 扩展已成功加载！请先运行 "init python" 积木初始化环境',
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

    render() {
        if (this.state.isLoading) {
            return (
                <div className={styles.editorWrapper}>
                    <div className={styles.loading}>
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
                <div className={styles.editorWrapper}>
                    <div className={styles.error}>
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
            <div className={styles.editorWrapper}>
                <div className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>
                        <span className={styles.sidebarTitle}>
                            <FormattedMessage
                                defaultMessage="FILES"
                                description="Header for file panel"
                                id="gui.monacoEditor.filesHeader"
                            />
                        </span>
                    </div>
                    <div className={styles.fileList}>
                        {this.state.files.map(file => {
                            const extension = getFileExtension(file.name);
                            const typeInfo = getFileTypeInfo(extension);
                            const isActive = file.id === this.state.activeFileId;
                            const isEditing = file.id === this.state.editingFileName;
                            const isLightIcon = typeInfo.color === '#f7df1e' || typeInfo.color === '#cbcb41';

                            return (
                                <div
                                    key={file.id}
                                    className={classNames(styles.fileItem, { [styles.active]: isActive })}
                                    onClick={() => !isEditing && this.selectFile(file.id)}
                                >
                                    <div
                                        className={classNames(styles.fileIcon, { [styles.lightText]: isLightIcon })}
                                        style={{ backgroundColor: typeInfo.color }}
                                    >
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
                                            className={classNames(styles.newFileInput, styles.renameInput)}
                                        />
                                    ) : (
                                        <span className={styles.fileName}>{file.name}</span>
                                    )}
                                    {!isEditing && (
                                        <div className={styles.fileActions}>
                                            <button
                                                className={styles.fileActionBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    this.startRenameFile(file.id);
                                                }}
                                                title={this.props.intl.formatMessage({ id: 'gui.monacoEditor.rename' })}
                                            >
                                                ✎
                                            </button>
                                            <button
                                                className={styles.fileActionBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    this.deleteFile(file.id);
                                                }}
                                                title={this.props.intl.formatMessage({ id: 'gui.monacoEditor.delete' })}
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
                        <div className={styles.newFileSection}>
                            <input
                                type="text"
                                placeholder={this.props.intl.formatMessage({
                                    defaultMessage: 'filename.py / filename.js / filename.json',
                                    id: 'gui.monacoEditor.fileNamePlaceholder'
                                })}
                                value={this.state.newFileName}
                                onChange={this.handleNewFileNameChange}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') this.handleNewFileSubmit();
                                    if (e.key === 'Escape') this.handleNewFileCancel();
                                }}
                                autoFocus
                                className={styles.newFileInput}
                            />
                            <div className={styles.newFileActions}>
                                <button
                                    onClick={this.handleNewFileSubmit}
                                    className={styles.newFileBtnCreate}
                                >
                                    <FormattedMessage
                                        defaultMessage="Create"
                                        description="Create file button"
                                        id="gui.monacoEditor.createFile"
                                    />
                                </button>
                                <button
                                    onClick={this.handleNewFileCancel}
                                    className={styles.newFileBtnCancel}
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
                            className={styles.newFileTrigger}
                            onClick={this.createNewFile}
                        >
                            <span className={styles.newFileIcon}>+</span>
                            <FormattedMessage
                                defaultMessage="New File"
                                description="New file button"
                                id="gui.monacoEditor.newFile"
                            />
                        </div>
                    )}
                </div>
                <div className={styles.editorArea}>
                    {activeFile && (
                        <div className={styles.editorHeader}>
                            <div className={styles.editorHeaderLeft}>
                                <div
                                    className={classNames(styles.fileIcon, { [styles.lightText]: getFileTypeInfo(activeExtension).color === '#f7df1e' || getFileTypeInfo(activeExtension).color === '#cbcb41' })}
                                    style={{ backgroundColor: getFileTypeInfo(activeExtension).color }}
                                >
                                    {activeExtension.toUpperCase().slice(0, 2)}
                                </div>
                                <span className={styles.editorFilename}>{activeFile.name}</span>
                            </div>
                            <div className={styles.editorHeaderRight}>
                                <div className={styles.zoomControl}>
                                    <button
                                        onClick={this.zoomOut}
                                        className={styles.zoomBtn}
                                        title={this.props.intl.formatMessage({ id: 'gui.monacoEditor.zoomOut' })}
                                    >
                                        −
                                    </button>
                                    <span className={styles.zoomValue}>
                                        {this.state.fontSize}px
                                    </span>
                                    <button
                                        onClick={this.zoomIn}
                                        className={styles.zoomBtn}
                                        title={this.props.intl.formatMessage({ id: 'gui.monacoEditor.zoomIn' })}
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    className={styles.settingsBtn}
                                    onClick={this.openSettingsModal}
                                    title={this.props.intl.formatMessage({ id: 'gui.monacoEditor.settings' })}
                                >
                                    &#9881;
                                </button>
                                <button
                                    className={styles.generateBtn}
                                    onClick={this.openFileSelectionModal}
                                    title={this.props.intl.formatMessage({ id: 'gui.monacoEditor.generateBlocksTooltip' })}
                                >
                                    <FormattedMessage
                                        defaultMessage="生成积木"
                                        description="Generate blocks button"
                                        id="gui.monacoEditor.generateBlocks"
                                    />
                                </button>
                            </div>
                        </div>
                    )}
                    {!activeFile && this.state.files.length === 0 && (
                        <div className={styles.emptyState}>
                            <FormattedMessage
                                defaultMessage="No files yet"
                                description="Empty state message"
                                id="gui.monacoEditor.noFiles"
                            />
                            <span className={styles.emptyStateHint}>
                                <FormattedMessage
                                    defaultMessage="Click 'New File' to create one"
                                    description="Empty state hint"
                                    id="gui.monacoEditor.createFileHint"
                                />
                            </span>
                        </div>
                    )}
                    {this.state.blockGenerationStatus && (
                        <div className={classNames(styles.statusMessage, styles[this.state.blockGenerationStatus.type])}>
                            {this.state.blockGenerationStatus.message}
                        </div>
                    )}
                    {(activeFile || this.state.files.length > 0) && (
                        <div
                            ref={this.containerRef}
                            className={styles.editorContent}
                        />
                    )}
                </div>
            </div>
            {this.state.showFileSelectionModal && this.renderFileSelectionModal()}
            {this.state.showSettingsModal && this.renderSettingsModal()}
            </React.Fragment>
        );
    }

    renderFileSelectionModal = () => {
        const pythonFiles = this.state.files.filter(f => f.name.endsWith('.py'));
        const allSelected = pythonFiles.length > 0 && this.state.selectedFileIds.length === pythonFiles.length;

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
                contentLabel={this.props.intl.formatMessage({ id: 'gui.monacoEditor.selectFiles' })}
                onRequestClose={this.closeFileSelectionModal}
                id="fileSelectionModal"
            >
                <Box className={styles.modalBox}>
                    <div className={styles.modalHeader}>
                        <span className={styles.modalTitle}>
                            <FormattedMessage
                                defaultMessage="Select Python files to generate blocks"
                                id="gui.monacoEditor.selectFiles"
                            />
                        </span>
                        <button
                            className={classNames(styles.selectAllBtn, { [styles.selected]: allSelected })}
                            onClick={selectAllPythonFiles}
                        >
                            {allSelected ? (
                                <FormattedMessage
                                    defaultMessage="Deselect all"
                                    id="gui.monacoEditor.deselectAll"
                                />
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Select all"
                                    id="gui.monacoEditor.selectAll"
                                />
                            )}
                        </button>
                    </div>
                    <div className={styles.modalBody}>
                        {pythonFiles.map(file => {
                            const isSelected = this.state.selectedFileIds.includes(file.id);
                            const validationResult = validatePythonCode(file.content);
                            const funcCount = validationResult?.parseResult?.exportedFunctions?.length || 0;

                            return (
                                <div
                                    key={file.id}
                                    className={classNames(styles.modalFileItem, { [styles.selected]: isSelected })}
                                    onClick={() => this.toggleFileSelection(file.id)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => this.toggleFileSelection(file.id)}
                                        className={styles.modalCheckbox}
                                    />
                                    <span className={styles.modalFileName}>{file.name}</span>
                                    <span className={styles.modalFunctionCount}>
                                        {funcCount > 0 ? (
                                            <FormattedMessage
                                                defaultMessage="{count} functions"
                                                id="gui.monacoEditor.functionCount"
                                                values={{ count: funcCount }}
                                            />
                                        ) : (
                                            <FormattedMessage
                                                defaultMessage="No exports"
                                                id="gui.monacoEditor.noExports"
                                            />
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                        {pythonFiles.length === 0 && (
                            <p className={styles.modalEmptyText}>
                                <FormattedMessage
                                    defaultMessage="No Python files"
                                    id="gui.monacoEditor.noPythonFiles"
                                />
                            </p>
                        )}
                    </div>
                    <div className={styles.modalButtons}>
                        <button className={styles.modalCancelBtn} onClick={this.closeFileSelectionModal}>
                            <FormattedMessage
                                defaultMessage="Cancel"
                                description="Cancel button"
                                id="gui.monacoEditor.cancel"
                            />
                        </button>
                        <button
                            className={classNames(styles.modalConfirmBtn, { [styles.disabled]: this.state.selectedFileIds.length === 0 })}
                            onClick={this.state.selectedFileIds.length > 0 ? this.confirmFileSelectionAndGenerate : undefined}
                            disabled={this.state.selectedFileIds.length === 0}
                        >
                            <FormattedMessage
                                defaultMessage="Generate ({count})"
                                id="gui.monacoEditor.generateCount"
                                values={{ count: this.state.selectedFileIds.length }}
                            />
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