/**
 * Turns the JSON in src/data/ into exactly what the templates need.
 *
 * Everything the template language cannot express lives here, in plain
 * JavaScript: the four-per-row initiative grid, the string-or-array shapes the
 * legacy data uses, the batch labels, the tender status filter. Templates then
 * only loop and print.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc } from './template.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/data');

const cache = new Map();

/**
 * Read one of the editable JSON files in src/data/.
 * `_help` and `$schema` are guidance for the editor, not content — they are
 * stripped here so nothing downstream has to know about them.
 * @param {string} name file name without the .json extension
 */
export function data(name) {
  if (cache.has(name)) return cache.get(name);

  const file = join(DATA, `${name}.json`);
  if (!existsSync(file)) {
    const available = readdirSync(DATA)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .join(', ');
    throw new Error(`src/data/${name}.json does not exist. Available: ${available}`);
  }

  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`src/data/${name}.json has a JSON error — ${err.message}`);
  }

  delete value.$schema;
  delete value._help;
  // List files are wrapped as { items: [...] } so they have somewhere to put
  // `_help`; unwrap them back to a plain array.
  const result = Array.isArray(value.items) && Object.keys(value).length === 1 ? value.items : value;
  cache.set(name, result);
  return result;
}

/** Keys of a keyed data file, minus anything the editor added for guidance. */
export const contentKeys = (object) => Object.keys(object).filter((k) => !k.startsWith('_'));

/**
 * Normalise a link written in the old site's style.
 *   "#!/faculty"        -> "/faculty"      (AngularJS hash route)
 *   "data/pdf/x.pdf"    -> "/data/pdf/x.pdf"
 * Absolute URLs, mailto:, tel: and paths that already start with / pass through.
 */
export function fixLink(href) {
  if (!href) return '';
  const s = String(href).trim();

  // The old site had a viewer route, #!pdf/<section>/<file>/<heading>, that
  // embedded the PDF through Google's gview. That viewer is deprecated, so
  // link straight to the file — browsers display PDFs natively.
  const viewer = /^#!\/?pdf\/[^/]+\/([^/]+)\//.exec(s);
  if (viewer) return `/data/pdf/${viewer[1]}.pdf`;

  if (s.startsWith('#!')) return '/' + s.slice(2).replace(/^\/+/, '');
  if (/^(https?:|mailto:|tel:|\/|#)/.test(s)) return s;
  if (s.startsWith('data/')) return '/' + s;
  return s;
}

/** An optional attribute: rendered only when there is a value. Pre-escaped. */
const attr = (name, value) =>
  value === undefined || value === null || value === false ? '' : ` ${name}="${esc(value)}"`;

/** target="_blank" rel="noopener", or nothing. */
export const newTab = (external) => (external ? ' target="_blank" rel="noopener"' : '');

/* -------------------------------------------------------------- site chrome */

/**
 * The menu, with the current page marked. Shared by the nav and the drawer.
 *
 * `path` arrives with a trailing slash ("/academics/") while the menu links are
 * written without one ("/academics"), so in practice only Home ever matches.
 * That is what the site has been shipping, and changing it would light up a
 * menu item that has never been highlighted before — a visible change, so it is
 * left as a decision for the institute rather than made here. To switch real
 * highlighting on, compare with the trailing slash stripped.
 */
export function navModel(path) {
  return data('nav').map((item) => {
    const children = item.children ?? null;
    const active =
      (item.link && item.link === path) || (children ?? []).some((c) => c.link === path);
    return {
      ...item,
      href: item.link ?? '#',
      wrapperClass: children ? 'dropdown-wrapper' : '',
      activeClass: active ? 'activeMenuTab' : '',
      haspopup: children ? ' aria-haspopup="true"' : '',
      arrow: children ? '<i class="material-icons right notranslate">arrow_drop_down</i>' : '',
      children,
      // The drawer lists the same children without the separator rules.
      childLinks: (children ?? []).filter((c) => !c.divider),
    };
  });
}

/** The footer, with the GST line attached to the last column. */
export function footerModel() {
  const footer = data('footer');
  return {
    ...footer,
    columns: footer.columns.map((links, i) => ({
      links: links.map((link) => ({ ...link, target: newTab(link.external) })),
      gst: i === footer.columns.length - 1 ? footer.gst : null,
    })),
  };
}

/* ------------------------------------------------------------ page fragments */

/** The blue title strip at the top of an interior page. */
export function banner({
  title,
  search = false,
  searchPlaceholder = 'Search',
  // Two of the original's search boxes had no placeholder text. Keeping that
  // means the input needs a label of its own for anyone using a screen reader.
  ariaLabel = searchPlaceholder,
  extra = '',
}) {
  return {
    title,
    search,
    searchPlaceholder,
    ariaLabel,
    // An empty placeholder is left off the tag entirely, as it was originally.
    placeholderAttr: searchPlaceholder ? ` placeholder="${esc(searchPlaceholder)}"` : '',
    titleClass: search ? 'col s12 m12 l4' : 'col s12',
    extra,
  };
}

/**
 * One staff member. The legacy data stores designation, phone and photo in
 * more than one shape, so every one of them is flattened here.
 */
export function personModel(person) {
  const photo = person.photo ? String(person.photo).trim() : '';

  const designations = Array.isArray(person.designation)
    ? person.designation
    : person.designation
      ? [person.designation]
      : [];

  const phones = Array.isArray(person.contact?.phone)
    ? person.contact.phone
    : person.contact?.phone
      ? [person.contact.phone]
      : [];

  const charges = [person.additionalcharge, person.additionalcharge1].filter(
    (c) => c && String(c).trim()
  );

  // Everything the banner's search box should match against, lower-cased once
  // here so the filter script only has to do a substring test.
  const searchable = [person.name, ...designations, ...(person.area ?? []), person.keypoint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    name: person.name,
    photo: photo ? `/data/images/${photo}` : '',
    // <br>-joined rather than looped: the original put no whitespace between
    // the lines, and a loop in the template would introduce some.
    charges: charges.map(esc).join('<br>'),
    designations: designations.map(esc).join('<br>'),
    area: person.area ?? [],
    keypoint: person.keypoint,
    phones,
    room: person.contact?.room,
    email: person.contact?.email,
    page: person.page?.text ? { text: person.page.text, link: person.page.link || '#' } : null,
    more: person.more?.text ? { text: person.more.text, link: `/${person.more.link}` } : null,
    searchable,
  };
}

/** One card on the Events or @Media page. */
export function mediaModel(item, imageBase) {
  const photo = item.photo?.file ? `${imageBase}/${item.photo.file}` : null;
  return {
    photo,
    background: photo
      ? `background:url('${encodeURI(photo)}') ${item.photo?.posx ?? 'center'} ${item.photo?.posy ?? 'center'} / cover`
      : '',
    links: (item.link ?? []).map((l) => ({ ...l, href: fixLink(l.link) })),
    title: item.title,
    description: item.description,
    date: item.date,
    searchable: [item.title, item.description, item.date]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

/* ------------------------------------------------------------------ homepage */

/** "b20cse" -> "2020 Batch CSE" */
export function batchLabel(key) {
  const m = /^b(\d{2})(.*)$/.exec(key);
  if (!m) return key;
  const [, year, suffix] = m;
  return `20${year} Batch${suffix ? ' ' + suffix.toUpperCase() : ''}`;
}

/** Split a list into rows of `size`, for the initiatives grid. */
export const chunk = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size)
  );

export { attr };
