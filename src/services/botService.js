import prisma from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

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
        return await prisma.bot.update({
            where: { id: botId },
            data
        });
    }

    async deleteBot(botId) {
        return await prisma.bot.delete({
            where: { id: botId }
        });
    }

    async addBotLog(botId, message, level = 'info') {
        return await prisma.botLog.create({
            data: {
                botId,
                message,
                level
            }
        });
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
