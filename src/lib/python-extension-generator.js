import { parsePythonFunctions } from './python-parser';

const toCamelCase = (str) => {
    return str
        .split('_')
        .map((word, index) => 
            index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join('');
};

const generateMultiFileExtension = (filesData) => {
    if (!filesData || filesData.length === 0) {
        return null;
    }

    const allBlocks = [];
    const allMethods = [];
    const allPythonCode = [];
    const fileLabels = [];

    filesData.forEach(fileData => {
        const { fileName, parseResult, fullCode } = fileData;
        
        if (parseResult.exportedFunctions.length === 0) {
            return;
        }

        allPythonCode.push(`# File: ${fileName}\n${fullCode}`);

        const labelBlockId = `label_${toCamelCase(fileName.replace('.py', ''))}`;
        fileLabels.push({
            blockId: labelBlockId,
            labelText: fileName.replace('.py', '')
        });

        allBlocks.push({
            opcode: labelBlockId,
            blockType: 'label',
            text: fileName.replace('.py', '')
        });

        parseResult.exportedFunctions.forEach(func => {
            const blockId = toCamelCase(func.name);
            const blockText = func.name + (func.parameters.length > 0 
                ? ' ' + func.parameters.map(p => `[${p.name.toUpperCase()}]`).join(' ')
                : '');
            
            const blockArgs = {};
            func.parameters.forEach(param => {
                blockArgs[param.name.toUpperCase()] = {
                    type: 'string',
                    defaultValue: ''
                };
            });

            const argsCode = func.parameters.map(p => `args.${p.name.toUpperCase()}`).join(', ');
            const blockType = func.returnType || 'command';

            allBlocks.push({
                opcode: blockId,
                blockType: blockType,
                text: blockText,
                arguments: blockArgs
            });

            allMethods.push({
                opcode: blockId,
                funcName: func.name,
                argsCode: argsCode
            });
        });
    });

    if (allBlocks.length === 0) {
        return null;
    }

    const blocksCode = allBlocks.map(b => {
        if (b.blockType === 'label') {
            return `                {
                    opcode: '${b.opcode}',
                    blockType: Scratch.BlockType.LABEL,
                    text: '${b.text}'
                }`;
        }
        const blockTypeStr = `Scratch.BlockType.${b.blockType.toUpperCase()}`;
        return `                {
                    opcode: '${b.opcode}',
                    blockType: ${blockTypeStr},
                    text: '${b.text}',
                    arguments: ${JSON.stringify(b.arguments)}
                }`;
    }).join(',\n');

    const methodsCode = allMethods.map(m => `
    async ${m.opcode}(args, util) {
        if (!window._pyodideReady || !window._pyodideInstance) {
            await initPyodide();
        }
        try {
            const func = window._pyodideInstance.globals.get('${m.funcName}');
            if (func) {
                const pyResult = await func(${m.argsCode});
                return pyResult;
            }
            return null;
        } catch (error) {
            console.error('Python execution error:', error);
            return null;
        }
    }`).join('\n');

    const combinedPythonCode = allPythonCode.join('\n\n');

    const extensionCode = `
(function() {
    async function initPyodide() {
        if (window._pyodideInstance) {
            window._pyodideReady = true;
            return window._pyodideInstance;
        }
        try {
            window._pyodideInstance = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            window._pyodideReady = true;
            window._pythonExtensionCode = ${JSON.stringify(combinedPythonCode)};
            await window._pyodideInstance.runPythonAsync(window._pythonExtensionCode);
            console.log('Pyodide initialized successfully');
            return window._pyodideInstance;
        } catch (error) {
            console.error('Failed to initialize Pyodide:', error);
            window._pyodideReady = false;
            throw error;
        }
    }

    class PythonExtension {
        getInfo() {
            return {
                id: 'pythonBlocks',
                name: 'Python',
                color1: '#66ccff',
                color2: '#55aadd',
                color3: '#4499cc',
                blocks: [
${blocksCode}
                ]
            };
        }
${methodsCode}
    }

    Scratch.extensions.register(new PythonExtension());
})();
`;

    const totalBlocks = allBlocks.filter(b => b.blockType !== 'label').length;

    return {
        extensionId: 'pythonBlocks',
        extensionCode,
        blockCount: totalBlocks,
        fileCount: filesData.length,
        fileNames: filesData.map(f => f.fileName)
    };
};

const generateExtensionFromFiles = (files) => {
    const filesData = [];
    
    for (const file of files) {
        if (!file.content || !file.name.endsWith('.py')) {
            continue;
        }
        
        const parseResult = parsePythonFunctions(file.content);
        
        if (!parseResult.hasExports || parseResult.exportedFunctions.length === 0) {
            continue;
        }
        
        filesData.push({
            fileName: file.name,
            parseResult,
            fullCode: file.content
        });
    }

    if (filesData.length === 0) {
        return {
            success: false,
            error: 'No valid Python files with __all__ exports found.'
        };
    }

    const extension = generateMultiFileExtension(filesData);

    if (!extension) {
        return {
            success: false,
            error: 'Failed to generate extension.'
        };
    }

    return {
        success: true,
        extension,
        filesData
    };
};

export {
    generateMultiFileExtension,
    generateExtensionFromFiles
};