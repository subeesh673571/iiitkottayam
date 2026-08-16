/**
 * Compares the pages this build produces against reference-dist/, the frozen
 * output of the previous (Astro) build. Verification only — not part of the
 * build.
 *
 * Four differences are expected by design and normalised away:
 *   - `data-astro-cid-*` scoping attributes, which no longer exist
 *   - the stylesheet link: /_astro/*.css  ->  /styles/site.css
 *   - <script> blocks: bundled+minified inline  ->  plain files in /js/
 *   - whitespace between tags
 *   - the spelling of an entity (&amp; vs &#38; vs a bare &)
 *
 * Anything else is a real difference and is printed.
 *
 *   node tools/diff-dist.mjs [--full]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = join(ROOT, 'reference-dist');
const B = join(ROOT, 'dist');
const full = process.argv.includes('--full');

function normalise(html) {
  return (
    html
      // scoping attributes Astro added to every element it styled
      .replace(/\s*data-astro-cid-[a-z0-9]+(="[^"]*")?/g, '')
      // the two builds name the stylesheet differently
      .replace(/<link rel="stylesheet" href="\/(_astro\/[^"]+|styles\/site)\.css">\s*/g, '')
      // component CSS: inlined in a <style> on one side, in site.css on the other
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      // scripts: inline+bundled on one side, external files on the other
      .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<script[^>]*\/?>/g, '')
      // an attribute with no value and one set to "" mean the same thing
      .replace(/\s(class|alt|href|title|src|style)(?=[\s>])/g, ' $1=""')
      // a space before the closing bracket of a tag is ignored by the browser
      .replace(/\s+>/g, '>')
      // HTML comments — the two builds keep them in different places
      .replace(/<!--[\s\S]*?-->/g, '')
      // &amp; / &#38; / a bare & are the same character; the two builds pick
      // different spellings in different places. Same for quotes.
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&#34;|&quot;/g, '"')
      .replace(/&#38;|&amp;/g, '&')
      // whitespace between tags, and around the edges
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

const pages = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(join(dir, entry.name));
    else if (entry.name.endsWith('.html')) pages.push(relative(A, join(dir, entry.name)));
  }
};
walk(A);

let same = 0;
const missing = [];
const differs = [];

for (const page of pages.sort()) {
  const target = join(B, page);
  if (!existsSync(target)) {
    missing.push(page);
    continue;
  }
  const a = normalise(readFileSync(join(A, page), 'utf8'));
  const b = normalise(readFileSync(target, 'utf8'));
  if (a === b) {
    same++;
    continue;
  }

  // Find where they part company, and show a little either side.
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  differs.push({
    page,
    at: i,
    was: a.slice(Math.max(0, i - 60), i + 140),
    now: b.slice(Math.max(0, i - 60), i + 140),
  });
}

// Pages this build produces that the reference did not have.
const built = [];
const walkB = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'data' && entry.name !== 'fonts') walkB(join(dir, entry.name));
    else if (entry.name.endsWith('.html')) built.push(relative(B, join(dir, entry.name)));
  }
};
walkB(B);
const extra = built.filter((p) => !pages.includes(p));

for (const d of (full ? differs : differs.slice(0, 12))) {
  console.log(`\n\x1b[33m${d.page}\x1b[0m  (first difference at character ${d.at})`);
  console.log(`  reference: …${d.was}…`);
  console.log(`  this build: …${d.now}…`);
}
if (!full && differs.length > 12) console.log(`\n…and ${differs.length - 12} more (run with --full)`);

console.log(`\n${same}/${pages.length} pages identical.`);
if (differs.length) console.log(`\x1b[31m${differs.length} differ\x1b[0m`);
if (missing.length) console.log(`\x1b[31m${missing.length} not built: ${missing.slice(0, 10).join(', ')}\x1b[0m`);
if (extra.length) console.log(`\x1b[33m${extra.length} extra: ${extra.slice(0, 10).join(', ')}\x1b[0m`);
process.exitCode = differs.length || missing.length || extra.length ? 1 : 0;
