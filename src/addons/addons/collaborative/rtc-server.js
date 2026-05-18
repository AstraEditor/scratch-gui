import { ID_SEA } from "./constants.js";
import { fetchWithTimeout } from "./utils.js";

/**
 * 协作编辑的网络层：房间管理（HTTP）+ 信令服务器（WebSocket）+ P2P（WebRTC）。
 *
 * 通过回调向外暴露消息和状态变更：
 *   onPeerMessage(peerId, data) — P2P 数据通道收到消息
 *   onStateChange(newState)      — 连接/断开/成员变化
 *   updateTipText(text, mode)    — UI 提示（透传）
 */
export function createRTCServer({ msg, console, updateTipText, onPeerMessage, onStateChange }) {

    // ── 内部状态 ────────────────────────────────────────────────

    let server = null; // WebSocket
    let allSTUN_URLs = null;

    const rtcConnections = new Map();  // peerId → RTCPeerConnection
    const dataChannels = new Map();    // peerId → RTCDataChannel
    const pendingCandidates = new Map(); // peerId → RTCIceCandidate[]

    const state = { clientId: null, roomId: null, allMembers: [] };

    const emitState = () => { onStateChange({ ...state }); };

    const getState = () => ({ ...state });

    // ── STUN 列表获取 ───────────────────────────────────────────

    const ensureSTUNList = async () => {
        if (allSTUN_URLs) return;
        updateTipText(msg("loading_available_stun"));
        try {
            const resp = await fetchWithTimeout(
                "https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt",
                5000,
            );
            if (resp) allSTUN_URLs = await resp.text();
        } catch (e) {
            console.error("[协作] 获取STUN列表失败", e);
        }
        if (!allSTUN_URLs) {
            try {
                updateTipText(msg("loading_available_stun_from_proxy"));
                const resp = await fetchWithTimeout(
                    "https://ghproxy.net/https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt",
                    5000,
                );
                if (resp) allSTUN_URLs = await resp.text();
            } catch (e) {
                console.error("[协作] 镜像STUN获取也失败", e);
            }
        }
        if (!allSTUN_URLs) {
            console.warn("[协作] 无法获取STUN列表，使用默认STUN");
            allSTUN_URLs = "stun.l.google.com:19302\n";
        }
    };

    // ── 房间 ID 生成 ────────────────────────────────────────────

    const spawnRoomID = async (mode = "reg", checkID = "", serverUrl = "localhost:1832") => {
        const isJoinMode = mode === "join";

        const getRandomNumber = (x, y) =>
            Math.floor(Math.random() * (y - x + 1)) + x;

        for (let retryNum = 0; retryNum < 10; retryNum++) {
            let queryId;
            if (!isJoinMode) {
                queryId = `${ID_SEA.Who[getRandomNumber(0, ID_SEA.Who.length - 1)]}${ID_SEA.Do[getRandomNumber(0, ID_SEA.Do.length - 1)]}${ID_SEA.Things[getRandomNumber(0, ID_SEA.Things.length - 1)]}`;
                console.log("[协作]尝试生成一个ID: " + queryId);
            } else {
                queryId = checkID;
            }

            try {
                const response = await fetchWithTimeout(
                    `http://${serverUrl}/roomIsFree?roomId=${encodeURIComponent(queryId)}`,
                );
                if (!response) continue;
                const data = await response.json();
                console.log("[协作]房间检查:", data);
                if (isJoinMode) {
                    return { id: checkID, isUsing: !data.isFree };
                } else {
                    if (data.isFree) {
                        console.log("[协作]房间可用: " + queryId);
                        return queryId;
                    }
                    console.log("[协作]房间已占用，重试...");
                }
            } catch (error) {
                console.error("[协作]检查房间失败:", error);
            }
        }

        if (isJoinMode) return { id: checkID, isUsing: false };
        return `room_${Date.now()}`;
    };

    // ── WebRTC 配置与连接生命周期 ─────────────────────────────────

    const getRTCConfig = () => ({
        iceServers: [
            {
                urls: allSTUN_URLs
                    .split("\n")
                    .filter((u) => u.trim() !== "")
                    .map((u) => `stun:${u.trim()}`),
            },
        ],
    });

    const closePeerConnection = (peerId) => {
        const channel = dataChannels.get(peerId);
        if (channel) {
            try { channel.close(); } catch (e) { /* ignore */ }
            dataChannels.delete(peerId);
        }
        const rtc = rtcConnections.get(peerId);
        if (rtc) {
            try { rtc.close(); } catch (e) { /* ignore */ }
            rtcConnections.delete(peerId);
        }
        pendingCandidates.delete(peerId);
        console.log("[协作] 已关闭与 " + peerId + " 的P2P连接");
    };

    const closeAllPeerConnections = () => {
        for (const peerId of rtcConnections.keys()) {
            closePeerConnection(peerId);
        }
    };

    // ── 数据通道 ────────────────────────────────────────────────

    const setupDataChannel = (channel, peerId) => {
        channel.onopen = () => {
            console.log("[协作] 数据通道已开启: " + peerId);
            updateTipText(msg("rtc_connected"));
        };

        channel.onclose = () => {
            console.log("[协作] 数据通道已关闭: " + peerId);
        };

        channel.onerror = (e) => {
            console.error("[协作] 数据通道错误: " + peerId, e);
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onPeerMessage(peerId, data);
            } catch (e) {
                console.error("[协作] 无效的P2P消息:", e);
            }
        };
    };

    // ── P2P 发送 ────────────────────────────────────────────────

    const sendToPeer = (peerId, data) => {
        const channel = dataChannels.get(peerId);
        if (!channel || channel.readyState !== "open") {
            console.warn("[协作] 无法发送给 " + peerId + ": 通道未就绪");
            return false;
        }
        try {
            channel.send(JSON.stringify(data));
            return true;
        } catch (e) {
            console.error("[协作] 发送失败:", e);
            return false;
        }
    };

    const broadcastToPeers = (data) => {
        let sent = 0;
        for (const peerId of dataChannels.keys()) {
            if (sendToPeer(peerId, data)) sent++;
        }
        return sent;
    };

    // ── WebRTC 信令 ─────────────────────────────────────────────

    const createAndSendOffer = async (peerId) => {
        console.log("[协作] 创建offer给: " + peerId);
        closePeerConnection(peerId);

        try {
            const rtc = new RTCPeerConnection(getRTCConfig());
            rtcConnections.set(peerId, rtc);

            const channel = rtc.createDataChannel("collaboration");
            dataChannels.set(peerId, channel);
            setupDataChannel(channel, peerId);

            rtc.onicecandidate = (event) => {
                if (event.candidate && server && server.readyState === WebSocket.OPEN) {
                    server.send(JSON.stringify({
                        type: "ice-candidate",
                        targetId: peerId,
                        candidate: event.candidate,
                    }));
                }
            };

            rtc.oniceconnectionstatechange = () => {
                console.log("[协作] ICE状态(" + peerId + "): " + rtc.iceConnectionState);
                if (rtc.iceConnectionState === "failed" || rtc.iceConnectionState === "disconnected") {
                    updateTipText(msg("rtc_failed"), "error");
                    closePeerConnection(peerId);
                }
            };

            const offer = await rtc.createOffer();
            await rtc.setLocalDescription(offer);

            if (server && server.readyState === WebSocket.OPEN) {
                server.send(JSON.stringify({
                    type: "offer",
                    targetId: peerId,
                    sdp: rtc.localDescription,
                }));
            }
        } catch (e) {
            console.error("[协作] 创建offer失败:", e);
            updateTipText(msg("rtc_failed"), "error");
            closePeerConnection(peerId);
        }
    };

    const handleOffer = async (senderId, sdp) => {
        console.log("[协作] 收到来自 " + senderId + " 的offer");
        closePeerConnection(senderId);

        try {
            const rtc = new RTCPeerConnection(getRTCConfig());
            rtcConnections.set(senderId, rtc);

            rtc.ondatachannel = (event) => {
                const channel = event.channel;
                dataChannels.set(senderId, channel);
                setupDataChannel(channel, senderId);
            };

            rtc.onicecandidate = (event) => {
                if (event.candidate && server && server.readyState === WebSocket.OPEN) {
                    server.send(JSON.stringify({
                        type: "ice-candidate",
                        targetId: senderId,
                        candidate: event.candidate,
                    }));
                }
            };

            rtc.oniceconnectionstatechange = () => {
                console.log("[协作] ICE状态(" + senderId + "): " + rtc.iceConnectionState);
                if (rtc.iceConnectionState === "failed" || rtc.iceConnectionState === "disconnected") {
                    updateTipText(msg("rtc_failed"), "error");
                    closePeerConnection(senderId);
                }
            };

            await rtc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await rtc.createAnswer();
            await rtc.setLocalDescription(answer);

            if (server && server.readyState === WebSocket.OPEN) {
                server.send(JSON.stringify({
                    type: "answer",
                    targetId: senderId,
                    sdp: rtc.localDescription,
                }));
            }

            // 消费排队的 ICE candidates
            if (pendingCandidates.has(senderId)) {
                const candidates = pendingCandidates.get(senderId);
                pendingCandidates.delete(senderId);
                for (const c of candidates) {
                    try { await rtc.addIceCandidate(c); } catch (e) { /* ignore */ }
                }
            }
        } catch (e) {
            console.error("[协作] 处理offer失败:", e);
            updateTipText(msg("rtc_failed"), "error");
            closePeerConnection(senderId);
        }
    };

    const handleAnswer = async (senderId, sdp) => {
        console.log("[协作] 收到来自 " + senderId + " 的answer");
        const rtc = rtcConnections.get(senderId);
        if (!rtc) {
            console.warn("[协作] 未找到 " + senderId + " 的RTC连接");
            return;
        }

        try {
            await rtc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {
            console.error("[协作] 设置remote description失败:", e);
            closePeerConnection(senderId);
        }
    };

    const handleIceCandidateMsg = async (senderId, candidate) => {
        const rtc = rtcConnections.get(senderId);
        if (!rtc) return;

        const iceCandidate = new RTCIceCandidate(candidate);
        try {
            if (rtc.remoteDescription) {
                await rtc.addIceCandidate(iceCandidate);
            } else {
                if (!pendingCandidates.has(senderId)) {
                    pendingCandidates.set(senderId, []);
                }
                pendingCandidates.get(senderId).push(iceCandidate);
            }
        } catch (e) {
            console.error("[协作] 添加ICE candidate失败:", e);
        }
    };

    // ── 服务器消息分发 ──────────────────────────────────────────

    const handleServerMessage = (data) => {
        console.log("[协作] 服务器消息:", data);
        switch (data.type) {
            case "connection":
                state.clientId = data.clientId;
                state.roomId = data.roomId;
                state.allMembers = data.existingPeers || [];
                updateTipText(msg("connected"));
                emitState();
                if (state.allMembers.length > 0) {
                    console.log("[协作] 房间内已有节点:", state.allMembers);
                }
                break;

            case "peer-joined":
                console.log("[协作] 节点加入: " + data.clientId);
                state.allMembers = data.existingPeers || [];
                updateTipText(msg("peer_joined"));
                emitState();
                createAndSendOffer(data.clientId);
                break;

            case "peer-left":
                console.log("[协作] 节点离开: " + data.clientId);
                state.allMembers = data.existingPeers || [];
                updateTipText(msg("peer_left"));
                emitState();
                closePeerConnection(data.clientId);
                break;

            case "offer":
                handleOffer(data.senderId, data.sdp);
                break;

            case "answer":
                handleAnswer(data.senderId, data.sdp);
                break;

            case "ice-candidate":
                handleIceCandidateMsg(data.senderId, data.candidate);
                break;

            default:
                console.warn("[协作] 未知消息类型:", data.type);
        }
    };

    // ── 登入 / 退出 ─────────────────────────────────────────────

    const exit = () => {
        closeAllPeerConnections();
        if (server) {
            try {
                server.send(JSON.stringify({
                    type: "exit",
                    clientId: state.clientId,
                }));
            } catch (e) { /* ignore */ }
            try { server.close(); } catch (e) { /* ignore */ }
            server = null;
        }
        state.clientId = null;
        state.roomId = null;
        state.allMembers = [];
    };

    const login = async (mode = "reg", serverUrl = "localhost:1832", roomId = "") => {
        await ensureSTUNList();

        if (!window.RTCPeerConnection) {
            updateTipText(msg("create_rtc_failed"), "error");
            return;
        }

        updateTipText(msg("linking_to_server"));
        const spawnedRoomID = await spawnRoomID(mode, roomId, serverUrl);

        if (mode === "join") {
            if (!spawnedRoomID.isUsing) {
                updateTipText(msg("join_failed"), "error");
                return;
            }
            server = new WebSocket(`ws://${serverUrl}?room=${spawnedRoomID.id}`);
        } else {
            server = new WebSocket(`ws://${serverUrl}?room=${spawnedRoomID}`);
        }

        server.onmessage = (msgs) => {
            try {
                const data = JSON.parse(msgs.data);
                handleServerMessage(data);
            } catch (e) {
                console.error("[协作] 解析服务器消息失败:", e);
            }
        };

        server.onerror = () => {
            updateTipText(msg("server_error"), "error");
        };

        server.onclose = () => {
            closeAllPeerConnections();
            updateTipText(msg("server_exit"), "error");
            server = null;
            state.clientId = null;
            state.roomId = null;
            state.allMembers = [];
            emitState();
        };

        // 页面关闭时退出
        window.addEventListener("beforeunload", exit);
    };

    return {
        login,
        exit,
        sendToPeer,
        broadcastToPeers,
        getState,
    };
}
