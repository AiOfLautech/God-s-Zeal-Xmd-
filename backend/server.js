require('dotenv').config();
const express = require('express');
const path = require('path');

const pairing = require('./routes/pairing');
const qrRoute = require('./routes/qr');
const { initWA } = require('./utils/whatsapp');

const app = express();
initWA();

app.use(express.json());

// 1) API routes
app.use('/api/pair', pairing);
app.use('/api/qr', qrRoute);

// 2) Serve frontend
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// 3) Fallback to index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
