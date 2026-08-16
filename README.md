# IIIT Kottayam — website rebuild

A static rebuild of https://www.iiitkottayam.ac.in/ in **plain HTML, CSS and
JavaScript**. `npm run build` writes 252 finished pages into `dist/`, which is
uploaded to the existing nginx server. There is no framework, **no npm
dependencies at all**, no database and no PHP.

Two companion documents:

- **[EDITING.md](./EDITING.md)** — the content editor's handbook, written for a
  non-developer. Start here if you maintain the site's content.
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — the technical reference: architecture,
  route map, data layer, styling system, verification tooling and gotchas.
- **[../doc/handbook.html](../doc/handbook.html)** — EDITING.md as a web page,
  for handing to someone who will not open a repository. Published at
  see [../doc/README.md](../doc/README.md). Keep it in step with EDITING.md.


## Requirements

Node.js 20.3+ (or 18.20.8+ / 22+). Nothing else — there is no `npm install`
step, because there is nothing to install.

## Commands

```bash
npm start        # local preview at http://localhost:4321, rebuilds on save
npm run check    # validate the content files (JSON + referenced assets)
npm run build    # runs check, then writes the deployable site to dist/
```

A full build takes about half a second.

`npm run check` is the guard rail for non-developer edits: a JSON syntax error
is a hard failure that blocks the build, while a reference to a missing image or
PDF is a warning that does not (several such files were already missing from the
old site). Its messages name the file, the line and the character, and are
written for a non-technical reader — see `scripts/check-content.mjs`.

## Layout

```
build.mjs            the whole build: routes, page models, writes dist/
build/
  template.mjs       the {{ }} renderer — ~180 lines, the only "framework"
  model.mjs          turns JSON into what a template needs
  serve.mjs          the dev server behind `npm start`
src/
  data/              JSON — menus, footer, and every list the site renders
    _schema/         generated JSON Schemas (tools/gen-schema.mjs)
  content/
    home/            the Welcome, Vision and Mission text
    pages/           HTML bodies for the 74 static interior pages
    faculty/         HTML bodies for the 117 staff profile pages
    campus/          HTML bodies for the 7 facilities tabs
  partials/          base, masthead, nav, sidenav, footer, page-banner, tab-strip
  templates/         one per page kind: index, page, people, batch, campus,
                     tenders, news, career, placement, media
  styles/global.css
public/              copied to the site root as-is
  data/              all images and PDFs, at their original URLs
  js/                the client-side scripts, one per behaviour
  fonts/ styles/     self-hosted Font Awesome, Material Icons, Roboto, Hind
scripts/             check-content.mjs, check-links.mjs
tools/               verification and one-off scripts (see below)
```

`public/data/...` deliberately mirrors the old site's paths, so every existing
link to a PDF that appears in a Google result or an old email keeps working.

## How the build works

`build.mjs` walks a list of routes. For each one it assembles a plain object —
the page model — and renders a template with it, then wraps the result in
`src/partials/base.html`. That is the whole architecture.

The template language is deliberately tiny: `{{ value }}`, `{{{ raw html }}}`,
`{{# if }}`, `{{# each }}` and `{{> partial }}`. Anything it cannot express is
worked out first, in JavaScript, in `build/model.mjs` — the four-per-row
initiative grid, the string-or-array shapes the legacy data uses, the
`b20cse → "2020 Batch CSE"` labels, the tender status filter. Templates only
loop and print; the logic is in one file you can read top to bottom.

Client-side behaviour is one small file per job in `public/js/`, loaded with
`<script defer>` by the pages that need it: `nav.js` and `sidenav.js` everywhere,
plus `slider.js`, `carousel.js`, `marquee.js`, `popup.js` and `home.js` on the
homepage, `search.js` on pages with a search box, and `tabs.js` on the tabbed
ones.

## Deploying to nginx

```bash
npm run build
./deploy.sh user@server:/var/www/iiitkottayam
```

`deploy.sh` rsyncs `dist/` to the target and deletes files that no longer exist.
Do a dry run first with `./deploy.sh --dry-run user@server:/path`.

nginx needs no special configuration. Each page is written to its own folder as
`index.html`, so `/placement` is served from `/placement/index.html` by the
default `index` handling. A `try_files` line is enough:

```nginx
location / {
    try_files $uri $uri/ =404;
}
```

## Current state

