/**
 * Checks the content files before they are published.
 *
 * Written for a non-developer: every message names the file, and where it can,
 * the line. Two tiers —
 *
 *   ✗ MUST FIX      the site cannot be built until this is corrected
 *   ! worth a look  a link will be dead, but the site still works
 *
 *   node scripts/check-content.mjs      (or: npm run check)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/data');
const PUBLIC = join(ROOT, 'public');

const colour = process.stdout.isTTY;
const red = (s) => (colour ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s) => (colour ? `\x1b[32m${s}\x1b[0m` : s);
const yellow = (s) => (colour ? `\x1b[33m${s}\x1b[0m` : s);
const bold = (s) => (colour ? `\x1b[1m${s}\x1b[0m` : s);

let errors = 0;
let warnings = 0;

const report = (file, message, hint) => {
  errors++;
  console.log(`\n${red('✗ MUST FIX')}  ${bold(file)}`);
  console.log(`  ${message}`);
  if (hint) console.log(`  ${yellow('→')} ${hint}`);
};

const warn = (file, message, hint) => {
  warnings++;
  console.log(`\n${yellow('! worth a look')}  ${bold(file)}`);
  console.log(`  ${message}`);
  if (hint) console.log(`  ${yellow('→')} ${hint}`);
};

/**
 * JSON.parse reports a character offset, which means nothing to a person
 * looking at a text editor. Turn it into a line and column.
 */
function place(text, err) {
  const at = /position (\d+)/.exec(err.message);
  if (!at) return { line: null, column: null };
  const before = text.slice(0, Number(at[1]));
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

/** Turn V8's wording into the mistake that actually caused it. */
function explain(message) {
  if (/Expected ':' after property name/.test(message)) {
    return 'A field name is missing the colon after it. It should read  "name": "value"';
  }
  if (/Expected ',' or '}'|Expected ',' or '\]'/.test(message)) {
    return 'A comma is missing between two entries — every entry needs one after it except the last.';
  }
  if (/Expected double-quoted property name/.test(message)) {
    return 'Usually a comma left after the LAST entry in a list. The last one must not have one.';
  }
  if (/Expected property name or '}'/.test(message)) {
    return 'An extra comma just before a closing brace. Remove it.';
  }
  if (/Unterminated string/.test(message)) {
    return 'A piece of text was opened with a " and never closed. Text must stay on one line.';
  }
  if (/Unexpected end of JSON input/.test(message)) {
    return 'A bracket, brace or quote was opened and never closed — check the end of the file.';
  }
  if (/Unexpected non-whitespace character after JSON/.test(message)) {
    return 'There is something after the final closing brace that should not be there.';
  }
  if (/Bad control character|Bad escaped character/.test(message)) {
    return 'A stray backslash, or a line break inside a piece of text. Text must stay on one line.';
  }
  return 'Compare the line with the entry above it — they should look the same.';
}

/* ---------------------------------------------------- 1. is the JSON valid? */
const data = {};
for (const file of readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
  const text = readFileSync(join(DATA, file), 'utf8');
  try {
    const parsed = JSON.parse(text);
    delete parsed.$schema;
    delete parsed._help;
    data[file] =
      Array.isArray(parsed.items) && Object.keys(parsed).length === 1 ? parsed.items : parsed;
  } catch (err) {
    const { line, column } = place(text, err);
    report(
      `src/data/${file}${line ? `  (line ${line}, character ${column})` : ''}`,
      err.message.replace(/ in JSON at position \d+.*/s, '').trim(),
      explain(err.message)
    );
  }
}

/* ------------------------------------ 2. do the files being pointed at exist? */
// Collect every "looks like a file path" string in the data files.
const missing = new Map();
const walk = (value, file, trail) => {
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s.startsWith('/data/')) return;
    if (existsSync(join(PUBLIC, decodeURIComponent(s.slice(1))))) return;
    if (!missing.has(s)) missing.set(s, []);
    missing.get(s).push(`${file} → ${trail}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, file, `${trail}[${i + 1}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, file, trail ? `${trail}.${k}` : k);
  }
};
for (const [file, value] of Object.entries(data)) walk(value, `src/data/${file}`, '');

// A `photo:` field is usually a bare file name under /data/images/, but some
// lists store the full path instead. Accept either.
for (const [file, value] of Object.entries(data)) {
  const people = Array.isArray(value) ? value : [];
  for (const person of people) {
    // Some lists (events, media) store photo as an object with extra
    // positioning; those paths are checked by the generic sweep above.
    if (!person || typeof person !== 'object' || typeof person.photo !== 'string') continue;
    const photo = person.photo.trim();
    const rel = photo.startsWith('/') ? photo.slice(1) : `data/images/${photo}`;
    if (existsSync(join(PUBLIC, decodeURIComponent(rel)))) continue;
    const key = '/' + rel;
    if (!missing.has(key)) missing.set(key, []);
    missing.get(key).push(`src/data/${file} → ${person.name ?? 'entry'}`);
  }
}

for (const [path, users] of missing) {
  warn(
    path,
    `This file is referred to but is not in the public folder.`,
    `Either the file has not been uploaded to public${path}, or the name is ` +
      `spelled differently (capital letters and spaces count).\n     Used by: ${users[0]}` +
      (users.length > 1 ? ` and ${users.length - 1} more` : '')
  );
}

/* -------------------------------------- 3. does every listed page have a body? */
for (const [listFile, folder] of [
  ['pages.json', 'pages'],
  ['faculty_pages.json', 'faculty'],
]) {
  for (const entry of data[listFile] ?? []) {
    const body = join(ROOT, 'src/content', folder, `${entry.slug}.html`);
    if (!existsSync(body)) {
      report(
        `src/content/${folder}/${entry.slug}.html`,
        `src/data/${listFile} lists the page "${entry.slug}" but its text file is missing.`,
        `Either create that file, or remove the "${entry.slug}" entry from ${listFile}.`
      );
    }
  }
}

/* ----------------------------------------------------------------- summary */
console.log('');
if (errors === 0 && warnings === 0) {
  console.log(green(bold('✓ Everything checks out. You are safe to publish.')));
} else {
  if (warnings > 0) {
    console.log(yellow(`${warnings} missing file${warnings === 1 ? '' : 's'} (listed above).`));
    console.log('These leave a dead link but do not stop the site working. Several');
    console.log('were already missing on the old website, so they may need to be');
    console.log('requested from the office rather than fixed here.');
  }
  if (errors > 0) {
    console.log('');
    console.log(red(bold(`${errors} problem${errors === 1 ? '' : 's'} MUST be fixed before publishing.`)));
    process.exitCode = 1;
  } else {
    console.log('');
    console.log(green(bold('✓ No blocking problems. You are safe to publish.')));
  }
}
console.log('Nothing here affects the live website — this only checks files on this computer.');
