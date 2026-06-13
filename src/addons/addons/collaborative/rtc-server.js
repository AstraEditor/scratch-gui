import { ID_SEA, DEFAULT_STUN_URLS, SERVER_OPCODE, idHead } from "./constants.js";
import { fetchWithTimeout, getAPPNAME } from "./utils.js";
import { cleanupAllRemote } from "./handle.js";

/**
 * 协作编辑的网络层：房间管理（HTTP）+ 信令服务器（WebSocket）+ P2P（WebRTC）。
 */
export class RTCServer {
    constructor({
        msg,
        console,
        updateTipText,
        vm,
        onPeerMessage,
        onStateChange,
        onPeerLeft,
    }) {
        this._msg = msg;
        this._console = console;
        this._updateTipText = updateTipText;
        this._onPeerMessage = onPeerMessage;
        this._onStateChange = onStateChange;
        this._onPeerLeft = onPeerLeft || null;
        this._vm = vm;

        this._scriptBlockCache = new Map();
        this._commentCache = new Map();  // targetId → JSON string
        this._extensionCache = new Set(); // Set<extensionId>
        this._costumeCache = new Map();   // targetId → Array<{name, dataFormat, bitmapResolution, rotationCenterX, rotationCenterY}>
        this._soundCache = new Map();     // targetId → Array<{name, dataFormat, rate, sampleCount}>
        this._variableCache = new Map();   // targetId → Map<varId, {name, type}>
        this._spriteIdCache = null;

        this._server = null;
        this._allSTUN_URLs = null;
        this._rtcConnections = new Map();
        this._dataChannels = new Map();
        this._pendingCandidates = new Map();
        this._isHost = false;
        this._chunkBuffers = new Map();
        this._pendingMessages = new Map();
        this._ingoreUpdate = false;
        this._remoteOperationCount = 0;
        this._remoteUpdateInProgress = false;
        this.state = { clientId: null, roomId: null, allMembers: [] };

        this._Blockly = null; // Set via setBlockly() after construction

        // 编辑锁定状态：记录当前用户正在编辑的对象
        this._localEditState = null; // { type: 'block'|'comment', id: string } | null
        this._editLockListeners = []; // 事件监听器，退出时清理

        // 聊天输入框状态
        this._chatInputEl = null;      // HTML input 元素
        this._chatBubbleEl = null;     // 本地聊天气泡 SVG 元素
        this._chatText = '';           // 当前输入的文字
        this._lastPointerPos = { x: 0, y: 0 }; // 上次光标位置（用于定位输入框）
        this._chatActive = false;      // 输入框是否激活

        this.workspace = document.querySelector("[class*=gui_blocks-wrapper]");
        this.editingTargetIndex = -1;
        this.boundMouseMoveHandler = this.mouseMoveHandler.bind(this);
        this._vm.on("targetsUpdate", () => this.updateWorkspace());
    }

    setBlockly(b) {
        this._Blockly = b;
        if (!this._editLockListenersReady) {
            this._setupEditLockListeners();
            this._editLockListenersReady = true;
        }
        // 重新绑定 mousemove 到当前 workspace（切换 sprite 时旧 workspace 已 dispose）
        this._bindPointerToCurrentWorkspace();
    }

    _bindPointerToCurrentWorkspace() {
        // 优先用 targetWorkspace（WorkspaceSvg，有 addEventListener）；fallback 到 getMainWorkspace
        const ws = this._Blockly?.getMainWorkspace()?.targetWorkspace || this._Blockly?.getMainWorkspace();
        if (!ws || typeof ws.addEventListener !== 'function') return;
        if (this._boundWorkspace === ws) return;  // 同一个 workspace，跳过
        // 解绑旧的
        if (this._boundWorkspace && this.boundMouseMoveHandler) {
            try { this._boundWorkspace.removeEventListener("mousemove", this.boundMouseMoveHandler); } catch { /* workspace已dispose */ }
        }
        // 绑定新的
        ws.addEventListener("mousemove", this.boundMouseMoveHandler);
        this._boundWorkspace = ws;
    }

    onIngoreUpdate(ingoreUpdate) {
        if (ingoreUpdate) {
            this._remoteOperationCount++;
            this._ingoreUpdate = true;
        } else {
            this._remoteOperationCount = Math.max(0, this._remoteOperationCount - 1);
            if (this._remoteOperationCount === 0) this._ingoreUpdate = false;
        }
    }

    getUserName() {
        return localStorage.getItem("tw:username") || "user";
    }

    getState() { return { ...this.state }; }

    isHost() { return this._isHost; }

    kickMember(targetId) {
        if (this._server && this._isHost) {
            this.broadcastToPeers(JSON.stringify({
                type: SERVER_OPCODE.KICK,
                targetId,
            }));
        }
    }

    async login(mode = "reg", serverUrl = "localhost:1832", roomId = "") {
        await this._ensureSTUNList();
        if (!window.RTCPeerConnection) {
            this._updateTipText(this._msg("create_rtc_failed"), "error");
            return;
        }
        this._updateTipText(this._msg("linking_to_server"));
        const spawnedRoomID = await this._spawnRoomID(mode, roomId, serverUrl);
        if (mode === "join") {
            if (!spawnedRoomID.isUsing) {
                this._updateTipText(this._msg("join_failed"), "error");
                return;
            }
            this._server = new WebSocket(`ws://${serverUrl}?room=${spawnedRoomID.id}&name=${this.getUserName()}`);
        } else {
            this._server = new WebSocket(`ws://${serverUrl}?room=${spawnedRoomID}&name=${this.getUserName()}`);
        }
        this._server.onmessage = (msgs) => {
            try { this._handleServerMessage(JSON.parse(msgs.data)); }
            catch (e) { this._console.error("[协作] 解析服务器消息失败:", e); }
        };
        this._server.onerror = () => this._updateTipText(this._msg("server_error"), "error");
        this._server.onclose = () => {
            this.exit();
            this._closeAllPeerConnections();
            this._updateTipText(this._msg("server_exit"), "error");
            this._server = null;
            this.state.clientId = null;
            this.state.roomId = null;
            this.state.allMembers = [];
            this._emitState();
        };
        window.addEventListener("beforeunload", () => this.exit());
        window.addEventListener("pagehide", () => this.exit());
        this.workspace.addEventListener("mousemove", this.boundMouseMoveHandler);

        // 聊天功能：Ctrl+T 打开输入框
        this._boundKeyHandler = this._handleKeyDown.bind(this);
        window.addEventListener("keydown", this._boundKeyHandler);

        // 注册编辑锁定的事件监听（在 setBlockly 中实际执行）
        this._editLockListenersReady = false;

        this._vm.runtime.on("PROJECT_CHANGED", () => {
            if (this._ingoreUpdate || this._remoteUpdateInProgress) return;
            if (this._updateTimer) clearTimeout(this._updateTimer);
            this._updateTimer = setTimeout(() => {
                this._updateTimer = null;
                if (this._Blockly && this._Blockly.Events && this._Blockly.Events.getGroup()) return;
                this.updateProject();
            }, 200);
        });

        // Hook extension loading since it doesn't emit PROJECT_CHANGED
        const origLoad = this._vm.extensionManager.loadExtensionURL.bind(this._vm.extensionManager);
        this._vm.extensionManager.loadExtensionURL = (...args) => {
            return origLoad(...args).then(result => {
                if (!this._ingoreUpdate && !this._remoteUpdateInProgress) {
                    this.updateProject();
                }
                return result;
            });
        };

        // 拦截项目替换操作（新项目、加载项目等）：联机中直接退出
        if (!this._vm._collabLoadProjectHooked) {
            this._vm._collabLoadProjectHooked = true;
            const origLoadProject = this._vm.loadProject.bind(this._vm);
            this._vm.loadProject = async (...args) => {
                if (this.state.clientId && !this._ingoreUpdate) {
                    this._console.log("[协作] 检测到项目替换操作，退出联机");
                    this.exit();
                }
                return origLoadProject(...args);
            };
        }

        this._vm.runtime.on("EXTENSION_REMOVED", () => {
            if (!this._ingoreUpdate && !this._remoteUpdateInProgress) {
                this.updateProject();
            }
        });
    }

