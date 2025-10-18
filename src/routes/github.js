import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import authService from '../services/authService.js';

const router = express.Router();

router.post('/save-token', isAuthenticated, async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        await authService.updateGithubToken(req.user.id, token);
        
        res.json({ message: 'GitHub token saved successfully' });
    } catch (error) {
        console.error('Error saving GitHub token:', error);
        res.status(500).json({ error: 'Failed to save GitHub token' });
    }
});

export default router;
