/**
 * Reports the rendered geometry of chosen elements on a page, from two builds,
 * so a visual difference can be traced to the element and rule causing it.
 * Verification only.
 *
 *   node tools/measure.mjs <dirA> <dirB> <path> <css-selector>
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCb);
const [dirA, dirB, path, selector] = process.argv.slice(2);

const REPORT = (sel) => `
<script>
window.addEventListener('load', () => setTimeout(() => {
  const out = [...document.querySelectorAll(${JSON.stringify(sel)})].slice(0, 6).map((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return [
      el.tagName.toLowerCase() + '.' + (el.className || '').split(' ').join('.'),
      'box=' + Math.round(r.width) + 'x' + Math.round(r.height),
      'width:' + s.width, 'maxWidth:' + s.maxWidth, 'height:' + s.height,
      'padding:' + s.padding, 'display:' + s.display,
    ].join('  ');
  });
  document.body.innerHTML = '<pre id="report">' + out.join('\\n') + '</pre>';
}, 500));
</script>`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

function serve(root, port) {
  return new Promise((resolve) => {
    createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = join(root, url);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
      if (file.endsWith('.html')) {
        const html = readFileSync(file, 'utf8').replace(/<\/body>/i, `${REPORT(selector)}</body>`);
        return res.writeHead(200, { 'content-type': TYPES['.html'] }).end(html);
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    }).listen(port, () => resolve());
  });
}

await serve(dirA, 8811);
await serve(dirB, 8812);

for (const [label, port] of [['reference', 8811], ['this build', 8812]]) {
  const { stdout } = await execFile('google-chrome', [
    '--headless', '--disable-gpu', '--no-sandbox', '--dump-dom',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'chr-'))}`,
    '--virtual-time-budget=10000', '--window-size=1440,2400',
    `http://localhost:${port}${path}`,
  ], { timeout: 120000, maxBuffer: 64 * 1024 * 1024 });

  const report = /<pre id="report">([\s\S]*?)<\/pre>/.exec(stdout);
  console.log(`\n\x1b[36m${label}\x1b[0m`);
  console.log(report ? report[1] : '(no report — selector matched nothing)');
}
process.exit(0);
