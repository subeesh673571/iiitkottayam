// Cross-fading banner, 8s per slide — the same timing the old Materialize
// slider used. Pauses while the pointer is over it or the tab is hidden.
const slider = document.querySelector('.slider');
const slides = [...slider.querySelectorAll('.slides > li')];
if (slides.length > 1) {
  let index = 0;
  let timer;

  // Give a slide its image (and warm the one after it) before it fades in.
  const load = (i) => {
    const img = slides[(i + slides.length) % slides.length].querySelector('img[data-src]');
    if (img) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  };

  const show = (next) => {
    slides[index].classList.remove('active');
    index = (next + slides.length) % slides.length;
    load(index);
    load(index + 1);
    slides[index].classList.add('active');
  };

  const start = () => {
    clearInterval(timer);
    timer = setInterval(() => show(index + 1), 8000);
  };

  slider.querySelector('[data-slide="prev"]').addEventListener('click', () => {
    show(index - 1);
    start();
  });
  slider.querySelector('[data-slide="next"]').addEventListener('click', () => {
    show(index + 1);
    start();
  });

  slider.addEventListener('mouseenter', () => clearInterval(timer));
  slider.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', () =>
    document.hidden ? clearInterval(timer) : start()
  );

  start();
}
