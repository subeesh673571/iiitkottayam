// Filters the cards below by the text typed in the page banner, matching the
// old Angular `filter:searchText` behaviour.
const box = document.getElementById('page-search');
const cards = [...document.querySelectorAll('[data-searchable]')];
const empty = document.getElementById('no-results');

box?.addEventListener('input', () => {
  const q = box.value.trim().toLowerCase();
  let shown = 0;
  for (const card of cards) {
    const hit = !q || card.dataset.searchable.includes(q);
    card.style.display = hit ? '' : 'none';
    if (hit) shown++;
  }
  if (empty) empty.style.display = shown === 0 ? '' : 'none';
});
