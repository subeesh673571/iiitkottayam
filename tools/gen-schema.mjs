/**
 * Generates a JSON Schema for every file in src/data/, by looking at what is
 * already in it. VS Code then offers key autocomplete, hover text and a red
 * underline the moment something is mistyped.
 *
 *   node tools/gen-schema.mjs
 *
 * Re-run it after adding a genuinely new field to a data file. Descriptions for
 * the common fields are in DESCRIPTIONS below — add to that rather than editing
 * the generated files, which are overwritten.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../src/data');
const OUT = join(DATA, '_schema');

/** Hover text, by field name. Applies wherever that name appears. */
const DESCRIPTIONS = {
  text: 'The wording people read.',
  title: 'The wording people read.',
  link: 'Where it goes: a page path like /placement, a file like /data/pdf/x.pdf, or a full https:// address.',
  links: 'One or more documents to link from this row.',
  image: 'Picture, written as /data/images/... (leave the word "public" out).',
  photo: 'Portrait file name, uploaded to public/data/images/.',
  new: 'true shows the animated NEW badge beside this item.',
  status: 'Tenders: 1 = live, 2 = closed, 3 = cancelled. Nothing else is shown. Elsewhere: above 0 shows the NEW badge.',
  name: 'Full name, as it should appear on the card.',
  designation: 'Job title. One line, or a list of lines.',
  area: 'Areas of interest, shown as bullet points.',
  contact: 'Phone, room and email shown at the bottom of the card.',
  email: 'Written as "name at iiitkottayam dot ac.in" so spam robots cannot collect it.',
  phone: 'One number, or a list of them.',
  room: 'Room number, e.g. AC 301.',
  slug: 'The address of the page: "rti" makes /rti. Must match the file name in src/content/.',
  caption: 'Words shown over the slide. Leave empty ("") for a slide with no text.',
  description: 'A sentence or two under the heading.',
  date: 'Shown under the description, exactly as you type it.',
  company: 'Recruiter name.',
  location: 'Where the recruiter is based.',
  img: 'Logo file name, uploaded to public/data/images/placement/.',
  label: 'The wording shown in the menu.',
  children: 'The entries of a drop-down under this menu item.',
  divider: 'true draws the thin separator line inside a drop-down.',
  external: 'true opens the link in a new tab.',
  lastDate: 'Closing date, exactly as you want it shown.',
  enabled: 'false switches this off completely.',
  heading: 'The line of text at the top.',
  width: 'Width in pixels. Leave it out to use the default.',
  height: 'Height in pixels. Leave it out to use the default.',
};

/** Describe one value: its type, and for objects/arrays what is inside. */
function infer(values) {
  const present = values.filter((v) => v !== undefined && v !== null);
  if (present.length === 0) return {};

  if (present.every(Array.isArray)) {
    return { type: 'array', items: infer(present.flat()) };
  }

  if (present.every((v) => typeof v === 'object' && !Array.isArray(v))) {
    const keys = [...new Set(present.flatMap(Object.keys))];
    const properties = {};
    for (const key of keys) {
      const child = infer(present.map((v) => v[key]));
      if (DESCRIPTIONS[key]) child.description = DESCRIPTIONS[key];
      properties[key] = child;
    }
    return {
      type: 'object',
      properties,
      // Nothing is marked `required`. A field that every current entry happens
      // to carry is not necessarily compulsory, and flagging a new entry that
      // leaves out an optional field would be wrong and off-putting.
      // A key that is not in the list is nearly always a typo, and this is what
      // makes VS Code underline it.
      additionalProperties: false,
    };
  }

  const types = [...new Set(present.map((v) => (Array.isArray(v) ? 'array' : typeof v)))];
  // Some legacy fields hold either one thing or a list of them.
  if (types.length > 1) return { type: types.map((t) => (t === 'object' ? 'object' : t)) };
  return { type: types[0] };
}

const HELP = {
  type: 'array',
  items: { type: 'string' },
  description: 'Notes for whoever edits this file. Ignored when the site is built.',
};

mkdirSync(OUT, { recursive: true });
let count = 0;

for (const file of readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '');
  const value = JSON.parse(readFileSync(join(DATA, file), 'utf8'));
  delete value.$schema;
  delete value._help;

  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: `src/data/${file}`,
    ...infer([value]),
  };
  schema.properties = { $schema: { type: 'string' }, _help: HELP, ...schema.properties };
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(schema, null, 2) + '\n');
  count++;
}

console.log(`${count} schemas written to src/data/_schema/`);
