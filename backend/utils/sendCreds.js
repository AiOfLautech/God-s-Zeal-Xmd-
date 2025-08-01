const fs = require('fs');
const path = require('path');
module.exports.sendCreds = async function(sock){
  const file = path.join(__dirname, '../creds/auth_info.json');
  const buffer = fs.readFileSync(file);
  const user = sock.user.id;
  await sock.sendMessage(user, { document: buffer, fileName: 'creds.json' });
  await sock.sendMessage(user, { text: 'Follow our channel: ' + process.env.WA_CHANNEL });
};