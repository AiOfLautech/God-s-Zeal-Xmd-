const { v4: uuidv4 } = require('uuid');
const { createWhatsAppConnection, generateQR, sendCredsToWhatsApp, followWhatsAppChannel } = require('./whatsapp');

// In-memory storage for active sessions
const activeSessions = new Map();
const qrSessions = new Map();

// Generate a secure 8-digit session code with GDT prefix
const generateSessionCode = () => {
  // Generate 8 random digits
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `GDT-${randomDigits}`;
};

// Generate realistic WhatsApp session credentials
const generateCreds = (phoneNumber, sessionCode) => {
  return {
    noiseKey: {
      private: {
        type: "Buffer",
        data: Buffer.from(crypto.randomBytes(32)).toString('base64')
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
        data: Buffer.from(crypto.randomBytes(32)).toString('base64')
      }
    },
    signedIdentityKey: {
      private: {
        type: "Buffer",
        data: Buffer.from(crypto.randomBytes(32)).toString('base64')
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
      data: Buffer.from(crypto.randomBytes(15)).toString('base64')
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
};

// Create a new session
const createSession = async (phoneNumber) => {
  try {
    const sessionCode = generateSessionCode();
    const sessionId = uuidv4();
    
    // Store session
    activeSessions.set(sessionId, {
      phoneNumber,
      code: sessionCode,
      createdAt: Date.now(),
      status: 'pending'
    });
    
    // Start WhatsApp connection in the background
    setTimeout(async () => {
      try {
        // Create WhatsApp connection
        const sock = await createWhatsAppConnection(sessionId);
        
        // Handle connection update
        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;
          
          if (qr) {
            console.log('QR RECEIVED', qr);
          }
          
          if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting', shouldReconnect);
            
            if (shouldReconnect) {
              await new Promise(resolve => setTimeout(resolve, 5000));
              await createWhatsAppConnection(sessionId);
            }
          } else if (connection === 'open') {
            console.log('Connection opened');
            
            // Generate session credentials
            const creds = generateCreds(phoneNumber, sessionCode);
            
            // Update session status
            const session = activeSessions.get(sessionId);
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
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = error.message;
        }
      }
    }, 1000);
    
    return {
      code: sessionCode,
      sessionId
    };
  } catch (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
};

// Generate QR code for session
const generateQRCode = async () => {
  try {
    const qrId = uuidv4();
    
    // Store QR session
    qrSessions.set(qrId, {
      createdAt: Date.now(),
      status: 'pending'
    });
    
    // Generate QR code
    const { qr, sessionId } = await generateQR(qrId);
    
    // Update QR session with QR code
    const session = qrSessions.get(qrId);
    if (session) {
      session.qr = qr;
      session.sessionId = sessionId;
    }
    
    return {
      qr,
      qrId
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

module.exports = {
  createSession,
  generateQRCode
};
