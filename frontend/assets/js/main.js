// Theme toggle
const toggle = document.getElementById('toggleTheme');
toggle.addEventListener('click', ()=>{
  document.body.dataset.theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
});
// ParticlesJS init
particlesJS.load('particles-js','../../frontend/assets/js/particles.json');