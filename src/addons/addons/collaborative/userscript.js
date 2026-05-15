import addToBar from "../../tools/AddToBar";
import { getSetting, getThemeMode } from "../../tools/AEsettings";
import icon from "!../../../lib/tw-recolor/build!./icon.svg";
import copyImg from "./copy.svg";
import { join } from "path-browserify";
import SideBar from "../../ui/side-bar/side-bar.js";

/*
联机编辑
{
    id: user_id,
    where: {
        mode: code | costume | sound,
        config: {
            target: target_id,
            ...
        }
    }
}
*/

export default async function ({ addon, console, msg }) {
    const vm = addon.tab.traps.vm;
    if (!vm) return;
    const idHead = "sa-addon-collaborative-";
    const tabID = idHead + "tab";
    const COMMAND = {
        JOIN: "join",
        EXIT: "exit",
    };

    let url = "localhost:1832";
    // 输入的房间ID
    let id = "";
    // 连接的服务器
    let server = null;
    let allSTUN_URLs = null;
    let serverConfig = {
        clientId: null,
        roomId: null,
    };
    const isVSCLayout = getSetting("EnableVSCodeLayout");

    // P2P state
    const rtcConnections = new Map(); // peerId → RTCPeerConnection
    const dataChannels = new Map(); // peerId → RTCDataChannel
    const pendingCandidates = new Map(); // peerId → RTCIceCandidate[]

    const tipBox = document.createElement("div");
    tipBox.className = idHead + "tipBoxScreen";
    document.body.appendChild(tipBox);

    const ID = Date.now();
    const IDSea = {
        Who: ["赛博", "口四楼", "汉堡", "猫猫", "小猫", "枫", "虾", "糖果"],
        Do: ["吃", "玩", "说", "丢", "买"],
        Things: ["AE", "皮球", "背带裤", "鸡"],
    };

    const refreshGUI = () => {
        if (isVSCLayout) {
            SideBar.clearContent();
            SideBar.setContent(createElements());
        } else {
            // 未启用 VSC 布局
            const content = document.querySelector(
                "[class*='sa-todo-modal-content']",
            );
            content.childNodes.forEach((ele) => ele.remove());
            content.appendChild(createElements());
        }
    };

    /**
     * 若`mode`为`reg`，则会返回生成的房间ID,否则会返回`{ id, isUsing }`
     * @param {'reg' | 'join'} mode
     * @returns {Promise<string|{id: string, isUsing: boolean}>}
     */
    const spawnRoomID = async (mode = "reg", checkID = id) => {
        const isJoinMode = mode === "join";

        const getRandomNumber = (x, y) => {
            return Math.floor(Math.random() * (y - x + 1)) + x;
        };

        let retryNum = 0;

        while (retryNum < 10) {
            let queryId;
            if (!isJoinMode) {
                queryId = `${IDSea.Who[getRandomNumber(0, IDSea.Who.length - 1)]}${IDSea.Do[getRandomNumber(0, IDSea.Do.length - 1)]}${IDSea.Things[getRandomNumber(0, IDSea.Things.length - 1)]}`;
                console.log("[协作]尝试生成一个ID: " + queryId);
            } else {
                queryId = checkID;
            }

            try {
                const response = await fetchWithTimeout(
                    `http://${url}/roomIsFree?roomId=${encodeURIComponent(queryId)}`,
                );
                if (!response) {
                    retryNum++;
                    continue;
                }
                const data = await response.json();
                console.log("[协作]房间检查:", data);
                if (isJoinMode) {
                    return { id: checkID, isUsing: !data.isFree };
                } else {
                    if (data.isFree) {
                        console.log("[协作]房间可用: " + queryId);
                        return queryId;
                    } else {
                        console.log("[协作]房间已占用，重试...");
                    }
                }
            } catch (error) {
                console.error("[协作]检查房间失败:", error);
            }

            retryNum++;
        }

        if (isJoinMode) {
            return { id: checkID, isUsing: false };
        }
        return `room_${Date.now()}`;
    };

    /**
     * @param {string} text
     * @param {'normal' | 'error' | 'warn'} mode
     * @returns
     */
    const updateTipText = (text = null, mode = "normal") => {
        if (!tipBox || !text) return;
        const tipMsg = document.createElement("div");
        tipMsg.className = idHead + "tipMsgScreen";
        tipMsg.style.background =
            mode === "normal"
                ? "#09f"
                : mode === "error"
                  ? "#f00"
                  : mode === "warn" && "#ff0";
        tipMsg.textContent = text;

        setTimeout(() => {
            tipMsg.className = `${tipMsg.className} end`;
            setTimeout(() => tipMsg.remove(), 500);
        }, 2000);
        tipBox.appendChild(tipMsg);
    };

    async function fetchWithTimeout(url, timeout = 3000) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: abortController.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            console.error("[协作] fetch失败:", error);
            return null;
        }
    }

    // ── WebRTC helpers ──

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
            try {
                channel.close();
            } catch (e) {
                /* ignore */
            }
            dataChannels.delete(peerId);
        }
        const rtc = rtcConnections.get(peerId);
        if (rtc) {
            try {
                rtc.close();
            } catch (e) {
                /* ignore */
            }
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
                handlePeerMessage(peerId, data);
            } catch (e) {
                console.error("[协作] 无效的P2P消息:", e);
            }
        };
    };

    // ── P2P send / receive ──

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

    const handlePeerMessage = (peerId, data) => {
        console.log("[协作] 收到来自 " + peerId + " 的消息:", data);
        switch (data.type) {
            // ── Phase 1: snapshot ──
            case "snapshot":
                // Host 发来的完整项目快照
                break;

            // ── Phase 1: patch ──
            case "block-update":
            case "block-create":
            case "block-delete":
            case "block-connect":
            case "block-disconnect":
                // patch 层在此处理
                break;

            // ── Phase 3: assets ──
            case "costume-add":
            case "costume-update":
            case "sound-add":
            case "sound-update":
                break;

            // ── Phase 4: runtime ──
            case "ping":
                sendToPeer(peerId, { type: "pong" });
                break;
            case "pong":
                break;

            default:
                console.warn("[协作] 未知P2P消息类型:", data.type);
        }
    };

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
                if (
                    event.candidate &&
                    server &&
                    server.readyState === WebSocket.OPEN
                ) {
                    server.send(
                        JSON.stringify({
                            type: "ice-candidate",
                            targetId: peerId,
                            candidate: event.candidate,
                        }),
                    );
                }
            };

            rtc.oniceconnectionstatechange = () => {
                console.log(
                    "[协作] ICE状态(" + peerId + "): " + rtc.iceConnectionState,
                );
                if (
                    rtc.iceConnectionState === "failed" ||
                    rtc.iceConnectionState === "disconnected"
                ) {
                    updateTipText(msg("rtc_failed"), "error");
                    closePeerConnection(peerId);
                }
            };

            const offer = await rtc.createOffer();
            await rtc.setLocalDescription(offer);

            if (server && server.readyState === WebSocket.OPEN) {
                server.send(
                    JSON.stringify({
                        type: "offer",
                        targetId: peerId,
                        sdp: rtc.localDescription,
                    }),
                );
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
                if (
                    event.candidate &&
                    server &&
                    server.readyState === WebSocket.OPEN
                ) {
                    server.send(
                        JSON.stringify({
                            type: "ice-candidate",
                            targetId: senderId,
                            candidate: event.candidate,
                        }),
                    );
                }
            };

            rtc.oniceconnectionstatechange = () => {
                console.log(
                    "[协作] ICE状态(" +
                        senderId +
                        "): " +
                        rtc.iceConnectionState,
                );
                if (
                    rtc.iceConnectionState === "failed" ||
                    rtc.iceConnectionState === "disconnected"
                ) {
                    updateTipText(msg("rtc_failed"), "error");
                    closePeerConnection(senderId);
                }
            };

            await rtc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await rtc.createAnswer();
            await rtc.setLocalDescription(answer);

            if (server && server.readyState === WebSocket.OPEN) {
                server.send(
                    JSON.stringify({
                        type: "answer",
                        targetId: senderId,
                        sdp: rtc.localDescription,
                    }),
                );
            }

            // 消费排队的 ICE candidates
            if (pendingCandidates.has(senderId)) {
                const candidates = pendingCandidates.get(senderId);
                pendingCandidates.delete(senderId);
                for (const c of candidates) {
                    try {
                        await rtc.addIceCandidate(c);
                    } catch (e) {
                        /* ignore */
                    }
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

    // ── Server message handler ──

    const handleServerMessage = (data) => {
        console.log("[协作] 服务器消息:", data);
        switch (data.type) {
            case "connection":
                serverConfig.clientId = data.clientId;
                serverConfig.roomId = data.roomId;
                enterRoom(data.roomId);
                updateTipText(msg("connected"));
                if (data.existingPeers && data.existingPeers.length > 0) {
                    console.log("[协作] 房间内已有节点:", data.existingPeers);
                }
                break;

            case "peer-joined":
                console.log("[协作] 节点加入: " + data.clientId);
                updateTipText(msg("peer_joined"));
                createAndSendOffer(data.clientId);
                break;

            case "peer-left":
                console.log("[协作] 节点离开: " + data.clientId);
                updateTipText(msg("peer_left"));
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

    // ── Connect / disconnect ──

    const exitColl = () => {
        closeAllPeerConnections();
        if (server) {
            try {
                server.send(
                    JSON.stringify({
                        type: "exit",
                        clientId: serverConfig.clientId,
                    }),
                );
            } catch (e) {
                /* ignore */
            }
            try {
                server.close();
            } catch (e) {
                /* ignore */
            }
            server = null;
        }
        serverConfig.clientId = null;
        serverConfig.roomId = null;
    };

    const login = async (mode = "reg") => {
        // 获取STUN列表
        if (!allSTUN_URLs) {
            updateTipText(msg("loading_available_stun"));
            try {
                const resp = await fetchWithTimeout(
                    "https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt",
                    5000,
                );
                if (resp) {
                    allSTUN_URLs = await resp.text();
                }
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
                    if (resp) {
                        allSTUN_URLs = await resp.text();
                    }
                } catch (e) {
                    console.error("[协作] 镜像STUN获取也失败", e);
                }
            }
            if (!allSTUN_URLs) {
                // 使用默认的Google STUN作为兜底
                console.warn("[协作] 无法获取STUN列表，使用默认STUN");
                allSTUN_URLs = "stun.l.google.com:19302\n";
            }
        }

        // 验证RTC可用
        if (!window.RTCPeerConnection) {
            updateTipText(msg("create_rtc_failed"), "error");
            return;
        }

        updateTipText(msg("linking_to_server"));
        const spawnedRoomID = await spawnRoomID(mode);

        if (mode === "join") {
            if (!spawnedRoomID.isUsing) {
                updateTipText(msg("join_failed"), "error");
                return;
            }
            server = new WebSocket(`ws://${url}?room=${spawnedRoomID.id}`);
        } else {
            server = new WebSocket(`ws://${url}?room=${spawnedRoomID}`);
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
            serverConfig.clientId = null;
            serverConfig.roomId = null;
        };

        // 退出编辑器
        window.addEventListener("beforeunload", exitColl);
    };

    const createElements = () => {
        /**
         * 创建一个Tip
         * @param {'warn' | 'tip'} mode
         * @param {string} text
         * @returns
         */
        const tipBox = (mode, text) => {
            const box = document.createElement("div");
            box.className =
                mode === "tip" ? idHead + "tipBox tip" : idHead + "tipBox warn";
            const title = document.createElement("h3");
            title.textContent = msg(mode);
            const content = document.createElement("p");
            content.textContent = text;
            box.appendChild(title);
            box.appendChild(content);
            return box;
        };
        /**
         * @param {Object} config
         * @param {String} config.defaultValue
         * @param {'text' | 'number'} config.type
         * @param {String} config.label
         * @param {Function} config.onChange
         * @param {String} text
         */
        const inputBox = (config, text) => {
            const box = document.createElement("div");
            box.className = idHead + "inputBox";
            const label = document.createElement("label");
            label.textContent = config.label;
            const input = document.createElement("input");
            input.type = config.type;
            input.value = text;
            input.onchange = (e) => {
                config.onChange(e.target.value);
            };
            box.appendChild(label);
            box.appendChild(input);
            return box;
        };

        const Container = document.createElement("div");
        Container.className = idHead + "container";
        // "协作"
        const Title = document.createElement("h2");
        Title.textContent = msg("title");
        Title.className = idHead + "title";

        // 如果没有加入房间
        if (!serverConfig.clientId) {
            const joinButton = document.createElement("button");
            joinButton.textContent = msg("join");
            joinButton.onclick = () => {
                login("join");
            };
            const createButton = document.createElement("button");
            createButton.textContent = msg("create");
            createButton.onclick = () => {
                login("reg");
            };

            const NetTipText = document.createElement("span");
            NetTipText.className = idHead + "netTip";
            NetTipText.style.display = "none";

            if (isVSCLayout) Container.appendChild(Title);
            Container.appendChild(tipBox("tip", msg("alpha_warn")));
            Container.appendChild(
                inputBox(
                    {
                        type: "string",
                        label: msg("url"),
                        value: url,
                        onChange: (value) => {
                            url = value;
                        },
                    },
                    url.toString(),
                ),
            );
            Container.appendChild(joinButton);
            Container.appendChild(
                inputBox(
                    {
                        type: "string",
                        label: msg("id"),
                        value: id,
                        onChange: (value) => {
                            id = value;
                        },
                    },
                    id.toString(),
                ),
            );
            Container.appendChild(createButton);
            Container.appendChild(NetTipText);
        } else {
            if (isVSCLayout) Container.appendChild(Title);

            const roomTitleDiv = document.createElement("div");
            roomTitleDiv.className = idHead + "roomTitleDiv";
            const roomTitleCopyButton = document.createElement("img");
            roomTitleCopyButton.src = copyImg;
            roomTitleCopyButton.className = idHead + "roomTitleCopyButton";
            roomTitleCopyButton.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(serverConfig.roomId);
                    updateTipText(msg("copied_room_id"));
                } catch {
                    updateTipText(msg("copy_room_id_failed"));
                }
            };
            const roomTitle = document.createElement("span");
            roomTitle.textContent = serverConfig.roomId;
            roomTitle.className = idHead + "roomTitle";

            roomTitleDiv.appendChild(roomTitleCopyButton);
            roomTitleDiv.appendChild(roomTitle);
            Container.appendChild(roomTitleDiv);
        }

        return Container;
    };

    const enterRoom = (roomId) => {
        // 创建提示在菜单栏
        const oldRoomIdText = document.querySelector(
            `.${idHead}roomTip-container`,
        );
        if (oldRoomIdText) oldRoomIdText.remove();

        const container = document.createElement("div");
        container.className = idHead + "roomTip-container";

        const roomIdText = document.createElement("span");
        roomIdText.textContent = roomId;

        container.appendChild(roomIdText);

        document
            .querySelector("[class*=menu-bar_menuGroup]")
            .appendChild(container);

        // 刷新来显示管理UI
        refreshGUI();
    };

    addToBar(addon, {
        id: tabID,
        icon: icon,
        name: msg("title"),
        getContent: createElements,
        onClick: () => {},
    });
}
