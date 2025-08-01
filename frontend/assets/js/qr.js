(async ()=>{
  const code = localStorage.getItem('pairCode');
  const res = await axios.get(`/api/qr?code=${code}`);
  if(res.data.qr){
    document.getElementById('qrImg').src = res.data.qr;
    document.getElementById('instructions').innerHTML = res.data.instructions.join('<br>');
    // on success backend triggers sendCreds
  }
})();