    async updateProject() {
        if (this._ingoreUpdate || this._remoteUpdateInProgress) return;

        const liveTargets = this._vm.runtime.targets;
        const liveIds = liveTargets.map(t => t.id);

        if (!this._spriteIdCache) this._spriteIdCache = new Set(liveIds);
        const oldIds = this._spriteIdCache;
        const newIdsSet = new Set(liveIds);
        const waitForBroadcast = [];

        for (const [index, id] of liveIds.entries()) {
            if (!oldIds.has(id)) waitForBroadcast.push({ type: SERVER_OPCODE.SPRITE_ADD, id, index });
        }
        for (const id of oldIds) {
            if (!newIdsSet.has(id)) {
                const oldIndex = Array.from(oldIds).indexOf(id);
                waitForBroadcast.push({ type: SERVER_OPCODE.SPRITE_DELETE, id, index: oldIndex });
            }
        }
        this._spriteIdCache = newIdsSet;

        // ── Extensions: detect changes ──
        // Use _loadedExtensions keys (includes builtins like pen, music)
        // getExtensionURLs() skips builtins, so we can't rely on it alone
        const loadedExtIds = new Set(this._vm.extensionManager._loadedExtensions.keys());
        for (const id of loadedExtIds) {
            if (!this._extensionCache.has(id)) {
                this._console.log(`[协作] extension ADD: ${id}`);
                // For builtins, send just the id; for custom, send the URL too
                const urls = this._vm.extensionManager.getExtensionURLs ? this._vm.extensionManager.getExtensionURLs() : {};
                waitForBroadcast.push({
                    type: SERVER_OPCODE.EXTENSION_ADD,
                    id,
                    url: urls[id] || null,
                });
            }
        }
        for (const id of this._extensionCache) {
            if (!loadedExtIds.has(id)) {
                this._console.log(`[协作] extension REMOVE: ${id}`);
                waitForBroadcast.push({ type: SERVER_OPCODE.EXTENSION_REMOVE, id });
            }
        }
        this._extensionCache = loadedExtIds;

        // Seed XML cache for targets that appeared since last run (remote
        // SPRITE_ADD). Only seed if the target was NOT previously tracked
        // in _spriteIdCache — genuinely new targets whose default blocks
        // are synced via SPRITE_ADD and should NOT be re-broadcast.
        for (let i = 0; i < liveTargets.length; i++) {
            const target = liveTargets[i];
            if (!this._scriptBlockCache.has(target.id) && !oldIds.has(target.id)) {
                const nc = new Map(); this._scriptBlockCache.set(target.id, nc);
                if (target.blocks && target.blocks._scripts) {
                    for (const rid of target.blocks._scripts) {
                        try { nc.set(rid, target.blocks.blockToXML(rid, target.comments || {})); } catch (e) {}
                    }
                }
            }
        }

        for (let targetIndex = 0; targetIndex < liveTargets.length; targetIndex++) {
            const target = liveTargets[targetIndex];
            if (!target?.blocks?._scripts) continue;

            const liveScripts = target.blocks._scripts;
            const targetId = target.id;

            if (!this._scriptBlockCache.has(targetId)) this._scriptBlockCache.set(targetId, new Map());
            const cache = this._scriptBlockCache.get(targetId);

            const cacheKeys = new Set(Array.from(cache.keys()));
            const liveSet = new Set(liveScripts);

            const addedRootIds = liveScripts.filter(rid => !cacheKeys.has(rid));
            const removedRootIds = Array.from(cacheKeys).filter(rid => !liveSet.has(rid));

            // Detect replacements: when a head block is replaced, its rootId changes
            // but the stack is at the same position. Match by coordinates + opcode.
            const replacements = new Map(); // oldRootId -> newRootId
            const handledAdded = new Set();
            for (const oldRid of removedRootIds) {
                const oldXml = cache.get(oldRid);
                if (!oldXml) continue;
                const oldX = parseFloat(oldXml.match(/x="([^"]+)"/)?.[1]);
                const oldY = parseFloat(oldXml.match(/y="([^"]+)"/)?.[1]);
                const oldOpcode = oldXml.match(/type="([^"]+)"/)?.[1];
                if (!isFinite(oldX) || !isFinite(oldY)) continue;

                for (const newRid of addedRootIds) {
                    if (handledAdded.has(newRid)) continue;
                    try {
                        const newXml = target.blocks.blockToXML(newRid, target.comments || {});
                        if (!newXml) continue;
                        const newX = parseFloat(newXml.match(/x="([^"]+)"/)?.[1]);
                        const newY = parseFloat(newXml.match(/y="([^"]+)"/)?.[1]);
                        const newOpcode = newXml.match(/type="([^"]+)"/)?.[1];
                        // 坐标接近且 opcode 一致才认为是 replacement
                        if (isFinite(newX) && isFinite(newY) && Math.abs(oldX - newX) < 5 && Math.abs(oldY - newY) < 5 && oldOpcode === newOpcode) {
                            replacements.set(oldRid, { newRid, newXml });
                            handledAdded.add(newRid);
                            break;
                        }
                    } catch (e) {}
                }
            }

            // Send replacements as UPDATE (with oldRootId for receiver to delete old tree)
            for (const [oldRid, { newRid, newXml }] of replacements) {
                waitForBroadcast.push({ type: SERVER_OPCODE.BLOCK_UPDATE, targetIndex, rootId: newRid, oldRootId: oldRid, xml: newXml });
                cache.delete(oldRid);
                cache.set(newRid, newXml);
            }

            // Remaining added = genuinely new stacks
            for (const rid of addedRootIds) {
                if (handledAdded.has(rid)) continue;
                try {
                    const xml = target.blocks.blockToXML(rid, target.comments || {});
                    if (xml) {
                        waitForBroadcast.push({ type: SERVER_OPCODE.BLOCK_CREATE, targetIndex, rootId: rid, xml });
                        cache.set(rid, xml);
                    }
                } catch (e) { this._console.error(`[协作] 序列化脚本 ${rid} 失败:`, e); }
            }

            // Modified scripts: compare XML (same rootId)
            const commonIds = liveScripts.filter(rid => cacheKeys.has(rid) && !replacements.has(rid));
            for (const rid of commonIds) {
                try {
                    const curXml = target.blocks.blockToXML(rid, target.comments || {});
                    if (!curXml) continue;
                    const oldXml = cache.get(rid);
                    if (curXml === oldXml) continue;

                    cache.set(rid, curXml);
                    waitForBroadcast.push({ type: SERVER_OPCODE.BLOCK_UPDATE, targetIndex, rootId: rid, xml: curXml });
                } catch (e) { this._console.error(`[协作] 比较脚本 ${rid} 失败:`, e); }
            }

