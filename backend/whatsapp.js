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

  sock = makeWASocket({ auth: state, printQRInTerminal: false });

  // Persist auth state updates
  sock.ev.on('creds.updated', saveState);

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Update the latest QR for retrieval by /api/qr
      sock.latestQR = qr;
    }
    if (connection === 'open') {
      console.log('WhatsApp connection open');
      // After QR scan and open, send credentials
      await postAuthActions();
    }
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed, status', status);
      if (status !== DisconnectReason.loggedOut) {
        // Attempt reconnect
        initWA();
      }
    }
  });
}

/**
 * Generate a 6-digit pairing code and map it to the number
 */
async function generatePairCode(number) {
  if (!sock) throw new Error('Socket not initialized');
  const code = (Math.floor(100000 + Math.random() * 900000)).toString();
  sock.pairMapping = sock.pairMapping || {};
  sock.pairMapping[code] = number;
  return code;
}

/**
 * Return the latest QR as base64 data URI and instructions
 */
async function getQRCode(code) {
  if (!sock || !sock.latestQR) throw new Error('QR not available');
  return {
    qr: `data:image/png;base64,${sock.latestQR}`,
    instructions: [
      'Open WhatsApp',
      'Settings → Linked Devices → Link a Device',
      'Scan the QR code displayed'
    ]
  };
}

/**
 * After successful auth, send creds.json and channel link
 */
async function postAuthActions() {
  try {
    const jid = sock.user.id; // e.g. 2348089336992@s.whatsapp.net
    // Identify which code mapped to this user
    const entry = Object.entries(sock.pairMapping || {}).find(([, num]) => jid.startsWith(num));
    if (entry) {
      // Send credential file
      await sendCreds(sock);
      delete sock.pairMapping[entry[0]];
    }
  } catch (err) {
    console.error('postAuthActions error:', err);
  }
}

module.exports = { initWA, generatePairCode, getQRCode };