**The whole site is built — 252 pages.** Measured against the live site at
1440px, the homepage nav item widths are identical to the pixel
(`61, 91, 80, 102, 104, 94, 108, 127, 113, 96, 151, 79`), and the content
column, placement panel and initiatives grid all land within 1–2px.

**42,543 of 42,571 internal references resolve (99.93%)** — links, images, PDFs
and CSS backgrounds across all 252 pages, checked by `npm run check:links`. The
28 that do not were each requested from the live server and return 404 there too.

| Group | Pages | Source |
| --- | --- | --- |
| Homepage | 1 | `src/templates/index.html` |
| Static interior pages | 74 | `src/content/pages/*.html` + `src/data/pages.json` |
| Faculty profiles | 117 | `src/content/faculty/*.html` + `src/data/faculty_pages.json` |
| Staff listings (faculty, admin, technical, …) | 7 | `src/templates/people.html` |
| Student & scholar rolls (one page per batch tab) | 33 | `src/templates/batch.html` |
| Facilities tabs | 8 | `src/content/campus/*.html` |
| Tenders (3 tabs × 2 spellings) | 7 | `src/templates/tenders.html` |
| News, Events, @Media, Career, Placement | 5 | one template each |

Records carried across from the old controllers: 176 faculty, 210 news items,
103 recruiters, 88 press clippings, 48 tenders, 26 events, 25 job openings,
plus every student and research-scholar batch.

### Routes

Page paths deliberately keep the **original route names** (`/btech_cs_home`,
`/researchScholar`, `/campus/hostel`) rather than tidier slugs. With ~39,000
cross-links between these pages, matching the old names means every internal
link resolves without a translation table. Tender tabs are served under both
the camelCase and lowercase spellings, because both appear in the old markup.

### Known deviations from the original, all deliberate

| Change | Reason |
| --- | --- |
| Slider images load as needed rather than all 74 at once | Cuts first load from 98 MB to 21 MB with no visible difference |
| `<marquee>` replaced with a CSS animation | The element is obsolete; the replacement also pauses on hover and respects `prefers-reduced-motion` |
| Mobile layout fixed | The original overflows horizontally and clips its own content on a phone |
| Visitor counter is a fixed number in `src/data/footer.json` | The original reads `countapi.xyz`, which has shut down — the live site has been showing a frozen number for some time |
| Retired slides and commented-out sections dropped | 77 of the original's 151 slides, plus the MOU, incubation-centre and countdown blocks, were commented out and did not render |
| Google Analytics not carried over | The original's tracking ID should be re-added deliberately, not inherited |
| PDF links go straight to the file | The old `#!pdf/…` route embedded PDFs through Google's `gview`, which is deprecated. Browsers display PDFs natively, so 467 of these links now point at the PDF itself — one less external dependency |
| Photo-gallery links point at the Events page | The old `#!gallery/…` viewer embedded **Photobucket over `http://`** — dead as a service, and blocked as mixed content on an HTTPS page, so it is already broken on the live site. 22 such links were repointed at Events, which has working Google Photos album links |
| Angular directives removed | `ng-show="1"` and friends are inert without Angular; the one `ng-include` (the shared fee table) is inlined |

### Search boxes restored

The original site put a search box on **14** of its views. The previous rebuild
carried it over to only five, so nine listings lost theirs. All of them are back,
with the original's own placeholder wording taken from `reference/views/*.html`:

