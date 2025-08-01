const router = require('express').Router();
const { getQRCode } = require('../utils/whatsapp');
router.get('/', async (req,res)=>{
  const { code } = req.query;
  try{
    const data = await getQRCode(code);
    res.json(data);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
module.exports = router;