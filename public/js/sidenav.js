// Slide-in menu for phones and tablets — replaces Materialize's sideNav.
const drawer = document.getElementById('slide-out');
const overlay = document.getElementById('side-nav-overlay');
const toggle = document.getElementById('menu-toggle');

const setOpen = (open) => {
  drawer.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
  toggle?.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
};

toggle?.addEventListener('click', (e) => {
  e.preventDefault();
  setOpen(!drawer.classList.contains('open'));
});
overlay.addEventListener('click', () => setOpen(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));

// Tapping a real link closes the drawer; tapping a section header expands it.
drawer.addEventListener('click', (e) => {
  const header = e.target.closest('.collapsible-header');
  if (header) {
    const body = header.nextElementSibling;
    const wasOpen = body.classList.contains('open');
    drawer.querySelectorAll('.collapsible-body.open')
      .forEach((el) => el.classList.remove('open'));
    body.classList.toggle('open', !wasOpen);
    return;
  }
  if (e.target.closest('a')) setOpen(false);
});

drawer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('collapsible-header')) {
    e.target.click();
  }
});
