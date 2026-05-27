import { parsePythonFunctions } from './python-parser';

const toCamelCase = (str) => {
    return str
        .split('_')
        .map((word, index) => 
            index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join('');
};

const generatePythonExtension = (parseResult, fullCode, extensionId = 'pythonExtension') => {
    const exportedFunctions = parseResult.exportedFunctions;
    if (exportedFunctions.length === 0) {
        return null;
    }

    const safeExtensionId = toCamelCase(extensionId);
    const extensionName = 'Python Extension';
    const blocks = [];

    exportedFunctions.forEach(func => {
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

        blocks.push({
            opcode: blockId,
            blockType: blockType,
            text: blockText,
            arguments: blockArgs,
            funcName: func.name,
            argsCode: argsCode
        });
    });

    const blocksCode = blocks.map(b => {
        const blockTypeStr = `Scratch.BlockType.${b.blockType.toUpperCase()}`;
        return `                {
                    opcode: '${b.opcode}',
                    blockType: ${blockTypeStr},
                    text: '${b.text}',
                    arguments: ${JSON.stringify(b.arguments)}
                }`;
    }).join(',\n');

    const methodsCode = blocks.map(b => `
    async ${b.opcode}(args, util) {
        if (!window._pyodideReady || !window._pyodideInstance) {
            await initPyodide();
        }
        try {
            const func = window._pyodideInstance.globals.get('${b.funcName}');
            if (func) {
                const pyResult = await func(${b.argsCode});
                return pyResult;
            }
            return null;
        } catch (error) {
            console.error('Python execution error:', error);
            return null;
        }
    }`).join('\n');

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
            window._pythonExtensionCode = ${JSON.stringify(fullCode)};
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
                id: '${safeExtensionId}',
                name: '${extensionName}',
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

    return {
        extensionId: safeExtensionId,
        extensionCode,
        blockCount: exportedFunctions.length,
        functionNames: exportedFunctions.map(f => f.name)
    };
};

const generateExtensionFromPythonCode = (pythonCode, fileName = null) => {
    const parseResult = parsePythonFunctions(pythonCode);
    
    if (!parseResult.hasExports) {
        return {
            success: false,
            error: 'No __all__ export list found. Add __all__ = ["function_name"] to your code.',
            parseResult
        };
    }

    if (parseResult.exportedFunctions.length === 0) {
        return {
            success: false,
            error: 'Functions specified in __all__ were not found in the code.',
            parseResult
        };
    }

    let baseId = 'pythonExt';
    if (fileName) {
        const safeFileName = fileName
            .replace(/\.py$/i, '')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .split('_')
            .map((word, index) => 
                index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');
        baseId = `py${safeFileName.charAt(0).toUpperCase() + safeFileName.slice(1)}`;
    }
    
    const id = `${baseId}${Date.now()}`;
    const extension = generatePythonExtension(parseResult, pythonCode, id);

    if (!extension) {
        return {
            success: false,
            error: 'Failed to generate extension.',
            parseResult
        };
    }

    return {
        success: true,
        extension,
        parseResult
    };
};

export {
    generatePythonExtension,
    generateExtensionFromPythonCode
};