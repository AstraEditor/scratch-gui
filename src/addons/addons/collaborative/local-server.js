// 这是用于进行信令服务器的文件
// 直接`node local-server.js`执行

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

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
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (pathname === '/stats') {
                res.writeHead(200, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify(this.getStats(), null, 2));
                return;
            }

            if (pathname === '/roomIsFree') {
                const roomId = query.roomId;
                const isFree = this.checkRoomIsFree(roomId);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    roomId: roomId,
                    isFree: isFree
                }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Signaling Server is running\n');
        });

        this.wss = new WebSocket.Server({ server: this.server });

        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            const queryParams = url.parse(req.url, true).query;
            const roomId = queryParams.room;

            if (!roomId) {
                ws.close(4000, 'Room ID is required');
                return;
            }
            this.clients.set(clientId, {
                ws,
                roomId,
                connectedAt: Date.now()
            });

            console.log(`Client ${clientId} connected to room ${roomId}`);

            this.sendToClient(ws, {
                type: 'connection',
                clientId,
                roomId
            });

            // 通知房间内其他客户端
            this.broadcastToRoom(roomId, {
                type: 'peer-joined',
                clientId,
                timestamp: Date.now()
            }, clientId);

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(clientId, data);
                } catch (error) {
                    console.error('Invalid message format:', error);
                }
            });

            ws.on('close', () => {
                const client = this.clients.get(clientId);
                if (client) {
                    console.log(`Client ${clientId} disconnected from room ${client.roomId}`);

                    this.broadcastToRoom(client.roomId, {
                        type: 'peer-left',
                        clientId,
                        timestamp: Date.now()
                    }, clientId);

                    this.clients.delete(clientId);
                }
            });

            ws.on('error', (error) => {
                console.error(`Client ${clientId} error:`, error);
            });
        });

        this.server.listen(this.port, () => {
            console.log(`Server running on ws://localhost:${this.port}`);
            console.log(`Server stats: http://localhost:${this.port}/stats`);
        });
    }

    handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        switch (data.type) {
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                // 转发信令消息给目标客户端
                if (data.targetId && this.clients.has(data.targetId)) {
                    this.sendToClient(this.clients.get(data.targetId).ws, {
                        ...data,
                        senderId: clientId
                    });
                }
                break;

            case 'chat-message':
                // 广播聊天消息到房间
                this.broadcastToRoom(client.roomId, {
                    type: 'chat-message',
                    senderId: clientId,
                    message: data.message,
                    timestamp: Date.now()
                });
                break;

            default:
                console.warn(`Unknown message type: ${data.type}`);
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
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
            uptime: process.uptime()
        };
    }

    checkRoomIsFree(roomId) {
        return !this.clients.has(roomId)
    }

    stop() {
        if (this.wss) {
            this.wss.close();
        }
        if (this.server) {
            this.server.close();
        }
        console.log('Signaling server stopped');
    }
}

const server = new SignalingServer(1832);
server.start();

