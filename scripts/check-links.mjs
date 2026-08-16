// Audits every internal reference in the built site — links, images, PDFs and
// CSS background images — against what actually exists in dist/.
//
//   npm run build && npm run check:links
//
// Pure Node, no dependencies. Exits non-zero if the broken count rises above
// BASELINE, so a regression fails CI while the known-bad upstream files do not.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// References that 404 on the live iiitkottayam.ac.in too — they cannot be fixed
// here, only by supplying the original files. Each one was requested from the
// live server and returned 404. Raise/lower deliberately, never to "make it
// pass": a rise means a new broken reference was introduced.
const BASELINE = 28;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

let allFiles;
try {
  allFiles = walk(DIST);
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const filePaths = new Set(allFiles.map((f) => relative(DIST, f).split('\\').join('/')));
const routes = new Set(
  allFiles
    .filter((f) => f.endsWith('index.html'))
    .map((f) => {
      const rel = relative(DIST, dirname(f)).split('\\').join('/');
      return rel === '' ? '/' : '/' + rel;
    })
);

const decode = (raw) => {
  // Entities first: a "&#38;" inside a file name contains a '#', and splitting
  // on '#' before decoding truncates the path.
  const unescaped = raw
    .replace(/&amp;|&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  try {
    return decodeURIComponent(unescaped.split('#')[0].split('?')[0]);
  } catch {
    return unescaped.split('#')[0].split('?')[0];
  }
};

const EXTERNAL = /^(https?:|\/\/|mailto:|tel:|#|javascript:|data:)/;
const broken = new Map();
let checked = 0;

for (const page of allFiles.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(page, 'utf8');
  const refs = [
    ...html.matchAll(/(?:href|src)="([^"]+)"/g),
    ...html.matchAll(/url\(\s*['"]?(\/data\/[^)'"]+)/g),
  ].map((m) => m[1]);

  // the route this page is served at, used to resolve relative references
  const pageRoute =
    '/' + relative(DIST, dirname(page)).split('\\').join('/').replace(/^\.$/, '');

  for (const raw of refs) {
    if (EXTERNAL.test(raw)) continue;
    let target = decode(raw);

    // A relative reference ("./data/x", "../data/x", "data/x") resolves against
    // the current route, not the site root. The legacy markup used these freely
    // because hash routing kept the browser on "/" — as real page paths they
    // point somewhere else entirely, so they must be resolved and checked.
    if (!target.startsWith('/')) {
      target = new URL(target, `http://x${pageRoute}/`).pathname;
    }
    checked++;
    const asRoute = target.replace(/\/$/, '') || '/';
    if (routes.has(target) || routes.has(asRoute) || filePaths.has(target.slice(1))) continue;
    if (!broken.has(target)) broken.set(target, new Set());
    broken.get(target).add('/' + relative(DIST, page).replace(/\/?index\.html$/, ''));
  }
}

const total = [...broken.values()].reduce((n, s) => n + s.size, 0);
const pct = (((checked - total) / checked) * 100).toFixed(2);

console.log(`pages       : ${routes.size}`);
console.log(`references  : ${checked}`);
console.log(`resolve     : ${checked - total} (${pct}%)`);
console.log(`broken      : ${total} across ${broken.size} distinct targets\n`);

for (const [target, pages] of [...broken].sort()) {
  const list = [...pages].slice(0, 2).join(', ');
  console.log(`  ${target}\n      on ${list}${pages.size > 2 ? ` +${pages.size - 2} more` : ''}`);
}

if (total > BASELINE) {
  console.log(`\nFAIL: ${total} broken, baseline is ${BASELINE}. A new one was introduced.`);
  process.exitCode = 1;
} else {
  console.log(`\nOK: ${total} broken, at or under the ${BASELINE} known-upstream baseline.`);
}
