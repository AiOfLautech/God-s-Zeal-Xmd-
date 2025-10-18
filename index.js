import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import cron from 'node-cron';

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

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

const SQLiteSessionStore = SQLiteStore(session);

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
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.use('/auth', authRouter);
app.use('/api/bots', botsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/github', githubRouter);
app.use('/api/pairing', pairingRouter);
app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

cron.schedule('*/5 * * * *', async () => {
    console.log('Cron: Keeping server alive');
});

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

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 Knight Bot Server`);
    console.log(`📺 YouTube: @mr_unique_hacker`);
    console.log(`💻 GitHub: @mruniquehacker`);
    console.log(`🌐 Server running on http://0.0.0.0:${PORT}\n`);
    
    await createAdminUser();
});

export default app;