| Page | Placeholder |
| --- | --- |
| `/faculty` | Search Faculty |
| `/admin` | Search Administrator |
| `/adminstaff` | Search Admin Support Staff |
| `/dept_head` | Search Head of Department |
| `/technical` | Search Technical |
| `/professional` | Search Professional Support Staff |
| `/FacInCharge` | Search Fac-In-Charge |
| `/events` | Search Events |
| `/media` | *(none — the original's input had no placeholder)* |
| `/students`, `/executivemtech`, `/imtechStudents`, `/emtechStudents` | Search Students Across Batch |
| `/researchScholar` | Search Research Scholar Across Batch |

On the student and scholar rolls the filter runs over **every batch at once**, as
the original's did — that is what "Across Batch" means, and why a name matches on
whichever tab it lives in rather than only the one on screen.

`/news` and `/career` also have a search box. The original had none on either;
they were added by the previous rebuild and are kept, because 210 news items and
25 openings are worth filtering.

Facilities (`/campus/*`), Tenders and Placement have no search box, because the
original had none there either.

### Two behaviours preserved on purpose, though both look like bugs

Both were inherited from the previous build and are left exactly as they were,
because changing either alters what visitors see and that is the institute's
call, not a refactor's:

- **No menu item is ever highlighted except Home.** The current path is compared
  against the menu links with its trailing slash still on (`/academics/` vs
  `/academics`), so nothing else matches. `build/model.mjs`'s `navModel()`
  explains how to switch real highlighting on.
- **`.banner-link` has no effect.** The rule is written next to the page banner
  but the only element using it — the Faculty page's "TA Duty List" link — sits
  in a slot belonging to a different component, so the scoped rule never
  matched it. It is left out of `global.css` rather than switched on for the
  first time.

### Worth addressing next

- **Total size is 2.4 GB**, essentially all of it in `public/data/` — the
  institute's accumulated PDFs and photos, copied at original quality.
  `deploy.sh` uses `rsync --checksum`, so only changed files go over the wire
  after the first upload, but the server needs the space.
- **Image weight on the homepage.** First load is 20.9 MB because the source
  images are unoptimised — `public/data/images/home/virtual_tour1_2026.gif`
  alone is 36 MB. Re-encoding the largest files would bring the homepage under
  ~3 MB with no visible change. This is the single highest-value follow-up.
- **21 references remain broken, every one of them broken upstream.** Each was
  requested from the live server and returned 404. 13 are PDFs (recruitment
  notices, exam notices, results), 3 are images, and 4 are dead routes the old
  site also failed to serve: `/campus/overview`, `/gender`, `/facr2019/` and one
  gallery link. Separately, six views referenced by routes (`congratulations`,
  `gender`, `recruitment_staff`, `recruitment_faculty`,
  `recruitment_faculty_hr_eng`, `recruitment_faculty_mathematics`) are 404
  upstream, so those routes are not built. The institute needs to supply the
  originals.
- **Tenders with `status: 0` are hidden**, exactly as on the old site, whose
  filter only matched 1 (live), 2 (closed) and 3 (cancelled). 15 of the 48
  tenders carry status 0 and therefore appear nowhere. Worth a look — they may
  simply need re-labelling as closed.

## Verification tooling

In `tools/`. None of it is part of the build.

| Script | What it does |
| --- | --- |
| `diff-dist.mjs` | Compares every built page against `reference-dist/`, a frozen copy of a previous build, ignoring differences that are expected by design. That folder holds the last verified output of this build. It began as the Astro output — the contract the rewrite was checked against — and was refreshed after the search boxes were restored, since that change was deliberate and verified page by page. It is untracked; to make a fresh baseline before a risky change, build and copy `dist/**/*.html` into it |
| `smoke.mjs` | Drives headless Chrome through 12 interaction cases — drawer, tabs, search, slider, carousel, popup, marquee, homepage random picks |
| `shoot.mjs` | Screenshots a list of pages from two builds at 1440px and 390px and compares the PNGs. `HIDE_GIFS=1` hides the animated NEW badges, which otherwise make a page differ from a second screenshot of itself |
| `measure.mjs` | Reports the rendered geometry and computed styles of chosen elements in two builds — for tracing a visual difference to the rule causing it |
| `gen-schema.mjs` | Regenerates `src/data/_schema/` from the data. Run it after adding a new field to a data file |
| `yaml-to-json.mjs` | The one-off YAML→JSON conversion. Kept for provenance; the YAML is gone |

The last full run: 252/252 pages structurally identical to the previous build,
25/26 screenshots pixel-identical (the 26th is the homepage, which is not stable
against itself because of 21 MB of images racing the screenshot timeout — its
layout was checked with `measure.mjs` instead and matches to the sub-pixel), and
12/12 interaction cases passing on both builds.

## Where the content came from

`../tools/extract.mjs` and `../tools/extract2.mjs` are the one-off scripts that
pulled the slider, news list, faculty, publications and events out of the legacy
`app.js` and `home.ctrl.js`. They are kept for provenance and are not part of
the build. They read from `../reference/`, a mirror of the old site — its 102
views, the controllers and `app.js` — which is still on disk and is the thing to
consult when a question of "what did the original actually do here?" comes up.

Content is now maintained in `src/data/`, so re-running them would overwrite
edits — they are for reference, not for repeat use.
