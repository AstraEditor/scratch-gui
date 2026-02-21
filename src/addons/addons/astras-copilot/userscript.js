export default async function () {
    // ==UserScript==
    // @name        AstrasCopilot
    // @namespace   https://astras.copilot.local
    // @match       *://turbowarp.org/*
    // @match       *://turbowarp.org/editor*
    // @match       *://studio.penguinmod.com/*
    // @match       *://studio.penguinmod.com/editor.html*
    // @icon        https://turbogpt.up.railway.app/images/logo.png
    // @grant       GM_addElement
    // @grant       GM_addStyle
    // @license     MIT
    // @version     3.3.1
    // @author      Astras / Modified
    // @description  AI copilot for Scratch mods, supports any OpenAI-compatible API. Theme follows editor in real-time.
    // ==/UserScript==

    (function() {
        'use strict';

        // ---------- Storage keys (migrated from turbogpt_*) ----------
        const STORAGE_KEYS = {
            API_URL: 'astras_apiUrl',
            API_KEY: 'astras_apiKey',
            HEADERS: 'astras_headers',
            BODY_TEMPLATE: 'astras_bodyTemplate',
            MODEL: 'astras_model'
        };

        // Migrate old turbogpt_* keys to new astras_* keys
        function migrateOldStorage() {
            const oldKeys = {
                apiUrl: 'turbogpt_apiUrl',
                apiKey: 'turbogpt_apiKey',
                headers: 'turbogpt_headers',
                bodyTemplate: 'turbogpt_bodyTemplate',
                model: 'turbogpt_model'
            };

            let migrated = false;
            Object.entries(oldKeys).forEach(([prop, oldKey]) => {
                const oldValue = localStorage.getItem(oldKey);
                if (oldValue !== null) {
                    const newKey = STORAGE_KEYS[prop.toUpperCase()];
                    if (!localStorage.getItem(newKey)) {
                        localStorage.setItem(newKey, oldValue);
                    }
                    localStorage.removeItem(oldKey);
                    migrated = true;
                }
            });
            if (migrated) console.log('AstrasCopilot: migrated old storage keys.');
        }
        migrateOldStorage();

        // ---------- Configuration (using new keys) ----------
        const DEFAULT_MODEL = 'gpt-3.5-turbo';
        let config = {
            apiUrl: localStorage.getItem(STORAGE_KEYS.API_URL) || 'https://api.openai.com/v1/chat/completions',
     apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
     headers: JSON.parse(localStorage.getItem(STORAGE_KEYS.HEADERS) || '[{"key":"Authorization","value":"Bearer {{apiKey}}"}]'),
     bodyTemplate: localStorage.getItem(STORAGE_KEYS.BODY_TEMPLATE) || '{"model":"{{model}}","messages":{{messages}},"temperature":0.7,"max_tokens":1000,"top_p":1.0,"n":1,"stream":false,"stop":null}',
     model: localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL
        };

        function saveConfig() {
            // Ensure model is not empty
            if (!config.model || config.model.trim() === '') {
                config.model = DEFAULT_MODEL;
            }
            localStorage.setItem(STORAGE_KEYS.API_URL, config.apiUrl);
            localStorage.setItem(STORAGE_KEYS.API_KEY, config.apiKey);
            localStorage.setItem(STORAGE_KEYS.HEADERS, JSON.stringify(config.headers));
            localStorage.setItem(STORAGE_KEYS.BODY_TEMPLATE, config.bodyTemplate);
            localStorage.setItem(STORAGE_KEYS.MODEL, config.model);
        }

        // ---------- Helper: replace placeholders ----------
        function replacePlaceholders(str, values) {
            return str.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] !== undefined ? values[key] : match);
        }

        // ---------- Get current theme from tw:theme ----------
        function getCurrentTheme() {
            try {
                const themeData = JSON.parse(localStorage.getItem('tw:theme') || '{}');
                return themeData.gui === 'dark' ? 'dark' : 'light';
            } catch {
                return 'light';
            }
        }

        // ---------- Global references for live theme update ----------
        let currentTheme = getCurrentTheme();

        // ---------- Settings popup ----------
        function openSettingsPopup() {
            if (document.getElementById('settingsPopup')) return;

            const overlay = document.createElement('div');
            overlay.id = 'settingsOverlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0, 0, 0, 0.5)';
            overlay.style.zIndex = '10000';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            document.body.appendChild(overlay);

            const popup = document.createElement('div');
            popup.id = 'settingsPopup';
            popup.style.background = '#fff';
            popup.style.padding = '25px';
            popup.style.borderRadius = '12px';
            popup.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
            popup.style.width = '550px';
            popup.style.maxWidth = '90%';
            popup.style.maxHeight = '80vh';
            popup.style.overflowY = 'auto';
            popup.style.color = '#000';
            overlay.appendChild(popup);

            // Attach to global for live theme update
            window.__astrasSettingsPopup = popup;
            popup.applyTheme = function() {
                const isDark = getCurrentTheme() === 'dark';
                if (isDark) {
                    popup.style.background = '#2c2c2c';
                    popup.style.color = '#fff';
                } else {
                    popup.style.background = '#fff';
                    popup.style.color = '#000';
                }
            };
            popup.applyTheme();

            let headersText = config.headers.map(h => `${h.key}: ${h.value}`).join('\n');

            popup.innerHTML = `
            <h2 style="margin-top:0; display:flex; justify-content:space-between; align-items:center;">
            ⚙️ API Settings
            <button id="closeSettings" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:inherit;">&times;</button>
            </h2>
            <div style="display:flex; flex-direction:column; gap:15px;">
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px;">API URL (supports {{apiKey}})</label>
            <input id="settingsApiUrl" type="text" value="${config.apiUrl.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; background:inherit; color:inherit;">
            </div>
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px;">API Key</label>
            <input id="settingsApiKey" type="password" value="${config.apiKey.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; background:inherit; color:inherit;">
            </div>
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px;">Custom Headers (one per line, format: Key: Value)</label>
            <textarea id="settingsHeaders" rows="4" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; background:inherit; color:inherit; font-family:monospace;">${headersText.replace(/"/g, '&quot;')}</textarea>
            <small style="opacity:0.8;">Use {{apiKey}} as placeholder.</small>
            </div>
            <div>
            <label style="font-weight:bold; display:block; margin-bottom:5px;">Body Template (JSON, supports placeholders)</label>
            <textarea id="settingsBodyTemplate" rows="6" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; background:inherit; color:inherit; font-family:monospace;">${config.bodyTemplate.replace(/"/g, '&quot;')}</textarea>
            <small style="opacity:0.8;">
            Placeholders: {{model}}, {{messages}} (JSON array), {{image}} (base64), {{imageMimeType}}.<br>
            Default: <code>{"model":"{{model}}","messages":{{messages}},"temperature":0.7,"max_tokens":1000,"top_p":1.0,"n":1,"stream":false,"stop":null}</code>
            </small>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
            <button id="saveSettings" style="background:#28a745; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">Save</button>
            <button id="resetDefaults" style="background:#ffc107; color:black; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">Reset to Default</button>
            </div>
            </div>
            `;

            const close = () => {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    window.__astrasSettingsPopup = null;
                }, 200);
            };
            document.getElementById('closeSettings').addEventListener('click', close);
            overlay.addEventListener('click', e => e.target === overlay && close());

            document.getElementById('saveSettings').addEventListener('click', () => {
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
                        const key = line.substring(0, colonIdx).trim();
                        const value = line.substring(colonIdx + 1).trim();
                        headersArray.push({ key, value });
                    }
                });

                config.apiUrl = newUrl || 'https://api.openai.com/v1/chat/completions';
                config.apiKey = newKey;
                config.headers = headersArray.length ? headersArray : [{ key: 'Authorization', value: 'Bearer {{apiKey}}' }];
                config.bodyTemplate = newBodyTemplate || '{"model":"{{model}}","messages":{{messages}},"temperature":0.7,"max_tokens":1000,"top_p":1.0,"n":1,"stream":false,"stop":null}';
                // 确保模型不为空
                const modelInput = document.getElementById('modelInput');
                if (modelInput) {
                    const newModel = modelInput.value.trim();
                    if (newModel) config.model = newModel;
                }
                saveConfig();

                close();
                alert('✅ Settings saved.');
            });

            document.getElementById('resetDefaults').addEventListener('click', () => {
                config.apiUrl = 'https://api.openai.com/v1/chat/completions';
                config.apiKey = '';
                config.headers = [{ key: 'Authorization', value: 'Bearer {{apiKey}}' }];
                config.bodyTemplate = '{"model":"{{model}}","messages":{{messages}},"temperature":0.7,"max_tokens":1000,"top_p":1.0,"n":1,"stream":false,"stop":null}';
                config.model = DEFAULT_MODEL;
                saveConfig();

                document.getElementById('settingsApiUrl').value = config.apiUrl;
                document.getElementById('settingsApiKey').value = config.apiKey;
                document.getElementById('settingsHeaders').value = 'Authorization: Bearer {{apiKey}}';
                document.getElementById('settingsBodyTemplate').value = config.bodyTemplate;
            });
        }

        // ---------- OpenAI API caller ----------
        async function callOpenAI(messages, modelOverride = null) {
            let model = modelOverride || config.model;
            if (!model || model.trim() === '') {
                throw new Error('❌ Model name is empty. Please specify a model.');
            }
            model = model.trim();

            const url = replacePlaceholders(config.apiUrl, { apiKey: config.apiKey, model });

            const headers = {};
            config.headers.forEach(h => {
                let value = replacePlaceholders(h.value, { apiKey: config.apiKey, model });
                headers[h.key] = value;
            });

            let bodyStr = config.bodyTemplate;
            const placeholders = {
                model: model,
                messages: JSON.stringify(messages),
     apiKey: config.apiKey
            };
            bodyStr = replacePlaceholders(bodyStr, placeholders);

            let body;
            try {
                body = JSON.parse(bodyStr);
            } catch (e) {
                throw new Error(`❌ Invalid body template JSON: ${e.message}`);
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Response is not JSON (${contentType}): ${text.slice(0, 200)}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || 'No response content.';
        }

        // ---------- Fetch model list from /v1/models ----------
        async function fetchModels() {
            try {
                let modelsUrl = config.apiUrl.replace(/\/chat\/completions$/, '/models');
                if (modelsUrl === config.apiUrl) {
                    const lastSlash = config.apiUrl.lastIndexOf('/');
                    if (lastSlash > 8) {
                        modelsUrl = config.apiUrl.substring(0, lastSlash) + '/models';
                    } else {
                        modelsUrl = config.apiUrl + '/models';
                    }
                }

                const headers = {};
                config.headers.forEach(h => {
                    let value = replacePlaceholders(h.value, { apiKey: config.apiKey, model: '' });
                    headers[h.key] = value;
                });

                const response = await fetch(modelsUrl, { headers });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                let models = [];
                if (Array.isArray(data)) {
                    models = data.map(m => typeof m === 'string' ? m : m.id).filter(Boolean);
                } else if (data.data && Array.isArray(data.data)) {
                    models = data.data.map(m => m.id).filter(Boolean);
                }
                return models;
            } catch (e) {
                console.warn('Failed to fetch model list:', e);
                return null;
            }
        }

        // ---------- Main UI injection ----------
        function injectAstrasCopilotButton() {
            if (document.querySelector('#astrasCopilotButton')) return;

            const feedbackButton = document.querySelector('.menu-bar_feedback-link_1BnAR');
            if (!feedbackButton) return;

            const chatButton = document.createElement('button');
            chatButton.id = 'astrasCopilotButton';
            chatButton.className = feedbackButton.className;
            chatButton.innerText = 'AstrasCopilot';
            chatButton.style.width = getComputedStyle(feedbackButton).width;
            chatButton.style.height = getComputedStyle(feedbackButton).height;
            chatButton.style.backgroundColor = '#ffffff';
            chatButton.style.color = 'var(--looks-secondary)';
            chatButton.style.border = 'none';
            chatButton.style.marginLeft = '10px';
            chatButton.style.borderRadius = '5px';
            chatButton.style.cursor = 'pointer';
            chatButton.style.transition = 'background-color 0.3s';

            chatButton.onmouseover = function() { this.style.backgroundColor = '#ffffff'; };
            chatButton.onmouseout = function() { this.style.backgroundColor = '#ffffff'; };

            let isPopupOpen = false;
            let popupContainer;
            let chatWindow;
            let chatMessages = JSON.parse(localStorage.getItem('chatMessages')) || [];

            function saveMessages() {
                localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
            }

            function openPopup() {
                if (isPopupOpen) {
                    popupContainer.style.display = 'flex';
                    return;
                }

                popupContainer = document.createElement('div');
                popupContainer.style.position = 'fixed';
                popupContainer.style.top = localStorage.getItem('popupTop') || '50px';
                popupContainer.style.left = localStorage.getItem('popupLeft') || '50px';
                popupContainer.style.backgroundColor = 'white';
                popupContainer.style.padding = '10px';
                popupContainer.style.borderRadius = '10px';
                popupContainer.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.3)';
                popupContainer.style.zIndex = '9999';
                popupContainer.style.width = '450px';
                popupContainer.style.height = '400px';
                popupContainer.style.overflow = 'hidden';
                popupContainer.style.display = 'flex';
                popupContainer.style.flexDirection = 'column';

                // Attach to global for live theme update
                window.__astrasPopup = popupContainer;

                // ----- Header with integrated settings gear -----
                const popupHeader = document.createElement('div');
                popupHeader.style.display = 'flex';
                popupHeader.style.alignItems = 'center';
                popupHeader.style.justifyContent = 'space-between';
                popupHeader.style.padding = '10px';
                popupHeader.style.cursor = 'move';
                popupHeader.style.backgroundColor = 'var(--looks-secondary)';
                popupHeader.style.color = 'white';
                popupHeader.style.borderRadius = '10px 10px 0 0';
                popupHeader.style.borderBottom = '1px solid #ccc';

                // Title with gear icon inline
                const titleContainer = document.createElement('div');
                titleContainer.style.display = 'flex';
                titleContainer.style.alignItems = 'center';
                titleContainer.style.gap = '8px';

                const titleSpan = document.createElement('span');
                titleSpan.innerText = 'AstrasCopilot';
                titleContainer.appendChild(titleSpan);

                const gearIcon = document.createElement('span');
                gearIcon.innerText = '⚙️';
                gearIcon.style.cursor = 'pointer';
                gearIcon.style.fontSize = '18px';
                gearIcon.style.transition = 'opacity 0.2s';
                gearIcon.onmouseover = () => gearIcon.style.opacity = '0.8';
                gearIcon.onmouseout = () => gearIcon.style.opacity = '1';
                gearIcon.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent drag
                    openSettingsPopup();
                });
                titleContainer.appendChild(gearIcon);

                popupHeader.appendChild(titleContainer);

                // Close button
                const closeButton = document.createElement('button');
                closeButton.innerHTML = '&times;';
                closeButton.style.cursor = 'pointer';
                closeButton.style.backgroundColor = '#dc3545';
                closeButton.style.border = 'none';
                closeButton.style.color = 'white';
                closeButton.style.fontSize = '20px';
                closeButton.style.width = '30px';
                closeButton.style.height = '30px';
                closeButton.style.borderRadius = '5px';
                closeButton.style.transition = 'background-color 0.3s';
                closeButton.onmouseover = function() { this.style.backgroundColor = '#c82333'; };
                closeButton.onmouseout = function() { this.style.backgroundColor = '#dc3545'; };
                closeButton.addEventListener('click', function() {
                    popupContainer.style.display = 'none';
                    isPopupOpen = false;
                    window.__astrasPopup = null;
                    saveMessages();
                });

                popupHeader.appendChild(closeButton);

                // ----- Chat window -----
                chatWindow = document.createElement('div');
                chatWindow.style.flex = '1';
                chatWindow.style.width = '100%';
                chatWindow.style.marginTop = '10px';
                chatWindow.style.border = '1px solid #ccc';
                chatWindow.style.overflowY = 'auto';
                chatWindow.style.padding = '5px';
                chatWindow.style.boxSizing = 'border-box';
                chatWindow.style.backgroundColor = '#f9f9f9';
                chatWindow.style.borderRadius = '5px';

                // Store references for theme updates
                popupContainer.chatWindow = chatWindow;

                chatMessages = JSON.parse(localStorage.getItem('chatMessages')) || [];
                chatMessages.forEach(msg => {
                    const el = document.createElement('div');
                    el.classList.add('message');
                    el.innerHTML = msg;
                    el.style.border = '1px solid #ccc';
                    el.style.padding = '5px';
                    el.style.marginBottom = '5px';
                    el.style.borderRadius = '5px';
                    el.style.animation = 'fadeIn 0.5s';
                    chatWindow.appendChild(el);
                });

                // ----- Model input with dynamic datalist -----
                const modelContainer = document.createElement('div');
                modelContainer.style.display = 'flex';
                modelContainer.style.alignItems = 'center';
                modelContainer.style.marginTop = '5px';
                modelContainer.style.gap = '5px';

                const modelLabel = document.createElement('span');
                modelLabel.innerText = 'Model:';
                modelLabel.style.fontSize = '13px';
                modelContainer.appendChild(modelLabel);

                const modelInput = document.createElement('input');
                modelInput.id = 'modelInput';
                modelInput.type = 'text';
                modelInput.value = config.model;
                modelInput.style.flex = '1';
                modelInput.style.padding = '8px';
                modelInput.style.border = '1px solid #ccc';
                modelInput.style.borderRadius = '5px';
                modelInput.style.fontSize = '13px';
                modelInput.setAttribute('list', 'modelSuggestions');
                modelContainer.appendChild(modelInput);
                popupContainer.modelInput = modelInput;

                const datalist = document.createElement('datalist');
                datalist.id = 'modelSuggestions';
                const fallbackModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4-vision-preview', 'gpt-4o', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'gemini-1.5-pro'];
                fallbackModels.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    datalist.appendChild(opt);
                });
                modelContainer.appendChild(datalist);

                fetchModels().then(models => {
                    if (models && models.length) {
                        while (datalist.firstChild) datalist.removeChild(datalist.firstChild);
                        models.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m;
                            datalist.appendChild(opt);
                        });
                    }
                });

                modelInput.addEventListener('change', function() {
                    const newModel = this.value.trim();
                    if (newModel) {
                        config.model = newModel;
                    } else {
                        // If cleared, revert to previous config.model
                        this.value = config.model;
                    }
                    saveConfig();
                });

                // ----- User input -----
                const userInput = document.createElement('input');
                userInput.type = 'text';
                userInput.placeholder = 'Message AstrasCopilot...';
                userInput.style.width = '100%';
                userInput.style.marginTop = '10px';
                userInput.style.padding = '10px';
                userInput.style.border = '1px solid #ccc';
                userInput.style.borderRadius = '5px';
                userInput.style.boxSizing = 'border-box';
                popupContainer.userInput = userInput;

                // ----- Buttons -----
                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'space-between';
                buttonContainer.style.marginTop = '10px';

                const sendButton = document.createElement('button');
                sendButton.innerText = 'Send';
                sendButton.style.padding = '10px 20px';
                sendButton.style.backgroundColor = '#28a745';
                sendButton.style.color = 'white';
                sendButton.style.border = 'none';
                sendButton.style.borderRadius = '5px';
                sendButton.style.cursor = 'pointer';
                sendButton.style.flex = '1';
                sendButton.style.marginLeft = '5px';
                sendButton.style.transition = 'background-color 0.3s';
                sendButton.onmouseover = function() { this.style.backgroundColor = '#218838'; };
                sendButton.onmouseout = function() { this.style.backgroundColor = '#28a745'; };

                const clearButton = document.createElement('button');
                clearButton.innerText = 'Clear';
                clearButton.style.padding = '10px 20px';
                clearButton.style.backgroundColor = '#ffc107';
                clearButton.style.color = 'white';
                clearButton.style.border = 'none';
                clearButton.style.borderRadius = '5px';
                clearButton.style.cursor = 'pointer';
                clearButton.style.flex = '1';
                clearButton.style.marginLeft = '5px';
                clearButton.style.transition = 'background-color 0.3s';
                clearButton.onmouseover = function() { this.style.backgroundColor = '#e0a800'; };
                clearButton.onmouseout = function() { this.style.backgroundColor = '#ffc107'; };
                clearButton.addEventListener('click', function() {
                    chatMessages = [];
                    localStorage.removeItem('chatMessages');
                    while (chatWindow.firstChild) chatWindow.removeChild(chatWindow.firstChild);
                });

                    const analyzeSpriteButton = document.createElement('button');
                    analyzeSpriteButton.innerText = 'Analyze Code';
                    analyzeSpriteButton.style.padding = '10px 20px';
                    analyzeSpriteButton.style.backgroundColor = '#17a2b8';
                    analyzeSpriteButton.style.color = 'white';
                    analyzeSpriteButton.style.border = 'none';
                    analyzeSpriteButton.style.borderRadius = '5px';
                    analyzeSpriteButton.style.cursor = 'pointer';
                    analyzeSpriteButton.style.flex = '2';
                    analyzeSpriteButton.style.marginLeft = '5px';
                    analyzeSpriteButton.style.transition = 'background-color 0.3s';
                    analyzeSpriteButton.onmouseover = function() { this.style.backgroundColor = '#138496'; };
                    analyzeSpriteButton.onmouseout = function() { this.style.backgroundColor = '#17a2b8'; };

                    // Vision popup (unchanged, uses closure)
                    analyzeSpriteButton.addEventListener('click', function openAnalyzePopup() {
                        if (document.getElementById('analyzePopup')) return;

                        const overlay = document.createElement('div');
                        overlay.id = 'analyzeOverlay';
                        overlay.style.position = 'fixed';
                        overlay.style.top = '0';
                        overlay.style.left = '0';
                        overlay.style.width = '100%';
                        overlay.style.height = '100%';
                        overlay.style.background = 'rgba(0, 0, 0, 0.5)';
                        overlay.style.zIndex = '9999';
                        overlay.style.display = 'flex';
                        overlay.style.justifyContent = 'center';
                        overlay.style.alignItems = 'center';
                        document.body.appendChild(overlay);

                        const popup = document.createElement('div');
                        popup.id = 'analyzePopup';
                        popup.style.background = '#fff';
                        popup.style.padding = '20px';
                        popup.style.borderRadius = '10px';
                        popup.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
                        popup.style.width = '400px';
                        popup.style.textAlign = 'center';
                        popup.style.position = 'relative';
                        popup.style.display = 'flex';
                        popup.style.flexDirection = 'column';
                        popup.style.gap = '10px';
                        overlay.appendChild(popup);

                        popup.innerHTML = `
                        <h2 style="margin: 0; font-size: 1.5rem; color: #333;">Analyze Code with Vision</h2>
                        <p style="font-size: 0.9rem; color: #666;">Upload a screenshot of your sprite code for analysis.</p>
                        <textarea id="spritePromptAnalyze" placeholder="Enter your prompt..." rows="6"
                        style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; font-size: 1rem; box-sizing: border-box; resize: none; height: 120px;"></textarea>
                        <div id="dropArea" style="
                        border: 2px dashed var(--looks-secondary);
                        padding: 20px;
                        cursor: pointer;
                        text-align: center;
                        font-size: 0.9rem;
                        color: var(--looks-secondary);
                        border-radius: 5px;
                        background: #f8f9fa;
                        ">
                        Select or Paste a Screenshot Here
                        <input type="file" id="spriteImage" accept="image/*" style="display: none;">
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                        <button id="analyzeConfirm" style="flex:1; background: green; color: white; padding: 10px; border: none; cursor: pointer; border-radius: 5px; font-size: 1rem;">Analyze</button>
                        <button id="analyzeClose" style="flex:1; background: red; color: white; padding: 10px; border: none; cursor: pointer; border-radius: 5px; font-size: 1rem; margin-left: 10px;">Cancel</button>
                        </div>
                        `;

                        const isDark = getCurrentTheme() === 'dark';
                        if (isDark) {
                            popup.style.background = '#2c2c2c';
                            popup.style.color = '#fff';
                            popup.querySelector('h2').style.color = '#ddd';
                            popup.querySelector('p').style.color = '#bbb';
                            popup.querySelector('#spritePromptAnalyze').style.backgroundColor = '#474747';
                            popup.querySelector('#spritePromptAnalyze').style.color = '#fff';
                            popup.querySelector('#spritePromptAnalyze').style.border = 'none';
                            popup.querySelector('#dropArea').style.backgroundColor = '#3a3a3a';
                            popup.querySelector('#dropArea').style.color = '#ddd';
                            popup.querySelector('#dropArea').style.border = '2px dashed #aaa';
                        }

                        const spriteImageInput = popup.querySelector('#spriteImage');
                        const dropArea = popup.querySelector('#dropArea');

                        function handleImageUpload() {
                            if (spriteImageInput.files.length > 0) {
                                dropArea.innerText = '✅ Image selected!';
                                dropArea.style.color = 'green';
                            }
                        }

                        dropArea.addEventListener('click', () => spriteImageInput.click());
                        spriteImageInput.addEventListener('change', handleImageUpload);
                        dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.background = '#e3f2fd'; });
                        dropArea.addEventListener('dragleave', () => dropArea.style.background = '#f8f9fa');
                        dropArea.addEventListener('drop', e => {
                            e.preventDefault();
                            dropArea.style.background = '#f8f9fa';
                            if (e.dataTransfer.files.length > 0) {
                                spriteImageInput.files = e.dataTransfer.files;
                                handleImageUpload();
                            }
                        });

                        const closeAnalyze = () => {
                            overlay.style.opacity = '0';
                            setTimeout(() => document.body.removeChild(overlay), 200);
                        };
                        popup.querySelector('#analyzeClose').addEventListener('click', closeAnalyze);
                        overlay.addEventListener('click', e => e.target === overlay && closeAnalyze());

                        popup.querySelector('#analyzeConfirm').addEventListener('click', async function() {
                            const userPrompt = popup.querySelector('#spritePromptAnalyze').value.trim();
                            const file = spriteImageInput.files[0];
                            if (!userPrompt) return alert('Please enter a prompt.');
                            if (!file) return alert('Please upload an image.');
                            if (!config.apiKey) return alert('⚠️ API Key is missing. Please configure it in Settings.');

                            const userDisplay = '<span class="user-prefix" style="color: green;">You:</span> ' + formatText(userPrompt + ' [image]');
                            chatMessages.push(userDisplay);
                            const msgEl = document.createElement('div');
                            msgEl.classList.add('message');
                            msgEl.innerHTML = userDisplay;
                            msgEl.style.border = '1px solid #ccc';
                            msgEl.style.padding = '10px';
                            msgEl.style.marginBottom = '10px';
                            msgEl.style.borderRadius = '5px';
                            chatWindow.appendChild(msgEl);
                            saveMessages();
                            chatWindow.scrollTop = chatWindow.scrollHeight;

                            closeAnalyze();

                            try {
                                const reader = new FileReader();
                                reader.onload = async function(e) {
                                    const base64 = e.target.result.split(',')[1];
                                    const mimeType = file.type || 'image/png';

                                    const messages = [{
                                        role: 'user',
                                        content: [
                                            { type: 'text', text: userPrompt },
                                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                                        ]
                                    }];

                                    const model = document.getElementById('modelInput')?.value.trim() || config.model;
                                    if (!model) {
                                        throw new Error('Model name is empty.');
                                    }
                                    const aiResponse = await callOpenAI(messages, model);

                                    const aiDisplay = '<span class="gpt-prefix" style="color: red;">AstrasCopilot:</span> ' + formatText(aiResponse);
                                    chatMessages.push(aiDisplay);
                                    const aiEl = document.createElement('div');
                                    aiEl.classList.add('message');
                                    aiEl.innerHTML = aiDisplay;
                                    aiEl.style.border = '1px solid #ccc';
                                    aiEl.style.padding = '10px';
                                    aiEl.style.marginBottom = '10px';
                                    aiEl.style.borderRadius = '5px';
                                    chatWindow.appendChild(aiEl);
                                    saveMessages();
                                    chatWindow.scrollTop = chatWindow.scrollHeight;
                                };
                                reader.readAsDataURL(file);
                            } catch (error) {
                                console.error(error);
                                alert('Error: ' + error.message);
                            }
                        });
                    });

                    async function sendMessage() {
                        sendButton.classList.add('is-loading');
                        sendButton.disabled = true;

                        const userMessage = userInput.value.trim();
                        if (!userMessage) {
                            alert('Please enter a message.');
                            sendButton.classList.remove('is-loading');
                            sendButton.disabled = false;
                            return;
                        }

                        if (!config.apiKey) {
                            alert('⚠️ API Key is missing. Please configure it in Settings.');
                            sendButton.classList.remove('is-loading');
                            sendButton.disabled = false;
                            return;
                        }

                        // 获取模型名称，如果为空则使用配置中的模型
                        let model = modelInput.value.trim();
                        if (!model) {
                            model = config.model;
                            // 如果配置也为空，使用默认值并提示
                            if (!model) {
                                model = DEFAULT_MODEL;
                                config.model = model;
                                saveConfig();
                                modelInput.value = model;
                            } else {
                                modelInput.value = model; // 恢复显示
                            }
                        }

                        const userDisplay = '<span class="user-prefix" style="color: green;">You:</span> ' + formatText(userMessage);
                        chatMessages.push(userDisplay);
                        const userEl = document.createElement('div');
                        userEl.classList.add('message');
                        userEl.innerHTML = userDisplay;
                        userEl.style.border = '1px solid #ccc';
                        userEl.style.padding = '10px';
                        userEl.style.marginBottom = '10px';
                        userEl.style.borderRadius = '5px';
                        chatWindow.appendChild(userEl);
                        userInput.value = '';
                        saveMessages();
                        chatWindow.scrollTop = chatWindow.scrollHeight;

                        try {
                            const messages = [{ role: 'user', content: userMessage }];
                            const aiResponse = await callOpenAI(messages, model);

                            const aiDisplay = '<span class="gpt-prefix" style="color: red;">AstrasCopilot:</span> ' + formatText(aiResponse);
                            chatMessages.push(aiDisplay);
                            const aiEl = document.createElement('div');
                            aiEl.classList.add('message');
                            aiEl.innerHTML = aiDisplay;
                            aiEl.style.border = '1px solid #ccc';
                            aiEl.style.padding = '10px';
                            aiEl.style.marginBottom = '10px';
                            aiEl.style.borderRadius = '5px';
                            chatWindow.appendChild(aiEl);
                            saveMessages();
                            chatWindow.scrollTop = chatWindow.scrollHeight;
                        } catch (error) {
                            console.error(error);
                            const errorMsg = 'Error: ' + error.message;
                            chatMessages.push(errorMsg);
                            const errEl = document.createElement('div');
                            errEl.innerHTML = errorMsg;
                            errEl.style.border = '1px solid #e57373';
                            errEl.style.padding = '10px';
                            errEl.style.marginBottom = '10px';
                            errEl.style.borderRadius = '5px';
                            chatWindow.appendChild(errEl);
                            saveMessages();
                        } finally {
                            sendButton.classList.remove('is-loading');
                            sendButton.disabled = false;
                        }
                    }

                    sendButton.addEventListener('click', sendMessage);
                    userInput.addEventListener('keydown', e => e.key === 'Enter' && sendMessage());

                    buttonContainer.appendChild(sendButton);
                    buttonContainer.appendChild(clearButton);
                    buttonContainer.appendChild(analyzeSpriteButton);

                    popupContainer.appendChild(popupHeader);
                    popupContainer.appendChild(chatWindow);
                    popupContainer.appendChild(modelContainer);
                    popupContainer.appendChild(userInput);
                    popupContainer.appendChild(buttonContainer);
                    document.body.appendChild(popupContainer);

                    dragElement(popupContainer, popupHeader);

                    // Define applyTheme for this popup
                    popupContainer.applyTheme = function() {
                        const isDark = getCurrentTheme() === 'dark';
                        if (isDark) {
                            popupContainer.style.backgroundColor = '#2c2c2c';
                            popupContainer.style.border = 'none';
                            chatWindow.style.backgroundColor = '#3a3a3a';
                            chatWindow.style.color = '#fff';
                            chatWindow.style.border = 'none';
                            userInput.style.backgroundColor = '#474747';
                            userInput.style.color = '#fff';
                            userInput.style.border = 'none';
                            modelInput.style.backgroundColor = '#505050';
                            modelInput.style.color = '#fff';
                            modelInput.style.border = 'none';
                        } else {
                            popupContainer.style.backgroundColor = 'white';
                            popupContainer.style.border = '1px solid #ccc';
                            chatWindow.style.backgroundColor = '#f9f9f9';
                            chatWindow.style.color = '#000';
                            chatWindow.style.border = '1px solid #ccc';
                            userInput.style.backgroundColor = 'white';
                            userInput.style.color = '#000';
                            userInput.style.border = '1px solid #ccc';
                            modelInput.style.backgroundColor = 'white';
                            modelInput.style.color = '#000';
                            modelInput.style.border = '1px solid #ccc';
                        }
                    };

                    popupContainer.applyTheme();
                    isPopupOpen = true;
            }

            function dragElement(el, handle) {
                let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
                handle.onmousedown = dragMouseDown;
                function dragMouseDown(e) {
                    e = e || window.event;
                    e.preventDefault();
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    document.onmousemove = elementDrag;
                }
                function elementDrag(e) {
                    e = e || window.event;
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
                    localStorage.setItem('popupTop', el.style.top);
                    localStorage.setItem('popupLeft', el.style.left);
                }
            }

            function formatText(text) {
                text = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/"(.*?)"/g, '<span style="color: #639cff; font-style: italic;">"$1"</span>');
                let blocks = text.split(/\n\s*\n/);
                blocks = blocks.map(block => {
                    let lines = block.split('\n').map(l => l.trim()).filter(l => l);
                    if (lines.every(l => /^\d+\./.test(l))) {
                        let items = lines.map(l => `<li>${l.replace(/^\d+\.\s*/, '')}</li>`);
                        return `<ol>${items.join('')}</ol>`;
                    } else if (lines.every(l => /^[-*]\s/.test(l))) {
                        let items = lines.map(l => `<li>${l.replace(/^[-*]\s*/, '')}</li>`);
                        return `<ul>${items.join('')}</ul>`;
                    } else {
                        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
                    }
                });
                return blocks.join('');
            }

            chatButton.addEventListener('click', openPopup);
            feedbackButton.parentNode.insertBefore(chatButton, feedbackButton.nextSibling);
        }

        // ---------- Live theme monitoring ----------
        function startThemeMonitor() {
            setInterval(() => {
                const newTheme = getCurrentTheme();
                if (newTheme !== currentTheme) {
                    currentTheme = newTheme;
                    // Update main popup if open
                    if (window.__astrasPopup && window.__astrasPopup.applyTheme) {
                        window.__astrasPopup.applyTheme();
                    }
                    // Update settings popup if open
                    if (window.__astrasSettingsPopup && window.__astrasSettingsPopup.applyTheme) {
                        window.__astrasSettingsPopup.applyTheme();
                    }
                }
            }, 500);
        }

        // ---------- Initialization ----------
        injectAstrasCopilotButton();
        startThemeMonitor();

        const observer = new MutationObserver(() => injectAstrasCopilotButton());
        observer.observe(document.body, { childList: true, subtree: true });

        const styleSheet = document.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.innerText = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .message { animation: fadeIn 0.5s; }
        `;
        document.head.appendChild(styleSheet);

        document.addEventListener('contextmenu', e => e.preventDefault());
    })();
}
