// The old <marquee behavior="alternate"> bounced between the two ends. CSS
// alone cannot know how far that is, so measure it and hand it over as a
// custom property — and remeasure when the window is resized.
const marquee = document.querySelector('.marquee');
const track = marquee?.querySelector('.marquee-track');

if (track) {
  const measure = () => {
    const distance = Math.max(0, track.scrollWidth - marquee.clientWidth);
    marquee.style.setProperty('--marquee-distance', `${distance}px`);
    // Hold a steady reading pace rather than a fixed duration, so a long
    // notice does not race past and a short one does not crawl.
    track.style.animationDuration = `${Math.max(8, distance / 45)}s`;
    track.style.animationPlayState = distance > 0 ? 'running' : 'paused';
  };

  measure();
  window.addEventListener('resize', measure);
  // Late-loading badge images change the width, so measure again after load.
  window.addEventListener('load', measure);
}
