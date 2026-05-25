import { ID_SEA, DEFAULT_STUN_URLS } from "./constants.js";
import { fetchWithTimeout, getAPPNAME } from "./utils.js";

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
    }) {
        this._msg = msg;
        this._console = console;
        this._updateTipText = updateTipText;
        this._onPeerMessage = onPeerMessage;
        this._onStateChange = onStateChange;
        this._vm = vm;

        this._server = null;
        this._allSTUN_URLs = null;
        this._rtcConnections = new Map();
        this._dataChannels = new Map();
        this._pendingCandidates = new Map();
        this._isHost = false;
        this._chunkBuffers = new Map();
        this._pendingMessages = new Map(); // peerId → data[]
        this.state = { clientId: null, roomId: null, allMembers: [] };

        this.workspace = document.querySelector("[class*=gui_blocks-wrapper]");
        this.editingTargetIndex;
        this.boundMouseMoveHandler = this.mouseMoveHandler.bind(this);
        this._vm.on("targetsUpdate", this.updateWorkspace);

        this.getUserName = () => localStorage.getItem("tw:username") || "user";
    }

    // ── 对外 API ─────────────────────────────────────────────────

    getState() {
        return { ...this.state };
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
            this._server = new WebSocket(
                `ws://${serverUrl}?room=${spawnedRoomID.id}&name=${this.getUserName()}`,
            );
        } else {
            this._server = new WebSocket(
                `ws://${serverUrl}?room=${spawnedRoomID}&name=${this.getUserName()}`,
            );
        }
        this._server.onmessage = (msgs) => {
            try {
                this._handleServerMessage(JSON.parse(msgs.data));
            } catch (e) {
                this._console.error("[协作] 解析服务器消息失败:", e);
            }
        };
        this._server.onerror = () =>
            this._updateTipText(this._msg("server_error"), "error");
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
        this.workspace.addEventListener(
            "mousemove",
            this.boundMouseMoveHandler,
        );
    }

    updateWorkspace() {
        try {
            this.editingTargetIndex = vm.runtime.targets.findIndex(
                (ele) => vm.runtime._editingTarget.id == ele.id,
            );
            // 移除所有pointer
            document.querySelectorAll(".sa-collaborative-pointer").forEach(ele => ele.remove());
        } catch {
            this.editingTargetIndex = -1;
        }
    }

    mouseMoveHandler(e) {
        this.moveMouse(e, this.workspace);
    }

    moveMouse(e, workspace) {
        if (this._pointerRaf) return;
        this._pointerRaf = requestAnimationFrame(() => {
            this._pointerRaf = null;
            this._sendPointer(e, workspace);
        });
    }

    _sendPointer(e, workspace) {
        const ws = Blockly.getMainWorkspace();
        const svg = ws.getParentSvg();
        const matrix = ws.getInverseScreenCTM();
        if (!matrix) return;

        const svgPoint = svg.createSVGPoint();
        svgPoint.x = e.clientX;
        svgPoint.y = e.clientY;
        const svgCoord = svgPoint.matrixTransform(matrix);

        const canvasMatrix = ws.getCanvas().getCTM().inverse();
        const canvasPoint = svg.createSVGPoint();
        canvasPoint.x = svgCoord.x;
        canvasPoint.y = svgCoord.y;
        const canvasCoord = canvasPoint.matrixTransform(canvasMatrix);

        this.broadcastToPeers(
            JSON.stringify({
                type: "pointer",
                id: this.state.clientId,
                workspaceIndex: this.editingTargetIndex,
                name: this.getUserName(),
                position: {
                    x: canvasCoord.x,
                    y: canvasCoord.y,
                },
            }),
        );
    }

    exit() {
        this.workspace.removeEventListener(
            "mousemove",
            this.boundMouseMoveHandler,
        );
        this._closeAllPeerConnections();
        if (this._server) {
            try {
                this._server.send(
                    JSON.stringify({
                        type: "exit",
                        clientId: this.state.clientId,
                    }),
                );
            } catch (e) {}
            try {
                this._server.close();
            } catch (e) {}
            this._server = null;
        }
        this.state.clientId = null;
        this.state.roomId = null;
        this.state.allMembers = [];
    }

    static CHUNK_SIZE = 15000; // bytes

    sendToPeer(peerId, data) {
        const channel = this._dataChannels.get(peerId);
        if (!channel) {
            this._console.warn("[协作] 无法发送给 " + peerId + ": 无通道");
            return false;
        }
        if (channel.readyState !== "open") {
            // 通道存在但未就绪 → 排队，onopen 时自动发送
            if (!this._pendingMessages.has(peerId)) {
                this._pendingMessages.set(peerId, []);
            }
            this._pendingMessages.get(peerId).push(data);
            this._console.log(
                `[协作] 消息排队 → ${peerId} (readyState=${channel.readyState})`,
            );
            return true;
        }
        try {
            const raw = JSON.stringify(data);
            if (raw.length <= RTCServer.CHUNK_SIZE) {
                channel.send(raw);
                return true;
            }
            // 分片发送
            const id = crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2);
            let offset = 0;
            let idx = 0;
            const total = Math.ceil(raw.length / RTCServer.CHUNK_SIZE);
            this._console.log(
                `[协作] 分片发送 → ${peerId} id=${id} total=${total} size=${raw.length}`,
            );
            while (offset < raw.length) {
                const chunk = raw.slice(offset, offset + RTCServer.CHUNK_SIZE);
                channel.send(
                    JSON.stringify({
                        type: "_chunk",
                        id,
                        idx: idx++,
                        total,
                        data: chunk,
                    }),
                );
                offset += RTCServer.CHUNK_SIZE;
            }
            return true;
        } catch (e) {
            this._console.error("[协作] 发送失败:", e);
            return false;
        }
    }

    broadcastToPeers(data) {
        let sent = 0;
        for (const peerId of this._dataChannels.keys())
            if (this.sendToPeer(peerId, data)) sent++;
        return sent;
    }

    async _buildSnapshotWithAssets() {
        const sb3 = await this._vm.saveProjectSb3("arraybuffer");

        let binary = "";

        const bytes = new Uint8Array(sb3);

        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return btoa(binary);
    }

    _emitState() {
        this._onStateChange({ ...this.state });
    }

    async _ensureSTUNList() {
        if (this._allSTUN_URLs) return;
        this._updateTipText(this._msg("loading_available_stun"));
        try {
            const r = await fetchWithTimeout(
                "https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt",
                5000,
            );
            if (r) this._allSTUN_URLs = await r.text();
        } catch (e) {
            this._console.error("[协作] 获取STUN列表失败", e);
        }
        if (!this._allSTUN_URLs) {
            try {
                this._updateTipText(
                    this._msg("loading_available_stun_from_proxy"),
                );
                const r = await fetchWithTimeout(
                    "https://ghproxy.net/https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt",
                    5000,
                );
                if (r) this._allSTUN_URLs = await r.text();
            } catch (e) {
                this._console.error("[协作] 镜像STUN获取也失败", e);
            }
        }
        if (!this._allSTUN_URLs) {
            this._console.warn("[协作] 无法获取STUN列表，使用默认STUN");
            this._allSTUN_URLs = DEFAULT_STUN_URLS;
        }
    }

    async _spawnRoomID(
        mode = "reg",
        checkID = "",
        serverUrl = "localhost:1832",
    ) {
        const isJoin = mode === "join";
        const rand = (x, y) => Math.floor(Math.random() * (y - x + 1)) + x;
        for (let i = 0; i < 10; i++) {
            const qid = isJoin
                ? checkID
                : `${ID_SEA.Who[rand(0, ID_SEA.Who.length - 1)]}${ID_SEA.Do[rand(0, ID_SEA.Do.length - 1)]}${ID_SEA.Things[rand(0, ID_SEA.Things.length - 1)]}`;
            try {
                const r = await fetchWithTimeout(
                    `http://${serverUrl}/roomIsFree?roomId=${encodeURIComponent(qid)}`,
                );
                if (!r) continue;
                const d = await r.json();
                if (isJoin) return { id: checkID, isUsing: !d.isFree };
                if (d.isFree) return qid;
            } catch (e) {}
        }
        return isJoin ? { id: checkID, isUsing: false } : `room_${Date.now()}`;
    }

    _getRTCConfig() {
        return {
            iceServers: [
                {
                    urls: this._allSTUN_URLs
                        .split("\n")
                        .filter((u) => u.trim())
                        .map((u) => `stun:${u.trim()}`),
                },
            ],
        };
    }

    _closePeerConnection(peerId) {
        const ch = this._dataChannels.get(peerId);
        if (ch) {
            try {
                ch.close();
            } catch (e) {}
            this._dataChannels.delete(peerId);
        }
        const rtc = this._rtcConnections.get(peerId);
        if (rtc) {
            try {
                rtc.close();
            } catch (e) {}
            this._rtcConnections.delete(peerId);
        }
        this._pendingCandidates.delete(peerId);
        this._pendingMessages.delete(peerId);
        this._console.log("[协作] 已关闭与 " + peerId + " 的P2P连接");
    }

    _closeAllPeerConnections() {
        this._chunkBuffers.clear();
        this._pendingMessages.clear();
        for (const pid of this._rtcConnections.keys())
            this._closePeerConnection(pid);
    }

    _setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            this._updateTipText(this._msg("rtc_connected"));
            // 消费排队消息
            const pending = this._pendingMessages.get(peerId);
            if (pending?.length) {
                this._console.log(
                    `[协作] 发送排队消息 → ${peerId} count=${pending.length}`,
                );
                for (const msg of pending) {
                    this.sendToPeer(peerId, msg); // 此时通道已 open，直接发送
                }
                this._pendingMessages.delete(peerId);
            }
        };
        channel.onerror = (e) => {
            this._console.error("[协作] 数据通道错误: " + peerId, e);
        };
        channel.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                // 分片消息 → 缓冲拼装
                if (msg.type === "_chunk") {
                    let buf = this._chunkBuffers.get(msg.id);
                    if (!buf) {
                        buf = { total: msg.total, chunks: [] };
                        this._chunkBuffers.set(msg.id, buf);
                    }
                    buf.chunks[msg.idx] = msg.data;
                    // 是否收齐
                    const received = buf.chunks.filter(
                        (c) => c !== undefined,
                    ).length;
                    if (received === buf.total) {
                        this._chunkBuffers.delete(msg.id);
                        const full = JSON.parse(buf.chunks.join(""));
                        this._console.log(
                            `[协作] 分片组装完成 id=${msg.id} total=${buf.total}`,
                        );
                        await this._onPeerMessage(peerId, full);
                    }
                    return;
                }
                await this._onPeerMessage(peerId, msg);
            } catch (e) {
                this._console.error("[协作] 无效的P2P消息:", e);
            }
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
                    this._server.send(
                        JSON.stringify({
                            type: "ice-candidate",
                            targetId: peerId,
                            candidate: e.candidate,
                        }),
                    );
            };
            rtc.oniceconnectionstatechange = () => {
                if (
                    rtc.iceConnectionState === "failed" ||
                    rtc.iceConnectionState === "disconnected"
                ) {
                    this._updateTipText(this._msg("rtc_failed"), "error");
                    this._closePeerConnection(peerId);
                }
            };
            const offer = await rtc.createOffer();
            await rtc.setLocalDescription(offer);
            if (this._server?.readyState === WebSocket.OPEN)
                this._server.send(
                    JSON.stringify({
                        type: "offer",
                        targetId: peerId,
                        sdp: rtc.localDescription,
                    }),
                );
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
            rtc.ondatachannel = (e) => {
                this._dataChannels.set(senderId, e.channel);
                this._setupDataChannel(e.channel, senderId);
            };
            rtc.onicecandidate = (e) => {
                if (e.candidate && this._server?.readyState === WebSocket.OPEN)
                    this._server.send(
                        JSON.stringify({
                            type: "ice-candidate",
                            targetId: senderId,
                            candidate: e.candidate,
                        }),
                    );
            };
            rtc.oniceconnectionstatechange = () => {
                if (
                    rtc.iceConnectionState === "failed" ||
                    rtc.iceConnectionState === "disconnected"
                ) {
                    this._updateTipText(this._msg("rtc_failed"), "error");
                    this._closePeerConnection(senderId);
                }
            };
            await rtc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await rtc.createAnswer();
            await rtc.setLocalDescription(answer);
            if (this._server?.readyState === WebSocket.OPEN)
                this._server.send(
                    JSON.stringify({
                        type: "answer",
                        targetId: senderId,
                        sdp: rtc.localDescription,
                    }),
                );
            if (this._pendingCandidates.has(senderId)) {
                for (const c of this._pendingCandidates.get(senderId))
                    try {
                        await rtc.addIceCandidate(c);
                    } catch (e) {}
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
        try {
            await rtc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {
            this._console.error("[协作] 设置remote description失败:", e);
            this._closePeerConnection(senderId);
        }
    }

    async _handleIceCandidateMsg(senderId, candidate) {
        const rtc = this._rtcConnections.get(senderId);
        if (!rtc) return;
        const ice = new RTCIceCandidate(candidate);
        try {
            if (rtc.remoteDescription) await rtc.addIceCandidate(ice);
            else {
                if (!this._pendingCandidates.has(senderId))
                    this._pendingCandidates.set(senderId, []);
                this._pendingCandidates.get(senderId).push(ice);
            }
        } catch (e) {
            this._console.error("[协作] 添加ICE candidate失败:", e);
        }
    }

    async _handleServerMessage(data) {
        switch (data.type) {
            case "connection":
                this.state.clientId = data.clientId;
                this.state.roomId = data.roomId;
                this.state.allMembers = data.existingPeers || [];

                // 检查谁发snapshot
                this._isHost = false;
                data.existingPeers.forEach((peer) => {
                    if (peer.cid === this.state.clientId && peer.owner) {
                        this._isHost = true;
                        return;
                    }
                });
                this._updateTipText(this._msg("connected"));
                this._emitState();
                break;
            case "peer-joined":
                this.state.allMembers = data.existingPeers || [];
                this._updateTipText(this._msg("peer_joined"));
                this._emitState();
                this._createAndSendOffer(data.clientId);
                if (this._isHost) {
                    const sendProject = {
                        type: "snapshot",
                        data: await this._buildSnapshotWithAssets(),
                        projectName: getAPPNAME(),
                        config: window.location.search,
                    };
                    this._console.log(
                        `[协作] Host 发送 snapshot:${JSON.stringify(sendProject)}`,
                    );
                    this.broadcastToPeers(JSON.stringify(sendProject));
                }
                break;
            case "peer-left":
                this.state.allMembers = data.existingPeers || [];
                this._updateTipText(this._msg("peer_left"));
                this._emitState();
                this._closePeerConnection(data.clientId);
                break;
            case "offer":
                this._handleOffer(data.senderId, data.sdp);
                break;
            case "answer":
                this._handleAnswer(data.senderId, data.sdp);
                break;
            case "ice-candidate":
                this._handleIceCandidateMsg(data.senderId, data.candidate);
                break;
        }
    }
}
