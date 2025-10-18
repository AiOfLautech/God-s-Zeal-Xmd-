import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import botService from '../services/botService.js';

const router = express.Router();

router.get('/', isAuthenticated, async (req, res) => {
    try {
        const bots = await botService.getUserBots(req.user.id);
        res.json({ bots });
    } catch (error) {
        console.error('Error fetching bots:', error);
        res.status(500).json({ error: 'Failed to fetch bots' });
    }
});

router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const bot = await botService.getBotById(req.params.id);
        
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        if (bot.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ bot });
    } catch (error) {
        console.error('Error fetching bot:', error);
        res.status(500).json({ error: 'Failed to fetch bot' });
    }
});

router.get('/:id/logs', isAuthenticated, async (req, res) => {
    try {
        const bot = await botService.getBotById(req.params.id);
        
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        if (bot.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const logs = await botService.getBotLogs(req.params.id);
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

router.post('/:id/restart', isAuthenticated, async (req, res) => {
    try {
        const bot = await botService.getBotById(req.params.id);
        
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        if (bot.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await botService.restartBot(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error restarting bot:', error);
        res.status(500).json({ error: 'Failed to restart bot' });
    }
});

router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const bot = await botService.getBotById(req.params.id);
        
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        if (bot.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await botService.deleteBot(req.params.id);
        res.json({ message: 'Bot deleted successfully' });
    } catch (error) {
        console.error('Error deleting bot:', error);
        res.status(500).json({ error: 'Failed to delete bot' });
    }
});

export default router;
