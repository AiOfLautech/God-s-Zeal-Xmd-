const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { createSession, generateQRCode } = require('./session-manager');
const { sendCredsToWhatsApp, followWhatsAppChannel } = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// WhatsApp Channel JID from the knowledge base
const WHATSAPP_CHANNEL_JID = '0029Va90zAnIHphOuO8Msp3A@c.us';

// In-memory storage for active sessions
const activeSessions = new Map();
const qrSessions = new Map();

// API endpoint to generate session code
app.post('/api/generate-session', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || !/^\+[0-9]{8,15}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Generate session code
    const { code, sessionId } = await createSession(phoneNumber);
    
    res.json({ 
      code,
      sessionId
    });
    
  } catch (error) {
    console.error('Error generating session:', error);
    res.status(500).json({ error: 'Failed to generate session' });
  }
});

// API endpoint to check session status
app.get('/api/session-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    status: session.status,
    code: session.code,
    phoneNumber: session.phoneNumber
  });
});

// API endpoint to generate QR code
app.get('/api/generate-qr', async (req, res) => {
  try {
    const { qr, qrId } = await generateQRCode();
    
    res.json({
      qr,
      qrId
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// API endpoint to check QR status
app.get('/api/qr-status/:qrId', (req, res) => {
  const { qrId } = req.params;
  const session = qrSessions.get(qrId);
  
  if (!session) {
    return res.status(404).json({ error: 'QR session not found' });
  }
  
  res.json({
    status: session.status,
    phoneNumber: session.phoneNumber
  });
});

// API endpoint to follow WhatsApp channel
app.post('/api/follow-channel', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Follow the WhatsApp channel
    await followWhatsAppChannel(phoneNumber);
    
    res.json({ 
      status: 'success',
      message: 'Successfully followed WhatsApp channel'
    });
    
  } catch (error) {
    console.error('Error following WhatsApp channel:', error);
    res.status(500).json({ error: 'Failed to follow WhatsApp channel' });
  }
});

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  const EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt > EXPIRATION_TIME) {
      activeSessions.delete(sessionId);
    }
  }
  
  for (const [qrId, session] of qrSessions.entries()) {
    if (now - session.createdAt > EXPIRATION_TIME) {
      qrSessions.delete(qrId);
    }
  }
}, 60000); // Check every minute

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