            // Removed scripts: only delete if truly gone (not replaced)
            const trulyRemoved = removedRootIds.filter(rid => !replacements.has(rid));
            if (trulyRemoved.length > 0) {
                const trulyDeleted = trulyRemoved.filter(rid => !target.blocks._blocks[rid]);
                if (trulyDeleted.length > 0) {
                    waitForBroadcast.push({ type: SERVER_OPCODE.BLOCK_DELETE, targetIndex, rootIds: trulyDeleted });
                }
                for (const rid of trulyRemoved) cache.delete(rid);
            }

            // ── Comments: full sync on any change ──
            const liveComments = target.comments || {};
            const sortedKeys = Object.keys(liveComments).sort();
            const liveList = sortedKeys.map(k => ({
                id: k,
                text: liveComments[k].text,
                x: liveComments[k].x,
                y: liveComments[k].y,
                width: liveComments[k].width,
                height: liveComments[k].height,
                minimized: liveComments[k].minimized,
                blockId: liveComments[k].blockId,
            }));
            const liveSerialized = JSON.stringify(liveList);

            if (!this._commentCache.has(targetId)) this._commentCache.set(targetId, '');
            const cachedSerialized = this._commentCache.get(targetId);

            if (liveSerialized !== cachedSerialized) {
                waitForBroadcast.push({
                    type: SERVER_OPCODE.COMMENT_SYNC,
                    targetIndex,
                    comments: liveList,
                });
                this._commentCache.set(targetId, liveSerialized);
            }

            // ── Costumes: detect changes (index-based diffing) ──
            const costumes = target.sprite?.costumes || [];
            // 快照包含 assetId，用于检测纯内容变更（画面改变但元数据不变的情况）
            const costumeSnapshot = costumes.map(c => ({
                assetId: c.assetId,
                name: c.name, dataFormat: c.dataFormat,
                bitmapResolution: c.bitmapResolution,
                rotationCenterX: c.rotationCenterX, rotationCenterY: c.rotationCenterY,
            }));
            if (!this._costumeCache.has(targetId)) {
                this._costumeCache.set(targetId, costumeSnapshot);
                this._console.log(`[协作-造型] 初始化缓存 target=${targetId} count=${costumes.length} assetIds=[${costumes.map(c=>c.assetId).join(',')}]`);
            }
            const cachedCostumes = this._costumeCache.get(targetId);
            // 基于索引位置逐位比较
            if (JSON.stringify(costumeSnapshot) !== JSON.stringify(cachedCostumes)) {
                this._console.log(`[协作-造型] 检测到变更 target=${targetId} live=${costumes.length} cached=${cachedCostumes.length}`);
                const maxLen = Math.max(costumes.length, cachedCostumes.length);
                for (let i = 0; i < maxLen; i++) {
                    const live = costumes[i];
                    const cached = cachedCostumes[i];
                    if (!live && cached) {
                        this._console.log(`[协作-造型] DELETE index=${i} name=${cached.name}`);
                        waitForBroadcast.push({ type: SERVER_OPCODE.COSTUME_DELETE, targetIndex, index: i });
                    } else if (live && !cached) {
                        const data = live.asset?.data;
                        if (data) {
                            let binary = '';
                            const bytes = new Uint8Array(data);
                            for (let bi = 0; bi < bytes.byteLength; bi++) binary += String.fromCharCode(bytes[bi]);
                            waitForBroadcast.push({
                                type: SERVER_OPCODE.COSTUME_ADD, targetIndex, index: i,
                                name: live.name, assetId: live.assetId, dataFormat: live.dataFormat,
                                bitmapResolution: live.bitmapResolution,
                                rotationCenterX: live.rotationCenterX, rotationCenterY: live.rotationCenterY,
                                data: btoa(binary),
                            });
                            this._console.log(`[协作-造型] ADD index=${i} name=${live.name} assetId=${live.assetId} fmt=${live.dataFormat} size=${bytes.byteLength}`);
                        } else {
                            this._console.warn(`[协作-造型] ADD index=${i} name=${live.name} 但 asset.data 为空，跳过！assetId=${live.assetId} asset=${!!live.asset}`);
                        }
                    } else if (live && cached) {
                        // assetId 变化说明内容变了，元数据变化说明属性变了
                        const liveKey = { assetId: live.assetId, name: live.name, dataFormat: live.dataFormat, bitmapResolution: live.bitmapResolution, rotationCenterX: live.rotationCenterX, rotationCenterY: live.rotationCenterY };
                        const cachedKey = { assetId: cached.assetId, name: cached.name, dataFormat: cached.dataFormat, bitmapResolution: cached.bitmapResolution, rotationCenterX: cached.rotationCenterX, rotationCenterY: cached.rotationCenterY };
                        if (JSON.stringify(liveKey) !== JSON.stringify(cachedKey)) {
                            const data = live.asset?.data;
                            if (data) {
                                let binary = '';
                                const bytes = new Uint8Array(data);
                                for (let bi = 0; bi < bytes.byteLength; bi++) binary += String.fromCharCode(bytes[bi]);
                                waitForBroadcast.push({
                                    type: SERVER_OPCODE.COSTUME_UPDATE, targetIndex, index: i,
                                    name: live.name, assetId: live.assetId,
                                    dataFormat: live.dataFormat, bitmapResolution: live.bitmapResolution,
                                    rotationCenterX: live.rotationCenterX, rotationCenterY: live.rotationCenterY,
                                    data: btoa(binary),
                                });
                                this._console.log(`[协作-造型] UPDATE index=${i} name=${live.name} oldAssetId=${cached.assetId} newAssetId=${live.assetId} fmt=${live.dataFormat} size=${bytes.byteLength}`);
                            } else {
                                this._console.warn(`[协作-造型] UPDATE index=${i} name=${live.name} 但 asset.data 为空，跳过！assetId=${live.assetId} asset=${!!live.asset}`);
                            }
                        }
                    }
                }
                this._costumeCache.set(targetId, costumeSnapshot);
            }

