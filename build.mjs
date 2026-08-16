/**
 * Builds the whole site.
 *
 *   node build.mjs        writes dist/
 *
 * Reads the JSON in src/data/, the page bodies in src/content/ and the
 * templates in src/templates/ + src/partials/, and writes one plain HTML file
 * per page into dist/. Everything in public/ is copied across as-is.
 *
 * No framework, no dependencies — `node build.mjs` and standard library only.
 * The four moving parts:
 *
 *   build/template.mjs   the {{ }} renderer
 *   build/model.mjs      turns JSON into what a template needs
 *   src/templates/       one file per kind of page
 *   src/partials/        the shared chrome, defined once
 */
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, statSync, existsSync, readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFile, render, esc } from './build/template.mjs';
import {
  data,
  contentKeys,
  fixLink,
  navModel,
  footerModel,
  banner,
  personModel,
  mediaModel,
  batchLabel,
  chunk,
  newTab,
} from './build/model.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const TEMPLATES = join(ROOT, 'src/templates');
const PARTIALS = join(ROOT, 'src/partials');
const CONTENT = join(ROOT, 'src/content');

const opts = { partials: PARTIALS };
const site = data('site');
let written = 0;

/** Read a page body out of src/content/. */
const body = (folder, name) => {
  const file = join(CONTENT, folder, `${name}.html`);
  if (!existsSync(file)) throw new Error(`Missing page body: src/content/${folder}/${name}.html`);
  return readFileSync(file, 'utf8');
};

/**
 * Render one page and write it to its folder, so nginx serves /placement from
 * /placement/index.html with no configuration.
 * @param {string} path    the URL path, e.g. "/faculty" ("/" for the homepage)
 * @param {object} page    { title, description, template, scripts, ...values }
 */
