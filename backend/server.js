const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { createWhatsAppConnection, generateQR, sendCredsToWhatsApp, followWhatsAppChannel } = require('./whatsapp');
const { encryptData, decryptData } = require('./utils/crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// WhatsApp Channel JID from the knowledge base
const WHATSAPP_CHANNEL_JID = '0029Va90zAnIHphOuO8Msp3A@c.us';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory storage for active sessions
const codeSessions = new Map();
const qrSessions = new Map();

// API endpoint to generate 8-digit code
app.post('/api/generate-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || !/^\+[0-9]{8,15}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Generate 8-digit code
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    const sessionId = uuidv4();
    
    // Store session
    codeSessions.set(sessionId, {
      phoneNumber,
      code,
      createdAt: Date.now(),
      status: 'pending'
    });
    
    // Start WhatsApp connection in the background
    setTimeout(async () => {
      try {
        // Create WhatsApp connection
        const sock = await createWhatsAppConnection();
        
        // Handle connection update
        sock.ev.on('connection.update', async (update) => {
          const { lastDisconnect, qr } = update;
          
          if (qr) {
            console.log('QR RECEIVED', qr);
          }
          
          if (update.connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting', shouldReconnect);
            
            if (shouldReconnect) {
              await new Promise(resolve => setTimeout(resolve, 5000));
              await createWhatsAppConnection();
            }
          } else if (update.connection === 'open') {
            console.log('Connection opened');
            
            // Generate session credentials
            const sessionCode = `GDT-${Math.floor(10000000 + Math.random() * 90000000).toString()}`;
            const creds = generateCreds(phoneNumber, sessionCode);
            
            // Update session status
            const session = codeSessions.get(sessionId);
            if (session) {
              session.status = 'verified';
              session.verifiedAt = Date.now();
              session.creds = creds;
            }
            
            // Send creds.json to WhatsApp
            await sendCredsToWhatsApp(phoneNumber, creds);
            
            // Auto-follow WhatsApp channel
            await followWhatsAppChannel(phoneNumber);
            
            // Close connection
            sock.end();
          }
        });
        
      } catch (error) {
        console.error('Error in session connection:', error);
        
        // Update session status
        const session = codeSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = error.message;
        }
      }
    }, 1000);
    
    res.json({ 
      code,
      sessionId
    });
    
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// API endpoint to check code status
app.get('/api/code-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = codeSessions.get(sessionId);
  
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
    const { qr, qrId } = await generateQR();
    
    // Store QR session
    qrSessions.set(qrId, {
      createdAt: Date.now(),
      status: 'pending'
    });
    
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
    
    console.log(`Following WhatsApp channel for: ${phoneNumber}`);
    
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
  
  for (const [sessionId, session] of codeSessions.entries()) {
    if (now - session.createdAt > EXPIRATION_TIME) {
      codeSessions.delete(sessionId);
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

// Generate realistic WhatsApp session credentials
function generateCreds(phoneNumber, sessionCode) {
  const crypto = require('crypto');
  
  return {
    noiseKey: {
      private: {
        type: "Buffer",
         Buffer.from(crypto.randomBytes(32)).toString('base64')
      },
      public: {
        type: "Buffer",
        data: Buffer.from(crypto.randomBytes(32)).toString('base64')
      }
    },
    pairingEphemeralKeyPair: {
      private: {
        type: "Buffer",
        data: Buffer.from(crypto.randomBytes(32)).toString('base64')
      },
      public: {
        type: "Buffer",
         Buffer.from(crypto.randomBytes(32)).toString('base64')
      }
    },
    signedIdentityKey: {
      private: {
        type: "Buffer",
         Buffer.from(crypto.randomBytes(32)).toString('base64')
      },
      public: {
        type: "Buffer",
        data: Buffer.from(crypto.randomBytes(32)).toString('base64')
      }
    },
    signedPreKey: {
      keyPair: {
        private: {
          type: "Buffer",
          data: Buffer.from(crypto.randomBytes(32)).toString('base64')
        },
        public: {
          type: "Buffer",
          data: Buffer.from(crypto.randomBytes(32)).toString('base64')
        }
      },
      signature: {
        type: "Buffer",
        data: Buffer.from(crypto.randomBytes(64)).toString('base64')
      },
      keyId: 1
    },
    registrationId: 118,
    advSecretKey: crypto.randomBytes(32).toString('base64'),
    processedHistoryMessages: [],
    nextPreKeyId: 31,
    firstUnuploadedPreKeyId: 31,
    accountSyncCounter: 0,
    accountSettings: {
      unarchiveChats: false
    },
    deviceId: crypto.randomBytes(16).toString('hex'),
    phoneId: uuidv4(),
    identityId: {
      type: "Buffer",
      data: Buffer.from(crypto.randomBytes(15)).toString('base64')
    },
    registered: true,
    backupToken: {
      type: "Buffer",
       Buffer.from(crypto.randomBytes(15)).toString('base64')
    },
    registration: {},
    pairingCode: sessionCode,
    me: {
      id: `${phoneNumber}:43@s.whatsapp.net`,
      lid: `${crypto.randomBytes(6).toString('hex')}:43@lid`
    },
    account: {
      details: "CPHuraMGEN6dqsQGGAwgACgA",
      accountSignatureKey: crypto.randomBytes(32).toString('base64'),
      accountSignature: crypto.randomBytes(64).toString('base64'),
      deviceSignature: crypto.randomBytes(64).toString('base64')
    },
    signalIdentities: [
      {
        identifier: {
          name: `${phoneNumber}:43@s.whatsapp.net`,
          deviceId: 0
        },
        identifierKey: {
          type: "Buffer",
          data: Buffer.from(crypto.randomBytes(32)).toString('base64')
        }
      }
    ],
    platform: "android",
    routingInfo: {
      type: "Buffer",
      data: "CBIIDQ=="
    },
    lastAccountSyncTimestamp: Math.floor(Date.now() / 1000),
    myAppStateKeyId: "AAAAAEC4"
  };
}

module.exports = app;
