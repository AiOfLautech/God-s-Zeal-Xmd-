require('dotenv').config();
const express = require('express');
const path = require('path');
const pairing = require('./routes/pairing');
const qr = require('./routes/qr');
const { initWA } = require('./utils/whatsapp');
const app = express();

initWA();
app.use(express.json());

// Serve static frontend files
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use('/api/pair', pairing);
app.use('/api/qr', qr);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
