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
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // emit QR updates internally:
      sock.latestQR = qr;
    }

    if (connection === 'open') {
      console.log('WhatsApp connected');
    }

    if (connection === 'close') {
      const status = lastDisconnect.error?.output?.statusCode;
      if (status !== DisconnectReason.loggedOut) {
        initWA(); // reconnect
      }
    }
  });

  sock.ev.on('creds.updated', saveState);
}

async function generatePairCode(number) {
  // TODO: store mapping number->code in memory/DB
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  sock.pairMapping = sock.pairMapping || {};
  sock.pairMapping[code] = number;
  return code;
}

async function getQRCode(code) {
  if (!sock.latestQR) {
    throw new Error('QR not available yet');
  }
  // return the last QR; instructions static
  return {
    qr: `data:image/png;base64,${sock.latestQR}`,
    instructions: ['Open WhatsApp → Settings → Linked Devices → Link a Device → scan']
  };
}

// Listen for successful pairing (implicit)
// Once authenticated, send creds to the original requester
sockEvPatch();

function sockEvPatch() {
  sock.ev.on('connection.update', async ({ connection }) => {
    if (connection === 'open') {
      // find the number that just paired:
      const { user } = sock;
      const number = user.id.split(':')[0];
      // find code => number map
      const entry = Object.entries(sock.pairMapping || {}).find(([, num]) => num === number);
      if (entry) {
        await sendCreds(sock);
        delete sock.pairMapping[entry[0]];
      }
    }
  });
}

module.exports = { initWA, generatePairCode, getQRCode };
