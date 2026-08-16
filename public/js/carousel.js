// Auto-advancing events panel, 4s per item — matches the old carousel.
const carousel = document.getElementById('sideEvents');
const items = [...(carousel?.children ?? [])];
if (items.length > 1) {
  let i = 0;
  let timer;
  const advance = () => {
    items[i].classList.remove('active');
    i = (i + 1) % items.length;
    items[i].classList.add('active');
  };
  const start = () => { clearInterval(timer); timer = setInterval(advance, 4000); };
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', () =>
    document.hidden ? clearInterval(timer) : start()
  );
  start();
}
