
import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat', isAuthenticated, async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!process.env.OPENAI_API_KEY) {
            return res.json({ 
                response: "AI features are currently unavailable. Please contact support." 
            });
        }

        // TODO: Integrate OpenAI API
        // For now, return a placeholder response
        res.json({ 
            response: `I received your message: "${message}". AI integration coming soon!` 
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

export default router;
