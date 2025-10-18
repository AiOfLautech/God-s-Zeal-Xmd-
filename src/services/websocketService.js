
import { WebSocketServer } from 'ws';

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map();
    }

    initialize(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws, req) => {
            const userId = this.getUserIdFromRequest(req);
            
            if (userId) {
                this.clients.set(userId, ws);
                console.log(`WebSocket client connected: ${userId}`);

                ws.on('close', () => {
                    this.clients.delete(userId);
                    console.log(`WebSocket client disconnected: ${userId}`);
                });

                ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                });
            }
        });
    }

    getUserIdFromRequest(req) {
        // Extract user ID from session cookie
        const cookies = req.headers.cookie?.split(';').map(c => c.trim()) || [];
        const sessionCookie = cookies.find(c => c.startsWith('connect.sid='));
        return sessionCookie ? sessionCookie.split('=')[1] : null;
    }

    broadcastBotActivity(userId, botId, activity) {
        const client = this.clients.get(userId);
        if (client && client.readyState === 1) {
            client.send(JSON.stringify({
                type: 'bot_activity',
                botId,
                activity,
                timestamp: new Date().toISOString()
            }));
        }
    }

    broadcastToAdmins(data) {
        this.clients.forEach((client, userId) => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: 'admin_update',
                    data,
                    timestamp: new Date().toISOString()
                }));
            }
        });
    }

    notifyBotStatusChange(userId, botId, status, message) {
        this.broadcastBotActivity(userId, botId, {
            type: 'status_change',
            status,
            message
        });
    }

    notifyBotLog(userId, botId, log) {
        this.broadcastBotActivity(userId, botId, {
            type: 'log',
            log
        });
    }
}

export default new WebSocketService();
