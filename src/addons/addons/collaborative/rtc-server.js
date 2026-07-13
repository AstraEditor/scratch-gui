import { ID_SEA, DEFAULT_STUN_URLS, SERVER_OPCODE, idHead } from "./constants.js";
import { fetchWithTimeout, getAPPNAME } from "./utils.js";
import { cleanupAllRemote } from "./handle.js";
import ReduxStore from "../../redux.js";
import { openLoadingProject, closeLoadingProject } from "../../../reducers/modals";

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
        this._peerLastSeen = new Map();
        this._heartbeatTimer = null;
        this._sendQueues = new Map();
        this._sendDrainTimers = new Map();
        this._ignoreQueue = new Map(); // operationId → true
        this.state = { clientId: null, roomId: null, allMembers: [] };
        this.members = []; // 由 host 统一管理：[{cid, userName, editingIndex}]
        this._Blockly = null; // Set via setBlockly() after construction

        // 编辑锁定状态：记录当前用户正在编辑的对象
        this._localEditState = null; // { type: 'block'|'comment', id: string } | null
        this._editLockListeners = []; // 事件监听器，退出时清理

        // 聊天输入框状态
        this._chatInputEl = null;      // HTML input 元素
        this._chatBubbleEl = null;     // 本地聊天气泡 SVG 元素
        this._chatText = '';           // 当前输入的文字
        this._lastPointerPos = { x: 0, y: 0 }; // 上次光标位置（用于定位输入框）
        this._loggingIn = false;       // 防止重复 login
        this._chatActive = false;      // 输入框是否激活
        this._dragActive = false;      // 是否正在拖动积木
        this._dragRootId = null;       // 拖动中的积木 root ID
        this._dragRootBlock = null;    // 拖动中的积木 root 引用（用于收集簇 ID）
        this._dragOffsetX = 0;         // 积木原点与鼠标的 X 偏移
        this._dragOffsetY = 0;         // 积木原点与鼠标的 Y 偏移
        this._lastDragBroadcast = 0;   // 上次广播拖动坐标的时间戳

        // Snapshot 加载状态：加载期间暂存增量消息，避免覆盖正在加载的项目
        this._snapshotLoading = false;
        this._deferredPeerMessages = [];
        this._snapshotTimeout = null;
        // 跟踪加载页面是否由协作插件开启，防止 exit() 误关 sb-file-uploader 开启的加载页面
        this._loadingProjectOpenedByCollab = false;
        // 防止 exit() 递归调用（server.onclose → exit → server.close → onclose）
        this._exiting = false;
        // login 会话标识，用于在 login 被 exit 打断时中止
        this._loginSession = null;
        // 自动重连状态
        this._reconnectEnabled = false;
        this._reconnectTimer = null;
        this._reconnectAttempts = 0;
        this._lastLoginArgs = null; // { mode, serverUrl, roomId }

        // 事件监听器引用（login 时绑定，exit 时解绑）
        this._boundBeforeUnload = null;
        this._boundPageHide = null;
        this._boundProjectChanged = null;
        this._boundExtensionRemoved = null;
        this._boundTargetsUpdate = null;
        this._boundUpdateWorkspace = null;
        this._boundKeyHandler = null;

        this.workspace = document.querySelector("[class*=gui_blocks-wrapper]");
        this.editingTargetIndex = -1;
        this.boundMouseMoveHandler = this.mouseMoveHandler.bind(this);
        this._boundUpdateWorkspace = () => this.updateWorkspace();
        this._vm.on("targetsUpdate", this._boundUpdateWorkspace);
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

    // 开始忽略更新，返回操作ID
    startIgnoreUpdate(operationId) {
        if (!operationId) {
            operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        }
        this._ignoreQueue.set(operationId, true);
        return operationId;
    }

    // 结束忽略更新
    endIgnoreUpdate(operationId) {
        if (this._ignoreQueue.has(operationId)) {
            this._ignoreQueue.delete(operationId);

            // 队列清空后，主动触发一次 updateProject 来同步 ignore 期间积累的本地变更
            if (this._ignoreQueue.size === 0) {
                if (this._updateTimer) clearTimeout(this._updateTimer);
                this._updateTimer = setTimeout(() => {
                    this._updateTimer = null;
                    this.updateProject();
                }, 50);
            }
        }
    }

    // 检查是否应该忽略更新
    shouldIgnoreUpdate() {
        return this._ignoreQueue.size > 0;
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

    _ensureHeartbeat() {
        if (this._heartbeatTimer) return;
        this._heartbeatTimer = setInterval(() => this._heartbeatTick(), RTCServer.HEARTBEAT_INTERVAL);
    }

    _stopHeartbeat() {
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    }

    _heartbeatTick() {
        const now = Date.now();
        for (const [peerId, lastSeen] of this._peerLastSeen) {
            const channel = this._dataChannels.get(peerId);
            if (!channel || channel.readyState !== "open") continue;
            if (now - lastSeen > RTCServer.HEARTBEAT_TIMEOUT) { this._handlePeerTimeout(peerId); continue; }
            this.sendToPeer(peerId, JSON.stringify({ type: SERVER_OPCODE.PING, from: this.state.clientId, t: now }), true);
        }
    }

    _handlePeerTimeout(peerId) {
        const hadConnection = this._dataChannels.has(peerId) || this._rtcConnections.has(peerId);
        const hadMember = this.state.allMembers.some(m => m.cid === peerId) || this.members.some(m => m.cid === peerId);
        if (!hadConnection && !hadMember) return;
        this._closePeerConnection(peerId);
        this.state.allMembers = this.state.allMembers.filter(m => m.cid !== peerId);
        if (this._isHost) {
            const before = this.members.length;
            this.members = this.members.filter(m => m.cid !== peerId);
            if (this.members.length !== before) this._broadcastMembersSync();
        }
        this._emitState();
    }

    _touchPeer(peerId) {
        if (!this.state.clientId || peerId === this.state.clientId) return;
        this._peerLastSeen.set(peerId, Date.now());
        this._ensureHeartbeat();
    }

    _queueSend(peerId, messages) {
        if (!messages || messages.length === 0) return false;
        if (!this._sendQueues.has(peerId)) this._sendQueues.set(peerId, []);
        const queue = this._sendQueues.get(peerId);
        if (queue.length + messages.length > RTCServer.PENDING_LIMIT) { return false; }
        queue.push(...messages);
        this._drainSendQueue(peerId);
        return true;
    }

    _messageToChunks(data) {
        if (data.length <= RTCServer.CHUNK_SIZE) return [data];
        const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
        const total = Math.ceil(data.length / RTCServer.CHUNK_SIZE);
        const chunks = [];
        for (let offset = 0, idx = 0; offset < data.length; offset += RTCServer.CHUNK_SIZE, idx++) {
            chunks.push(JSON.stringify({ type: "_chunk", id, idx, total, data: data.slice(offset, offset + RTCServer.CHUNK_SIZE) }));
        }
        return chunks;
    }

    _scheduleDrain(peerId, delay = 20) {
        if (this._sendDrainTimers.has(peerId)) return;
        const timer = setTimeout(() => { this._sendDrainTimers.delete(peerId); this._drainSendQueue(peerId); }, delay);
        this._sendDrainTimers.set(peerId, timer);
    }

    _drainSendQueue(peerId) {
        const channel = this._dataChannels.get(peerId);
        const queue = this._sendQueues.get(peerId);
        if (!channel || !queue || queue.length === 0) return;
        if (channel.readyState !== "open") return;
        channel.bufferedAmountLowThreshold = RTCServer.BUFFER_LOW_WATER;
        channel.onbufferedamountlow = () => this._drainSendQueue(peerId);
        try {
            while (queue.length > 0 && channel.bufferedAmount < RTCServer.BUFFER_HIGH_WATER) channel.send(queue.shift());
        } catch (e) { this._scheduleDrain(peerId, 250); return; }
        if (queue.length === 0) { this._sendQueues.delete(peerId); return; }
        this._scheduleDrain(peerId);
    }

    async login(mode = "reg", serverUrl = "localhost:1832", roomId = "") {
        // 防止重复登录（网络延迟下多次点击加入/创建）
        if (this._loggingIn || this.state.clientId) {
            this._console.warn("[协作] 已有进行中的连接，忽略重复 login 请求");
            return;
        }
        this._loggingIn = true;
        // 生成 login 会话标识，若 login 被 exit 打断则中止
        const loginSession = Symbol('login');
        this._loginSession = loginSession;
        // 保存登录参数用于自动重连
        this._lastLoginArgs = { mode, serverUrl, roomId };
        try {
            await this._ensureSTUNList();
            // 若 login 被 exit 打断（_loginSession 变化），中止
            if (this._loginSession !== loginSession) { this._console.log("[协作] login 被 abort，中止"); return; }
            if (!window.RTCPeerConnection) {
                this._updateTipText(this._msg("create_rtc_failed"), "error");
                return;
            }
            this._updateTipText(this._msg("linking_to_server"));
            const spawnedRoomID = await this._spawnRoomID(mode, roomId, serverUrl);
            // 若 login 被 exit 打断，中止
            if (this._loginSession !== loginSession) { this._console.log("[协作] login 被 abort，中止"); return; }
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
                try {
                    Promise.resolve(this._handleServerMessage(JSON.parse(msgs.data)))
                        .catch(e => this._console.error("[协作] 处理服务器消息异常:", e));
                }
                catch (e) { this._console.error("[协作] 解析服务器消息失败:", e); }
            };
            this._server.onerror = () => this._updateTipText(this._msg("server_error"), "error");
            this._server.onclose = () => {
                // exit() 中会 close server，触发 onclose；用守卫避免递归
                if (this._exiting) return;
                // 自动重连：非用户主动退出时尝试重连
                // 避免在 login 进行中或已有重连定时器时重复调度
                if (this._reconnectEnabled && !this._loggingIn && !this._reconnectTimer) {
                    this._scheduleReconnect();
                    return;
                }
                if (!this._reconnectEnabled) {
                    this._updateTipText(this._msg("server_exit"), "error");
                    this.exit();
                    this._emitState();
                }
            };
            // 立即初始化工作区索引，防止 targetUpdate 在插件启动前已触发导致光标不出现
            this.updateWorkspace();
            this._boundBeforeUnload = () => this.exit();
            this._boundPageHide = () => this.exit();
            window.addEventListener("beforeunload", this._boundBeforeUnload);
            window.addEventListener("pagehide", this._boundPageHide);
            this.workspace.addEventListener("mousemove", this.boundMouseMoveHandler);

            // 聊天功能：Ctrl+T 打开输入框
            this._boundKeyHandler = this._handleKeyDown.bind(this);
            window.addEventListener("keydown", this._boundKeyHandler);

            // 注册编辑锁定的事件监听（在 setBlockly 中实际执行）
            // 注意：不在 login 中重置 _editLockListenersReady，避免 setBlockly 被多次调用时重复注册
            // 重置在 exit() 清理监听器后进行

            this._boundProjectChanged = () => {
                if (this.shouldIgnoreUpdate()) return;
                if (this._updateTimer) clearTimeout(this._updateTimer);
                this._updateTimer = setTimeout(() => {
                    this._updateTimer = null;
                    if (this._Blockly && this._Blockly.Events && this._Blockly.Events.getGroup()) return;
                    this.updateProject();
                }, 200);
            };
            this._vm.runtime.on("PROJECT_CHANGED", this._boundProjectChanged);

            // Hook extension loading since it doesn't emit PROJECT_CHANGED
            // 幂等保护：只在首次 login 时安装 hook，避免多次包装导致链式调用 N 次 updateProject
            if (!this._vm.extensionManager._collabLoadExtHooked) {
                this._vm.extensionManager._collabLoadExtHooked = true;
                const origLoadExt = this._vm.extensionManager.loadExtensionURL.bind(this._vm.extensionManager);
                this._vm.extensionManager.loadExtensionURL = (...args) => {
                    return origLoadExt(...args).then(result => {
                        // 仅在已连接协作时同步，未连接时是 no-op
                        if (this.state.clientId && !this.shouldIgnoreUpdate()) {
                            this.updateProject();
                        }
                        return result;
                    });
                };
            }

            // 拦截项目替换操作（新项目、加载项目等）：联机中直接退出
            if (!this._vm._collabLoadProjectHooked) {
                this._vm._collabLoadProjectHooked = true;
                const origLoadProject = this._vm.loadProject.bind(this._vm);
                this._vm.loadProject = async (...args) => {
                    if (this.state.clientId && !this.shouldIgnoreUpdate()) {
                        this._console.log("[协作] 检测到项目替换操作，退出联机");
                        // 用 try/catch 包裹 exit()，确保即使 exit 抛异常也不阻断 origLoadProject
                        try { this.exit(); } catch (e) { this._console.error("[协作] exit 异常:", e); }
                    }
                    return origLoadProject(...args);
                };
            }

            this._boundExtensionRemoved = () => {
                if (!this.shouldIgnoreUpdate()) {
                    this.updateProject();
                }
            };
            this._vm.runtime.on("EXTENSION_REMOVED", this._boundExtensionRemoved);

            this._boundTargetsUpdate = this.switchTarget.bind(this);
            this._vm.on('targetsUpdate', this._boundTargetsUpdate);
        } finally {
            this._loggingIn = false;
        }
    }

    nowEditingIndex() {
        const editing = this._vm.runtime._editingTarget;
        if (!editing) return -1;
        return this._vm.runtime.targets.findIndex(t => t.id === editing.id);
    }

    switchTarget() {
        if (this.shouldIgnoreUpdate()) return;

        const index = this.nowEditingIndex();
        if (index >= 0) {
            // 乐观更新自己的 members 条目，避免等 Host 回传导致落后一次
            const me = this.members.find(m => m.cid === this.state.clientId);
            if (me) me.editingIndex = index;

            if (this._isHost) {
                this._broadcastMembersSync();
            } else {
                this.broadcastToPeers(JSON.stringify({
                    type: SERVER_OPCODE.SWITCH_TARGET,
                    id: this.state.clientId,
                    index
                }));
            }
        }
    }

    // Host 广播完整成员列表给所有人
    _broadcastMembersSync() {
        if (!this._isHost) return;
        this._console.log("[协作] 广播成员列表:", JSON.stringify(this.members));
        this.broadcastToPeers(JSON.stringify({
            type: SERVER_OPCODE.MEMBERS_SYNC,
            members: this.members
        }));
    }

    async updateProject() {
        if (this.shouldIgnoreUpdate()) return;

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
                        try { nc.set(rid, target.blocks.blockToXML(rid, target.comments || {})); } catch (e) { }
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
                    } catch (e) { }
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
                this._console.log(`[协作-造型] 初始化缓存 target=${targetId} count=${costumes.length} assetIds=[${costumes.map(c => c.assetId).join(',')}]`);
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
                this._console.log(`[协作-音频] 初始化缓存 target=${targetId} count=${sounds.length} assetIds=[${sounds.map(s => s.assetId).join(',')}]`);
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
                document.querySelectorAll(`.${idHead}pointer`).forEach((ele) => ele.remove());
                if (fromIndex >= 0) {
                    this.broadcastToPeers(JSON.stringify({
                        type: SERVER_OPCODE.POINTER_LEAVE, id: this.state.clientId, fromIndex,
                    }), true);
                }
                // 切换 sprite 时释放本地编辑锁定
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

        // 拖动幽灵广播
        this._handleDragBroadcast(ws, canvasCoord);
    }

    _getDraggedBlock() {
        const ws = this._Blockly?.getMainWorkspace();
        const gesture = ws?.currentGesture_;
        return gesture?.targetBlock_ || null;
    }

    // 广播拖动积木的编辑锁定/解锁（仅锁根积木，避免多层遮罩叠加产生渐变色）
    _broadcastDragLock(lock) {
        if (!this._dragRootBlock) return;
        const id = this._dragRootBlock.id;
        this.broadcastToPeers(JSON.stringify({
            type: lock ? SERVER_OPCODE.EDIT_LOCK : SERVER_OPCODE.EDIT_UNLOCK,
            userId: this.state.clientId,
            userName: this.getUserName(),
            lockType: 'block',
            lockId: id,
            noLabel: true,
        }), true);
    }

    _handleDragBroadcast(ws, coords) {
        if (!this.state.clientId || !this._Blockly) return;
        const isDragging = ws.isDragging();

        if (isDragging) {
            const draggedBlock = this._getDraggedBlock();
            if (!draggedBlock) return;

            const now = Date.now();
            if (!this._dragActive) {
                // 拖动开始：发送完整 XML + 相对偏移 + 锁定积木簇
                this._dragActive = true;
                this._dragRootId = draggedBlock.id;
                this._dragRootBlock = draggedBlock;
                this._lastDragBroadcast = 0;
                this._broadcastDragLock(true);

                // 计算积木原点与鼠标的偏移（积木相对于鼠标的位置差）
                const blockXY = draggedBlock.getRelativeToSurfaceXY();
                this._dragOffsetX = blockXY.x - coords.x;
                this._dragOffsetY = blockXY.y - coords.y;

                let xml;
                try {
                    const dom = this._Blockly.Xml.blockToDom(draggedBlock, true);
                    xml = this._Blockly.Xml.domToText(dom);
                } catch (e) {
                    console.error("[协作-拖动] XML 序列化失败:", e);
                    return;
                }
                this.broadcastToPeers(JSON.stringify({
                    type: SERVER_OPCODE.BLOCK_DRAG_START,
                    targetIndex: this.editingTargetIndex,
                    userId: this.state.clientId,
                    rootId: draggedBlock.id,
                    xml,
                    x: coords.x,
                    y: coords.y,
                    offsetX: this._dragOffsetX,
                    offsetY: this._dragOffsetY,
                }), true);
            } else if (now - this._lastDragBroadcast > 50) {
                // 拖动中：仅发坐标 (50ms 节流)
                this._lastDragBroadcast = now;
                this.broadcastToPeers(JSON.stringify({
                    type: SERVER_OPCODE.BLOCK_DRAG_MOVE,
                    targetIndex: this.editingTargetIndex,
                    userId: this.state.clientId,
                    rootId: draggedBlock.id,
                    x: coords.x,
                    y: coords.y,
                }), true);
            }
        } else if (this._dragActive) {
            // 拖动结束：解锁积木簇
            this._broadcastDragLock(false);
            this._dragActive = false;
            this.broadcastToPeers(JSON.stringify({
                type: SERVER_OPCODE.BLOCK_DRAG_END,
                targetIndex: this.editingTargetIndex,
                userId: this.state.clientId,
                rootId: this._dragRootId,
            }), true);
            this._dragRootId = null;
            this._dragRootBlock = null;
        }
    }

    // ── 聊天功能 ──────────────────────────────────────────────

    _handleKeyDown(e) {
        // 必须按 Ctrl+T（Mac 上是 Meta+T）才触发，避免普通 't' 输入被拦截
        if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T')) {
            // 用户正在 input/textarea/contenteditable 中输入时不触发
            const ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
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
        const ws = this._Blockly.getMainWorkspace();
        if (!ws) return;
        this._chatActive = true;
        this._chatText = '';

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

        // 3. 监听 document focusin/focusout：覆盖注释 textarea 和积木字段输入框
        const isCommentTextarea = (el) => {
            return el?.classList?.contains('scratchCommentTextarea') ||
                el?.classList?.contains('blocklyCommentTextarea');
        };
        const onFocusIn = (e) => {
            if (this._pendingUnlockTimer) {
                clearTimeout(this._pendingUnlockTimer);
                this._pendingUnlockTimer = null;
            }
            const target = e.target;
            // 注释 textarea（工作区注释或积木注释）
            if (isCommentTextarea(target)) {
                this._detectAndBroadcastEditState();
                return;
            }
            // 积木字段输入框（WidgetDiv 内的 input/textarea）
            if (target?.closest?.('.blocklyWidgetDiv')) {
                // 等 WidgetDiv.owner_ 就位后再检测
                setTimeout(() => this._detectAndBroadcastEditState(), 0);
            }
        };
        const onFocusOut = (e) => {
            const target = e.target;
            if (isCommentTextarea(target)) {
                const goingToComment = isCommentTextarea(e.relatedTarget);
                if (!goingToComment) {
                    this._pendingUnlockTimer = setTimeout(() => {
                        this._pendingUnlockTimer = null;
                        this._detectAndBroadcastEditState();
                    }, 100);
                }
                return;
            }
            // 积木字段输入框失去焦点
            if (target?.closest?.('.blocklyWidgetDiv')) {
                this._pendingUnlockTimer = setTimeout(() => {
                    this._pendingUnlockTimer = null;
                    this._detectAndBroadcastEditState();
                }, 100);
            }
        };
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);

        // 保存监听器引用，退出时清理
        this._editLockListeners = [
            { type: 'blockly_event', handler: onBlocklyEvent },
            { type: 'mutation_observer', observer: widgetObserver },
            { type: 'document_event', event: 'focusin', handler: onFocusIn },
            { type: 'document_event', event: 'focusout', handler: onFocusOut },
        ];
        // 4. WidgetDiv show/hide monkey-patch（作为 focus 事件之外的额外保障）
        const wd = this._Blockly?.WidgetDiv;
        if (wd && typeof wd.hide === 'function' && typeof wd.show === 'function') {
            const origHide = wd.hide, origShow = wd.show;
            const self = this;
            wd.hide = function (...args) { origHide.apply(this, args); self._detectAndBroadcastEditState(); };
            wd.show = function (...args) { origShow.apply(this, args); self._detectAndBroadcastEditState(); };
            this._editLockListeners.push(
                { type: 'widgetdiv_hide_patch', original: origHide, obj: wd, key: 'hide' },
                { type: 'widgetdiv_show_patch', original: origShow, obj: wd, key: 'show' },
            );
        }

        // 注册 Blockly workspace 变更监听
        const ws = this._Blockly.getMainWorkspace();
        if (ws) {
            ws.addChangeListener(onBlocklyEvent);
        } else {
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
        // 2. 注释编辑：遍历 Blockly 注释对象，用 textarea_ 直接比对 (SVG 的 id attribute 在跨 namespace 时无法通过 DOM 遍历获取)
        // 工作区注释使用 scratchCommentTextarea，积木注释使用 blocklyCommentTextarea
        const active = document.activeElement;
        const isAnyCommentTextarea = active && (
            active.classList.contains('scratchCommentTextarea') ||
            active.classList.contains('blocklyCommentTextarea')
        );
        if (!newState && isAnyCommentTextarea) {
            const ws = this._Blockly?.getMainWorkspace();
            if (ws) {
                const target = this._vm?.runtime?.getEditingTarget();
                const sortedKeys = target?.comments ? Object.keys(target.comments).sort() : [];
                let foundId = null;
                // 工作区注释
                for (const tc of ws.getTopComments(true) || []) {
                    if (tc.textarea_ === active) { foundId = tc.id; break; }
                }
                // 积木注释
                if (!foundId) {
                    for (const block of ws.getAllBlocks(false) || []) {
                        if (block.comment?.textarea_ === active) { foundId = block.comment.id; break; }
                    }
                }
                if (foundId) {
                    const idx = sortedKeys.indexOf(foundId);
                    if (idx >= 0) {
                        newState = { type: 'comment', index: idx };
                    } else {
                        // VM 还没同步这个 comment，延迟重试
                        if (this._commentRetryTimer) clearTimeout(this._commentRetryTimer);
                        this._commentRetryTimer = setTimeout(() => {
                            this._commentRetryTimer = null;
                            this._detectAndBroadcastEditState();
                        }, 100);
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
        // 防止 exit 递归调用（onclose 触发 exit 时）
        if (this._exiting) return;
        this._exiting = true;
        try {
        // 发送拖动结束 + 解锁（如果正在拖动）
        if (this._dragActive && this.state.clientId) {
            this._broadcastDragLock(false);
            this.broadcastToPeers(JSON.stringify({
                type: SERVER_OPCODE.BLOCK_DRAG_END,
                targetIndex: this.editingTargetIndex,
                userId: this.state.clientId,
                rootId: this._dragRootId,
            }), true);
            this._dragActive = false;
            this._dragRootId = null;
            this._dragRootBlock = null;
        }
        this.workspace.removeEventListener("mousemove", this.boundMouseMoveHandler);
        // 清理编辑锁定的事件监听器
        for (const listener of this._editLockListeners) {
            if (listener.type === 'mutation_observer' && listener.observer) {
                listener.observer.disconnect();
            } else if (listener.type === 'document_event') {
                document.removeEventListener(listener.event, listener.handler);
            } else if ((listener.type === 'widgetdiv_hide_patch' || listener.type === 'widgetdiv_show_patch') && listener.original) {
                if (listener.obj && listener.key) {
                    listener.obj[listener.key] = listener.original;
                }
            } else if (listener.type === 'blockly_event') {
                const ws = this._Blockly?.getMainWorkspace?.();
                if (ws) ws.removeChangeListener(listener.handler);
            }
        }
        this._editLockListeners = [];
        // 监听器已清理，允许下次 setBlockly 重新注册
        this._editLockListenersReady = false;
        // 退出时释放所有锁定
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
            this._localEditState = null;
        }
        // 清理聊天输入框
        if (this._boundKeyHandler) {
            window.removeEventListener("keydown", this._boundKeyHandler);
            this._boundKeyHandler = null;
        }
        this._stopHeartbeat();
        // 用户主动退出，取消自动重连
        this._cancelReconnect();
        if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
        if (this._updateTimer) { clearTimeout(this._updateTimer); this._updateTimer = null; }
        if (this._commentRetryTimer) { clearTimeout(this._commentRetryTimer); this._commentRetryTimer = null; }
        if (this._pendingUnlockTimer) { clearTimeout(this._pendingUnlockTimer); this._pendingUnlockTimer = null; }
        if (this._pointerRaf) { cancelAnimationFrame(this._pointerRaf); this._pointerRaf = null; }
        if (this._snapshotTimeout) { clearTimeout(this._snapshotTimeout); this._snapshotTimeout = null; }
        // 解绑 workspace mousemove 监听
        if (this._boundWorkspace && this.boundMouseMoveHandler) {
            try { this._boundWorkspace.removeEventListener("mousemove", this.boundMouseMoveHandler); } catch { /* workspace已dispose */ }
            this._boundWorkspace = null;
        }
        // 移除 login 时绑定的全局监听器，防止每次 login 累积
        if (this._boundBeforeUnload) { window.removeEventListener("beforeunload", this._boundBeforeUnload); this._boundBeforeUnload = null; }
        if (this._boundPageHide) { window.removeEventListener("pagehide", this._boundPageHide); this._boundPageHide = null; }
        if (this._boundProjectChanged) { this._vm.runtime.off("PROJECT_CHANGED", this._boundProjectChanged); this._boundProjectChanged = null; }
        if (this._boundExtensionRemoved) { this._vm.runtime.off("EXTENSION_REMOVED", this._boundExtensionRemoved); this._boundExtensionRemoved = null; }
        if (this._boundTargetsUpdate) { this._vm.off('targetsUpdate', this._boundTargetsUpdate); this._boundTargetsUpdate = null; }
        this._loggingIn = false;
        // 使当前 login 会话失效，让进行中的 login 在 await 恢复后中止
        this._loginSession = null;
        this._snapshotLoading = false;
        this._deferredPeerMessages = [];
        // 仅关闭由协作插件开启的加载页面，避免误关 sb-file-uploader 为普通项目加载开启的加载页面
        if (this._loadingProjectOpenedByCollab) {
            ReduxStore.dispatch(closeLoadingProject());
            this._loadingProjectOpenedByCollab = false;
        }
        // 清理忽略队列：snapshot 中途退出时 snapshotOpId 可能仍存在，否则 shouldIgnoreUpdate 永远返回 true
        this._ignoreQueue.clear();
        this._hideChatInput();
        // 清理工作区中的远端元素（指针、聊天气泡、锁定遮罩）
        cleanupAllRemote();
        this._closeAllPeerConnections();
        if (this._server) {
            try { this._server.send(JSON.stringify({ type: "exit", clientId: this.state.clientId })); } catch (e) { }
            try { this._server.close(); } catch (e) { }
            this._server = null;
        }
        // 重置所有缓存，避免重新加入协作后陈旧缓存导致错误 diff
        this._scriptBlockCache.clear();
        this._commentCache.clear();
        this._extensionCache.clear();
        this._costumeCache.clear();
        this._soundCache.clear();
        this._variableCache.clear();
        this._spriteIdCache = null;
        // 重置 host 状态和成员列表
        this._isHost = false;
        this.members = [];
        // _allSTUN_URLs 保留（本地备用缓存，避免 GitHub 不可达时无法协作）
        this.state.clientId = null; this.state.roomId = null; this.state.allMembers = [];
        } finally {
            this._exiting = false;
        }
    }

    // ── 自动重连 ──────────────────────────────────────────────────

    _scheduleReconnect() {
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        this._reconnectAttempts++;
        // 指数退避：1s, 2s, 4s, 8s, 16s，上限 30s
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);
        this._console.log(`[协作] 将在 ${delay}ms 后尝试第 ${this._reconnectAttempts} 次重连`);
        this._updateTipText(this._msg("reconnecting") || `重连中... (${this._reconnectAttempts})`);
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this._doReconnect();
        }, delay);
    }

    _doReconnect() {
        if (!this._reconnectEnabled || !this._lastLoginArgs) return;
        // 清理旧状态但保留重连标记和登录参数
        this._server = null;
        this.state.clientId = null;
        this.state.allMembers = [];
        this._closeAllPeerConnections();
        const { mode, serverUrl, roomId } = this._lastLoginArgs;
        // 重新登录（复用 login 方法，但绕过 _loggingIn 检查）
        this._loggingIn = false;
        this.login(mode, serverUrl, roomId).catch(e => {
            this._console.error("[协作] 重连失败:", e);
            // 重连失败，继续重试
            this._scheduleReconnect();
        });
    }

    _cancelReconnect() {
        this._reconnectEnabled = false;
        if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
        this._reconnectAttempts = 0;
    }

    static CHUNK_SIZE = 15000;
    static HEARTBEAT_INTERVAL = 10000;
    static HEARTBEAT_TIMEOUT = 35000;
    static CHUNK_RECEIVE_TIMEOUT = 120000;
    static BUFFER_LOW_WATER = 64 * 1024;
    static BUFFER_HIGH_WATER = 256 * 1024;
    static PENDING_LIMIT = 10000;

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
        if (dropIfBuffered && (channel.bufferedAmount > RTCServer.BUFFER_HIGH_WATER || this._sendQueues.has(peerId))) return false;
        try {
            if (data.length <= RTCServer.CHUNK_SIZE && !this._sendQueues.has(peerId) && channel.bufferedAmount < RTCServer.BUFFER_HIGH_WATER) {
                channel.send(data);
            } else {
                return this._queueSend(peerId, this._messageToChunks(data));
            }
            return true;
        } catch (e) {
            if (dropIfBuffered) return false;
            if (!this._pendingMessages.has(peerId)) this._pendingMessages.set(peerId, []);
            const pending = this._pendingMessages.get(peerId);
            if (pending.length < 50) pending.push(data);
            if (!this._retryTimer) this._retryTimer = setTimeout(() => this._retryPending(), 100);
            return false;
        }
    }

    _retryPending() {
        this._retryTimer = null;
        let hasPending = false;
        for (const [peerId, pending] of this._pendingMessages) {
            if (pending.length === 0) { this._pendingMessages.delete(peerId); continue; }
            const channel = this._dataChannels.get(peerId);
            if (!channel || channel.readyState !== "open") continue;
            const msg = pending.shift();
            if (this.sendToPeer(peerId, msg)) {
                if (pending.length > 0) hasPending = true;
                else this._pendingMessages.delete(peerId);
            } else {
                pending.unshift(msg);
                hasPending = true;
            }
        }
        if (hasPending) this._retryTimer = setTimeout(() => this._retryPending(), 50);
    }

    broadcastToPeers(data, skipGuard) {
        if (!skipGuard && this.shouldIgnoreUpdate()) return 0;
        let dropIfBuffered = false;
        try {
            const type = JSON.parse(data).type;
            dropIfBuffered = type === SERVER_OPCODE.POINTER
                || type === SERVER_OPCODE.POINTER_LEAVE
                || type === SERVER_OPCODE.BLOCK_DRAG_START
                || type === SERVER_OPCODE.BLOCK_DRAG_MOVE
                || type === SERVER_OPCODE.BLOCK_DRAG_END
                || type === SERVER_OPCODE.CHAT_MESSAGE;
        } catch (e) {}
        let sent = 0;
        for (const peerId of this._dataChannels.keys()) {
            if (this.sendToPeer(peerId, data, dropIfBuffered)) sent++;
        }
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
        try { const r = await fetchWithTimeout("https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt", 5000); if (r) this._allSTUN_URLs = await r.text(); } catch (e) { }
        if (!this._allSTUN_URLs) {
            try { const r = await fetchWithTimeout("https://ghproxy.net/https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt", 5000); if (r) this._allSTUN_URLs = await r.text(); } catch (e) { }
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
            } catch (e) { }
        }
        return isJoin ? { id: checkID, isUsing: false } : `room_${Date.now()}`;
    }

    _getRTCConfig() {
        return { iceServers: [{ urls: this._allSTUN_URLs.split("\n").filter((u) => u.trim()).map((u) => `stun:${u.trim()}`) }] };
    }

    _closePeerConnection(peerId) {
        const ch = this._dataChannels.get(peerId);
        if (ch) { try { ch.close(); } catch (e) { } this._dataChannels.delete(peerId); }
        const rtc = this._rtcConnections.get(peerId);
        if (rtc) { try { rtc.close(); } catch (e) { } this._rtcConnections.delete(peerId); }
        this._pendingCandidates.delete(peerId);
        this._pendingMessages.delete(peerId);
        this._peerLastSeen.delete(peerId);
        this._sendQueues.delete(peerId);
        // 清理该 peer 的未完成分片重组缓冲区（按 peerId 过滤，因为 key 是 chunkId）
        for (const [chunkId, buf] of this._chunkBuffers) {
            if (buf.peerId === peerId) {
                if (buf.timer) clearTimeout(buf.timer);
                this._chunkBuffers.delete(chunkId);
            }
        }
        const drainTimer = this._sendDrainTimers.get(peerId);
        if (drainTimer) { clearTimeout(drainTimer); this._sendDrainTimers.delete(peerId); }
        if (this._onPeerLeft) this._onPeerLeft(peerId);
        this._console.log("[协作] 已关闭与 " + peerId + " 的P2P连接");
    }

    _closeAllPeerConnections() {
        for (const timer of this._sendDrainTimers.values()) clearTimeout(timer);
        this._sendDrainTimers.clear();
        this._sendQueues.clear();
        this._peerLastSeen.clear();
        // 清理所有分片重组定时器
        for (const buf of this._chunkBuffers.values()) if (buf.timer) clearTimeout(buf.timer);
        this._chunkBuffers.clear();
        this._pendingMessages.clear();
        for (const pid of this._rtcConnections.keys()) this._closePeerConnection(pid);
    }

    _setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            this._updateTipText(this._msg("rtc_connected"));
            const pending = this._pendingMessages.get(peerId);
            if (pending?.length) {
                this._pendingMessages.delete(peerId);
                for (const msg of pending) this.sendToPeer(peerId, msg);
            }
        };
        channel.onerror = (e) => { this._console.error("[协作] 数据通道错误: " + peerId, e); };
        channel.onmessage = async (event) => {
            this._touchPeer(peerId);
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "_chunk") {
                    let buf = this._chunkBuffers.get(msg.id);
                    if (!buf) {
                        buf = { total: msg.total, chunks: [], peerId };
                        buf.timer = setTimeout(() => {
                            this._console.warn(`[协作] 分片重组超时: id=${msg.id} total=${buf.total}`);
                            this._chunkBuffers.delete(msg.id);
                        }, RTCServer.CHUNK_RECEIVE_TIMEOUT);
                        this._chunkBuffers.set(msg.id, buf);
                    }
                    buf.chunks[msg.idx] = msg.data;
                    const received = buf.chunks.filter((c) => c !== undefined).length;
                    if (received === buf.total) {
                        clearTimeout(buf.timer);
                        this._chunkBuffers.delete(msg.id);
                        await this._onPeerMessage(peerId, buf.chunks.join(""));
                    }
                    return;
                }
                await this._onPeerMessage(peerId, event.data);
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
                // 仅在 "failed" 时关闭连接；"disconnected" 是暂时的，依赖心跳超时处理
                if (rtc.iceConnectionState === "failed") {
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
                // 仅在 "failed" 时关闭连接；"disconnected" 是暂时的，依赖心跳超时处理
                if (rtc.iceConnectionState === "failed") {
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
                for (const c of this._pendingCandidates.get(senderId)) try { await rtc.addIceCandidate(c); } catch (e) { }
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
                // Host 初始化 members（包含自己）
                if (this._isHost) {
                    this.members = this.state.allMembers.map(m => ({
                        cid: m.cid,
                        userName: m.userName,
                        editingIndex: m.cid === this.state.clientId ? this.nowEditingIndex() : 0
                    }));
                }
                // 连接成功，启用自动重连，重置重连计数
                this._reconnectEnabled = true;
                this._reconnectAttempts = 0;
                this._updateTipText(this._msg("connected"));
                this._emitState();
                // Non-host peers expect a SNAPSHOT from host; set timeout
                if (!this._isHost) {
                    // 立即显示加载页面，让 member 在等待 SNAPSHOT 期间有视觉反馈
                    ReduxStore.dispatch(openLoadingProject());
                    this._loadingProjectOpenedByCollab = true;
                    this._snapshotTimeout = setTimeout(() => {
                        if (this._snapshotTimeout) {
                            this._snapshotTimeout = null;
                            ReduxStore.dispatch(closeLoadingProject());
                            this._loadingProjectOpenedByCollab = false;
                            this._updateTipText(this._msg("snapshot_timeout"), "error");
                            this.exit();
                        }
                    }, 120000);
                }
                break;
            case "peer-joined":
                this.state.allMembers = data.existingPeers || [];
                this._updateTipText(this._msg("peer_joined"));
                this._emitState();
                this._createAndSendOffer(data.clientId);
                if (this._isHost) {
                    // Host：将新成员加入 members 并广播完整列表
                    const newPeer = this.state.allMembers.find(m => m.cid === data.clientId);
                    if (newPeer) {
                        this.members.push({
                            cid: newPeer.cid,
                            userName: newPeer.userName,
                            editingIndex: 0
                        });
                    }
                    this._broadcastMembersSync();
                    // 发送快照（try/catch 防止 _buildSnapshotWithAssets 失败导致 member 卡 120 秒）
                    try {
                        const extensions = [];
                        const extURLs = this._vm.extensionManager.getExtensionURLs ? this._vm.extensionManager.getExtensionURLs() : {};
                        for (const id of this._vm.extensionManager._loadedExtensions.keys()) {
                            extensions.push({ id, url: extURLs[id] || null });
                        }
                        const snapshotData = await this._buildSnapshotWithAssets();
                        const sendProject = { type: SERVER_OPCODE.SNAPSHOT, data: snapshotData, projectName: getAPPNAME(), config: window.location.search, extensions };
                        // 仅发送给新加入的 peer，避免让所有已连接的 peer 重新加载快照
                        this.sendToPeer(data.clientId, JSON.stringify(sendProject));
                    } catch (e) {
                        this._console.error("[协作] 构建/发送 snapshot 失败:", e);
                        // 通知 member snapshot 失败，让其退出等待
                        this.sendToPeer(data.clientId, JSON.stringify({ type: SERVER_OPCODE.SNAPSHOT_ERROR }));
                    }
                }
                break;
            case "peer-left": {
                this.state.allMembers = data.existingPeers || [];
                // Host 迁移：根据 existingPeers 中的 owner 标记重算 _isHost
                const wasHost = this._isHost;
                let newIsHost = false;
                for (const peer of (data.existingPeers || [])) {
                    if (peer.cid === this.state.clientId && peer.owner) {
                        newIsHost = true;
                        break;
                    }
                }
                this._isHost = newIsHost;
                if (newIsHost) {
                    // 新 Host 接管：重建 members 列表（基于现有 peers）
                    this.members = this.state.allMembers.map(m => ({
                        cid: m.cid,
                        userName: m.userName,
                        editingIndex: m.cid === this.state.clientId ? this.nowEditingIndex() : 0
                    }));
                    this._broadcastMembersSync();
                } else {
                    // 非 Host：移除离开的成员
                    this.members = this.members.filter(m => m.cid !== data.clientId);
                }
                // Host 离开后，若正在等待 SNAPSHOT，停止等待并退出
                if (wasHost && !this._isHost && this._snapshotTimeout) {
                    // 原 Host 离开，member 的 snapshot 永远收不到了
                    clearTimeout(this._snapshotTimeout);
                    this._snapshotTimeout = null;
                    if (this._loadingProjectOpenedByCollab) {
                        ReduxStore.dispatch(closeLoadingProject());
                        this._loadingProjectOpenedByCollab = false;
                    }
                    this._updateTipText(this._msg("host_left") || "Host 已离开", "error");
                    this.exit();
                }
                this._updateTipText(this._msg("peer_left"));
                this._emitState();
                this._closePeerConnection(data.clientId);
                break;
            }
            case "offer": this._handleOffer(data.senderId, data.sdp); break;
            case "answer": this._handleAnswer(data.senderId, data.sdp); break;
            case "ice-candidate": this._handleIceCandidateMsg(data.senderId, data.candidate); break;
        }
    }
}
