const { makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// WhatsApp Channel JID from the knowledge base
const WHATSAPP_CHANNEL_JID = '0029Va90zAnIHphOuO8Msp3A@c.us';

// Create a new WhatsApp connection
const createWhatsAppConnection = async () => {
  // Create a unique auth folder for this connection
  const authFolder = `./auth_info_${Date.now()}`;
  await fs.promises.mkdir(authFolder, { recursive: true });
  
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Desktop'),
    syncFullHistory: true,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: undefined,
    keepAliveIntervalMs: 15000,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterMap: {},
    logger: {
      level: 'error'
    }
  });
  
  // Save credentials periodically
  sock.ev.process(async (events) => {
    if (events['creds.update']) {
      await saveCreds();
    }
    
    if (events['connection.update']) {
      const { connection, lastDisconnect, qr } = events['connection.update'];
      
      if (qr) {
        console.log('QR RECEIVED', qr);
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting', shouldReconnect);
        
        if (shouldReconnect) {
          await delay(5000);
          await createWhatsAppConnection();
        }
      } else if (connection === 'open') {
        console.log('Connected');
      }
    }
  });
  
  return sock;
};

// Generate QR code for WhatsApp connection
const generateQR = async () => {
  return new Promise((resolve, reject) => {
    const qrId = uuidv4();
    let qrCode = null;
    
    createWhatsAppConnection()
      .then(sock => {
        sock.ev.on('connection.update', async (update) => {
          const { qr } = update;
          
          if (qr) {
            try {
              const qrUrl = await qrcode.toDataURL(qr);
              qrCode = qrUrl;
              
              resolve({
                qr: qrUrl,
                qrId: qrId
              });
              
              // Close the connection after QR is generated
              setTimeout(() => {
                sock.end();
                // Clean up auth folder
                const authFolder = `./auth_info_${Date.now()}`;
                if (fs.existsSync(authFolder)) {
                  fs.rmSync(authFolder, { recursive: true, force: true });
                }
              }, 10000);
            } catch (err) {
              reject(err);
            }
          }
        });
      })
      .catch(err => {
        reject(err);
        // Clean up any potential auth folder
        const authFolder = `./auth_info_${Date.now()}`;
        if (fs.existsSync(authFolder)) {
          fs.rmSync(authFolder, { recursive: true, force: true });
        }
      });
  });
};

// Send creds.json to WhatsApp DM
const sendCredsToWhatsApp = async (phoneNumber, creds) => {
  try {
    console.log(`Sending creds.json to WhatsApp number: ${phoneNumber}`);
    
    // Convert phone number to WhatsApp ID format
    const whatsappId = phoneNumber.replace('+', '') + '@s.whatsapp.net';
    
    // Create WhatsApp connection
    const sock = await createWhatsAppConnection();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Prepare the creds.json content
    const credsContent = JSON.stringify(creds, null, 2);
    
    // Send the creds.json as a text message
    await sock.sendMessage(
      whatsappId,
      { text: `Here is your Godszeal XMD session file (creds.json):\n\n${credsContent}` }
    );
    
    console.log('Creds sent successfully to WhatsApp');
    
    // Close the connection
    sock.end();
    
    // Clean up auth folder
    const authFolder = `./auth_info_${Date.now()}`;
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
    
    return true;
  } catch (error) {
    console.error('Error sending creds to WhatsApp:', error);
    throw new Error('Failed to send creds to WhatsApp');
  }
};

// Auto-follow WhatsApp channel
const followWhatsAppChannel = async (phoneNumber) => {
  try {
    console.log(`Auto-following WhatsApp channel for: ${phoneNumber}`);
    
    // Convert phone number to WhatsApp ID format
    const whatsappId = phoneNumber.replace('+', '') + '@s.whatsapp.net';
    
    // Create WhatsApp connection
    const sock = await createWhatsAppConnection();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Follow the WhatsApp channel
    await sock.sendMessage(
      WHATSAPP_CHANNEL_JID,
      { text: 'follow' }
    );
    
    console.log(`Successfully followed channel: ${WHATSAPP_CHANNEL_JID}`);
    
    // Close the connection
    sock.end();
    
    // Clean up auth folder
    const authFolder = `./auth_info_${Date.now()}`;
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
    
    return true;
  } catch (error) {
    console.error('Error following WhatsApp channel:', error);
    throw new Error('Failed to follow WhatsApp channel');
  }
};

// Verify WhatsApp number
const verifyWhatsAppNumber = async (phoneNumber) => {
  try {
    console.log(`Verifying WhatsApp number: ${phoneNumber}`);
    
    // Convert phone number to WhatsApp ID format
    const whatsappId = phoneNumber.replace('+', '') + '@s.whatsapp.net';
    
    // Create WhatsApp connection
    const sock = await createWhatsAppConnection();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if the number is registered on WhatsApp
    const isRegistered = await sock.onWhatsApp(whatsappId);
    
    // Close the connection
    sock.end();
    
    // Clean up auth folder
    const authFolder = `./auth_info_${Date.now()}`;
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
    
    return isRegistered;
  } catch (error) {
    console.error('Error verifying WhatsApp number:', error);
    throw new Error('Failed to verify WhatsApp number');
  }
};

module.exports = {
  createWhatsAppConnection,
  generateQR,
  sendCredsToWhatsApp,
  followWhatsAppChannel,
  verifyWhatsAppNumber
};
