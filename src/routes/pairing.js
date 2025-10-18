import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';
import { isAuthenticated } from '../middleware/auth.js';
import botService from '../services/botService.js';
import githubService from '../services/githubService.js';

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', isAuthenticated, async (req, res) => {
    let num = req.query.number;
    const userId = req.user.id;
    let dirs = './' + (num || `session_${userId}`);

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, 84987654321 for Vietnam, etc.) without + or spaces.' });
        }
        return;
    }
    num = phone.getNumber('e164').replace('+', '');

    let bot = await botService.createBot(userId, num);

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
            let KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            KnightBot.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, isOnline } = update;

                if (connection === 'open') {
                    console.log("✅ Connected successfully!");
                    await botService.addBotLog(bot.id, 'WhatsApp connected successfully', 'success');
                    
                    try {
                        const sessionKnight = fs.readFileSync(dirs + '/creds.json');
                        const credsContent = sessionKnight.toString();
                        
                        await botService.updateBot(bot.id, { status: 'connected' });

                        const githubResult = await githubService.automateGitHubSetup(userId, credsContent);

                        if (githubResult.success) {
                            await botService.updateBot(bot.id, {
                                status: 'running',
                                githubRepoUrl: githubResult.repoUrl,
                                githubRepoName: githubResult.repoName,
                                workflowStatus: 'created'
                            });

                            await botService.addBotLog(bot.id, `GitHub setup completed: ${githubResult.repoUrl}`, 'success');

                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            const tokenInfo = githubResult.usedAdminToken 
                                ? '\n🔑 *Note:* Repository created using admin credentials. Login with GitHub for personal control.'
                                : '\n🔑 *Note:* Repository created using your GitHub account.';

                            await KnightBot.sendMessage(userJid, {
                                text: `✅ *Bot Setup Complete!*\n\n🎉 Your bot is now live and running!\n\n📦 Repository: ${githubResult.repoUrl}\n\n⚙️ GitHub Actions workflow has been created and your bot will automatically deploy.${tokenInfo}\n\n⚠️ *Important Security Note:*\nYour session credentials have been securely stored in your GitHub repository. Never share them with anyone!\n\n┌┤✑  Thanks for using Knight Bot\n│└────────────┈ ⳹\n│©2025 𝐆𝐎𝐃'𝐒 𝐙𝐄𝐀𝐋 TECH\n└─────────────────┈ ⳹`
                            });

                            await botService.addBotLog(bot.id, 'Success notification sent to user', 'info');
                        } else {
                            await botService.updateBot(bot.id, { status: 'error' });
                            await botService.addBotLog(bot.id, `GitHub setup failed: ${githubResult.error}`, 'error');
                        }

                        console.log("🧹 Cleaning up session...");
                        await delay(1000);
                        removeFile(dirs);
                        console.log("✅ Session cleaned up successfully");
                    } catch (error) {
                        console.error("❌ Error processing session:", error);
                        await botService.updateBot(bot.id, { status: 'error' });
                        await botService.addBotLog(bot.id, `Error: ${error.message}`, 'error');
                        removeFile(dirs);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === 401) {
                        console.log("❌ Logged out from WhatsApp. Need to generate new pair code.");
                        await botService.addBotLog(bot.id, 'WhatsApp session expired', 'error');
                    } else {
                        console.log("🔁 Connection closed — restarting...");
                        initiateSession();
                    }
                }
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(3000);
                num = num.replace(/[^\d+]/g, '');
                if (num.startsWith('+')) num = num.substring(1);

                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        console.log({ num, code });
                        await botService.addBotLog(bot.id, `Pairing code generated: ${code}`, 'info');
                        await res.send({ code, botId: bot.id });
                    }
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    await botService.addBotLog(bot.id, `Error generating pair code: ${error.message}`, 'error');
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Failed to get pairing code. Please check your phone number and try again.' });
                    }
                }
            }

            KnightBot.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error('Error initializing session:', err);
            await botService.addBotLog(bot.id, `Initialization error: ${err.message}`, 'error');
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    if (e.includes("Stream Errored")) return;
    if (e.includes("Stream Errored (restart required)")) return;
    if (e.includes("statusCode: 515")) return;
    if (e.includes("statusCode: 503")) return;
    console.log('Caught exception: ', err);
});

export default router;
