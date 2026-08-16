// Pin the nav to the top of the viewport once the masthead above it has
// scrolled out of the way. Replaces the old site's jQuery scroll handler.
const header = document.getElementById('myHeader');
const smallLogo = document.getElementById('logo-on-small-nav');
const mobileLogo = document.querySelector('.custom-responsive-image');
const stickyAt = header.offsetTop;

const onScroll = () => {
  const pinned = window.pageYOffset >= stickyAt;
  header.classList.toggle('sticky', pinned);
  header.classList.toggle('nav-scrolled', pinned);
  if (smallLogo) smallLogo.style.display = pinned ? 'block' : 'none';
  if (mobileLogo) mobileLogo.classList.toggle('custom-logo-mobile', pinned);
};

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
