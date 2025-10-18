import express from 'express';
import passport from '../config/passport.js';
import authService from '../services/authService.js';

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        const existingUser = await authService.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = await authService.createUser(username, email, password);
        const token = authService.generateJWT(user);

        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Error logging in after registration' });
            }
            res.json({ message: 'Registration successful', user, token });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.status(500).json({ error: 'Login error' });
        }
        if (!user) {
            return res.status(401).json({ error: info.message || 'Invalid credentials' });
        }
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Login error' });
            }
            const token = authService.generateJWT(user);
            res.json({ message: 'Login successful', user, token });
        });
    })(req, res, next);
});

router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout error' });
        }
        res.json({ message: 'Logout successful' });
    });
});

router.get('/github', passport.authenticate('github', { scope: ['user:email', 'repo', 'user:follow'] }));

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/login.html' }),
    (req, res) => {
        res.redirect('/dashboard.html');
    }
);

router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

export default router;