            // ── Sounds: detect changes (index-based diffing) ──
            const sounds = target.sprite?.sounds || [];
            const soundSnapshot = sounds.map(s => ({
                assetId: s.assetId,
                name: s.name, dataFormat: s.dataFormat, rate: s.rate, sampleCount: s.sampleCount,
            }));
            if (!this._soundCache.has(targetId)) {
                this._soundCache.set(targetId, soundSnapshot);
                this._console.log(`[协作-音频] 初始化缓存 target=${targetId} count=${sounds.length} assetIds=[${sounds.map(s=>s.assetId).join(',')}]`);
            }
            const cachedSounds = this._soundCache.get(targetId);
            if (JSON.stringify(soundSnapshot) !== JSON.stringify(cachedSounds)) {
                this._console.log(`[协作-音频] 检测到变更 target=${targetId} live=${sounds.length} cached=${cachedSounds.length}`);
                const maxLen = Math.max(sounds.length, cachedSounds.length);
                for (let i = 0; i < maxLen; i++) {
                    const live = sounds[i];
                    const cached = cachedSounds[i];
                    if (!live && cached) {
                        this._console.log(`[协作-音频] DELETE index=${i} name=${cached.name}`);
                        waitForBroadcast.push({ type: SERVER_OPCODE.SOUND_DELETE, targetIndex, index: i });
                    } else if (live && !cached) {
                        const data = live.asset?.data;
                        if (data) {
                            let binary = '';
                            const bytes = new Uint8Array(data);
                            for (let bi = 0; bi < bytes.byteLength; bi++) binary += String.fromCharCode(bytes[bi]);
                            waitForBroadcast.push({
                                type: SERVER_OPCODE.SOUND_ADD, targetIndex, index: i,
                                name: live.name, assetId: live.assetId, dataFormat: live.dataFormat,
                                rate: live.rate, sampleCount: live.sampleCount,
                                data: btoa(binary),
                            });
                            this._console.log(`[协作-音频] ADD index=${i} name=${live.name} assetId=${live.assetId} fmt=${live.dataFormat} size=${bytes.byteLength}`);
                        } else {
                            this._console.warn(`[协作-音频] ADD index=${i} name=${live.name} 但 asset.data 为空，跳过！assetId=${live.assetId} asset=${!!live.asset}`);
                        }
                    } else if (live && cached) {
                        const liveKey = { assetId: live.assetId, name: live.name, dataFormat: live.dataFormat, rate: live.rate, sampleCount: live.sampleCount };
                        const cachedKey = { assetId: cached.assetId, name: cached.name, dataFormat: cached.dataFormat, rate: cached.rate, sampleCount: cached.sampleCount };
                        if (JSON.stringify(liveKey) !== JSON.stringify(cachedKey)) {
                            const data = live.asset?.data;
                            if (data) {
                                let binary = '';
                                const bytes = new Uint8Array(data);
                                for (let bi = 0; bi < bytes.byteLength; bi++) binary += String.fromCharCode(bytes[bi]);
                                waitForBroadcast.push({
                                    type: SERVER_OPCODE.SOUND_UPDATE, targetIndex, index: i,
                                    name: live.name, assetId: live.assetId,
                                    dataFormat: live.dataFormat, rate: live.rate, sampleCount: live.sampleCount,
                                    data: btoa(binary),
                                });
                                this._console.log(`[协作-音频] UPDATE index=${i} name=${live.name} oldAssetId=${cached.assetId} newAssetId=${live.assetId} fmt=${live.dataFormat} size=${bytes.byteLength}`);
                            } else {
                                this._console.warn(`[协作-音频] UPDATE index=${i} name=${live.name} 但 asset.data 为空，跳过！assetId=${live.assetId} asset=${!!live.asset}`);
                            }
                        }
                    }
                }
                this._soundCache.set(targetId, soundSnapshot);
            }

            // ── Variables/Lists: detect changes ──
            const liveVariables = target.variables || {};
            if (!this._variableCache.has(targetId)) {
                // 初始化缓存
                const varMap = new Map();
                for (const [varId, varObj] of Object.entries(liveVariables)) {
                    varMap.set(varId, { name: varObj.name, type: varObj.type });
                }
                this._variableCache.set(targetId, varMap);
            }
            const cachedVars = this._variableCache.get(targetId);
            const liveVarIds = new Set(Object.keys(liveVariables));
            const cachedVarIds = new Set(cachedVars.keys());

            // 检测新增的变量
            for (const varId of liveVarIds) {
                if (!cachedVarIds.has(varId)) {
                    const varObj = liveVariables[varId];
                    waitForBroadcast.push({
                        type: SERVER_OPCODE.VARIABLE_ADD,
                        targetIndex,
                        varId,
                        name: varObj.name,
                        type: varObj.type, // '' (scalar) or 'list'
                        isCloud: varObj.isCloud || false,
                    });
                    this._console.log(`[协作-变量] ADD: ${varObj.name} (${varObj.type || 'scalar'})`);
                }
            }

            // 检测删除的变量
            for (const varId of cachedVarIds) {
                if (!liveVarIds.has(varId)) {
                    const cachedVar = cachedVars.get(varId);
                    waitForBroadcast.push({
                        type: SERVER_OPCODE.VARIABLE_DELETE,
                        targetIndex,
                        varId,
                    });
                    this._console.log(`[协作-变量] DELETE: ${cachedVar?.name || varId}`);
                }
            }

            // 检测重命名的变量（ID相同但名称或类型变了）
            for (const varId of liveVarIds) {
                if (cachedVarIds.has(varId)) {
                    const liveVar = liveVariables[varId];
                    const cachedVar = cachedVars.get(varId);
                    if (liveVar.name !== cachedVar.name || liveVar.type !== cachedVar.type) {
                        waitForBroadcast.push({
                            type: SERVER_OPCODE.VARIABLE_RENAME,
                            targetIndex,
                            varId,
                            newName: liveVar.name,
                            newType: liveVar.type,
                        });
                        this._console.log(`[协作-变量] RENAME: ${cachedVar.name} → ${liveVar.name}`);
                    }
                }
            }

