const router = require('express').Router();
const { generatePairCode } = require('../utils/whatsapp');
router.post('/', async (req,res)=>{
  const { number } = req.body;
  try{
    const code = await generatePairCode(number);
    res.json({ code });
  }catch(e){ res.status(500).json({ error:e.message }); }
});
module.exports = router;