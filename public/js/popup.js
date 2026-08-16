// The notice that appears a moment after the homepage loads.
const modal = document.getElementById('autoModal');
if (modal) {
  const close = () => modal.classList.remove('open');
  setTimeout(() => modal.classList.add('open'), 250);
  modal.querySelector('.close-btn').addEventListener('click', close);
  modal.addEventListener('click', (e) => e.target === modal && close());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
