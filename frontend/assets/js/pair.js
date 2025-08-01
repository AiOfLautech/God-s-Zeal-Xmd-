const btn = document.getElementById('generate');
btn.addEventListener('click', async ()=>{
  const number = document.getElementById('mobileNumber').value.trim();
  const res = await axios.post('/api/pair', { number });
  if(res.data.code){
    const out = document.getElementById('output');
    out.textContent = 'GDT+' + res.data.code;
    localStorage.setItem('pairCode', res.data.code);
    document.getElementById('toQr').style.display = 'block';
  } else alert('Error');
});