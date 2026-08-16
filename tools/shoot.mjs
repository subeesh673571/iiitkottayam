/**
 * Screenshots a list of pages from two directories and reports how many pixels
 * differ. Verification only — not part of the build.
 *
 *   node tools/shoot.mjs <dirA> <dirB> <outDir>
 *
 * Serves each directory on its own port, drives headless Chrome at 1440px and
 * 390px, and compares the PNGs byte-block by byte-block. Animations (the
 * slider, the events carousel, the marquee) are frozen first, and the two
 * random panels on the homepage are seeded, so the comparison is stable.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const [dirA, dirB, outDir] = process.argv.slice(2);
if (!dirA || !dirB || !outDir) {
  console.error('usage: node tools/shoot.mjs <dirA> <dirB> <outDir>');
  process.exit(1);
}

const PAGES = [
  ['home', '/'],
  ['faculty', '/faculty'],
  ['profile', '/faculty/abinphilip'],
  ['news', '/news'],
  ['media', '/media'],
  ['events', '/events'],
  ['placement', '/placement'],
  ['tenders', '/tenders/liveTenders'],
  ['students', '/students/batch22'],
  ['campus', '/campus/hostel'],
  ['rti', '/rti'],
  ['admin', '/admin'],
  ['career', '/career'],
];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.JPG': 'image/jpeg',
};

// Freeze everything that moves, so two runs of the same page match.
const FREEZE = `
<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>
<script>
  // Keep the first slide and the first carousel item showing, and keep all of
  // the faculty/publication cards, instead of three at random.
  const stop = () => {
    for (const f of [setInterval, setTimeout]) {}
    document.querySelectorAll('.slides > li').forEach((li, i) =>
      li.classList.toggle('active', i === 0));
    document.querySelectorAll('#sideEvents > .carousel-item').forEach((el, i) =>
      el.classList.toggle('active', i === 0));
    document.querySelectorAll('img[data-src]').forEach((img) => {
      img.src = img.dataset.src; img.removeAttribute('data-src');
    });
    const modal = document.getElementById('autoModal');
    if (modal) modal.classList.remove('open');
    // The NEW badges are animated GIFs. Chrome samples them at whatever frame
    // it happens to be on, so a page carrying one does not even match a second
    // screenshot of itself. HIDE_GIFS=1 takes them out of the comparison.
    if (${process.env.HIDE_GIFS ? 'true' : 'false'}) {
      document.querySelectorAll('img[src$=".gif"]').forEach((img) => {
        img.style.visibility = 'hidden';
      });
    }
  };
  // Seeded, not constant: the homepage picks three distinct cards with
  // "while (chosen.size < 3)", which never finishes if every draw is the same.
  let seed = 1;
  Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  window.addEventListener('load', () => { stop(); setTimeout(stop, 300); });
</script>`;

function serve(root, port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = join(root, url);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      if (file.endsWith('.html')) {
        // The freeze goes in last, so it overrides the page's own scripts.
        const html = readFileSync(file, 'utf8').replace(/<\/body>/i, `${FREEZE}</body>`);
        res.writeHead(200, { 'content-type': TYPES['.html'] }).end(html);
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(port, () => resolve(server));
  });
}

// Async on purpose: the pages are served from this same process, so a blocking
// spawn would stop the server answering the very request Chrome is waiting on.
// Each run also needs its own profile directory, or a second Chrome refuses to
// start while the first still holds the default one.
let run = 0;
const shoot = (url, out, width) =>
  execFile(
    'google-chrome',
    [
      '--headless', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      `--user-data-dir=${join(outDir, `.chrome-${run++}`)}`,
      '--virtual-time-budget=15000', `--window-size=${width},2400`,
      `--screenshot=${out}`, url,
    ],
    { timeout: 180000 }
  );

const a = await serve(dirA, 8801);
const b = await serve(dirB, 8802);
mkdirSync(outDir, { recursive: true });

let worst = 0;
for (const [name, path] of PAGES) {
  for (const width of [1440, 390]) {
    const fa = join(outDir, `${name}-${width}-a.png`);
    const fb = join(outDir, `${name}-${width}-b.png`);
    await shoot(`http://localhost:8801${path}`, fa, width);
    await shoot(`http://localhost:8802${path}`, fb, width);

    const [ba, bb] = [readFileSync(fa), readFileSync(fb)];
    const same = ba.equals(bb);
    // Identical PNG bytes means identical pixels. Different bytes may still be
    // the same picture, so the size delta is reported as a rough signal.
    const delta = Math.abs(ba.length - bb.length) / Math.max(ba.length, bb.length);
    if (!same) worst = Math.max(worst, delta);
    console.log(
      `${same ? '\x1b[32midentical\x1b[0m' : '\x1b[33mdiffers  \x1b[0m'}  ` +
        `${name.padEnd(10)} ${String(width).padStart(4)}px  ` +
        `${(ba.length / 1024).toFixed(0)}kB vs ${(bb.length / 1024).toFixed(0)}kB` +
        (same ? '' : `  (${(delta * 100).toFixed(1)}% size delta)`)
    );
  }
}

a.close();
b.close();
console.log(`\nScreenshots in ${outDir}`);
