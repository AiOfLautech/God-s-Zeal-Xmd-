const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const { BufferJSON } = require('@whiskeysockets/baileys/lib/Types/ProtoBuf');
const { proto } = require('@whiskeysockets/baileys');

// WhatsApp Channel JID from the knowledge base
const WHATSAPP_CHANNEL_JID = '0029Va90zAnIHphOuO8Msp3A@c.us';

// Create a new WhatsApp connection
const createWhatsAppConnection = async (sessionId = uuidv4()) => {
  // Use multi-file auth state
  const { state, saveCreds } = await useMultiFileAuthState(`./auth_info/${sessionId}`);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    version: [2, 3000, 1015901307],
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    defaultQueryTimeoutMs: undefined
  });
  
  // Handle events
  sock.ev.process(async (events) => {
    // Save credentials when they update
    if (events['creds.update']) {
      await saveCreds();
    }
    
    // Handle connection updates
    if (events['connection.update']) {
      const { connection, lastDisconnect, qr } = events['connection.update'];
      
      if (qr) {
        console.log('QR RECEIVED', qr);
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting', shouldReconnect);
        
        if (shouldReconnect) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          createWhatsAppConnection(sessionId);
        }
      } else if (connection === 'open') {
        console.log('Connected');
      }
    }
  });
  
  return sock;
};

// Generate QR code for WhatsApp connection
const generateQR = async (sessionId = uuidv4()) => {
  return new Promise((resolve, reject) => {
    createWhatsAppConnection(sessionId)
      .then(sock => {
        // Handle QR code
        sock.ev.on('connection.update', (update) => {
          const { qr } = update;
          
          if (qr) {
            // Convert QR to data URL
            qrcode.toDataURL(qr, (err, url) => {
              if (err) {
                reject(err);
                return;
              }
              
              resolve({
                qr: url,
                sessionId: sessionId
              });
            });
          }
        });
      })
      .catch(err => reject(err));
  });
};

// Send creds.json to WhatsApp DM
const sendCredsToWhatsApp = async (phoneNumber, creds) => {
  try {
    console.log(`Sending creds.json to WhatsApp number: ${phoneNumber}`);
    
    // Convert phone number to WhatsApp ID format
    const whatsappId = phoneNumber.replace('+', '') + '@s.whatsapp.net';
    
    // Create WhatsApp connection
    const sessionId = uuidv4();
    const sock = await createWhatsAppConnection(sessionId);
    
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
    const sessionId = uuidv4();
    const sock = await createWhatsAppConnection(sessionId);
    
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
    const sessionId = uuidv4();
    const sock = await createWhatsAppConnection(sessionId);
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if the number is registered on WhatsApp
    const response = await sock.onWhatsApp(whatsappId);
    const isRegistered = response && response[0] && response[0].exists;
    
    // Close the connection
    sock.end();
    
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
