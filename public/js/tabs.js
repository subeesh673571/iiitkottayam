// Switch tab panels without a page load; the per-tab URLs still work directly.
// Used by the student rolls and the tender tabs.
const tabs = document.querySelector('#batch-tabs, #tender-tabs');
tabs?.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-tab]');
  if (!link) return;
  e.preventDefault();
  const key = link.dataset.tab;
  tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a === link));
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.dataset.panel === key)
  );
  history.replaceState(null, '', link.getAttribute('href'));
});
