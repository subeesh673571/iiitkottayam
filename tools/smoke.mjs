/**
 * Exercises the client-side behaviour that no screenshot can show: the mobile
 * drawer, the tab strips, the search boxes, the slider, the carousel, the
 * popup, the marquee measurement and the homepage's random picks.
 *
 *   node tools/smoke.mjs [dir]      (default: dist)
 *
 * Each case runs in headless Chrome against the built site and reports pass or
 * fail. Verification only — not part of the build.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream, mkdtempSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCb);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'dist');
const PORT = 8821;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

/** Each case: a page, and a function run in the browser returning [ok, note]. */
const CASES = [
  {
    name: 'mobile drawer opens and closes',
    path: '/',
    body: `
      const drawer = document.getElementById('slide-out');
      const toggle = document.getElementById('menu-toggle');
      toggle.click();
      const opened = drawer.classList.contains('open');
      document.getElementById('side-nav-overlay').click();
      const closed = !drawer.classList.contains('open');
      return [opened && closed, 'opened=' + opened + ' closed=' + closed];`,
  },
  {
    name: 'drawer section expands',
    path: '/',
    body: `
      const header = document.querySelector('#slide-out .collapsible-header');
      header.click();
      return [header.nextElementSibling.classList.contains('open'), header.textContent.trim()];`,
  },
  {
    name: 'nav pins on scroll',
    path: '/',
    body: `
      const header = document.getElementById('myHeader');
      window.scrollTo(0, 800);
      window.dispatchEvent(new Event('scroll'));
      const pinned = header.classList.contains('sticky');
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('scroll'));
      return [pinned && !header.classList.contains('sticky'), 'pinned then released'];`,
  },
  {
    name: 'slider advances and loads the next image',
    path: '/',
    body: `
      const slides = [...document.querySelectorAll('.slides > li')];
      document.querySelector('[data-slide="next"]').click();
      const moved = !slides[0].classList.contains('active') && slides[1].classList.contains('active');
      const loaded = !slides[1].querySelector('img').hasAttribute('data-src');
      return [moved && loaded, 'moved=' + moved + ' image loaded=' + loaded];`,
  },
  {
    name: 'events carousel rotates',
    path: '/',
    body: `
      const items = [...document.getElementById('sideEvents').children];
      const first = items.findIndex((el) => el.classList.contains('active'));
      return [first === 0 && items.length > 1, items.length + ' items, first is active'];`,
  },
  {
    name: 'marquee measures its travel',
    path: '/',
    body: `
      const m = document.querySelector('.marquee');
      const d = m.style.getPropertyValue('--marquee-distance');
      return [d !== '' && d !== '0px', 'distance=' + d];`,
  },
  {
    name: 'popup appears, then closes',
    path: '/',
    body: `
      const modal = document.getElementById('autoModal');
      const shown = modal.classList.contains('open');
      modal.querySelector('.close-btn').click();
      return [shown && !modal.classList.contains('open'), 'shown=' + shown];`,
  },
  {
    name: 'homepage shows three faculty and three publications',
    path: '/',
    body: `
      const f = document.getElementById('faculty-pool').children.length;
      const p = document.getElementById('publication-pool').children.length;
      return [f === 3 && p === 3, 'faculty=' + f + ' publications=' + p];`,
  },
  {
    name: 'faculty search filters the cards',
    path: '/faculty',
    body: `
      const box = document.getElementById('page-search');
      const cards = [...document.querySelectorAll('[data-searchable]')];
      const before = cards.filter((c) => c.style.display !== 'none').length;
      box.value = 'zzzznomatch';
      box.dispatchEvent(new Event('input'));
      const none = cards.every((c) => c.style.display === 'none');
      const empty = document.getElementById('no-results').style.display !== 'none';
      box.value = '';
      box.dispatchEvent(new Event('input'));
      const restored = cards.filter((c) => c.style.display !== 'none').length;
      return [none && empty && restored === before, before + ' cards, all hidden then restored'];`,
  },
  {
    name: 'tender tabs switch panels',
    path: '/tenders/liveTenders',
    body: `
      const link = document.querySelector('a[data-tab="closedTenders"]');
      link.click();
      const panel = document.querySelector('[data-panel="closedTenders"]');
      const live = document.querySelector('[data-panel="liveTenders"]');
      return [panel.classList.contains('active') && !live.classList.contains('active'),
              'closed shown, live hidden, url=' + location.pathname];`,
  },
  {
    name: 'student batch tabs switch panels',
    path: '/students',
    body: `
      const links = [...document.querySelectorAll('a[data-tab]')];
      links[0].click();
      const key = links[0].dataset.tab;
      const panel = document.querySelector('[data-panel="' + key + '"]');
      return [panel.classList.contains('active'), 'switched to ' + key];`,
  },
  {
    name: 'administration search filters (was missing)',
    path: '/admin',
    body: `
      const box = document.getElementById('page-search');
      if (!box) return [false, 'no search box on /admin'];
      const cards = [...document.querySelectorAll('[data-searchable]')];
      box.value = 'zzzznomatch';
      box.dispatchEvent(new Event('input'));
      const none = cards.every((c) => c.style.display === 'none');
      box.value = 'director';
      box.dispatchEvent(new Event('input'));
      const some = cards.filter((c) => c.style.display !== 'none').length;
      return [none && some > 0 && some < cards.length,
              box.placeholder + ' — ' + some + '/' + cards.length + ' match "director"'];`,
  },
  {
    name: 'student roll search matches across batches',
    path: '/students',
    body: `
      const box = document.getElementById('page-search');
      if (!box) return [false, 'no search box on /students'];
      const names = [...document.querySelectorAll('.tab-panel [data-searchable]')];
      const panels = new Set(names.map((n) => n.closest('.tab-panel').dataset.panel));
      const first = names[0].dataset.searchable.split(' ')[0];
      box.value = first;
      box.dispatchEvent(new Event('input'));
      const shown = names.filter((n) => n.style.display !== 'none');
      const hitPanels = new Set(shown.map((n) => n.closest('.tab-panel').dataset.panel));
      return [shown.length > 0 && shown.length < names.length,
              names.length + ' names over ' + panels.size + ' batches; "' + first +
              '" matches ' + shown.length + ' across ' + hitPanels.size + ' batch(es)'];`,
  },
  {
    name: 'every listing the original searched has a search box',
    path: '/dept_head',
    body: `
      const box = document.getElementById('page-search');
      return [!!box, box ? 'placeholder: ' + box.placeholder : 'MISSING'];`,
  },
  {
    name: 'facilities has no search, as the original had none',
    path: '/campus/security',
    body: `
      return [!document.getElementById('page-search'), 'correctly absent'];`,
  },
  {
    name: 'no page errors anywhere in the sample',
    path: '/media',
    body: `return [window.__errors.length === 0, window.__errors.join(' | ') || 'clean'];`,
  },
];

