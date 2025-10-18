import express from 'express';
import { isAdmin } from '../middleware/auth.js';
import botService from '../services/botService.js';
import prisma from '../config/database.js';

const router = express.Router();

router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                _count: {
                    select: { bots: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/bots', isAdmin, async (req, res) => {
    try {
        const bots = await botService.getAllBots();
        res.json({ bots });
    } catch (error) {
        console.error('Error fetching bots:', error);
        res.status(500).json({ error: 'Failed to fetch bots' });
    }
});

router.delete('/users/:id', isAdmin, async (req, res) => {
    try {
        await prisma.user.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

router.post('/bots/restart-all', isAdmin, async (req, res) => {
    try {
        const bots = await prisma.bot.findMany({
            where: { status: 'running' }
        });

        for (const bot of bots) {
            await botService.restartBot(bot.id);
        }

        res.json({ message: `Restarted ${bots.length} bots`, count: bots.length });
    } catch (error) {
        console.error('Error restarting all bots:', error);
        res.status(500).json({ error: 'Failed to restart all bots' });
    }
});

router.get('/stats', isAdmin, async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const totalBots = await prisma.bot.count();
        const activeBots = await prisma.bot.count({
            where: { status: 'running' }
        });

        res.json({
            stats: {
                totalUsers,
                totalBots,
                activeBots
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
