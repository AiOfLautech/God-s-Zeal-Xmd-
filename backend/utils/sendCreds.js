const fs = require('fs');
const path = require('path');

async function sendCreds(sock) {
  const authFile = path.join(__dirname, '../creds/auth_info.json');
  const buffer = fs.readFileSync(authFile);

  const jid = sock.user.id; // e.g. "2348089xxx@s.whatsapp.net"
  // 1) send the creds file
  await sock.sendMessage(jid, {
    document: buffer,
    fileName: 'creds.json',
    mimetype: 'application/json'
  });

  // 2) auto-follow the channel
  await sock.sendMessage(jid, {
    text: `Thanks for linking! 🙏\nFollow our channel: ${process.env.WA_CHANNEL}`
  });
}

module.exports = { sendCreds };
