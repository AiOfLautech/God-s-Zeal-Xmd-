const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

// Get encryption key from environment variable
const getEncryptionKey = () => {
  if (!process.env.ENCRYPTION_KEY) {
    // Generate a random key if not provided (not recommended for production)
    console.warn('ENCRYPTION_KEY not set in environment. Using a random key (session data will not persist across restarts)');
    return crypto.randomBytes(32);
  }
  
  return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
};

// Encrypt data
const encryptData = (text) => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      content: encrypted
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Decrypt data
const decryptData = (encryptedData) => {
  try {
    const key = getEncryptionKey();
    const { iv, content } = encryptedData;
    
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

module.exports = {
  encryptData,
  decryptData
};