function emit(path, page) {
  const inner = renderFile(join(TEMPLATES, `${page.template}.html`), page, opts);

  const html = renderFile(join(PARTIALS, 'base.html'), {
    site,
    // The path is compared against the menu links with its trailing slash on,
    // exactly as the previous build did. See navModel() for what that means.
    nav: navModel(path === '/' ? '/' : `${path}/`),
    footer: footerModel(),
    pageTitle: page.title ? `${page.title} | ${site.title}` : site.title,
    description: page.description ?? site.description,
    scripts: ['nav.js', 'sidenav.js', ...(page.scripts ?? [])],
    body: inner,
  }, opts);

  const dir = join(DIST, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  written++;
}

/* ------------------------------------------------------------------ homepage */

function buildHome() {
  const home = data('home');
  const slides = data('slides');

  emit('/', {
    template: 'index',
    scripts: ['popup.js', 'marquee.js', 'slider.js', 'carousel.js', 'home.js'],
    popup: site.popup?.enabled ? site.popup : null,
    home: {
      ...home,
      banners: home.banners.map((b) => ({
        ...b,
        // width/height are optional in the data and were left off the tag
        // entirely when absent, so they are assembled here rather than in the
        // template, where an empty attribute would still be printed.
        sizeAttrs:
          (b.width ? ` width="${esc(b.width)}"` : '') +
          (b.height ? ` height="${esc(b.height)}"` : ''),
        style: [
          b.max_height ? `max-height:${b.max_height}px` : '',
          `float:${b.align === 'left' ? 'left' : 'right'}`,
        ]
          .filter(Boolean)
          .join(';'),
      })),
      marquee: (home.marquee ?? []).map((m) => ({ ...m, linkText: m.link_text ?? 'Click Here' })),
    },
    initiativeRows: chunk(
      home.initiatives.map((i) => ({ ...i, width: i.width ?? 120 })),
      4
    ),
    slides: slides.map((slide, i) => {
      // Every slide sits inside the viewport, so `loading="lazy"` would not
      // hold anything back. Only the first two carry a real `src`; the rest
      // are filled in by the script just before they are shown.
      const src = i < 2 ? ` src="${esc(slide.image)}"` : ` data-src="${esc(slide.image)}"`;
      return {
        ...slide,
        activeClass: i === 0 ? 'active' : '',
        img: `<img${src} alt="${esc(slide.caption ?? '')}" decoding="async">`,
      };
    }),
    news: data('news'),
    events: data('events').map((event, i) => ({
      ...event,
      activeClass: i === 0 ? ' active' : '',
      background: `background:url('${event.image}') center center / cover`,
    })),
    faculty: data('faculty'),
    publications: data('publications'),
    welcome: readFileSync(join(CONTENT, 'home/welcome.html'), 'utf8').trim(),
    vision: readFileSync(join(CONTENT, 'home/vision.html'), 'utf8').trim(),
    mission: readFileSync(join(CONTENT, 'home/mission.html'), 'utf8').trim(),
  });
}

/* --------------------------------------------- static pages & staff profiles */

function buildBodies() {
  for (const page of data('pages')) {
    emit(`/${page.slug}`, {
      template: 'page',
      title: page.title,
      body: body('pages', page.slug),
    });
  }

  for (const page of data('faculty_pages')) {
    emit(`/faculty/${page.slug}`, {
      template: 'page',
      title: page.title,
      body: body('faculty', page.slug),
    });
  }
}

/* ------------------------------------------------------------ staff listings */

// `search` is the placeholder text, copied from the original site's own inputs
// (reference/views/<slug>.html). Every one of these listings had a search box;
// leaving it off any of them is a regression, not a simplification.
const PEOPLE_PAGES = [
  {
    slug: 'faculty',
    title: 'Faculty',
    data: 'faculty_full',
    search: 'Search Faculty',
    extra: { label: 'TA Duty List', link: '/data/pdf/ta.pdf' },
  },
  { slug: 'admin', title: 'Administration', data: 'administration', search: 'Search Administrator' },
  { slug: 'adminstaff', title: 'Administrative Staff', data: 'adminstaff', search: 'Search Admin Support Staff' },
  { slug: 'dept_head', title: 'Head of Department', data: 'dept_head', search: 'Search Head of Department' },
  { slug: 'technical', title: 'Technical Staff', data: 'technical', search: 'Search Technical' },
  { slug: 'professional', title: 'Professional Support Staff', data: 'professional', search: 'Search Professional Support Staff' },
  { slug: 'FacInCharge', title: 'Faculty In-Charge', data: 'faculty_incharge', search: 'Search Fac-In-Charge' },
];

function buildPeople() {
  for (const page of PEOPLE_PAGES) {
    const extra = page.extra
      ? `<div class="col s12 m12 l3 center-align">
        <a href="${esc(page.extra.link)}" class="white-text banner-link" target="_blank" rel="noopener">
          ${esc(page.extra.label)}
        </a>
      </div>`
      : '';

    emit(`/${page.slug}`, {
      template: 'people',
      title: page.title,
      scripts: page.search ? ['search.js'] : [],
      banner: banner({
        title: page.title,
        search: Boolean(page.search),
        searchPlaceholder: page.search,
        extra,
      }),
      people: data(page.data).map(personModel),
    });
  }
}

/* ------------------------------------------------- student & scholar listings */

// `search` is the original site's own placeholder text. Its filter ran over
// every batch at once — hence "Across Batch" — so a name typed here matches on
// whichever tab it lives in, not just the one on screen.
const LISTINGS = [
  { base: 'students', title: 'B.Tech Students', data: 'btech_students', prefix: 'batch', search: 'Search Students Across Batch' },
  { base: 'researchScholar', title: 'Research Scholars', data: 'research_scholars', prefix: 'batch', search: 'Search Research Scholar Across Batch' },
  { base: 'executivemtech', title: 'M.Tech Students', data: 'mtech_students', prefix: 'mtech_batch', search: 'Search Students Across Batch' },
  { base: 'imtechStudents', title: 'iM.Tech Students', data: 'imtech_students', prefix: 'imtech_batch', search: 'Search Students Across Batch' },
  { base: 'emtechStudents', title: 'e-M.Tech Students', data: 'emtech_students', prefix: 'emtech_batch', search: 'Search Students Across Batch' },
];

function buildBatches() {
  for (const listing of LISTINGS) {
    const batches = data(listing.data);
    const keys = contentKeys(batches);

    const page = (active) => ({
      template: 'batch',
      title: listing.title,
      scripts: ['tabs.js', 'search.js'],
      banner: banner({
        title: listing.title,
        search: true,
        searchPlaceholder: listing.search,
        extra: render(
          readFileSync(join(PARTIALS, 'tab-strip.html'), 'utf8'),
          {
            tabsId: ' id="batch-tabs"',
            tabs: keys.map((key) => ({
              label: batchLabel(key),
              attrs:
                ` href="/${listing.base}/${listing.prefix}${key.slice(1)}"` +
                ` class="${key === active ? 'active' : ''}" data-tab="${esc(key)}"`,
            })),
          },
          opts
        ),
      }),
      panels: keys.map((key) => ({
        key,
        label: batchLabel(key),
        activeClass: key === active ? ' active' : '',
        names: batches[key]
          .map((name) => String(name).replace(/\s+/g, ' ').trim())
          .map((name) => ({ name, searchable: name.toLowerCase() })),
        empty: batches[key].length === 0,
      })),
    });

    // The base path shows the newest batch; every tab also has its own URL, so
    // the old /students/batch15 style links keep resolving.
    emit(`/${listing.base}`, page(keys.at(-1)));
    for (const key of keys) {
      emit(`/${listing.base}/${listing.prefix}${key.slice(1)}`, page(key));
    }
  }
}

/* ---------------------------------------------------------------- facilities */

const FACILITIES = [
  { slug: 'hostel', label: 'Hostel' },
  { slug: 'security', label: 'Security' },
  { slug: 'internet', label: 'Internet' },
  { slug: 'gymnasium', label: 'Gymnasium' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'atm', label: 'Bank/ATM' },
  { slug: 'medical', label: 'Medical' },
  { slug: 'https://opac.iiitkottayam.ac.in', label: 'Library', external: true },
];

function buildCampus() {
  const page = (active) => ({
    template: 'campus',
    title: FACILITIES.find((t) => t.slug === active)?.label ?? 'Facilities',
    banner: banner({
      title: 'Facilities',
      extra: render(
        readFileSync(join(PARTIALS, 'tab-strip.html'), 'utf8'),
        {
          tabsId: '',
          tabs: FACILITIES.map((tab) => ({
            label: tab.label,
            attrs:
              ` href="${esc(tab.external ? tab.slug : `/campus/${tab.slug}`)}"` +
              ` class="${tab.slug === active ? 'active' : ''}"${newTab(tab.external)}`,
          })),
        },
        opts
      ),
    }),
    body: body('campus', active),
  });

  emit('/campus', page('hostel'));
  for (const tab of FACILITIES.filter((t) => !t.external)) emit(`/campus/${tab.slug}`, page(tab.slug));
}

/* ------------------------------------------------------------------- tenders */

const TENDER_TABS = [
  { slug: 'liveTenders', label: 'Live Tenders', status: 1 },
  { slug: 'closedTenders', label: 'Closed Tenders', status: 2 },
  { slug: 'cancelledTenders', label: 'Cancelled Tenders', status: 3 },
];

function buildTenders() {
  const tenders = data('tenders');

  const page = (active) => ({
    template: 'tenders',
    title: 'Tenders',
    scripts: ['tabs.js'],
    banner: banner({
      title: 'Tenders',
      extra: render(
        readFileSync(join(PARTIALS, 'tab-strip.html'), 'utf8'),
        {
          tabsId: ' id="tender-tabs"',
          tabs: TENDER_TABS.map((tab) => ({
            label: tab.label,
            attrs:
              ` href="/tenders/${tab.slug}" data-tab="${esc(tab.slug)}"` +
              ` class="${tab.slug === active ? 'active' : ''}"`,
          })),
        },
        opts
      ),
    }),
    panels: TENDER_TABS.map((tab) => {
      const rows = tenders.filter((t) => Number(t.status) === tab.status);
      return {
        slug: tab.slug,
        lowerLabel: tab.label.toLowerCase(),
        activeClass: tab.slug === active ? ' active' : '',
        empty: rows.length === 0,
        rows: rows.map((t) => ({
          ...t,
          links: (t.links ?? []).map((l) => ({ ...l, href: fixLink(l.link) })),
        })),
      };
    }),
  });

  emit('/tenders', page('liveTenders'));
  // Both spellings appear in the old markup, so serve each tab at either.
  for (const tab of TENDER_TABS) {
    emit(`/tenders/${tab.slug}`, page(tab.slug));
    emit(`/tenders/${tab.slug.toLowerCase()}`, page(tab.slug));
  }
}

/* ----------------------------------------------------------- one-off listings */

function buildNews() {
  emit('/news', {
    template: 'news',
    title: 'News',
    scripts: ['search.js'],
    banner: banner({ title: 'News', search: true, searchPlaceholder: 'Search news' }),
    news: data('news_full').map((item) => ({
      title: String(item.title).trim(),
      isNew: Number(item.status) > 0,
      links: (item.link ?? []).map((l) => ({ ...l, href: fixLink(l.link) })),
      searchable: String(item.title).toLowerCase(),
    })),
  });
}

function buildCareer() {
  emit('/career', {
    template: 'career',
    title: 'Career',
    scripts: ['search.js'],
    banner: banner({ title: 'Career', search: true, searchPlaceholder: 'Search openings' }),
    jobs: data('careers').map((job) => ({
      title: String(job.title).replace(/\s+/g, ' ').trim(),
      description: job.description,
      isNew: Number(job.status) > 0,
      href: job.link ? fixLink(job.link) : '',
      target: newTab(job.linktype),
      searchable: [job.title, job.description].filter(Boolean).join(' ').toLowerCase(),
    })),
  });
}

function buildPlacement() {
  emit('/placement', {
    template: 'placement',
    title: 'Placement',
    before: body('pages', '_placement-before'),
    after: body('pages', '_placement-after'),
    recruiters: data('recruiters'),
  });
}

function buildMediaPages() {
  emit('/events', {
    template: 'media',
    title: 'Events',
    scripts: ['search.js'],
    banner: banner({ title: 'Events', search: true, searchPlaceholder: 'Search Events' }),
    cards: data('events_full').map((item) => mediaModel(item, '/data/images/events')),
    emptyMessage: 'No matching events found.',
  });

  emit('/media', {
    template: 'media',
    title: '@Media',
    scripts: ['search.js'],
    // The original's @Media input had no placeholder. Kept that way; the
    // aria-label still names the box for a screen reader.
    banner: banner({ title: '@Media', search: true, searchPlaceholder: '', ariaLabel: 'Search coverage' }),
    cards: data('media').map((item) => mediaModel(item, '/data/images/media')),
    emptyMessage: 'No matching coverage found.',
  });
}

/* --------------------------------------------------------------------- files */

/**
 * Copy a file only when it is new or has changed. public/data/ is 2.4 GB of
 * PDFs and photos; copying all of it on every build would make the edit-and-
 * look loop unusable.
 */
function copyIfChanged(from, to) {
  const source = statSync(from);
  if (existsSync(to)) {
    const target = statSync(to);
    if (target.size === source.size && target.mtimeMs >= source.mtimeMs) return 0;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  return 1;
}

/** Copy public/ over the top of dist/, and the stylesheet the pages ask for. */
function copyAssets() {
  let copied = 0;
  const walk = (dir, target) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const from = join(dir, entry.name);
      const to = join(target, entry.name);
      if (entry.isDirectory()) walk(from, to);
      else copied += copyIfChanged(from, to);
    }
  };
  walk(join(ROOT, 'public'), DIST);

  mkdirSync(join(DIST, 'styles'), { recursive: true });
  copied += copyIfChanged(join(ROOT, 'src/styles/global.css'), join(DIST, 'styles/site.css'));
  return copied;
}

/** Remove the HTML from a previous build, so a deleted page really goes away. */
function clearHtml(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // public/data holds the institute's own files and never contains pages.
    if (entry.isDirectory() && entry.name !== 'data' && entry.name !== 'fonts') {
      clearHtml(join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      rmSync(join(dir, entry.name));
    }
  }
}

/* ---------------------------------------------------------------------- main */

const started = Date.now();
mkdirSync(DIST, { recursive: true });
// Only the generated HTML is cleared; the institute's files under dist/data
// are left alone and refreshed by copyAssets() when they change.
clearHtml(DIST);

buildHome();
buildBodies();
buildPeople();
buildBatches();
buildCampus();
buildTenders();
buildNews();
buildCareer();
buildPlacement();
buildMediaPages();
const copied = copyAssets();

console.log(
  `${written} pages built in ${((Date.now() - started) / 1000).toFixed(2)}s -> dist/` +
    (copied ? ` (${copied} file${copied === 1 ? '' : 's'} copied from public/)` : '')
);
