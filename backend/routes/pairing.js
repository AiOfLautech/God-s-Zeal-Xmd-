const router = require('express').Router();
const { generatePairCode } = require('../utils/whatsapp');

router.post('/', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Missing number' });

    const code = await generatePairCode(number);
    res.json({ code });             // { code: '12345' }
  } catch (e) {
    console.error('Pairing error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