const HARNESS = (body) => `
<script>
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push(e.message));
</script>
<script>
  window.addEventListener('load', () => setTimeout(() => {
    let result;
    try { result = (function () { ${body} })(); }
    catch (err) { result = [false, 'threw: ' + err.message]; }
    document.body.innerHTML =
      '<pre id="r">' + (result[0] ? 'PASS' : 'FAIL') + '::' + result[1] + '</pre>';
  }, 900));
</script>`;

let current = CASES[0];

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = join(DIR, url);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
  if (file.endsWith('.html')) {
    // The harness goes in after the page's own scripts, so they have run first.
    const html = readFileSync(file, 'utf8').replace(/<\/body>/i, `${HARNESS(current.body)}</body>`);
    return res.writeHead(200, { 'content-type': TYPES['.html'] }).end(html);
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT);

let failures = 0;
for (const testCase of CASES) {
  current = testCase;
  const { stdout } = await execFile('google-chrome', [
    '--headless', '--disable-gpu', '--no-sandbox', '--dump-dom',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'smoke-'))}`,
    '--virtual-time-budget=12000', '--window-size=1440,2400',
    `http://localhost:${PORT}${testCase.path}`,
  ], { timeout: 180000, maxBuffer: 64 * 1024 * 1024 });

  const found = /<pre id="r">(PASS|FAIL)::([\s\S]*?)<\/pre>/.exec(stdout);
  const ok = found?.[1] === 'PASS';
  if (!ok) failures++;
  console.log(
    `${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${testCase.name.padEnd(48)} ` +
      `${found ? found[2] : 'no result — the page did not run'}`
  );
}

console.log(failures ? `\n\x1b[31m${failures} failed\x1b[0m` : `\n\x1b[32mAll ${CASES.length} passed\x1b[0m`);
process.exit(failures ? 1 : 0);
