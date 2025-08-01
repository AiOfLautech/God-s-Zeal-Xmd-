const { default: makeWASocket, useSingleFileAuthState } = require('@adiwajshing/baileys');
const fs = require('fs');
const path = require('path');
const { sendCreds } = require('./sendCreds');

let sock;
const sessionsDir = path.join(__dirname, '../creds');
if(!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);

function initWA(){
  const { state, saveState } = useSingleFileAuthState(path.join(sessionsDir, 'auth_info.json'));
  sock = makeWASocket({ auth: state });
  sock.ev.on('connection.update', update => {
    if(update.connection === 'open') console.log('WA Connected');
  });
  sock.ev.on('creds.updated', saveState);
  // listen for pairing complete, then send creds
  sock.ev.on('connection.update', async u=>{
    if(u.qr == null && u.connection === 'open'){
      await sendCreds(sock);
    }
  });
}

async function generatePairCode(number){
  const code = Math.random().toString().slice(2,7);
  return code;
}

async function getQRCode(code){
  const qr = await sock.refreshQRCode();
  return { qr, instructions: ['Scan with WhatsApp'] };
}

module.exports = { initWA, generatePairCode, getQRCode };