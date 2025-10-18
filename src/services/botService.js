import prisma from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import websocketService from './websocketService.js';

class BotService {
    async createBot(userId, phoneNumber) {
        return await prisma.bot.create({
            data: {
                userId,
                phoneNumber,
                status: 'pending'
            }
        });
    }

    async getUserBots(userId) {
        return await prisma.bot.findMany({
            where: { userId },
            include: {
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getAllBots() {
        return await prisma.bot.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getBotById(botId) {
        return await prisma.bot.findUnique({
            where: { id: botId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });
    }

    async updateBot(botId, data) {
        const bot = await prisma.bot.update({
            where: { id: botId },
            data
        });

        // Notify status change via WebSocket
        if (data.status) {
            websocketService.notifyBotStatusChange(
                bot.userId,
                botId,
                data.status,
                `Bot status changed to ${data.status}`
            );
        }

        return bot;
    }

    async deleteBot(botId) {
        return await prisma.bot.delete({
            where: { id: botId }
        });
    }

    async addBotLog(botId, message, level = 'info') {
        const log = await prisma.botLog.create({
            data: {
                botId,
                message,
                level
            }
        });

        // Notify via WebSocket
        const bot = await prisma.bot.findUnique({ where: { id: botId } });
        if (bot) {
            websocketService.notifyBotLog(bot.userId, botId, log);
        }

        return log;
    }

    async getBotLogs(botId, limit = 100) {
        return await prisma.botLog.findMany({
            where: { botId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    async restartBot(botId) {
        await this.addBotLog(botId, 'Bot restart requested', 'info');
        await this.updateBot(botId, { status: 'restarting' });
        
        setTimeout(async () => {
            await this.updateBot(botId, { status: 'running' });
            await this.addBotLog(botId, 'Bot restarted successfully', 'success');
        }, 2000);

        return { success: true, message: 'Bot restart initiated' };
    }
}

export default new BotService();
