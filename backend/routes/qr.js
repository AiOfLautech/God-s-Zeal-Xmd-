const router = require('express').Router();
const { getQRCode } = require('../utils/whatsapp');

router.get('/', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const data = await getQRCode(code);
    // { qr: 'data:image/png;base64,...', instructions: [...] }
    res.json(data);
  } catch (e) {
    console.error('QR error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
