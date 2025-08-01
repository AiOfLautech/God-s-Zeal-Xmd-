const {
  default: makeWASocket,
  DisconnectReason,
  useSingleFileAuthState,
  Browsers,
  delay
} = require('@adiwajshing/baileys');
const path = require('path');
const fs = require('fs');
const { sendCreds } = require('./sendCreds');

// Initialize sock as null
let sock = null;
let initializing = false;
const sessionsDir = path.join(__dirname, '../creds');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);

/**
 * Initialize WhatsApp connection
 */
function initWA() {
  // Prevent multiple simultaneous initializations
  if (initializing) {
    console.log('WhatsApp initialization already in progress');
    return;
  }
  
  initializing = true;
  
  try {
    const authFile = path.join(sessionsDir, 'auth_info.json');
    const { state, saveState } = useSingleFileAuthState(authFile);

    // Properly initialize sock with browser info
    sock = makeWASocket({ 
      auth: state, 
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Desktop'),
      syncFullHistory: true,
      defaultQueryTimeoutMs: undefined // No timeout for queries
    });

    if (!sock) {
      throw new Error('Failed to initialize WhatsApp socket');
    }

    // Store latest QR code
    sock.latestQR = null;
    // Store pairing codes
    sock.pairMapping = {};

    // Handle authentication state updates
    if (sock && sock.ev) {
      sock.ev.on('creds.update', saveState);
      
      // Handle connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Update the latest QR for retrieval by /api/qr
          sock.latestQR = qr;
        }
        
        if (connection === 'open') {
          console.log('WhatsApp connection open');
          // After QR scan and open, send credentials
          await postAuthActions();
        }
        
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          console.log(`Connection closed. Status code: ${statusCode}. Reconnect: ${shouldReconnect}`);
          
          if (shouldReconnect) {
            // Reset initialization flag to allow retry
            initializing = false;
            // Attempt reconnect with delay to avoid spamming
            setTimeout(initWA, 5000);
          } else {
            console.log('Connection closed permanently (logged out)');
            initializing = false;
          }
        }
      });
      
      // Handle message updates
      sock.ev.on('messages.upsert', async (m) => {
        // Message handling logic would go here
        console.log('New message received');
      });
    } else {
      console.error('sock.ev is undefined after initialization');
      initializing = false;
      throw new Error('WhatsApp socket initialization failed: sock.ev is undefined');
    }
    
    // Reset initialization flag
    initializing = false;
    return sock;
  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    // Reset sock and initialization flag if initialization failed
    sock = null;
    initializing = false;
    throw error;
  }
}

/**
 * Generate a 6-digit pairing code and map it to the number
 */
async function generatePairCode(number) {
  if (!sock) {
    throw new Error('Socket not initialized. Call initWA() first.');
  }
  
  const code = (Math.floor(100000 + Math.random() * 900000)).toString();
  sock.pairMapping = sock.pairMapping || {};
  sock.pairMapping[code] = number;
  return code;
}

/**
 * Return the latest QR as base64 data URI and instructions
 */
async function getQRCode() {
  if (!sock) {
    throw new Error('Socket not initialized. Call initWA() first.');
  }
  
  if (!sock.latestQR) {
    // Force QR generation if not available
    if (!initializing) {
      initWA();
    }
    throw new Error('QR not available. Waiting for connection...');
  }
  
  return {
    qr: `data:image/png;base64,${sock.latestQR}`,
    instructions: [
      'Open WhatsApp',
      'Settings → Linked Devices → Link a Device',
      'Scan the QR code displayed'
    ]
  };
}

/**
 * After successful auth, send creds.json and channel link
 */
async function postAuthActions() {
  try {
    if (!sock || !sock.user || !sock.user.id) {
      throw new Error('Socket not properly initialized');
    }
    
    const jid = sock.user.id; // e.g. 23480809336992@s.whatsapp.net
    const userNumber = jid.split('@')[0];
    
    console.log(`WhatsApp connection established for ${userNumber}`);
    
    // Identify which code mapped to this user
    const entry = Object.entries(sock.pairMapping || {}).find(([, num]) => userNumber.startsWith(num));
    if (entry) {
      console.log(`Found pairing code for ${userNumber}: ${entry[0]}`);
      // Send credential file
      await sendCreds(sock, entry[0]);
      delete sock.pairMapping[entry[0]];
    }
  } catch (err) {
    console.error('postAuthActions error:', err);
    throw err;
  }
}

/**
 * Check if WhatsApp connection is ready
 */
function isWAConnected() {
  return sock && sock.user && sock.ws && sock.ws.readyState === sock.ws.OPEN;
}

/**
 * Get current connection status
 */
function getConnectionStatus() {
  if (!sock) return 'not-initialized';
  if (!sock.user) return 'connecting';
  if (sock.ws && sock.ws.readyState === sock.ws.OPEN) return 'open';
  return 'closed';
}

// Initialize WhatsApp connection when module loads
// But wrap it in a timeout to ensure other modules are ready
setTimeout(() => {
  try {
    initWA();
  } catch (error) {
    console.error('Failed to initialize WA on startup:', error);
    // Schedule a retry
    setTimeout(initWA, 10000);
  }
}, 1000);

module.exports = { 
  initWA, 
  generatePairCode, 
  getQRCode,
  isWAConnected,
  getConnectionStatus,
  // For testing/debugging
  _getInternalSocket: () => sock
};
