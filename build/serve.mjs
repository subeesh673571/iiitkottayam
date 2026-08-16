/**
 * The local preview server behind `npm start`.
 *
 * Builds the site, serves dist/ on http://localhost:4321, and rebuilds
 * whenever a content file is saved — refresh the browser to see the change.
 * Plain node:http, no dependencies.
 */
import { createServer } from 'node:http';
import { watch, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

function build() {
  const started = Date.now();
  const result = spawnSync(process.execPath, [join(ROOT, 'build.mjs')], { encoding: 'utf8' });
  if (result.status === 0) {
    process.stdout.write(result.stdout);
  } else {
    // A mistake in a content file should read as "try again", not as a crash.
    console.log('\n\x1b[31mThe site could not be built.\x1b[0m');
    console.log((result.stderr || '').split('\n').slice(0, 6).join('\n'));
    console.log('\nFix the file named above and save it — this will try again.');
  }
  return Date.now() - started;
}

build();

// Rebuild when content changes. Several editors save a file in more than one
// step, so wait for things to settle before building.
let pending;
const changed = (file) => {
  if (file && (file.endsWith('~') || file.startsWith('.'))) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    console.log(`\nchanged: ${file ?? 'content'} — rebuilding`);
    build();
  }, 150);
};

for (const dir of ['src/data', 'src/content', 'src/templates', 'src/partials', 'src/styles', 'build']) {
  if (existsSync(join(ROOT, dir))) watch(join(ROOT, dir), { recursive: true }, (_, file) => changed(file));
}

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = join(DIST, url);

  // "/placement" is served from "/placement/index.html", the same way nginx
  // will serve it in production.
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<h1>404</h1><p>Nothing is published at <code>${url}</code>.</p>`);
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  The website is running at  \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log('  Save a file to rebuild, then refresh the page.');
  console.log('  Press Ctrl+C to stop.\n');
});
