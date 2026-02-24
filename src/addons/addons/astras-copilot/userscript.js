export default async function () {
    // ==UserScript==
    // @name        AstrasCopilot v4.0 with ScratchDSL
    // @namespace   https://astras.copilot.local
    // @match       *://turbowarp.org/*
    // @match       *://turbowarp.org/editor*
    // @match       *://studio.penguinmod.com/*
    // @match       *://studio.penguinmod.com/editor.html*
    // @icon        https://astras.copilot.local/logo.png
    // @grant       GM_addElement
    // @grant       GM_addStyle
    // @license     MIT
    // @version     4.0.0
    // @author      Astras / Modified with ScratchDSL Integration
    // @description  AI copilot for Scratch mods with native ScratchDSL code generation and one-click import to workspace.
    // ==/UserScript==

    (function() {
        'use strict';

        // ==========================================
        // PART 1: ScratchDSL Core (Embedded)
        // ==========================================

        const ScratchDSL = (function() {
            const variables = new Map();
            const lists = new Map();

            function generateId() {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%()*+,-./:;=?@[]^_`{|}~';
                let id = '';
                for (let i = 0; i < 20; i++) {
                    id += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return id;
            }

            function getVariableId(name) {
                if (!variables.has(name)) variables.set(name, generateId());
                return variables.get(name);
            }

            function getListId(name) {
                if (!lists.has(name)) lists.set(name, generateId());
                return lists.get(name);
            }

            function clearVariables() {
                variables.clear();
                lists.clear();
            }

            const BLOCK_VALUES = {
                'control_repeat': ['TIMES'],
                'control_repeat_until': ['CONDITION'],
                'control_while': ['CONDITION'],
                'control_for_each': ['VALUE'],
                'control_forever': [],
                'control_wait': ['DURATION'],
                'control_wait_until': ['CONDITION'],
                'control_if': ['CONDITION'],
                'control_if_else': ['CONDITION'],
                'control_stop': [],
                'control_create_clone_of': ['CLONE_OPTION'],
                'control_delete_this_clone': [],
                'control_all_at_once': [],
                'event_whenflagclicked': [],
                'event_whenkeypressed': ['KEY_OPTION'],
                'event_whentouchingobject': ['TOUCHINGOBJECTMENU'],
                'event_broadcast': ['BROADCAST_INPUT'],
                'event_broadcastandwait': ['BROADCAST_INPUT'],
                'event_whengreaterthan': ['VALUE'],
                'looks_say': ['MESSAGE'],
                'looks_sayforsecs': ['MESSAGE', 'SECS'],
                'looks_think': ['MESSAGE'],
                'looks_thinkforsecs': ['MESSAGE', 'SECS'],
                'looks_show': [],
                'looks_hide': [],
                'looks_switchcostumeto': ['COSTUME'],
                'looks_switchbackdropto': ['BACKDROP'],
                'looks_switchbackdroptoandwait': ['BACKDROP'],
                'looks_nextcostume': [],
                'looks_nextbackdrop': [],
                'looks_changeeffectby': ['CHANGE'],
                'looks_seteffectto': ['VALUE'],
                'looks_cleargraphiceffects': [],
                'looks_changesizeby': ['CHANGE'],
                'looks_setsizeto': ['SIZE'],
                'looks_gotofrontback': [],
                'looks_goforwardbackwardlayers': ['NUM'],
                'motion_movesteps': ['STEPS'],
                'motion_gotoxy': ['X', 'Y'],
                'motion_goto': ['TO'],
                'motion_turnright': ['DEGREES'],
                'motion_turnleft': ['DEGREES'],
                'motion_pointindirection': ['DIRECTION'],
                'motion_pointtowards': ['TOWARDS'],
                'motion_glidesecstoxy': ['SECS', 'X', 'Y'],
                'motion_glideto': ['SECS', 'TO'],
                'motion_ifonedgebounce': [],
                'motion_setrotationstyle': [],
                'motion_changexby': ['DX'],
                'motion_setx': ['X'],
                'motion_changeyby': ['DY'],
                'motion_sety': ['Y'],
                'operator_add': ['NUM1', 'NUM2'],
                'operator_subtract': ['NUM1', 'NUM2'],
                'operator_multiply': ['NUM1', 'NUM2'],
                'operator_divide': ['NUM1', 'NUM2'],
                'operator_lt': ['OPERAND1', 'OPERAND2'],
                'operator_equals': ['OPERAND1', 'OPERAND2'],
                'operator_gt': ['OPERAND1', 'OPERAND2'],
                'operator_and': ['OPERAND1', 'OPERAND2'],
                'operator_or': ['OPERAND1', 'OPERAND2'],
                'operator_not': ['OPERAND'],
                'operator_random': ['FROM', 'TO'],
                'operator_join': ['STRING1', 'STRING2'],
                'operator_letter_of': ['STRING', 'LETTER'],
                'operator_length': ['STRING'],
                'operator_contains': ['STRING1', 'STRING2'],
                'operator_mod': ['NUM1', 'NUM2'],
                'operator_round': ['NUM'],
                'operator_mathop': ['NUM'],
                'sound_play': ['SOUND_MENU'],
                'sound_playuntildone': ['SOUND_MENU'],
                'sound_stopallsounds': [],
                'sound_setvolumeto': ['VOLUME'],
                'sound_changevolumeby': ['VOLUME'],
                'sensing_touchingobject': ['TOUCHINGOBJECTMENU'],
                'sensing_touchingcolor': ['COLOR'],
                'sensing_coloristouchingcolor': ['COLOR', 'COLOR2'],
                'sensing_distanceto': ['DISTANCETOMENU'],
                'sensing_timer': [],
                'sensing_resettimer': [],
                'sensing_of': ['OBJECT'],
                'sensing_mousex': [],
                'sensing_mousey': [],
                'sensing_keypressed': ['KEY_OPTION'],
                'sensing_current': [],
                'sensing_dayssince2000': [],
                'sensing_loudness': [],
                'sensing_askandwait': ['QUESTION'],
                'sensing_answer': [],
                'data_variable': [],
                'data_setvariableto': ['VALUE'],
                'data_changevariableby': ['VALUE'],
                'data_listcontents': [],
                'data_addtolist': ['ITEM'],
                'data_deleteoflist': ['INDEX'],
                'data_deletealloflist': [],
                'data_insertatlist': ['INDEX', 'ITEM'],
                'data_replaceitemoflist': ['INDEX', 'ITEM'],
                'data_itemoflist': ['INDEX'],
                'data_itemnumoflist': ['ITEM'],
                'data_lengthoflist': [],
                'data_listcontainsitem': ['ITEM'],
            };

            const SHADOW_TYPE = {
                'TIMES': 'math_whole_number',
                'STEPS': 'math_number',
                'DEGREES': 'math_number',
                'DURATION': 'math_number',
                'SECS': 'math_number',
                'X': 'math_number',
                'Y': 'math_number',
                'DX': 'math_number',
                'DY': 'math_number',
                'DISTANCE': 'math_number',
                'CHANGE': 'math_number',
                'SIZE': 'math_number',
                'NUM': 'math_number',
                'NUM1': 'math_number',
                'NUM2': 'math_number',
                'FROM': 'math_number',
                'TO': 'math_number',
                'LETTER': 'math_integer',
                'INDEX': 'math_integer',
                'VALUE': 'math_number',
                'MESSAGE': 'text',
                'STRING': 'text',
                'STRING1': 'text',
                'STRING2': 'text',
                'ITEM': 'text',
                'QUESTION': 'text',
                'CONDITION': 'text',
                'OPERAND': 'text',
                'OPERAND1': 'text',
                'OPERAND2': 'text',
                'TOWARDS': 'motion_pointtowards_menu',
                'COSTUME': 'looks_costume',
                'BACKDROP': 'looks_backdrops',
                'CLONE_OPTION': 'control_create_clone_of_menu',
                'TOUCHINGOBJECTMENU': 'sensing_touchingobjectmenu',
                'DISTANCETOMENU': 'sensing_distancetomenu',
                'KEY_OPTION': 'sensing_keyoptions',
                'SOUND_MENU': 'sound_sounds_menu',
                'OBJECT': 'sensing_of_object_menu',
                'COLOR': 'colour_picker',
                'COLOR2': 'colour_picker',
                'BROADCAST_INPUT': 'event_broadcast_menu',
            };

            const SPECIAL_SHADOW = {
                'motion_goto__TO': 'motion_goto_menu',
                'motion_glideto__TO': 'motion_glideto_menu',
                'motion_pointtowards__TOWARDS': 'motion_pointtowards_menu',
                'looks_switchcostumeto__COSTUME': 'looks_costume',
                'looks_switchbackdropto__BACKDROP': 'looks_backdrops',
                'control_create_clone_of__CLONE_OPTION': 'control_create_clone_of_menu',
                'sensing_touchingobject__TOUCHINGOBJECTMENU': 'sensing_touchingobjectmenu',
                'sensing_distanceto__DISTANCETOMENU': 'sensing_distancetomenu',
                'event_broadcast__BROADCAST_INPUT': 'event_broadcast_menu',
                'event_broadcastandwait__BROADCAST_INPUT': 'event_broadcast_menu',
                'sound_play__SOUND_MENU': 'sound_sounds_menu',
                'sound_playuntildone__SOUND_MENU': 'sound_sounds_menu',
                'sensing_of__OBJECT': 'sensing_of_object_menu',
            };

            const FIELD_NAME_MAP = {
                'math_whole_number': 'NUM',
                'math_number': 'NUM',
                'math_integer': 'NUM',
                'math_positive_number': 'NUM',
                'text': 'TEXT',
                'looks_costume': 'COSTUME',
                'looks_backdrops': 'BACKDROP',
                'motion_goto_menu': 'TO',
                'motion_glideto_menu': 'TO',
                'motion_pointtowards_menu': 'TOWARDS',
                'control_create_clone_of_menu': 'CLONE_OPTION',
                'sensing_touchingobjectmenu': 'TOUCHINGOBJECTMENU',
                'sensing_distancetomenu': 'DISTANCETOMENU',
                'sensing_keyoptions': 'KEY_OPTION',
                'event_broadcast_menu': 'BROADCAST_INPUT',
                'sound_sounds_menu': 'SOUND_MENU',
                'sensing_of_object_menu': 'OBJECT',
                'colour_picker': 'COLOUR',
            };

            function isAllUpperCase(str) {
                return /^[A-Z_]+$/.test(str);
            }

            function isNumeric(str) {
                return /^-?\d+(\.\d+)?$/.test(str);
            }

            function isQuotedString(str) {
                return /^".*"$|^'.*'$/.test(str);
            }

            function getShadowType(blockType, valueName) {
                const key = `${blockType}__${valueName}`;
                return SPECIAL_SHADOW[key] || SHADOW_TYPE[valueName] || 'text';
            }

            function getFieldName(shadowType) {
                return FIELD_NAME_MAP[shadowType] || 'TEXT';
            }

            function createDefaultShadow(doc, blockType, valueName, defaultValue = '') {
                const shadowType = getShadowType(blockType, valueName);
                const shadowEl = doc.createElement('shadow');
                shadowEl.setAttribute('type', shadowType);
                shadowEl.setAttribute('id', generateId());

                const fieldName = getFieldName(shadowType);
                const fieldEl = doc.createElement('field');
                fieldEl.setAttribute('name', fieldName);

                let val = defaultValue;
                if (shadowType.startsWith('math_')) {
                    val = String(Number(val) || 0);
                }
                fieldEl.textContent = val;
                shadowEl.appendChild(fieldEl);
                return shadowEl;
            }

            function setValueWithAutoShadow(doc, blockEl, valueName, valueStr) {
                let valueEl = blockEl.querySelector(`value[name="${valueName}"]`);
                if (!valueEl) {
                    valueEl = doc.createElement('value');
                    valueEl.setAttribute('name', valueName);
                    blockEl.appendChild(valueEl);
                }

                const oldShadow = valueEl.querySelector('shadow');
                if (oldShadow) valueEl.removeChild(oldShadow);

                const blockType = blockEl.getAttribute('type');
                const defaultShadowType = getShadowType(blockType, valueName);

                let shadowType;
                let fieldValue = valueStr;
                const isNum = isNumeric(valueStr);

                if (defaultShadowType.startsWith('math_') || defaultShadowType === 'text') {
                    if (isNum) {
                        shadowType = 'math_number';
                    } else {
                        shadowType = 'text';
                        if (!isQuotedString(valueStr)) {
                            fieldValue = `"${valueStr}"`;
                        }
                    }
                } else {
                    shadowType = defaultShadowType;
                    fieldValue = valueStr.replace(/^["']|["']$/g, '');
                }

                const shadowEl = doc.createElement('shadow');
                shadowEl.setAttribute('type', shadowType);
                shadowEl.setAttribute('id', generateId());

                const fieldName = getFieldName(shadowType);
                const fieldEl = doc.createElement('field');
                fieldEl.setAttribute('name', fieldName);

                if (shadowType.startsWith('math_')) {
                    fieldEl.textContent = String(Number(fieldValue) || 0);
                } else {
                    fieldEl.textContent = fieldValue.replace(/^["']|["']$/g, '');
                }
                shadowEl.appendChild(fieldEl);
                valueEl.appendChild(shadowEl);
            }

            function cleanEmptyNext(el) {
                Array.from(el.children).forEach(child => {
                    if (child.tagName === 'next' && child.children.length === 0) {
                        el.removeChild(child);
                    } else {
                        cleanEmptyNext(child);
                    }
                });
            }

            function parse(text) {
                const doc = document.implementation.createDocument(null, null, null);
                const root = doc.createElement('xml');
                root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                doc.appendChild(root);

                const lines = text.split('\n')
                .map(l => l.trimEnd())
                .filter(l => l.trim() && !l.trim().startsWith('#'));

                const getIndent = line => (line.match(/^(\s*)/) || ['', ''])[1].length;
                const stack = [{ element: root, type: 'xml', indent: -1 }];

                // Collect variable/list declarations
                const varDeclLines = lines.filter(line => {
                    const tokens = line.trim().split(/\s+/);
                    return tokens[0] === 'VARIABLE' || tokens[0] === 'LIST';
                });

                varDeclLines.forEach(line => {
                    const tokens = line.trim().split(/\s+/);
                    const cmd = tokens[0];
                    if (cmd === 'VARIABLE') {
                        const name = tokens[1].replace(/^["']|["']$/g, '');
                        getVariableId(name);
                    } else if (cmd === 'LIST') {
                        const name = tokens[1].replace(/^["']|["']$/g, '');
                        getListId(name);
                    }
                });

                if (variables.size > 0 || lists.size > 0) {
                    const varsEl = doc.createElement('variables');
                    variables.forEach((id, name) => {
                        const varEl = doc.createElement('variable');
                        varEl.setAttribute('type', '');
                        varEl.setAttribute('id', id);
                        varEl.setAttribute('islocal', 'false');
                        varEl.setAttribute('iscloud', 'false');
                        varEl.textContent = name;
                        varsEl.appendChild(varEl);
                    });
                    lists.forEach((id, name) => {
                        const varEl = doc.createElement('variable');
                        varEl.setAttribute('type', 'list');
                        varEl.setAttribute('id', id);
                        varEl.setAttribute('islocal', 'false');
                        varEl.setAttribute('iscloud', 'false');
                        varEl.textContent = name;
                        varsEl.appendChild(varEl);
                    });
                    root.insertBefore(varsEl, root.firstChild);
                }

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const indent = getIndent(line);
                    const tokens = line.trim().split(/\s+/);
                    const cmd = tokens[0];

                    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                        stack.pop();
                    }
                    const parent = stack[stack.length - 1];

                    if (cmd === 'VARIABLE' || cmd === 'LIST') continue;

                    switch (cmd) {
                        case 'BLOCK': {
                            const blockType = tokens[1];
                            const blockEl = doc.createElement('block');
                            blockEl.setAttribute('type', blockType);
                            blockEl.setAttribute('id', generateId());

                            const atIdx = tokens.indexOf('AT');
                            if (atIdx > 0 && tokens[atIdx + 1]) {
                                const [x, y] = tokens[atIdx + 1].split(',');
                                blockEl.setAttribute('x', x);
                                blockEl.setAttribute('y', y);
                            }

                            const requiredValues = BLOCK_VALUES[blockType] || [];
                            requiredValues.forEach(valueName => {
                                const valueEl = doc.createElement('value');
                                valueEl.setAttribute('name', valueName);
                                const shadowEl = createDefaultShadow(doc, blockType, valueName, '');
                                valueEl.appendChild(shadowEl);
                                blockEl.appendChild(valueEl);
                            });

                            let j = 2;
                            while (j < tokens.length) {
                                const token = tokens[j];
                                if (token === 'AT') {
                                    j += 2;
                                    continue;
                                }

                                if (isAllUpperCase(token)) {
                                    if (j + 1 >= tokens.length) {
                                        j++;
                                        continue;
                                    }
                                    const key = token;
                                    let val = tokens[j + 1];

                                    if (['BLOCK', 'VALUE', 'SUBSTACK', 'SUBSTACK2', 'SHADOW', 'NEXT', 'AT'].includes(key)) {
                                        j++;
                                        continue;
                                    }

                                    if (requiredValues.includes(key)) {
                                        setValueWithAutoShadow(doc, blockEl, key, val);
                                        j += 2;
                                    } else {
                                        if (key === 'VARIABLE') {
                                            const varName = val.replace(/^["']|["']$/g, '');
                                            const fieldEl = doc.createElement('field');
                                            fieldEl.setAttribute('name', 'VARIABLE');
                                            fieldEl.setAttribute('id', getVariableId(varName));
                                            fieldEl.setAttribute('variabletype', '');
                                            fieldEl.textContent = varName;
                                            blockEl.appendChild(fieldEl);
                                        } else if (key === 'LIST') {
                                            const listName = val.replace(/^["']|["']$/g, '');
                                            const fieldEl = doc.createElement('field');
                                            fieldEl.setAttribute('name', 'LIST');
                                            fieldEl.setAttribute('id', getListId(listName));
                                            fieldEl.setAttribute('variabletype', 'list');
                                            fieldEl.textContent = listName;
                                            blockEl.appendChild(fieldEl);
                                        } else if (key === 'MUTATION') {
                                            const mutationEl = doc.createElement('mutation');
                                            const attrMatch = val.match(/(\w+)\s+(\w+)/);
                                            if (attrMatch) {
                                                mutationEl.setAttribute(attrMatch[1], attrMatch[2]);
                                            }
                                            blockEl.appendChild(mutationEl);
                                        } else {
                                            const fieldEl = doc.createElement('field');
                                            fieldEl.setAttribute('name', key);
                                            fieldEl.textContent = val.replace(/^["']|["']$/g, '');
                                            blockEl.appendChild(fieldEl);
                                        }
                                        j += 2;
                                    }
                                } else {
                                    if (requiredValues.length === 1) {
                                        const valueName = requiredValues[0];
                                        setValueWithAutoShadow(doc, blockEl, valueName, token);
                                        j++;
                                    } else {
                                        j++;
                                    }
                                }
                            }

                            if (parent.type === 'statement') {
                                const blocks = Array.from(parent.element.children).filter(c => c.tagName === 'block');
                                if (blocks.length === 0) {
                                    parent.element.appendChild(blockEl);
                                } else {
                                    const lastBlock = blocks[blocks.length - 1];
                                    let nextEl = lastBlock.querySelector(':scope > next');
                                    if (!nextEl) {
                                        nextEl = doc.createElement('next');
                                        lastBlock.appendChild(nextEl);
                                    }
                                    nextEl.appendChild(blockEl);
                                }
                            } else if (parent.type === 'value') {
                                const shadowEl = parent.element.querySelector('shadow');
                                if (shadowEl) parent.element.removeChild(shadowEl);
                                parent.element.appendChild(blockEl);
                            } else if (parent.type === 'block') {
                                const emptySubstack = parent.element.querySelector('statement[name="SUBSTACK"]:empty, statement[name="SUBSTACK2"]:empty');
                                if (emptySubstack) {
                                    emptySubstack.appendChild(blockEl);
                                } else {
                                    let nextEl = parent.element.querySelector(':scope > next');
                                    if (!nextEl) {
                                        nextEl = doc.createElement('next');
                                        parent.element.appendChild(nextEl);
                                    }
                                    nextEl.appendChild(blockEl);
                                }
                            } else {
                                parent.element.appendChild(blockEl);
                            }

                            stack.push({ element: blockEl, type: 'block', indent });
                            break;
                        }

                        case 'VALUE': {
                            if (parent.type === 'block') {
                                const valueName = tokens[1];
                                let valueEl = parent.element.querySelector(`value[name="${valueName}"]`);
                                if (!valueEl) {
                                    valueEl = doc.createElement('value');
                                    valueEl.setAttribute('name', valueName);
                                    parent.element.appendChild(valueEl);
                                    const blockType = parent.element.getAttribute('type');
                                    const shadowEl = createDefaultShadow(doc, blockType, valueName, '');
                                    valueEl.appendChild(shadowEl);
                                }
                                stack.push({ element: valueEl, type: 'value', indent });
                            }
                            break;
                        }

                        case 'SUBSTACK':
                        case 'SUBSTACK2': {
                            if (parent.type === 'block') {
                                const stmtEl = doc.createElement('statement');
                                stmtEl.setAttribute('name', cmd);
                                parent.element.appendChild(stmtEl);
                                stack.push({ element: stmtEl, type: 'statement', indent });
                            }
                            break;
                        }

                        case 'SHADOW': {
                            if (parent.type === 'value') {
                                const shadowType = tokens[1];
                                const shadowEl = doc.createElement('shadow');
                                shadowEl.setAttribute('type', shadowType);
                                shadowEl.setAttribute('id', generateId());

                                if (tokens.length > 2) {
                                    const fieldName = getFieldName(shadowType);
                                    const fieldEl = doc.createElement('field');
                                    fieldEl.setAttribute('name', fieldName);
                                    fieldEl.textContent = tokens.slice(2).join(' ').replace(/^["']|["']$/g, '');
                                    shadowEl.appendChild(fieldEl);
                                }

                                const oldShadow = parent.element.querySelector('shadow');
                                if (oldShadow) parent.element.removeChild(oldShadow);
                                parent.element.appendChild(shadowEl);
                            }
                            break;
                        }
                    }
                }

                cleanEmptyNext(root);
                return doc;
            }

            function toString(xmlDoc, pretty = false) {
                const serializer = new XMLSerializer();
                let str = serializer.serializeToString(xmlDoc);
                if (pretty) {
                    str = str
                    .replace(/>\s*</g, '>\n<')
                    .replace(/\n{2,}/g, '\n')
                    .trim();
                }
                return str;
            }

            function getMainWorkspace() {
                if (typeof Blockly === 'undefined') return null;
                if (typeof Blockly.getMainWorkspace === 'function') {
                    return Blockly.getMainWorkspace();
                }
                if (Blockly.mainWorkspace) return Blockly.mainWorkspace;
                if (Blockly.Workspace && Blockly.Workspace.getAll) {
                    const workspaces = Blockly.Workspace.getAll();
                    if (workspaces.length) return workspaces[0];
                }
                return null;
            }

            function loadToWorkspace(dsl, workspace, options = {}) {
                const { clear = true, center = true } = options;
                try {
                    const xmlDoc = parse(dsl);
                    const targetWorkspace = workspace || getMainWorkspace();
                    if (!targetWorkspace) throw new Error('无法获取工作区');
                    if (clear) targetWorkspace.clear();
                    Blockly.Xml.domToWorkspace(xmlDoc.documentElement, targetWorkspace);
                    if (center) {
                        const topBlocks = targetWorkspace.getTopBlocks();
                        if (topBlocks.length) targetWorkspace.centerOnBlock(topBlocks[0].id);
                    }
                    return { success: true, blockCount: targetWorkspace.getAllBlocks().length };
                } catch (e) {
                    console.error('DSL加载失败:', e);
                    return { success: false, error: e.message };
                }
            }

            return {
                parse,
                toString,
                loadToWorkspace,
                clearVariables,
                getVariableId,
                getListId,
                BLOCK_VALUES
            };
        })();

        // ==========================================
        // PART 2: AstrasCopilot UI & API
        // ==========================================

        const STORAGE_KEYS = {
            API_URL: 'astras_apiUrl',
            API_KEY: 'astras_apiKey',
            HEADERS: 'astras_headers',
            BODY_TEMPLATE: 'astras_bodyTemplate',
            MODEL: 'astras_model'
        };

        const DEFAULT_MODEL = 'gpt-3.5-turbo';
        let config = {
            apiUrl: localStorage.getItem(STORAGE_KEYS.API_URL) || 'https://api.openai.com/v1/chat/completions',
     apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
     headers: JSON.parse(localStorage.getItem(STORAGE_KEYS.HEADERS) || '[{"key":"Authorization","value":"Bearer {{apiKey}}"}]'),
     bodyTemplate: localStorage.getItem(STORAGE_KEYS.BODY_TEMPLATE) || '{"model":"{{model}}","messages":{{messages}},"temperature":0.7,"max_tokens":2000,"top_p":1.0,"n":1,"stream":false}',
     model: localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL
        };

        function saveConfig() {
            if (!config.model || config.model.trim() === '') config.model = DEFAULT_MODEL;
            localStorage.setItem(STORAGE_KEYS.API_URL, config.apiUrl);
            localStorage.setItem(STORAGE_KEYS.API_KEY, config.apiKey);
            localStorage.setItem(STORAGE_KEYS.HEADERS, JSON.stringify(config.headers));
            localStorage.setItem(STORAGE_KEYS.BODY_TEMPLATE, config.bodyTemplate);
            localStorage.setItem(STORAGE_KEYS.MODEL, config.model);
        }

        function replacePlaceholders(str, values) {
            return str.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] !== undefined ? values[key] : match);
        }

        function getCurrentTheme() {
            try {
                const themeData = JSON.parse(localStorage.getItem('tw:theme') || '{}');
                return themeData.gui === 'dark' ? 'dark' : 'light';
            } catch {
                return 'light';
            }
        }

        let currentTheme = getCurrentTheme();

        async function callOpenAI(messages, modelOverride = null) {
            let model = modelOverride || config.model;
            if (!model || model.trim() === '') throw new Error('Model name is empty');
            model = model.trim();

            const url = replacePlaceholders(config.apiUrl, { apiKey: config.apiKey, model });
            const headers = {};
            config.headers.forEach(h => {
                headers[h.key] = replacePlaceholders(h.value, { apiKey: config.apiKey, model });
            });

            let bodyStr = replacePlaceholders(config.bodyTemplate, {
                model: model,
                messages: JSON.stringify(messages),
                                              apiKey: config.apiKey
            });

            let body = JSON.parse(bodyStr);
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content || 'No response';
        }

        // System prompt for ScratchDSL generation
        const SCRATCHDSL_SYSTEM_PROMPT = `You are an expert Scratch programmer. When the user asks you to create or generate Scratch code, you MUST respond with valid ScratchDSL code blocks that can be directly imported into Scratch/TurboWarp.

        ScratchDSL Syntax Rules:
        1. Use "BLOCK <type> [AT x,y]" to create blocks
        2. Use indentation (2 spaces) for nested blocks inside SUBSTACK or VALUE
        3. Available block types: event_whenflagclicked, control_forever, motion_movesteps, looks_say, etc.
        4. For values: BLOCK operator_add NUM1 10 NUM2 20
        5. For variables: BLOCK data_setvariableto VARIABLE "score" VALUE 100
        6. For lists: BLOCK data_addtolist LIST "myList" ITEM "hello"
        7. For substacks:
        BLOCK control_repeat TIMES 10
        SUBSTACK
        BLOCK motion_movesteps STEPS 10
        8. Always include event_whenflagclicked as the starting block
        9. Use AT x,y to position blocks (e.g., AT 100,100)

        Example response format:
        \`\`\`scratchdsl
        BLOCK event_whenflagclicked AT 100,100
        BLOCK control_forever
        SUBSTACK
        BLOCK motion_movesteps STEPS 10
        BLOCK looks_say MESSAGE "Hello!"
        \`\`\`

        Only output the ScratchDSL code in code blocks when generating Scratch projects.`;

        function extractScratchDSL(text) {
            const match = text.match(/```(?:scratchdsl)?\s*([\s\S]*?)```/);
            if (match) return match[1].trim();

            // Try to find BLOCK statements without code blocks
            if (text.includes('BLOCK event_whenflagclicked') || text.includes('BLOCK motion_') || text.includes('BLOCK looks_')) {
                return text.trim();
            }
            return null;
        }

        function injectAstrasCopilotButton() {
            if (document.querySelector('#astrasCopilotButton')) return;

            const feedbackButton = document.querySelector('.menu-bar_feedback-link_1BnAR');
            if (!feedbackButton) return;

            const chatButton = document.createElement('button');
            chatButton.id = 'astrasCopilotButton';
            chatButton.className = feedbackButton.className;
            chatButton.innerText = '🤖 AstrasCopilot';
            chatButton.style.cssText = `
            width: ${getComputedStyle(feedbackButton).width};
            height: ${getComputedStyle(feedbackButton).height};
            background-color: var(--looks-secondary);
            color: white;
            border: none;
            margin-left: 10px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: transform 0.2s, box-shadow 0.2s;
            `;
            chatButton.onmouseover = () => {
                chatButton.style.transform = 'scale(1.05)';
                chatButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            };
            chatButton.onmouseout = () => {
                chatButton.style.transform = 'scale(1)';
                chatButton.style.boxShadow = 'none';
            };

            let isPopupOpen = false;
            let popupContainer, chatWindow;
            let chatMessages = JSON.parse(localStorage.getItem('astras_chatMessages')) || [];

            function saveMessages() {
                localStorage.setItem('astras_chatMessages', JSON.stringify(chatMessages));
            }

            function createImportButton(dslCode) {
                const btn = document.createElement('button');
                btn.innerText = '📥 Import to Scratch';
                btn.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 12px;
                margin-top: 8px;
                font-weight: bold;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
                transition: all 0.3s;
                `;
                btn.onmouseover = () => {
                    btn.style.transform = 'translateY(-2px)';
                    btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
                };
                btn.onmouseout = () => {
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
                };
                btn.onclick = () => {
                    ScratchDSL.clearVariables();
                    const result = ScratchDSL.loadToWorkspace(dslCode, null, { clear: false, center: true });
                    if (result.success) {
                        btn.innerText = `✅ Imported ${result.blockCount} blocks!`;
                        btn.style.background = '#28a745';
                        setTimeout(() => {
                            btn.innerText = '📥 Import to Scratch';
                            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        }, 3000);
                    } else {
                        btn.innerText = '❌ Import Failed';
                        btn.style.background = '#dc3545';
                        alert('Import Error: ' + result.error);
                    }
                };
                return btn;
            }

            function openPopup() {
                if (isPopupOpen) {
                    popupContainer.style.display = 'flex';
                    return;
                }

                popupContainer = document.createElement('div');
                popupContainer.style.cssText = `
                position: fixed;
                top: ${localStorage.getItem('astras_popupTop') || '50px'};
                left: ${localStorage.getItem('astras_popupLeft') || '50px'};
                background-color: ${getCurrentTheme() === 'dark' ? '#2c2c2c' : 'white'};
                padding: 0;
                border-radius: 15px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 9999;
                width: 500px;
                height: 600px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                border: 2px solid var(--looks-secondary);
                `;

                window.__astrasPopup = popupContainer;

                // Header
                const popupHeader = document.createElement('div');
                popupHeader.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px 20px;
                background: linear-gradient(135deg, var(--looks-secondary) 0%, var(--looks-tertiary) 100%);
                color: white;
                cursor: move;
                user-select: none;
                `;

                const titleContainer = document.createElement('div');
                titleContainer.style.cssText = 'display:flex; align-items:center; gap:10px;';

                const titleSpan = document.createElement('span');
                titleSpan.innerText = '🤖 AstrasCopilot';
                titleSpan.style.fontWeight = 'bold';
                titleSpan.style.fontSize = '16px';

                const badge = document.createElement('span');
                badge.innerText = 'DSL';
                badge.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
                `;

                titleContainer.appendChild(titleSpan);
                titleContainer.appendChild(badge);

                const controls = document.createElement('div');
                controls.style.cssText = 'display:flex; gap:10px; align-items:center;';

                const settingsBtn = document.createElement('span');
                settingsBtn.innerText = '⚙️';
                settingsBtn.style.cssText = 'cursor:pointer; font-size:18px; opacity:0.9;';
                settingsBtn.onclick = (e) => {
                    e.stopPropagation();
                    openSettingsPopup();
                };

                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '×';
                closeBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 24px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                `;
                closeBtn.onclick = () => {
                    popupContainer.style.display = 'none';
                    isPopupOpen = false;
                    window.__astrasPopup = null;
                };

                controls.appendChild(settingsBtn);
                controls.appendChild(closeBtn);
                popupHeader.appendChild(titleContainer);
                popupHeader.appendChild(controls);

                // Chat window
                chatWindow = document.createElement('div');
                chatWindow.style.cssText = `
                flex: 1;
                width: 100%;
                overflow-y: auto;
                padding: 15px;
                box-sizing: border-box;
                background-color: ${getCurrentTheme() === 'dark' ? '#1a1a1a' : '#f8f9fa'};
                color: ${getCurrentTheme() === 'dark' ? '#fff' : '#000'};
                `;

                // Render existing messages
                chatMessages.forEach(msg => {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = msg;
                    chatWindow.appendChild(wrapper);
                });

                // Input area
                const inputArea = document.createElement('div');
                inputArea.style.cssText = `
                padding: 15px;
                background-color: ${getCurrentTheme() === 'dark' ? '#2c2c2c' : '#fff'};
                border-top: 1px solid ${getCurrentTheme() === 'dark' ? '#444' : '#e0e0e0'};
                display: flex;
                flex-direction: column;
                gap: 10px;
                `;

                // Model selector
                const modelRow = document.createElement('div');
                modelRow.style.cssText = 'display:flex; gap:10px; align-items:center;';

                const modelLabel = document.createElement('span');
                modelLabel.innerText = 'Model:';
                modelLabel.style.fontSize = '12px';
                modelLabel.style.opacity = '0.8';

                const modelInput = document.createElement('input');
                modelInput.type = 'text';
                modelInput.value = config.model;
                modelInput.style.cssText = `
                flex: 1;
                padding: 6px 10px;
                border: 1px solid ${getCurrentTheme() === 'dark' ? '#555' : '#ddd'};
                border-radius: 5px;
                background: ${getCurrentTheme() === 'dark' ? '#3a3a3a' : '#fff'};
                color: inherit;
                font-size: 12px;
                `;
                modelInput.onchange = () => {
                    config.model = modelInput.value.trim() || DEFAULT_MODEL;
                    saveConfig();
                };

                modelRow.appendChild(modelLabel);
                modelRow.appendChild(modelInput);

                // Message input
                const userInput = document.createElement('textarea');
                userInput.placeholder = 'Ask me to create Scratch code, or chat with me...\nTip: Try "Make a cat move in a square"';
                userInput.style.cssText = `
                width: 100%;
                height: 60px;
                padding: 10px;
                border: 1px solid ${getCurrentTheme() === 'dark' ? '#555' : '#ddd'};
                border-radius: 8px;
                background: ${getCurrentTheme() === 'dark' ? '#3a3a3a' : '#fff'};
                color: inherit;
                resize: none;
                font-family: inherit;
                box-sizing: border-box;
                `;

                // Buttons
                const buttonRow = document.createElement('div');
                buttonRow.style.cssText = 'display:flex; gap:8px;';

                const sendBtn = document.createElement('button');
                sendBtn.innerText = 'Send';
                sendBtn.style.cssText = `
                flex: 2;
                padding: 10px;
                background: var(--looks-secondary);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                transition: opacity 0.2s;
                `;

                const clearBtn = document.createElement('button');
                clearBtn.innerText = 'Clear';
                clearBtn.style.cssText = `
                flex: 1;
                padding: 10px;
                background: ${getCurrentTheme() === 'dark' ? '#444' : '#e0e0e0'};
                color: inherit;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                `;
                clearBtn.onclick = () => {
                    chatMessages = [];
                    localStorage.removeItem('astras_chatMessages');
                    chatWindow.innerHTML = '';
                };

                const genBtn = document.createElement('button');
                genBtn.innerText = '🎲 Quick Gen';
                genBtn.style.cssText = `
                flex: 1;
                padding: 10px;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                `;
                genBtn.onclick = () => {
                    const ideas = [
                        "Make a sprite bounce around the screen",
     "Create a simple calculator with variables",
     "Make a sprite follow the mouse",
     "Create a countdown timer",
     "Make a sprite draw a spiral"
                    ];
                    userInput.value = ideas[Math.floor(Math.random() * ideas.length)];
                };

                buttonRow.appendChild(sendBtn);
                buttonRow.appendChild(genBtn);
                buttonRow.appendChild(clearBtn);

                inputArea.appendChild(modelRow);
                inputArea.appendChild(userInput);
                inputArea.appendChild(buttonRow);

                popupContainer.appendChild(popupHeader);
                popupContainer.appendChild(chatWindow);
                popupContainer.appendChild(inputArea);
                document.body.appendChild(popupContainer);

                // Drag functionality
                dragElement(popupContainer, popupHeader);

                // Theme update
                popupContainer.applyTheme = () => {
                    const isDark = getCurrentTheme() === 'dark';
                    popupContainer.style.backgroundColor = isDark ? '#2c2c2c' : 'white';
                    popupContainer.style.borderColor = 'var(--looks-secondary)';
                    chatWindow.style.backgroundColor = isDark ? '#1a1a1a' : '#f8f9fa';
                    chatWindow.style.color = isDark ? '#fff' : '#000';
                    inputArea.style.backgroundColor = isDark ? '#2c2c2c' : '#fff';
                    inputArea.style.borderTopColor = isDark ? '#444' : '#e0e0e0';
                    userInput.style.backgroundColor = isDark ? '#3a3a3a' : '#fff';
                    userInput.style.borderColor = isDark ? '#555' : '#ddd';
                    userInput.style.color = isDark ? '#fff' : '#000';
                    modelInput.style.backgroundColor = isDark ? '#3a3a3a' : '#fff';
                    modelInput.style.borderColor = isDark ? '#555' : '#ddd';
                    clearBtn.style.backgroundColor = isDark ? '#444' : '#e0e0e0';
                };

                async function sendMessage() {
                    const text = userInput.value.trim();
                    if (!text) return;
                    if (!config.apiKey) {
                        alert('⚠️ Please configure your API Key in Settings (⚙️)');
                        return;
                    }

                    // Add user message
                    const userDiv = document.createElement('div');
                    userDiv.style.cssText = 'margin-bottom:15px; animation: fadeIn 0.3s;';
                    userDiv.innerHTML = `<div style="color:var(--looks-secondary); font-weight:bold; margin-bottom:5px;">You:</div><div style="background:${getCurrentTheme() === 'dark' ? '#333' : '#e3f2fd'}; padding:10px; border-radius:10px; border-bottom-left-radius:2px;">${formatText(text)}</div>`;
                    chatWindow.appendChild(userDiv);
                    chatMessages.push(userDiv.innerHTML);
                    saveMessages();

                    userInput.value = '';
                    chatWindow.scrollTop = chatWindow.scrollHeight;

                    // Show typing indicator
                    const typingDiv = document.createElement('div');
                    typingDiv.id = 'typingIndicator';
                    typingDiv.style.cssText = 'margin-bottom:15px; opacity:0.7;';
                    typingDiv.innerHTML = `<div style="color:#f5576c; font-weight:bold; margin-bottom:5px;">AstrasCopilot:</div><div style="background:${getCurrentTheme() === 'dark' ? '#333' : '#fff3e0'}; padding:10px; border-radius:10px; border-bottom-right-radius:2px;">Thinking...</div>`;
                    chatWindow.appendChild(typingDiv);
                    chatWindow.scrollTop = chatWindow.scrollHeight;

                    try {
                        const messages = [
                            { role: 'system', content: SCRATCHDSL_SYSTEM_PROMPT },
     ...chatMessages.slice(-10).map((m, i) => ({
         role: i % 2 === 0 ? 'user' : 'assistant',
         content: m.replace(/<[^>]*>/g, '')
     })),
     { role: 'user', content: text }
                        ];

                        const response = await callOpenAI(messages);

                        // Remove typing indicator
                        const indicator = document.getElementById('typingIndicator');
                        if (indicator) indicator.remove();

                        // Check for ScratchDSL code
                        const dslCode = extractScratchDSL(response);

                        const aiDiv = document.createElement('div');
                        aiDiv.style.cssText = 'margin-bottom:15px; animation: fadeIn 0.3s;';

                        let contentHtml = formatText(response);

                        // If DSL found, add import button
                        if (dslCode) {
                            contentHtml += `<div style="margin-top:10px; padding:10px; background:${getCurrentTheme() === 'dark' ? '#1e3a5f' : '#e8f4f8'}; border-radius:8px; border-left:4px solid var(--looks-secondary);"><div style="font-size:11px; color:var(--looks-secondary); margin-bottom:5px; font-weight:bold;">🧩 ScratchDSL Code Detected</div></div>`;
                        }

                        aiDiv.innerHTML = `<div style="color:#f5576c; font-weight:bold; margin-bottom:5px;">AstrasCopilot:</div><div style="background:${getCurrentTheme() === 'dark' ? '#333' : '#fff3e0'}; padding:10px; border-radius:10px; border-bottom-right-radius:2px;">${contentHtml}</div>`;

                        if (dslCode) {
                            aiDiv.querySelector('div > div:last-child').appendChild(createImportButton(dslCode));
                        }

                        chatWindow.appendChild(aiDiv);
                        chatMessages.push(aiDiv.innerHTML);
                        saveMessages();

                    } catch (error) {
                        const indicator = document.getElementById('typingIndicator');
                        if (indicator) indicator.remove();

                        const errorDiv = document.createElement('div');
                        errorDiv.style.cssText = 'margin-bottom:15px; color:#dc3545;';
                        errorDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
                        chatWindow.appendChild(errorDiv);
                    }

                    chatWindow.scrollTop = chatWindow.scrollHeight;
                }

                sendBtn.onclick = sendMessage;
                userInput.onkeydown = (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                };

                isPopupOpen = true;
            }

            function dragElement(el, handle) {
                let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
                handle.onmousedown = dragMouseDown;

                function dragMouseDown(e) {
                    e.preventDefault();
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    document.onmousemove = elementDrag;
                }

                function elementDrag(e) {
                    e.preventDefault();
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    let top = el.offsetTop - pos2;
                    let left = el.offsetLeft - pos1;
                    top = Math.max(0, Math.min(top, window.innerHeight - el.offsetHeight));
                    left = Math.max(0, Math.min(left, window.innerWidth - el.offsetWidth));
                    el.style.top = top + 'px';
                    el.style.left = left + 'px';
                }

                function closeDragElement() {
                    document.onmouseup = null;
                    document.onmousemove = null;
                    localStorage.setItem('astras_popupTop', el.style.top);
                    localStorage.setItem('astras_popupLeft', el.style.left);
                }
            }

            function formatText(text) {
                // Escape HTML
                text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                // Format markdown
                text = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.1); padding:2px 4px; border-radius:3px; font-family:monospace;">$1</code>')
                .replace(/```[\s\S]*?```/g, match => `<pre style="background:rgba(0,0,0,0.05); padding:10px; border-radius:5px; overflow-x:auto; font-size:12px;">${match.replace(/```/g, '')}</pre>`);

                // Convert newlines
                text = text.replace(/\n/g, '<br>');

                return text;
            }

            chatButton.onclick = openPopup;
            feedbackButton.parentNode.insertBefore(chatButton, feedbackButton.nextSibling);
        }

        function openSettingsPopup() {
            if (document.getElementById('settingsPopup')) return;

            const overlay = document.createElement('div');
            overlay.id = 'settingsOverlay';
            overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            `;

            const popup = document.createElement('div');
            popup.id = 'settingsPopup';
            const isDark = getCurrentTheme() === 'dark';
            popup.style.cssText = `
            background: ${isDark ? '#2c2c2c' : '#fff'};
            color: ${isDark ? '#fff' : '#000'};
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 600px;
            max-width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            `;

            let headersText = config.headers.map(h => `${h.key}: ${h.value}`).join('\n');

            popup.innerHTML = `
            <h2 style="margin-top:0; display:flex; justify-content:space-between; align-items:center; color:var(--looks-secondary);">
            ⚙️ API Configuration
            <button id="closeSettings" style="background:transparent; border:none; font-size:28px; cursor:pointer; color:inherit;">&times;</button>
            </h2>
            <div style="display:flex; flex-direction:column; gap:15px;">
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px; font-size:13px;">API URL</label>
            <input id="settingsApiUrl" type="text" value="${config.apiUrl.replace(/"/g, '&quot;')}"
            style="width:100%; padding:10px; border:1px solid ${isDark ? '#555' : '#ccc'}; border-radius:8px; background:${isDark ? '#3a3a3a' : '#fff'}; color:inherit; font-family:monospace; font-size:12px;">
            </div>
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px; font-size:13px;">API Key</label>
            <input id="settingsApiKey" type="password" value="${config.apiKey.replace(/"/g, '&quot;')}"
            style="width:100%; padding:10px; border:1px solid ${isDark ? '#555' : '#ccc'}; border-radius:8px; background:${isDark ? '#3a3a3a' : '#fff'}; color:inherit; font-family:monospace;">
            </div>
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px; font-size:13px;">Custom Headers (Key: Value per line)</label>
            <textarea id="settingsHeaders" rows="4"
            style="width:100%; padding:10px; border:1px solid ${isDark ? '#555' : '#ccc'}; border-radius:8px; background:${isDark ? '#3a3a3a' : '#fff'}; color:inherit; font-family:monospace; font-size:12px;">${headersText.replace(/"/g, '&quot;')}</textarea>
            </div>
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px; font-size:13px;">Body Template (JSON)</label>
            <textarea id="settingsBodyTemplate" rows="6"
            style="width:100%; padding:10px; border:1px solid ${isDark ? '#555' : '#ccc'}; border-radius:8px; background:${isDark ? '#3a3a3a' : '#fff'}; color:inherit; font-family:monospace; font-size:11px;">${config.bodyTemplate.replace(/"/g, '&quot;')}</textarea>
            <small style="opacity:0.7; font-size:11px;">Placeholders: {{model}}, {{messages}}, {{apiKey}}</small>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button id="resetDefaults" style="background:#6c757d; color:white; padding:10px 20px; border:none; border-radius:8px; cursor:pointer;">Reset</button>
            <button id="saveSettings" style="background:var(--looks-secondary); color:white; padding:10px 20px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Save Settings</button>
            </div>
            </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            const close = () => {
                overlay.style.opacity = '0';
                setTimeout(() => document.body.removeChild(overlay), 200);
            };

            document.getElementById('closeSettings').onclick = close;
            overlay.onclick = e => { if (e.target === overlay) close(); };

            document.getElementById('saveSettings').onclick = () => {
                const newUrl = document.getElementById('settingsApiUrl').value.trim();
                const newKey = document.getElementById('settingsApiKey').value.trim();
                const newHeadersText = document.getElementById('settingsHeaders').value.trim();
                const newBodyTemplate = document.getElementById('settingsBodyTemplate').value.trim();

                const headersArray = [];
                newHeadersText.split('\n').forEach(line => {
                    line = line.trim();
                    if (!line) return;
                    const colonIdx = line.indexOf(':');
                    if (colonIdx > 0) {
                        headersArray.push({
                            key: line.substring(0, colonIdx).trim(),
                                          value: line.substring(colonIdx + 1).trim()
                        });
                    }
                });

                config.apiUrl = newUrl || 'https://api.openai.com/v1/chat/completions';
                config.apiKey = newKey;
                config.headers = headersArray.length ? headersArray : [{ key: 'Authorization', value: 'Bearer {{apiKey}}' }];
                config.bodyTemplate = newBodyTemplate || '{"model":"{{model}}","messages":{{messages}},"temperature":0.7}';
                saveConfig();
                close();
            };

            document.getElementById('resetDefaults').onclick = () => {
                config.apiUrl = 'https://api.openai.com/v1/chat/completions';
                config.apiKey = '';
                config.headers = [{ key: 'Authorization', value: 'Bearer {{apiKey}}' }];
                config.bodyTemplate = '{"model":"{{model}}","messages":{{messages}},"temperature":0.7,"max_tokens":2000}';
                config.model = DEFAULT_MODEL;
                saveConfig();
                document.getElementById('settingsApiUrl').value = config.apiUrl;
                document.getElementById('settingsApiKey').value = '';
                document.getElementById('settingsHeaders').value = 'Authorization: Bearer {{apiKey}}';
                document.getElementById('settingsBodyTemplate').value = config.bodyTemplate;
            };
        }

        function startThemeMonitor() {
            setInterval(() => {
                const newTheme = getCurrentTheme();
                if (newTheme !== currentTheme) {
                    currentTheme = newTheme;
                    if (window.__astrasPopup && window.__astrasPopup.applyTheme) {
                        window.__astrasPopup.applyTheme();
                    }
                }
            }, 500);
        }

        // Initialize
        injectAstrasCopilotButton();
        startThemeMonitor();

        const observer = new MutationObserver(() => injectAstrasCopilotButton());
        observer.observe(document.body, { childList: true, subtree: true });

        // Add styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .message { animation: fadeIn 0.3s ease-out; }
        `;
        document.head.appendChild(styleSheet);

        console.log('🤖 AstrasCopilot v4.0 with ScratchDSL loaded!');
    })();
}
