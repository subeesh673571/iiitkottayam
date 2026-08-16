/**
 * SUPERSEDED — kept for provenance. Do not run.
 *
 * The conversion it performed is done: src/data holds JSON, and the YAML is
 * gone. It also imports js-yaml, which is no longer installed (the build has no
 * dependencies), so it will fail on the first line. It is recorded here only to
 * show how the JSON files were produced.
 *
 * One-off: convert src/data/*.yaml to src/data/*.json.
 *
 * The YAML files carry editor guidance in `#` comments. JSON has no comments,
 * so the leading comment block of each file becomes a `_help` array that the
 * build ignores and the content editor reads.
 *
 *   list files   ->  { "$schema", "_help": [...], "items": [ ... ] }
 *   keyed files  ->  { "$schema", "_help": [...], ...original keys }
 *
 * Three files (site, home, footer) also carry comments part-way down; those are
 * finished by hand afterwards. Not part of the build — kept for provenance.
 *
 *   node tools/yaml-to-json.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../src/data');

/** Pull the run of `#` lines at the top of the file, stripped of the `#`. */
function leadingHelp(text) {
  const help = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t === '') {
      if (help.length) break;
      continue;
    }
    if (!t.startsWith('#')) break;
    const body = t.replace(/^#\s?/, '').trim();
    // Drop the ==== and ---- rules; they are decoration, not guidance.
    if (/^[=\-]{3,}$/.test(body)) continue;
    help.push(body);
  }
  return help;
}

let count = 0;
for (const file of readdirSync(DATA).filter((f) => f.endsWith('.yaml'))) {
  const name = file.replace(/\.yaml$/, '');
  const text = readFileSync(join(DATA, file), 'utf8');
  const value = load(text);
  const help = leadingHelp(text);

  const out = { $schema: `./_schema/${name}.json` };
  if (help.length) out._help = help;
  if (Array.isArray(value)) out.items = value;
  else Object.assign(out, value);

  writeFileSync(join(DATA, `${name}.json`), JSON.stringify(out, null, 2) + '\n');
  count++;
  console.log(`${file}  ->  ${name}.json${help.length ? `  (${help.length} help lines)` : ''}`);
}
console.log(`\n${count} files converted.`);
