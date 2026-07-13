process.noDeprecation = true; // 禁用过时警告
// 这是用于进行信令服务器的文件
// 直接`node local-server.js`执行

const WebSocket = require("ws");
const http = require("http");
const url = require("url");

// 限制常量
const MAX_CLIENTS = 200;
const MAX_CLIENTS_PER_ROOM = 20;

class SignalingServer {
    constructor(port = 3000) {
        this.port = port;
        this.clients = new Map();
        this.rooms = new Map();
        this.server = null;
        this.wss = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            // 解析URL
            const parsedUrl = url.parse(req.url, true);
            const pathname = parsedUrl.pathname;
            const query = parsedUrl.query;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");

            if (pathname === "/stats") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(this.getStats(), null, 2));
                return;
            }

            if (pathname === "/roomIsFree") {
                const roomId = query.roomId;
                const isFree = this.checkRoomIsFree(roomId);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        roomId: roomId,
                        isFree: isFree,
                    }),
                );
                return;
            }

            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Signaling Server is running\n");
        });

        this.wss = new WebSocket.Server({ server: this.server });

        this.wss.on("connection", (ws, req) => {
            const clientId = this.generateClientId();
            const queryParams = url.parse(req.url, true).query;
            const roomId = queryParams.room;
            const userName = queryParams.name;

            // 输入校验：roomId 和 userName 不能为空，长度限制
            if (!roomId || typeof roomId !== 'string' || roomId.length > 64) {
                ws.close(4000, "房间ID无效");
                return;
            }
            if (!userName || typeof userName !== 'string' || userName.length > 32) {
                ws.close(4000, "用户名无效");
                return;
            }
            // 客户端总数限制
            if (this.clients.size >= MAX_CLIENTS) {
                ws.close(4029, "服务器已满");
                return;
            }
            // 单房间客户端数限制
            let roomCount = 0;
            this.clients.forEach((c) => { if (c.roomId === roomId) roomCount++; });
            if (roomCount >= MAX_CLIENTS_PER_ROOM) {
                ws.close(4029, "房间已满");
                return;
            }
            this.clients.set(clientId, {
                ws,
                roomId,
                userName,
                connectedAt: Date.now(),
            });

            console.log(`客户端 ${userName}(${clientId}) 连接到了 ${roomId} 房间`);

            let hostCid = null;
            let earliestConnect = Infinity;
            this.clients.forEach((client, cid) => {
                if (client.roomId === roomId && client.connectedAt < earliestConnect) {
                    earliestConnect = client.connectedAt;
                    hostCid = cid;
                }
            });

            if (hostCid === null) hostCid = clientId;

            const existingPeers = [];
            this.clients.forEach((client, cid) => {
                if (client.roomId === roomId) {
                    existingPeers.push({
                        cid,
                        userName: client.userName,
                        owner: cid === hostCid,
                    });
                }
            });

            this.sendToClient(ws, {
                type: "connection",
                clientId,
                roomId,
                existingPeers,
            });

            // 通知房间内其他客户端
            this.broadcastToRoom(
                roomId,
                {
                    type: "peer-joined",
                    clientId,
                    existingPeers,
                    timestamp: Date.now(),
                },
                clientId,
            );

            ws.on("message", (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(clientId, data);
                } catch (error) {
                    console.error(`客户端 ${userName}(${clientId}) 发送了无效的消息格式:`, error);
                }
            });

            ws.on("close", () => {
                const client = this.clients.get(clientId);
                if (!client) return;
                try {
                    console.log(
                        `客户端 ${userName}(${clientId}) 断开了 ${client.roomId} 房间的连接`,
                    );

                    // 重新计算当前在线成员（含房主标识）
                    const currentPeers = [];
                    let hostCid = null;
                    let earliestConnect = Infinity;
                    this.clients.forEach((c, cid) => {
                        if (c.roomId === client.roomId && cid !== clientId) {
                            if (c.connectedAt < earliestConnect) {
                                earliestConnect = c.connectedAt;
                                hostCid = cid;
                            }
                        }
                    });
                    this.clients.forEach((c, cid) => {
                        if (c.roomId === client.roomId && cid !== clientId) {
                            currentPeers.push({
                                cid,
                                userName: c.userName,
                                owner: cid === hostCid,
                            });
                        }
                    });

                    this.broadcastToRoom(
                        client.roomId,
                        {
                            type: "peer-left",
                            clientId,
                            existingPeers: currentPeers,
                            timestamp: Date.now(),
                        },
                        clientId,
                    );
                } finally {
                    // 确保客户端被删除，即使广播异常也不会导致幽灵客户端
                    this.clients.delete(clientId);
                }
            });

            ws.on("error", (error) => {
                console.error(`客户端 ${userName}(${clientId}) 发生错误:`, error);
            });
        });

        this.server.listen(this.port, () => {
            console.log(`服务器运行在 ws://localhost:${this.port}`);
            console.log(`服务器统计信息: http://localhost:${this.port}/stats`);
        });
    }

    handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        switch (data.type) {
            case "offer":
            case "answer":
            case "ice-candidate":
                // 转发信令消息给目标客户端
                if (data.targetId && this.clients.has(data.targetId)) {
                    this.sendToClient(this.clients.get(data.targetId).ws, {
                        ...data,
                        senderId: clientId,
                    });
                }
                break;

            case "exit":
                // 广播退出消息到房间
                this.broadcastToRoom(client.roomId, {
                    type: "exit",
                    clientId,
                    userName: client.userName,
                    timestamp: Date.now(),
                });
                break;

            case "kick":
                if (data.targetId && data.targetId !== clientId) {
                    // 鉴权：用 connectedAt 最早判定 host，而非 Map 迭代顺序
                    let hostCid = null;
                    let earliestConnect = Infinity;
                    this.clients.forEach((c, cid) => {
                        if (c.roomId === client.roomId && c.connectedAt < earliestConnect) {
                            earliestConnect = c.connectedAt;
                            hostCid = cid;
                        }
                    });
                    if (hostCid === clientId) {
                        const target = this.clients.get(data.targetId);
                        if (target) {
                            this.sendToClient(target.ws, { type: "kicked", reason: data.reason || "" });
                            target.ws.close(4001, "被房主踢出");
                            console.log(`房主 ${client.userName} 踢出了 ${target.userName}(${data.targetId})`);
                        }
                    }
                }
                break;

            default:
                console.warn(`客户端 ${clientId} 发送了未知的消息类型: ${data.type}`);
        }
    }

    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    broadcastToRoom(roomId, data, excludeClientId = null) {
        this.clients.forEach((client, clientId) => {
            if (client.roomId === roomId && clientId !== excludeClientId) {
                this.sendToClient(client.ws, data);
            }
        });
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    getStats() {
        const roomStats = {};
        this.clients.forEach((client) => {
            if (!roomStats[client.roomId]) {
                roomStats[client.roomId] = 0;
            }
            roomStats[client.roomId]++;
        });

        return {
            totalClients: this.clients.size,
            rooms: roomStats,
            uptime: process.uptime(),
        };
    }

    checkRoomIsFree(roomId) {
        let result = true;
        this.clients.forEach((room, clientID) => {
            if (roomId === room.roomId) result = false;
        });
        console.log(`${roomId} 房间正 ${result ? "闲置" : "存在"}`);
        return result;
    }

    stop() {
        // 先关闭所有已连接的客户端
        this.clients.forEach((client) => {
            try { client.ws.close(1001, "服务器关闭"); } catch (e) { }
        });
        this.clients.clear();
        if (this.wss) {
            this.wss.close();
        }
        if (this.server) {
            this.server.close();
        }
        console.log("Signaling server stopped");
    }
}

const server = new SignalingServer(1832);
server.start();
