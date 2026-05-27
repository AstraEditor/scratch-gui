const analyzeReturnType = (functionBody) => {
    const returnRegex = /return\s+(.+)/g;
    const returnMatch = functionBody.match(returnRegex);
    
    if (!returnMatch) {
        const hasEmptyReturn = /return\s*$/.test(functionBody);
        if (hasEmptyReturn) {
            return 'command';
        }
        return 'command';
    }
    
    const returnValues = [];
    let match;
    const returnValueRegex = /return\s+(.+)$/gm;
    while ((match = returnValueRegex.exec(functionBody)) !== null) {
        returnValues.push(match[1].trim());
    }
    
    if (returnValues.length === 0) {
        return 'command';
    }
    
    const booleanPatterns = [
        /^True$/i,
        /^False$/i,
        /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(==|!=|<=|>=|<|>|is|is\s+not)\s*.+$/,
        /^\s*.+\s*(==|!=|<=|>=|<|>|is|is\s+not)\s*[a-zA-Z_][a-zA-Z0-9_]*$/,
        /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s+(and|or)\s+.+$/,
        /^\s*.+\s+(and|or)\s+[a-zA-Z_][a-zA-Z0-9_]*$/,
        /^\s*not\s+.+$/,
        /^\s*\(.+\s*(==|!=|<=|>=|<|>|and|or|is)\s*.+\)\s*$/
    ];
    
    for (const returnValue of returnValues) {
        let isBoolean = false;
        for (const pattern of booleanPatterns) {
            if (pattern.test(returnValue)) {
                isBoolean = true;
                break;
            }
        }
        if (isBoolean) {
            return 'boolean';
        }
    }
    
    return 'reporter';
};

const parsePythonFunctions = (code) => {
    const functions = [];
    const exportedFunctions = [];
    
    const functionRegex = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*:/g;
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
        const functionName = match[1];
        const paramsStr = match[2].trim();
        
        const parameters = [];
        if (paramsStr) {
            const params = paramsStr.split(',').map(p => p.trim());
            for (const param of params) {
                if (param && !param.startsWith('*')) {
                    const paramName = param.split('=')[0].trim();
                    if (paramName) {
                        parameters.push({
                            name: paramName,
                            hasDefault: param.includes('=')
                        });
                    }
                }
            }
        }
        
        const startIndex = match.index;
        let endIndex = startIndex;
        const lines = code.substring(startIndex).split('\n');
        let indentLevel = null;
        let functionBody = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (i === 0) {
                functionBody += line + '\n';
                continue;
            }
            
            if (line.trim() === '') {
                functionBody += line + '\n';
                continue;
            }
            
            const currentIndent = line.search(/\S/);
            
            if (indentLevel === null) {
                indentLevel = currentIndent;
            }
            
            if (currentIndent < indentLevel && line.trim() !== '') {
                break;
            }
            
            functionBody += line + '\n';
            endIndex = startIndex + functionBody.length - 1;
        }
        
        const returnType = analyzeReturnType(functionBody);
        
        functions.push({
            name: functionName,
            parameters,
            body: functionBody.trim(),
            returnType,
            startIndex,
            endIndex
        });
    }
    
    const allRegex = /__all__\s*=\s*\[([^\]]+)\]/;
    const allMatch = code.match(allRegex);
    
    if (allMatch) {
        const exportsStr = allMatch[1];
        const exports = exportsStr.split(',')
            .map(e => e.trim().replace(/['"]/g, '').trim())
            .filter(e => e.length > 0);
        
        for (const func of functions) {
            if (exports.includes(func.name)) {
                exportedFunctions.push(func);
            }
        }
    }
    
    return {
        allFunctions: functions,
        exportedFunctions,
        hasExports: allMatch !== null
    };
};

const generateBlockDefinition = (func) => {
    const blockId = `python_${func.name}_${Date.now()}`;
    
    const argumentIds = func.parameters.map((p, i) => `arg${i}`);
    const argumentNames = func.parameters.map(p => p.name);
    const argumentDefaults = func.parameters.map(p => p.hasDefault ? '' : '');
    
    const procCode = func.name + (func.parameters.length > 0 
        ? ' ' + func.parameters.map(p => `%${p.name}`).join(' ')
        : '');
    
    return {
        opcode: 'procedures_definition',
        blockId,
        inputs: {
            custom_block: {
                opcode: 'procedures_prototype',
                inputs: argumentIds.map((id, i) => ({
                    id,
                    name: argumentNames[i],
                    defaultValue: argumentDefaults[i]
                })),
                procCode
            }
        },
        mutation: {
            proccode: procCode,
            argumentids: JSON.stringify(argumentIds),
            argumentnames: JSON.stringify(argumentNames),
            argumentdefaults: JSON.stringify(argumentDefaults),
            warp: 'false',
            storedpythoncode: func.body
        },
        name: func.name,
        parameters: func.parameters,
        pythonCode: func.body
    };
};

const validatePythonCode = (code) => {
    const errors = [];
    
    const syntaxPatterns = [
        { regex: /def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*:/g, message: 'Function definition' },
        { regex: /__all__\s*=\s*\[[^\]]*\]/g, message: 'Export list' }
    ];
    
    const parseResult = parsePythonFunctions(code);
    
    if (parseResult.exportedFunctions.length === 0 && parseResult.hasExports) {
        errors.push({
            type: 'warning',
            message: '__all__ 中指定的函数未找到定义'
        });
    }
    
    if (!parseResult.hasExports && parseResult.allFunctions.length > 0) {
        errors.push({
            type: 'info',
            message: '未定义 __all__，请添加导出列表以创建积木'
        });
    }
    
    for (const func of parseResult.exportedFunctions) {
        if (func.parameters.length > 10) {
            errors.push({
                type: 'warning',
                message: `函数 ${func.name} 参数过多 (${func.parameters.length})，建议不超过 10 个`
            });
        }
    }
    
    return {
        valid: errors.filter(e => e.type === 'error').length === 0,
        errors,
        parseResult
    };
};

export {
    parsePythonFunctions,
    generateBlockDefinition,
    validatePythonCode
};