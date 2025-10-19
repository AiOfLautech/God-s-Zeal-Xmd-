import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import cron from 'node-cron';
import helmet from 'helmet';

dotenv.config();

import passport from './src/config/passport.js';
import pairRouter from './pair.js';
import pairingRouter from './src/routes/pairing.js';
import qrRouter from './qr.js';
import authRouter from './src/routes/auth.js';
import botsRouter from './src/routes/bots.js';
import adminRouter from './src/routes/admin.js';
import githubRouter from './src/routes/github.js';
import authService from './src/services/authService.js';
import prisma from './src/config/database.js';
import websocketService from './src/services/websocketService.js';
import { createServer } from 'http';
import { loginLimiter, apiLimiter, pairingLimiter } from './src/middleware/rateLimiter.js';

const app = express();
const server = createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

const SQLiteSessionStore = SQLiteStore(session);

// Trust proxy - Required for rate limiting when behind a reverse proxy (Render, Replit, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for dynamic content
    crossOriginEmbedderPolicy: false
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    store: new SQLiteSessionStore({
        db: 'sessions.db',
        dir: './prisma'
    }),
    secret: process.env.SESSION_SECRET || 'knight-bot-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/dashboard.html');
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});

import { isAuthenticated } from './src/middleware/auth.js';

// Apply rate limiting and authentication
app.use('/auth', loginLimiter, authRouter);
app.use('/api/bots', apiLimiter, isAuthenticated, botsRouter);
app.use('/api/admin', apiLimiter, adminRouter);
app.use('/api/github', apiLimiter, isAuthenticated, githubRouter);
app.use('/api/pairing', pairingLimiter, isAuthenticated, pairingRouter);
app.use('/pair', pairingLimiter, isAuthenticated, pairRouter);
app.use('/qr', pairingLimiter, isAuthenticated, qrRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

cron.schedule('*/5 * * * *', async () => {
    console.log('Cron: Keeping server alive');
});

app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login.html' }),
    (req, res) => {
        res.redirect('/dashboard.html');
    }
);

async function createAdminUser() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@knightbot.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        const existingAdmin = await authService.findUserByEmail(adminEmail);
        
        if (!existingAdmin) {
            const admin = await authService.createUser('admin', adminEmail, adminPassword);
            await prisma.user.update({
                where: { id: admin.id },
                data: { role: 'admin' }
            });
            console.log(`✅ Admin user created: ${adminEmail}`);
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 Knight Bot Server`);
    console.log(`📺 YouTube: @mr_unique_hacker`);
    console.log(`💻 GitHub: @mruniquehacker`);
    console.log(`🌐 Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔌 WebSocket server initialized\n`);
    
    websocketService.initialize(server);
    await createAdminUser();
});

export default app;
