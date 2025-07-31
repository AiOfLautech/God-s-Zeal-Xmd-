const { WAConnection, MessageType, MessageOptions, Mimetype } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');
const { encryptData } = require('./utils/crypto');

// WhatsApp Channel JID from the knowledge base
const WHATSAPP_CHANNEL_JID = '0029Va90zAnIHphOuO8Msp3A@c.us';

// Create a new WhatsApp connection
const createWhatsAppConnection = () => {
  const conn = new WAConnection();
  
  conn.version = [2, 3000, 1015901307];
  conn.browserDescription = ['Chrome', 'Windows', '10.0.0'];
  
  conn.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
  });
  
  conn.on('connecting', () => {
    console.log('Connecting...');
  });
  
  conn.on('open', () => {
    console.log('Connected');
  });
  
  conn.on('close', (reason) => {
    console.log('Disconnected:', reason);
  });
  
  return conn;
};

// Generate QR code for WhatsApp connection
const generateQR = async () => {
  const conn = createWhatsAppConnection();
  const qrId = uuidv4();
  
  return new Promise((resolve, reject) => {
    conn.on('qr', (qr) => {
      resolve({
        qr,
        qrId
      });
    });
    
    conn.connect()
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
    const conn = createWhatsAppConnection();
    
    // Connect and wait for QR scan
    await conn.connect();
    
    // Wait for connection to be established
    await new Promise(resolve => {
      conn.on('open', resolve);
    });
    
    // Prepare the creds.json content
    const credsContent = JSON.stringify(creds, null, 2);
    
    // Send the creds.json as a text message
    await conn.sendMessage(
      whatsappId,
      `Here is your Godszeal XMD session file (creds.json):\n\n${credsContent}`,
      MessageType.text
    );
    
    // Close the connection
    conn.close();
    
    console.log('Creds sent successfully to WhatsApp');
    
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
    const conn = createWhatsAppConnection();
    
    // Connect
    await conn.connect();
    
    // Wait for connection to be established
    await new Promise(resolve => {
      conn.on('open', resolve);
    });
    
    // Follow the WhatsApp channel
    // In WhatsApp's protocol, following a channel is done by sending a specific message
    await conn.sendMessage(
      WHATSAPP_CHANNEL_JID,
      'follow',
      MessageType.text
    );
    
    // Close the connection
    conn.close();
    
    console.log(`Successfully followed channel: ${WHATSAPP_CHANNEL_JID}`);
    
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
    const conn = createWhatsAppConnection();
    
    // Connect
    await conn.connect();
    
    // Wait for connection to be established
    await new Promise(resolve => {
      conn.on('open', resolve);
    });
    
    // Check if the number is registered on WhatsApp
    const isRegistered = await conn.isOnWhatsApp(whatsappId);
    
    // Close the connection
    conn.close();
    
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