            // 更新缓存
            const newVarCache = new Map();
            for (const [varId, varObj] of Object.entries(liveVariables)) {
                newVarCache.set(varId, { name: varObj.name, type: varObj.type });
            }
            this._variableCache.set(targetId, newVarCache);
        }

        // Dedup: for same key, last write wins
        const opMap = new Map();
        for (const item of waitForBroadcast) {
            if (item.type === SERVER_OPCODE.SPRITE_ADD || item.type === SERVER_OPCODE.SPRITE_DELETE) continue;
            if (item.type === SERVER_OPCODE.EXTENSION_ADD || item.type === SERVER_OPCODE.EXTENSION_REMOVE) {
                opMap.set(`ext:${item.url}`, item);
                continue;
            }
            let key;
            if (item.type === SERVER_OPCODE.BLOCK_DELETE) {
                for (const rid of item.rootIds) opMap.set(`${item.targetIndex}:block:${rid}`, { type: SERVER_OPCODE.BLOCK_DELETE, targetIndex: item.targetIndex, rootId: rid });
                continue;
            } else if (item.rootId) {
                key = `${item.targetIndex}:block:${item.rootId}`;
            } else if (item.type === SERVER_OPCODE.COMMENT_SYNC) {
                key = `${item.targetIndex}:comment`;
            } else if (item.type === SERVER_OPCODE.COSTUME_ADD || item.type === SERVER_OPCODE.COSTUME_DELETE || item.type === SERVER_OPCODE.COSTUME_UPDATE) {
                key = `${item.targetIndex}:costume:${item.index}`;
            } else if (item.type === SERVER_OPCODE.SOUND_ADD || item.type === SERVER_OPCODE.SOUND_DELETE || item.type === SERVER_OPCODE.SOUND_UPDATE) {
                key = `${item.targetIndex}:sound:${item.index}`;
            } else if (item.type === SERVER_OPCODE.VARIABLE_ADD || item.type === SERVER_OPCODE.VARIABLE_DELETE || item.type === SERVER_OPCODE.VARIABLE_RENAME) {
                key = `${item.targetIndex}:variable:${item.varId}`;
            } else continue;
            opMap.set(key, item);
        }

        const finalMessages = [];
        for (const item of waitForBroadcast) {
            if (item.type === SERVER_OPCODE.SPRITE_ADD || item.type === SERVER_OPCODE.SPRITE_DELETE) finalMessages.push(item);
        }
        for (const [, op] of opMap) finalMessages.push(op);

        if (finalMessages.length > 0) {
            const msgSummary = finalMessages.map(m => {
                if (m.type === SERVER_OPCODE.BLOCK_DELETE) return `${m.type}:${m.rootId || m.rootIds}`;
                if (m.type === SERVER_OPCODE.COMMENT_SYNC) return `${m.type}:comments`;
                if (m.type === SERVER_OPCODE.COSTUME_ADD || m.type === SERVER_OPCODE.COSTUME_DELETE || m.type === SERVER_OPCODE.COSTUME_UPDATE) return `${m.type}:${m.name}`;
                if (m.type === SERVER_OPCODE.SOUND_ADD || m.type === SERVER_OPCODE.SOUND_DELETE || m.type === SERVER_OPCODE.SOUND_UPDATE) return `${m.type}:${m.name}`;
                if (m.type === SERVER_OPCODE.VARIABLE_ADD || m.type === SERVER_OPCODE.VARIABLE_DELETE || m.type === SERVER_OPCODE.VARIABLE_RENAME) return `${m.type}:${m.name || m.varId}`;
                return `${m.type}:${m.rootId || m.id || '?'}`;
            }).join(', ');
            this._console.log(`[协作] broadcasting ${finalMessages.length} msgs: ${msgSummary}`);
            for (const item of finalMessages) {
                if (item.type === SERVER_OPCODE.SPRITE_ADD) {
                    try {
                        const spriteData = await this._vm.exportSprite(item.id, "uint8array");
                        const base64Data = this._arrayBufferToBase64(spriteData);
                        this.broadcastToPeers(JSON.stringify({ type: SERVER_OPCODE.SPRITE_ADD, targetIndex: item.index, spriteData: base64Data }));
                    } catch (e) { this._console.error("[协作] 导出角色失败:", e); }
                } else if (item.type === SERVER_OPCODE.SPRITE_DELETE) {
                    this.broadcastToPeers(JSON.stringify({ type: SERVER_OPCODE.SPRITE_DELETE, targetIndex: item.index }));
                } else {
                    this.broadcastToPeers(JSON.stringify(item));
                }
            }
        }
    }

    _serializeComment(comment) {
        return JSON.stringify({
            text: comment.text,
            x: comment.x,
            y: comment.y,
            width: comment.width,
            height: comment.height,
            minimized: comment.minimized,
            blockId: comment.blockId,
        });
    }

    _arrayBufferToBase64(buffer) {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    updateWorkspace() {
        setTimeout(() => {
            try {
                const fromIndex = this.editingTargetIndex;
                this.editingTargetIndex = this._vm.runtime.targets.findIndex(
                    (ele) => this._vm.runtime._editingTarget?.id === ele.id);
                document.querySelectorAll(".sa-collaborative-pointer").forEach((ele) => ele.remove());
                if (fromIndex >= 0) {
                    this.broadcastToPeers(JSON.stringify({
                        type: SERVER_OPCODE.POINTER_LEAVE, id: this.state.clientId, fromIndex,
                    }), true);
                }
                // 切换 sprite 时释放本地编辑锁定
                if (this._localEditState) {
                    this.broadcastToPeers(JSON.stringify({
                        type: SERVER_OPCODE.EDIT_UNLOCK,
                        userId: this.state.clientId,
                        lockType: this._localEditState.type,
                        lockId: this._localEditState.id,
                    }), true);
                    this._localEditState = null;
                }
            } catch { this.editingTargetIndex = -1; }
        }, 30);
    }

    mouseMoveHandler(e) {
        if (this._pointerRaf) return;
        this._pointerRaf = requestAnimationFrame(() => {
            this._pointerRaf = null;
            this._sendPointer(e);
        });
    }

    _sendPointer(e) {
        if (!this._Blockly) return;
        // workspace 切换时兜底重绑
        this._bindPointerToCurrentWorkspace();
        const ws = this._Blockly.getMainWorkspace();
        if (!ws) return;
        const svg = ws.getParentSvg();
        const matrix = ws.getInverseScreenCTM();
        if (!matrix) return;
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = e.clientX; svgPoint.y = e.clientY;
        const svgCoord = svgPoint.matrixTransform(matrix);
        const canvas = ws.getCanvas();
        if (!canvas) return;
        const canvasMatrix = canvas.getCTM().inverse();
        const canvasPoint = svg.createSVGPoint();
        canvasPoint.x = svgCoord.x; canvasPoint.y = svgCoord.y;
        const canvasCoord = canvasPoint.matrixTransform(canvasMatrix);
        this._lastPointerPos = { x: canvasCoord.x, y: canvasCoord.y };
        // 聊天输入框跟随光标
        if (this._chatInputEl) this._positionChatInput(this._chatInputEl);
        this.broadcastToPeers(JSON.stringify({
            type: SERVER_OPCODE.POINTER, id: this.state.clientId, workspaceIndex: this.editingTargetIndex,
            name: this.getUserName(), position: { x: canvasCoord.x, y: canvasCoord.y },
            themeColor: getComputedStyle(document.documentElement).getPropertyValue('--looks-secondary').trim() || '#0099ff',
        }), true);
    }

    // ── 聊天功能 ──────────────────────────────────────────────

    _handleKeyDown(e) {
        if (e.key === 't') {
            e.preventDefault();
            if (this._chatActive) {
                this._hideChatInput();
            } else {
                this._showChatInput();
            }
            return;
        }
        // ESC 关闭输入框
        if (e.key === 'Escape' && this._chatActive) {
            e.preventDefault();
            this._hideChatInput();
        }
    }

    _showChatInput() {
        if (this._chatActive || !this._Blockly) return;
        this._chatActive = true;
        this._chatText = '';

        const ws = this._Blockly.getMainWorkspace();
        if (!ws) return;

        // 创建 HTML 输入框（悬浮在 Blockly 上方）
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 50;
        input.placeholder = this._msg('enter_message_tip');
        input.className = `${idHead}chat-input`;

        // 样式：圆角矩形，半透明背景
        Object.assign(input.style, {
            position: 'absolute',
            padding: '4px 10px',
            borderRadius: '12px',
            background: 'var(--looks-secondary)',
            border: 'none',
            color: '#e0e6ed',
            fontSize: '15px',
            fontFamily: 'sans-serif',
            outline: 'none',
            zIndex: '9999',
            minWidth: '60px',
            maxWidth: '250px',
            boxSizing: 'border-box',
        });

        // 定位到光标右下角
        this._positionChatInput(input);

        // 实时输入监听
        input.addEventListener('input', () => {
            this._chatText = input.value;
            // 自适应宽度
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = '13px sans-serif';
            const textWidth = ctx.measureText(input.value || input.placeholder).width;
            input.style.width = Math.max(60, Math.min(250, textWidth + 24)) + 'px';

            // 实时广播
            this._broadcastChatMessage(this._chatText);
        });

        // 失焦关闭
        input.addEventListener('blur', () => {
            // 延迟关闭，避免点击其他地方时立即关闭
            setTimeout(() => {
                if (document.activeElement !== input) {
                    this._hideChatInput();
                }
            }, 150);
        });

        // 阻止事件冒泡到 Blockly
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('keydown', e => e.stopPropagation());

        document.body.appendChild(input);
        this._chatInputEl = input;

        // 聚焦输入框
        requestAnimationFrame(() => input.focus());

        // 发送空消息（表示开始聊天，远端显示空气泡）
        this._broadcastChatMessage('');
    }

    _hideChatInput() {
        this._chatActive = false;
        this._chatText = '';

        // 移除输入框
        if (this._chatInputEl) {
            this._chatInputEl.remove();
            this._chatInputEl = null;
        }

        // 移除本地气泡
        if (this._chatBubbleEl) {
            this._chatBubbleEl.remove();
            this._chatBubbleEl = null;
        }

        // 广播空消息（表示结束聊天）
        this._broadcastChatMessage(null); // null 表示清除
    }

    _positionChatInput(input) {
        const ws = this._Blockly.getMainWorkspace();
        if (!ws) return;
        const svg = ws.getParentSvg();
        if (!svg) return;

        // 将 workspace 坐标转换为屏幕坐标
        const svgRect = svg.getBoundingClientRect();
        const CTM = ws.getCanvas()?.getCTM();
        if (!CTM) return;

        const screenX = svgRect.left + this._lastPointerPos.x * CTM.a + CTM.e;
        const screenY = svgRect.top + this._lastPointerPos.y * CTM.d + CTM.f;

        input.style.left = (screenX + 15) + 'px';
        input.style.top = (screenY + 20) + 'px';
    }

    _updateLocalChatBubble(x, y, text) {
        if (!this._chatBubbleEl) return;

        const g = this._chatBubbleEl;
        const rect = g.querySelector('rect');
        const textEl = g.querySelector('text');

        // 计算文字宽度
        const fontSize = 12;
        const padding = 12;
        const approxWidth = text.length * (fontSize * 0.6) + padding;
        const width = Math.max(30, approxWidth);
        const height = 24;

        // 更新位置（光标右下角）
        g.setAttribute('transform', `translate(${x + 18}, ${y + 22})`);

        // 更新气泡大小
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);

        // 更新文字
        textEl.textContent = text || '';
        textEl.setAttribute('x', width / 2);
        textEl.setAttribute('y', height / 2 + 4);
        textEl.setAttribute('text-anchor', 'middle');
    }

    _broadcastChatMessage(text) {
        this.broadcastToPeers(JSON.stringify({
            type: SERVER_OPCODE.CHAT_MESSAGE,
            id: this.state.clientId,
            themeColor: getComputedStyle(document.documentElement).getPropertyValue('--looks-secondary').trim() || '#0099ff',
            name: this.getUserName(),
            position: { ...this._lastPointerPos },
            text: text,          // string = 内容，null = 清除
            workspaceIndex: this.editingTargetIndex,
        }), true);

        // 同时更新本地气泡
        if (text !== null) {
            this._updateLocalChatBubble(
                this._lastPointerPos.x,
                this._lastPointerPos.y,
                text
            );
        }
    }

    // 在 _sendPointer 中记录光标位置（用于定位聊天输入框）

    // 注册编辑锁定相关的事件监听器
    _setupEditLockListeners() {
        // 1. 监听 Blockly workspace 变更事件
        const onBlocklyEvent = (event) => {
            if (!event) return;
            if (event.type === 'ui' && event.element === 'selected') {
                this._detectAndBroadcastEditState();
            }
        };

        // 2. 监听 WidgetDiv 的 DOM 变化（输入框打开/关闭）
        const widgetDiv = this._Blockly?.WidgetDiv?.DIV;
        let widgetObserver = null;
        if (widgetDiv) {
            widgetObserver = new MutationObserver(() => {
                this._detectAndBroadcastEditState();
            });
            widgetObserver.observe(widgetDiv, { attributes: true, attributeFilter: ['style'] });
        }

        // 3. 监听 document focusin/focusout 事件：检测注释 textarea 获焦/失焦
        const onFocusIn = (e) => {
            // 取消待执行的解锁定时器（焦点在注释之间切换时）
            if (this._pendingUnlockTimer) {
                clearTimeout(this._pendingUnlockTimer);
                this._pendingUnlockTimer = null;
            }
            if (e.target?.classList?.contains('scratchCommentTextarea')) {
                this._detectAndBroadcastEditState();
            }
        };
        const onFocusOut = (e) => {
            if (e.target?.classList?.contains('scratchCommentTextarea')) {
                // relatedTarget 是下一个获焦元素，如果不是注释 textarea 则延迟释放锁定
                const goingToComment = e.relatedTarget?.classList?.contains('scratchCommentTextarea');
                if (!goingToComment) {
                    this._pendingUnlockTimer = setTimeout(() => {
                        this._pendingUnlockTimer = null;
                        this._detectAndBroadcastEditState();
                    }, 100);
                }
            }
        };
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);

        // 4. 监听 WidgetDiv show/hide（通过 monkey-patch）
        const origWidgetHide = this._Blockly?.WidgetDiv?.hide;
        const origWidgetShow = this._Blockly?.WidgetDiv?.show;
        const self = this;
        if (origWidgetHide) {
            this._Blockly.WidgetDiv.hide = function(...args) {
                origWidgetHide.apply(this, args);
                self._detectAndBroadcastEditState();
            };
        }
        if (origWidgetShow) {
            this._Blockly.WidgetDiv.show = function(...args) {
                origWidgetShow.apply(this, args);
                self._detectAndBroadcastEditState();
            };
        }

        // 保存监听器引用，退出时清理
        this._editLockListeners = [
            { type: 'blockly_event', handler: onBlocklyEvent },
            { type: 'mutation_observer', observer: widgetObserver },
            { type: 'document_event', event: 'focusin', handler: onFocusIn },
            { type: 'document_event', event: 'focusout', handler: onFocusOut },
            { type: 'widgetdiv_hide_patch', original: origWidgetHide },
            { type: 'widgetdiv_show_patch', original: origWidgetShow },
        ];

        // 注册 Blockly workspace 变更监听
        const ws = this._Blockly.getMainWorkspace();
        if (ws) {
            ws.addChangeListener(onBlocklyEvent);
            this._console.log("[协作-锁定] 已注册 workspace.addChangeListener");
        } else {
            this._console.log("[协作-锁定] workspace 不存在，跳过 addChangeListener");
        }
    }

    // 检测当前编辑状态并广播 lock/unlock
    _detectAndBroadcastEditState() {
        if (!this._Blockly) return;
        let newState = null;

        // 1. 积木字段编辑（文本/数字输入框）
        if (this._Blockly.WidgetDiv.isVisible()) {
            const field = this._Blockly.WidgetDiv.owner_;
            if (field?.sourceBlock_) {
                newState = { type: 'block', id: field.sourceBlock_.id };
            }
        }
        // 2. 注释编辑：检查焦点是否在注释 textarea 上
        const active = document.activeElement;
        if (!newState && active && active.classList.contains('scratchCommentTextarea')) {
            const vm = this._vm;
            const target = vm?.runtime?.getEditingTarget();
            const ws = this._Blockly?.getMainWorkspace();
            if (target && target.comments && ws) {
                const sortedKeys = Object.keys(target.comments).sort();
                for (let i = 0; i < sortedKeys.length; i++) {
                    const commentId = sortedKeys[i];
                    const commentData = target.comments[commentId];
                    if (commentData.blockId) {
                        const block = ws.getBlockById(commentData.blockId);
                        if (block?.comment?.textarea_ === active) {
                            newState = { type: 'comment', index: i };
                            break;
                        }
                    } else {
                        const comment = ws.getCommentById(commentId);
                        if (comment?.textarea_ === active) {
                            newState = { type: 'comment', index: i };
                            break;
                        }
                    }
                }
            }
        }

        // 检测状态变化
        const oldKey = this._localEditState
            ? `${this._localEditState.type}:${this._localEditState.type === 'comment' ? this._localEditState.index : this._localEditState.id}`
            : null;
        const newKey = newState
            ? `${newState.type}:${newState.type === 'comment' ? newState.index : newState.id}`
            : null;

        if (oldKey === newKey) return; // 无变化

        // 释放旧锁定
        if (this._localEditState) {
            const lockId = this._localEditState.type === 'comment'
                ? String(this._localEditState.index)
                : this._localEditState.id;
            this.broadcastToPeers(JSON.stringify({
                type: SERVER_OPCODE.EDIT_UNLOCK,
                userId: this.state.clientId,
                lockType: this._localEditState.type,
                lockId: lockId,
            }), true);
        }
        // 发送新锁定
        if (newState) {
            const lockId = newState.type === 'comment'
                ? String(newState.index)
                : newState.id;
            this.broadcastToPeers(JSON.stringify({
                type: SERVER_OPCODE.EDIT_LOCK,
                userId: this.state.clientId,
                userName: this.getUserName(),
                lockType: newState.type,
                lockId: lockId,
            }), true);
        }
        this._localEditState = newState;
    }

    exit() {
        this.workspace.removeEventListener("mousemove", this.boundMouseMoveHandler);
        // 通知 server 自己离开（让 server 广播 peer-left 并清理记录）
        if (this._server && this._server.readyState === WebSocket.OPEN) {
            try { this._server.send(JSON.stringify({ type: "exit" })); } catch { /* ignore */ }
        }
        // 清理编辑锁定的事件监听器
        for (const listener of this._editLockListeners) {
            if (listener.type === 'mutation_observer' && listener.observer) {
                listener.observer.disconnect();
            } else if (listener.type === 'document_event') {
                document.removeEventListener(listener.event, listener.handler);
            } else if (listener.type === 'widgetdiv_hide_patch' && listener.original) {
                if (this._Blockly?.WidgetDiv) {
                    this._Blockly.WidgetDiv.hide = listener.original;
                }
            } else if (listener.type === 'widgetdiv_show_patch' && listener.original) {
                if (this._Blockly?.WidgetDiv) {
                    this._Blockly.WidgetDiv.show = listener.original;
                }
            } else if (listener.type === 'blockly_event') {
                const ws = this._Blockly?.getMainWorkspace?.();
                if (ws) ws.removeChangeListener(listener.handler);
            }
        }
        this._editLockListeners = [];
        // 退出时释放所有锁定
        if (this._localEditState) {
            this.broadcastToPeers(JSON.stringify({
                type: SERVER_OPCODE.EDIT_UNLOCK,
                userId: this.state.clientId,
                lockType: this._localEditState.type,
                lockId: this._localEditState.id,
            }), true);
            this._localEditState = null;
        }
        // 清理聊天输入框
        if (this._boundKeyHandler) {
            window.removeEventListener("keydown", this._boundKeyHandler);
            this._boundKeyHandler = null;
        }
        this._hideChatInput();
        // 清理工作区中的远端元素（指针、聊天气泡、锁定遮罩）
        cleanupAllRemote();
        this._closeAllPeerConnections();
        if (this._server) {
            try { this._server.send(JSON.stringify({ type: "exit", clientId: this.state.clientId })); } catch (e) {}
            try { this._server.close(); } catch (e) {}
            this._server = null;
        }
        this.state.clientId = null; this.state.roomId = null; this.state.allMembers = [];
    }

    static CHUNK_SIZE = 15000;

    sendToPeer(peerId, data, dropIfBuffered) {
        const channel = this._dataChannels.get(peerId);
        if (!channel) return false;
        if (channel.readyState !== "open") {
            // pointer 等纯视觉消息在通道未就绪时直接丢弃
            if (dropIfBuffered) return false;
            if (!this._pendingMessages.has(peerId)) this._pendingMessages.set(peerId, []);
            // 限制待发队列长度，防止内存泄漏
            const pending = this._pendingMessages.get(peerId);
            if (pending.length < 50) pending.push(data);
            return true;
        }
        // pointer 等纯视觉消息在 buffer 积压时直接丢弃
        if (dropIfBuffered && channel.bufferedAmount > 16 * 1024) return false;
        try {
            const raw = JSON.stringify(data);
            if (raw.length <= RTCServer.CHUNK_SIZE) {
                channel.send(raw);
            } else {
                const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
                let offset = 0, idx = 0;
                const total = Math.ceil(raw.length / RTCServer.CHUNK_SIZE);
                while (offset < raw.length) {
                    const chunk = raw.slice(offset, offset + RTCServer.CHUNK_SIZE);
                    channel.send(JSON.stringify({ type: "_chunk", id, idx: idx++, total, data: chunk }));
                    offset += RTCServer.CHUNK_SIZE;
                }
            }
            return true;
        } catch (e) {
            if (dropIfBuffered) return false;
            if (!this._pendingMessages.has(peerId)) this._pendingMessages.set(peerId, []);
            const pending = this._pendingMessages.get(peerId);
            if (pending.length < 50) pending.push(data);
            if (!this._retryTimer) this._retryTimer = setTimeout(() => this._retryPending(peerId), 100);
            return false;
        }
    }

    _retryPending(peerId) {
        this._retryTimer = null;
        const channel = this._dataChannels.get(peerId);
        if (!channel || channel.readyState !== "open") return;
        const pending = this._pendingMessages.get(peerId);
        if (!pending || pending.length === 0) return;
        const msg = pending.shift();
        if (this.sendToPeer(peerId, msg)) {
            if (pending.length > 0) this._retryTimer = setTimeout(() => this._retryPending(peerId), 50);
        } else {
            pending.unshift(msg);
        }
    }

    broadcastToPeers(data, skipGuard) {
        if (!skipGuard && (this._ingoreUpdate || this._remoteUpdateInProgress)) return 0;
        // pointer/pointer-leave 是纯视觉消息，buffer 积压时可丢弃
        const dropIfBuffered = skipGuard;
        let sent = 0;
        for (const peerId of this._dataChannels.keys())
            if (this.sendToPeer(peerId, data, dropIfBuffered)) sent++;
        return sent;
    }

    async _buildSnapshotWithAssets() {
        const sb3 = await this._vm.saveProjectSb3("arraybuffer");
        let binary = "";
        const bytes = new Uint8Array(sb3);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    _emitState() { this._onStateChange({ ...this.state }); }

    async _ensureSTUNList() {
        if (this._allSTUN_URLs) return;
        this._updateTipText(this._msg("loading_available_stun"));
        try { const r = await fetchWithTimeout("https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt", 5000); if (r) this._allSTUN_URLs = await r.text(); } catch (e) {}
        if (!this._allSTUN_URLs) {
            try { const r = await fetchWithTimeout("https://ghproxy.net/https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt", 5000); if (r) this._allSTUN_URLs = await r.text(); } catch (e) {}
        }
        if (!this._allSTUN_URLs) this._allSTUN_URLs = DEFAULT_STUN_URLS;
    }

    async _spawnRoomID(mode = "reg", checkID = "", serverUrl = "localhost:1832") {
        const isJoin = mode === "join";
        const rand = (x, y) => Math.floor(Math.random() * (y - x + 1)) + x;
        for (let i = 0; i < 10; i++) {
            const qid = isJoin ? checkID : `${ID_SEA.Who[rand(0, ID_SEA.Who.length - 1)]}${ID_SEA.Do[rand(0, ID_SEA.Do.length - 1)]}${ID_SEA.Things[rand(0, ID_SEA.Things.length - 1)]}`;
            try {
                const r = await fetchWithTimeout(`http://${serverUrl}/roomIsFree?roomId=${encodeURIComponent(qid)}`);
                if (!r) continue;
                const d = await r.json();
                if (isJoin) return { id: checkID, isUsing: !d.isFree };
                if (d.isFree) return qid;
            } catch (e) {}
        }
        return isJoin ? { id: checkID, isUsing: false } : `room_${Date.now()}`;
    }

    _getRTCConfig() {
        return { iceServers: [{ urls: this._allSTUN_URLs.split("\n").filter((u) => u.trim()).map((u) => `stun:${u.trim()}`) }] };
    }

    _closePeerConnection(peerId) {
        const ch = this._dataChannels.get(peerId);
        if (ch) { try { ch.close(); } catch (e) {} this._dataChannels.delete(peerId); }
        const rtc = this._rtcConnections.get(peerId);
        if (rtc) { try { rtc.close(); } catch (e) {} this._rtcConnections.delete(peerId); }
        this._pendingCandidates.delete(peerId);
        this._pendingMessages.delete(peerId);
        if (this._onPeerLeft) this._onPeerLeft(peerId);
        this._console.log("[协作] 已关闭与 " + peerId + " 的P2P连接");
    }

    _closeAllPeerConnections() {
        this._chunkBuffers.clear();
        this._pendingMessages.clear();
        for (const pid of this._rtcConnections.keys()) this._closePeerConnection(pid);
    }

    _setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            this._updateTipText(this._msg("rtc_connected"));
            const pending = this._pendingMessages.get(peerId);
            if (pending?.length) {
                for (const msg of pending) this.sendToPeer(peerId, msg);
                const remaining = this._pendingMessages.get(peerId);
                if (!remaining || remaining.length === 0) this._pendingMessages.delete(peerId);
            }
        };
        channel.onerror = (e) => { this._console.error("[协作] 数据通道错误: " + peerId, e); };
        channel.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "_chunk") {
                    let buf = this._chunkBuffers.get(msg.id);
                    if (!buf) { buf = { total: msg.total, chunks: [] }; this._chunkBuffers.set(msg.id, buf); }
                    buf.chunks[msg.idx] = msg.data;
                    const received = buf.chunks.filter((c) => c !== undefined).length;
                    if (received === buf.total) {
                        this._chunkBuffers.delete(msg.id);
                        const full = JSON.parse(buf.chunks.join(""));
                        await this._onPeerMessage(peerId, full);
                    }
                    return;
                }
                await this._onPeerMessage(peerId, msg);
            } catch (e) { this._console.error("[协作] 无效的P2P消息:", e); }
        };
    }

    async _createAndSendOffer(peerId) {
        this._closePeerConnection(peerId);
        try {
            const rtc = new RTCPeerConnection(this._getRTCConfig());
            this._rtcConnections.set(peerId, rtc);
            const ch = rtc.createDataChannel("collaboration");
            this._dataChannels.set(peerId, ch);
            this._setupDataChannel(ch, peerId);
            rtc.onicecandidate = (e) => {
                if (e.candidate && this._server?.readyState === WebSocket.OPEN)
                    this._server.send(JSON.stringify({ type: "ice-candidate", targetId: peerId, candidate: e.candidate }));
            };
            rtc.oniceconnectionstatechange = () => {
                if (rtc.iceConnectionState === "failed" || rtc.iceConnectionState === "disconnected") {
                    this._updateTipText(this._msg("rtc_failed"), "error");
                    this._closePeerConnection(peerId);
                }
            };
            const offer = await rtc.createOffer();
            await rtc.setLocalDescription(offer);
            if (this._server?.readyState === WebSocket.OPEN)
                this._server.send(JSON.stringify({ type: "offer", targetId: peerId, sdp: rtc.localDescription }));
        } catch (e) {
            this._console.error("[协作] 创建offer失败:", e);
            this._updateTipText(this._msg("rtc_failed"), "error");
            this._closePeerConnection(peerId);
        }
    }

    async _handleOffer(senderId, sdp) {
        this._closePeerConnection(senderId);
        try {
            const rtc = new RTCPeerConnection(this._getRTCConfig());
            this._rtcConnections.set(senderId, rtc);
            rtc.ondatachannel = (e) => { this._dataChannels.set(senderId, e.channel); this._setupDataChannel(e.channel, senderId); };
            rtc.onicecandidate = (e) => {
                if (e.candidate && this._server?.readyState === WebSocket.OPEN)
                    this._server.send(JSON.stringify({ type: "ice-candidate", targetId: senderId, candidate: e.candidate }));
            };
            rtc.oniceconnectionstatechange = () => {
                if (rtc.iceConnectionState === "failed" || rtc.iceConnectionState === "disconnected") {
                    this._updateTipText(this._msg("rtc_failed"), "error");
                    this._closePeerConnection(senderId);
                }
            };
            await rtc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await rtc.createAnswer();
            await rtc.setLocalDescription(answer);
            if (this._server?.readyState === WebSocket.OPEN)
                this._server.send(JSON.stringify({ type: "answer", targetId: senderId, sdp: rtc.localDescription }));
            if (this._pendingCandidates.has(senderId)) {
                for (const c of this._pendingCandidates.get(senderId)) try { await rtc.addIceCandidate(c); } catch (e) {}
                this._pendingCandidates.delete(senderId);
            }
        } catch (e) {
            this._console.error("[协作] 处理offer失败:", e);
            this._updateTipText(this._msg("rtc_failed"), "error");
            this._closePeerConnection(senderId);
        }
    }

    async _handleAnswer(senderId, sdp) {
        const rtc = this._rtcConnections.get(senderId);
        if (!rtc) return;
        try { await rtc.setRemoteDescription(new RTCSessionDescription(sdp)); }
        catch (e) { this._console.error("[协作] 设置remote description失败:", e); this._closePeerConnection(senderId); }
    }

    async _handleIceCandidateMsg(senderId, candidate) {
        const rtc = this._rtcConnections.get(senderId);
        if (!rtc) return;
        const ice = new RTCIceCandidate(candidate);
        try {
            if (rtc.remoteDescription) await rtc.addIceCandidate(ice);
            else {
                if (!this._pendingCandidates.has(senderId)) this._pendingCandidates.set(senderId, []);
                this._pendingCandidates.get(senderId).push(ice);
            }
        } catch (e) { this._console.error("[协作] 添加ICE candidate失败:", e); }
    }

    async _handleServerMessage(data) {
        switch (data.type) {
            case "connection":
                this.state.clientId = data.clientId;
                this.state.roomId = data.roomId;
                this.state.allMembers = data.existingPeers || [];
                this._isHost = false;
                data.existingPeers.forEach((peer) => { if (peer.cid === this.state.clientId && peer.owner) this._isHost = true; });
                this._updateTipText(this._msg("connected"));
                this._emitState();
                break;
            case "peer-joined":
                this.state.allMembers = data.existingPeers || [];
                this._updateTipText(this._msg("peer_joined"));
                this._emitState();
                this._createAndSendOffer(data.clientId);
                if (this._isHost) {
                    const extensions = [];
                    const extURLs = this._vm.extensionManager.getExtensionURLs ? this._vm.extensionManager.getExtensionURLs() : {};
                    for (const id of this._vm.extensionManager._loadedExtensions.keys()) {
                        extensions.push({ id, url: extURLs[id] || null });
                    }
                    const sendProject = { type: SERVER_OPCODE.SNAPSHOT, data: await this._buildSnapshotWithAssets(), projectName: getAPPNAME(), config: window.location.search, extensions };
                    this.broadcastToPeers(JSON.stringify(sendProject));
                }
                break;
            case "peer-left":
                this.state.allMembers = data.existingPeers || [];
                this._updateTipText(this._msg("peer_left"));
                this._emitState();
                this._closePeerConnection(data.clientId);
                break;
            case "offer": this._handleOffer(data.senderId, data.sdp); break;
            case "answer": this._handleAnswer(data.senderId, data.sdp); break;
            case "ice-candidate": this._handleIceCandidateMsg(data.senderId, data.candidate); break;
        }
    }
}
