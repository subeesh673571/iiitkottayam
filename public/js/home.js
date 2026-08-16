// The original site shuffled these two lists on every page load and showed
// three of each. Keep that behaviour by hiding the rest once the page is up.
const pickThree = (id) => {
  const pool = document.getElementById(id);
  if (!pool) return;
  const items = [...pool.children];
  if (items.length <= 3) return;
  const keep = new Set();
  while (keep.size < 3) keep.add(Math.floor(Math.random() * items.length));
  items.forEach((el, i) => {
    if (!keep.has(i)) el.remove();
  });
};

pickThree('faculty-pool');
pickThree('publication-pool');
