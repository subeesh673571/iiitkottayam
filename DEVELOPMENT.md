# Development guide

Technical reference for the IIIT Kottayam website rebuild. For content editing,
see [EDITING.md](./EDITING.md), which is written for a non-developer. For a
short project overview, see [README.md](./README.md).

---

## 1. Stack and rationale

| | |
| --- | --- |
| Framework | None |
| Build | `build.mjs` + 3 files in `build/`, Node standard library only |
| Templating | `.html` files with `{{ }}` tags, rendered by `build/template.mjs` |
| Data | JSON, with generated JSON Schemas for editor support |
| Styling | One hand-written stylesheet, no CSS framework |
| Client JS | ~200 lines total, hand-written, no libraries, one file per behaviour |
| Dependencies | **Zero.** `package.json` has an empty `dependencies` |
| Output | Plain HTML/CSS/JS in `dist/`, served by nginx |

The site it replaces was an **AngularJS 1.x SPA** (EOL December 2021) on
**Materialize CSS 1.x** (archived): 102 view partials under `/views/`, a 128 KB
`app.js` holding routing *and* content, and hash routing (`#!/faculty`).

Four constraints shaped this rebuild:

1. **Hosting must not change.** The institute serves static files from nginx.
   No database, no PHP, no server runtime.
2. **Content must leave the markup.** A non-developer maintains the site, so
   anything that changes routinely lives in JSON or a text file.
3. **Rendering must match the original.** `src/styles/global.css` re-implements
   only the Materialize subset the site actually used, *keeping the original
   class names*, so legacy markup renders unchanged.
4. **The source must be readable end to end.** No framework, no bundler, no
   plugin chain. The whole build is a few hundred lines you can sit and read,
   and it will still run in five years without a dependency audit.

> **History.** An earlier version of this rebuild used Astro 5 with YAML data.
> It produced the same static output, and this build was verified page by page
> against it (§9). Astro was dropped for constraint 4, and YAML for JSON because
> that is what the maintainer knows. Anything below marked *(from the Astro
> build)* is a lesson carried over, not a live description.

---

## 2. Getting started

Requires Node.js 20.3+ (or 18.20.8+ / 22+). There is nothing to install.

```bash
npm start                # dev server, http://localhost:4321, rebuilds on save
```

| Command | Purpose |
| --- | --- |
| `npm start` / `npm run dev` | Dev server; rebuilds on save, refresh to see it |
| `npm run check` | Validate JSON + referenced assets (see §9) |
| `npm run build` | Runs `check`, then builds to `dist/` |
| `npm run preview` | Same server, for looking at what will ship |
| `npm run check:links` | Audit every internal reference in `dist/` (see §9) |

`build` depends on `check`, so a JSON syntax error fails the build rather than
shipping a broken page. A full build takes about 0.5s.

---

## 3. How a page is produced

```
src/data/*.json ─┐
                 ├─► build/model.mjs ──► src/templates/<kind>.html ──┐
src/content/**  ─┘      (page model)         (page body)             │
                                                                     ▼
                                       src/partials/base.html ──► dist/<route>/index.html
                                            (shared chrome)
```

`build.mjs` walks a list of routes. For each one it builds a plain JavaScript
object — the page model — renders a template with it, and wraps the result in
`base.html`. `emit(path, page)` is the single function that writes a page; every
route type goes through it, so the chrome, the `<title>` and the script list are
decided in exactly one place.

Nothing runs on the server. Every route is a static `index.html`.

### The template language

`build/template.mjs`, about 180 lines. Five tags, and no more:

| Tag | Does |
| --- | --- |
| `{{ name }}` | insert a value, HTML-escaped |
| `{{{ name }}}` | insert raw HTML — page bodies, and pre-built attribute strings |
| `{{# if x }}…{{ else }}…{{/ if }}` | conditional; `[]` and `""` count as false |
| `{{# each xs }}…{{/ each }}` | loop; `{{ this }}`, `{{ @index }}`, `{{ @first }}`, `{{ @last }}` |
| `{{> partial }}` | include `src/partials/<partial>.html` |

Names are dotted paths (`contact.email`), and `../` steps out of a loop into the
enclosing scope.

This is deliberately too weak to hold logic. Anything it cannot express is
computed first, in `build/model.mjs`. That split is the point: templates stay
skimmable, and every decision the site makes is in one JavaScript file.

> The renderer builds a **fresh regex per call** because `run()` recurses; a
> shared `RegExp` with a `lastIndex` would be clobbered by the inner call and
> silently drop output. Likewise `{{ iframe }}` must not parse as the `if`
> keyword — hence the `\b` in the tag pattern. Both are covered by the checks
> in §9.

---

## 4. Route map

252 pages, produced by 10 templates:

| Pages | Template | Source of truth |
| ---: | --- | --- |
| 117 | `page.html` | `data/faculty_pages.json` + `content/faculty/*.html` |
| 74 | `page.html` | `data/pages.json` + `content/pages/*.html` |
| 33 | `batch.html` | `data/{btech,mtech,imtech,emtech}_students.json`, `research_scholars.json` |
| 8 | `campus.html` | `content/campus/*.html` |
| 7 | `people.html` | `data/faculty_full.json`, `administration.json`, … |
| 7 | `tenders.html` | `data/tenders.json` |
| 6 | `index`, `news`, `career`, `placement`, `media` (×2) | one data file each |

Each group is built by a `buildX()` function in `build.mjs`, in the same order.

### URL naming

Routes deliberately keep the **legacy names** — `/btech_cs_home`,
`/researchScholar`, `/campus/hostel` — rather than tidier slugs. With ~40,000
cross-links inside the migrated content, matching the old names means
`#!foo → /foo` is a mechanical rewrite with no translation table and no broken
links. Do not "clean these up" without a redirect map.

Two compatibility details:

- Tender tabs are emitted at both `/tenders/liveTenders` and
  `/tenders/livetenders`; both spellings appear in the legacy markup.
- Batch pages are emitted for the base path *and* every tab
  (`/students`, `/students/batch19`, …), so deep links keep working.

---

## 5. The data layer — `build/model.mjs`

### `data(name)`

Reads `src/data/<name>.json`, strips the two editor-facing keys (`$schema` and
`_help`), and unwraps `{ items: [...] }` back to a plain array. Results are
cached, so a file read once during a build is not re-read for the next of 252
pages.

Every data file is an object, never a bare array, so that `_help` has somewhere
to live. List files put their content under `items`; keyed files (`site`,
`home`, `footer`, the student rolls) use named keys directly.

> **`contentKeys(object)`, not `Object.keys(object)`.** The student rolls are
> keyed by batch (`b15`, `b16`, …) and now carry a `_help` key alongside. Any
> code iterating those keys must skip the ones starting with `_`, or the site
> grows a "Batch _help" tab.

### `fixLink(href)`

Normalises the legacy URL forms found in migrated data:

| Input | Output | Why |
| --- | --- | --- |
| `#!/faculty`, `#!faculty` | `/faculty` | AngularJS hash route |
| `data/pdf/x.pdf` | `/data/pdf/x.pdf` | root-relative asset |
| `#!pdf/home/Webinar21/Webinar` | `/data/pdf/Webinar21.pdf` | see below |
| `https://…`, `mailto:`, `/…` | unchanged | already absolute |

The `#!pdf/<section>/<file>/<heading>` form was a viewer route that embedded the
PDF through Google's `gview`, now deprecated. Browsers render PDFs natively, so
these resolve straight to the file — 467 links were converted this way.

### The rest

`navModel`, `footerModel`, `banner`, `personModel`, `mediaModel`, `batchLabel`
and `chunk` are the per-shape transforms. They exist so the templates can be
dumb: `personModel` alone flattens designation (string *or* list), phone
(string *or* list), two "additional charge" fields, a trailing-space-infested
photo name, and builds the lower-cased string the search box matches against.

---

## 6. Content model

Two kinds, chosen per content shape:

| Kind | Location | Used for |
| --- | --- | --- |
| **JSON** | `src/data/*.json` (29 files) | Anything repeating: menus, staff, news, tenders, events |
| **HTML** | `src/content/{pages,faculty,campus,home}/` (203 files) | Prose pages migrated from the legacy views |

The HTML bodies are injected with `{{{ }}}`. They are stored as HTML rather than
Markdown on purpose: they contain tables, nested layout and inline styles that
Markdown would mangle. The three homepage prose blocks were Markdown under the
Astro build and are now HTML too — that removed the last reason to have a
Markdown parser in the build at all. Their headings live in `home.json` under
`headings`.

### JSON Schemas

`src/data/_schema/*.json`, generated by `tools/gen-schema.mjs` from the data
itself. Each data file names its own schema with a `$schema` key, and
`.vscode/settings.json` maps them as a fallback.

Two deliberate choices in the generator:

- **`additionalProperties: false`** — an unknown key is nearly always a typo, and
  this is what makes the editor underline it.
- **Nothing is `required`.** A field that every current entry happens to carry is
  not necessarily compulsory; flagging a new entry that omits an optional field
  would be wrong and off-putting.

Re-run `node tools/gen-schema.mjs` after adding a genuinely new field, or the
editor will flag it as a typo. Field descriptions live in the `DESCRIPTIONS` map
in that script, not in the generated files, which are overwritten.

### Adding a page type

- **A new static page** — add the HTML to `src/content/pages/<slug>.html` and an
  entry to `src/data/pages.json`. `buildBodies()` picks it up automatically, and
  `npm run check` fails if one exists without the other.
- **A new list page** — add the JSON, a template in `src/templates/`, and a
  `buildX()` in `build.mjs` that calls `emit()`. Follow `buildNews()` for a flat
  list or `buildPeople()` for a parameterised family.
- **A new nav entry** — `src/data/nav.json` only; `nav.html` and `sidenav.html`
  both render from `navModel()`, so desktop and mobile stay in sync.

---

## 7. Styling — `src/styles/global.css`

One stylesheet, no preprocessor, copied to `dist/styles/site.css` at build time.
Sections in order:

1. **Design tokens** (`:root`) — the institute's palette, lifted from the
   original: green `rgb(56,178,71)`, blue `rgb(66,133,244)`, deep blue
   `rgb(8,55,97)`, page background `#f7f7f7`, Trebuchet MS.
2. **Reset and base type** — including Materialize's heading scale, which the
   migrated markup was written against.
3. **Grid** — Materialize's 12-column float grid (`.row`, `.col.s*/m*/l*`) at its
   original breakpoints: small ≤600, medium 601–992, large ≥993.
4. **Component styles** — nav, dropdown, side-nav, cards, slider, footer.
5. **Materialize pieces used only by interior pages** — ported verbatim.
6. **Page-specific blocks** — staff cards, tabs, tour strip.
7. **Component styles** — the block at the end, described below.

### The de-scoped component block

Under the Astro build each component carried its own `<style>`, which the
compiler scoped by adding a `data-astro-cid-*` attribute to both the selector
and the elements. Those rules are now in one block at the end of `global.css`,
and scoping is gone. Three consequences were dealt with explicitly, and the
comment at the top of the block says so:

- **`.btn-flat` was defined twice**, differently, by the media card and the
  events carousel. Both survive, nested as `.media-card .btn-flat` and
  `.events-card .btn-flat` so they cannot reach each other.
- **`.recruiterLogo` must stay `.recruiter .recruiterLogo`.** The placement
  page's own `<style>` sets `max-width: 150px` on that class further down the
  document. The scoped rule used to win on specificity; a bare `.recruiterLogo`
  would lose on source order and shrink every recruiter logo. This was caught by
  the screenshot comparison, not by reading the code — see §9.
- **`.banner-link` is deliberately absent.** It was declared beside the page
  banner, but the only element using it — the Faculty page's "TA Duty List" link
  — is passed in from the calling page and therefore never carried the banner's
  scope attribute. The rule never applied. Adding it now would be a visible
  change, so it was left out.

> **The general rule.** When moving a scoped rule to global CSS, remember it
> used to carry one extra attribute selector's worth of specificity. If the same
> class is also styled inside a page body's `<style>`, the global version can now
> lose on source order. This finds every such case:
>
> ```bash
> node -e '
> const fs=require("fs"),path=require("path");
> const body=new Map();
> (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
>  const f=path.join(d,e.name);
>  if(e.isDirectory())walk(f);
>  else if(e.name.endsWith(".html"))
>   for(const m of fs.readFileSync(f,"utf8").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
>    for(const c of m[1].matchAll(/\.([A-Za-z][\w-]*)/g))
>     body.set(c[1],(body.get(c[1])||new Set()).add(path.relative("src/content",f)));
> }})("src/content");
> const css=fs.readFileSync("src/styles/global.css","utf8");
> const block=css.slice(css.indexOf("Component styles"));
> for(const m of new Set([...block.matchAll(/(^|[\s,>])\.([A-Za-z][\w-]*)/gm)].map(m=>m[2])))
>  if(body.has(m)) console.log(" ."+m, [...body.get(m)].slice(0,3).join(", "));'
> ```
>
> It currently reports `.card-content` (already two classes deep, so it wins) and
> `.recruiterLogo` (fixed above).

### The Materialize port

The legacy pages were written against *full* Materialize (141 KB). This
stylesheet reimplements only what is actually used, keeping the original
selectors. If a migrated page looks wrong, the first thing to check is whether
it uses a Materialize class that was never ported:

```bash
# classes used in migrated content but defined nowhere
node -e '
const fs=require("fs"),path=require("path");
const css=fs.readFileSync("src/styles/global.css","utf8");
const defined=new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m=>m[1]));
const used=new Map();
(function walk(d){for(const e of fs.readdirSync(d)){const p=path.join(d,e);
 if(fs.statSync(p).isDirectory())walk(p);
 else if(p.endsWith(".html")){const t=fs.readFileSync(p,"utf8");
  const local=new Set([...(t.match(/<style[\s\S]*?<\/style>/g)||[]).join("").matchAll(/\.([A-Za-z][\w-]*)/g)].map(m=>m[1]));
  for(const m of t.matchAll(/class="([^"]*)"/g))for(const c of m[1].split(/\s+/))
   if(c&&!defined.has(c)&&!local.has(c))used.set(c,(used.get(c)||0)+1);}}})("src/content");
console.log([...used].sort((a,b)=>b[1]-a[1]).slice(0,25));'
```

Anything this reports should be checked against the original
`materialize.min.css` before being added — many leftovers are **Bootstrap**
classes (`.col-sm-6`, `.panel-body`, `.img-responsive`) that the original site
never loaded either, so they were unstyled there too and are not regressions.

### Inline `<style>` in migrated pages

Each migrated body carries the `<style>` block from its legacy view. Injected
raw, those rules apply to the **whole document** for that page, just as they did
in the SPA. Consequences to be aware of:

- ~40 pages declare `.material-icons { float: left }`. This does *not* affect the
  nav arrows — `nav i.right` wins on specificity. Verified.
- 3 pages set `body { background }` (`/collaboration`, `/mtech_home`,
  `/convocation_2025`). Faithful to the original.
- `/magazine` sets `#myHeader`, `#mobile-head` and `footer` to `display:none`
  and `html,body { overflow-y:hidden }`. It is a full-screen magazine reader and
  the live original behaves identically — **this is intended, not a bug.**

If you ever need to sandbox these, scope them at conversion time rather than
patching 200 files by hand.

---

## 8. Client-side JavaScript

Deliberately small and dependency-free. One file per behaviour in `public/js/`,
loaded with `<script defer>` by the pages that need it. `emit()` puts `nav.js`
and `sidenav.js` on every page; anything else is listed in that route's
`scripts` array.

| Behaviour | File | On |
| --- | --- | --- |
| Sticky nav on scroll | `nav.js` | every page |
| Mobile drawer + accordions | `sidenav.js` | every page |
| Banner slider, 8s, lazy image loading | `slider.js` | homepage |
| Events carousel, 4s | `carousel.js` | homepage |
| Ticker distance measurement | `marquee.js` | homepage |
| Arrival popup | `popup.js` | homepage |
| Random 3 faculty / publications | `home.js` | homepage |
| Card search filter | `search.js` | the 14 listings that carry a search box (see README) |
| Tab switching | `tabs.js` | student rolls, tenders |

Conventions: all timers pause on hover and on `visibilitychange`; anything
animated respects `prefers-reduced-motion`; nothing requires JS to read the
content.

`search.js` hides anything carrying `data-searchable` that does not match, and
shows `#no-results` when nothing does. On the student rolls the markers sit on
each individual `<li>`, and the filter deliberately runs across every batch
panel at once — including the ones the tab strip is currently hiding — because
that is what the original's "Search Students Across Batch" did.

`tabs.js` finds its strip with `querySelector('#batch-tabs, #tender-tabs')`. Those
two IDs are what the previous build emitted and the markup was kept identical,
so a new tabbed page needs its ID added there.

### Slider image loading

The banner holds 74 slides, all inside the viewport, so `loading="lazy"` would
not defer anything. Only the first two carry a real `src`; the rest use
`data-src` and are swapped in one slide ahead. This is what cuts first load from
98 MB to 21 MB — do not "simplify" it back to plain `src`.

---

## 9. Verification

### `npm run check` — content

`scripts/check-content.mjs`. Two severities, deliberately:

- **error** — invalid JSON, or a page listed in `pages.json` with no body file.
  Fails the build.
- **warning** — a referenced image or PDF is absent. Does *not* fail, because
  such files were already missing upstream and must not block publishing.

Messages are written for a non-technical reader. `JSON.parse` reports a
character offset, which means nothing to someone looking at a text editor, so
`place()` converts it to a line and column and `explain()` translates V8's
wording into the mistake that actually caused it.

### `npm run check:links` — references

`scripts/check-links.mjs` walks `dist/` and resolves every `href`, `src` and CSS
`url()` against the built routes and files. Current state:

```
pages       : 252
references  : 42571
resolve     : 42543 (99.93%)
broken      : 28 across 20 distinct targets
```

All 28 return 404 on the live site too — each was requested from the live server
to confirm. The script has a `BASELINE = 28` and exits non-zero above it, so a
*new* broken reference fails while the known-upstream ones do not. Adjust the
constant deliberately when files are supplied — never to make the check pass.

Two parsing rules the checker depends on, both learned the hard way:

> **Decode HTML entities before splitting on `#`.** A file name containing
> `&#38;` holds a literal `#`; splitting first truncates the path and invents
> four phantom failures.

> **Resolve relative references against the page's own route.** The legacy
> markup used `./data/x`, `data/x` and even `data\pdf\x` freely, because hash
> routing kept the browser at `/`. As real page paths they resolve *under the
> route* — `/IDY/data/images/...` — and 404. An early version of this checker
> skipped anything not starting with `/` and therefore reported 99.95% while 186
> references were silently broken.

### `tools/diff-dist.mjs` — page-by-page comparison

The gate used to replace the Astro build, and the thing to reach for before any
change that should be invisible. It compares every page in `dist/` against
`reference-dist/`, a frozen copy of a known-good build, after normalising four
differences that are expected by design: the `data-astro-cid-*` attributes, the
stylesheet filename, `<script>`/`<style>` blocks (inline and bundled on one side,
external files on the other) and whitespace between tags. It also canonicalises
entity spellings, because `&amp;`, `&#38;` and a bare `&` are the same character
and the two builds each pick a different one in different places.

To use it against a future change: build, copy `dist/**/*.html` to
`reference-dist/`, make the change, build again, run the script.

The baseline was refreshed once, after the nine missing search boxes were
restored: 40 pages changed, each verified to differ *only* by the search input,
its `data-searchable` markers and the "no matching names" block, with the other
212 byte-identical. Refresh it the same way — deliberately, and only once the
diff has been read.

### `tools/smoke.mjs` — behaviour

12 cases driven through headless Chrome: the drawer opens and closes, a drawer
section expands, the nav pins and releases on scroll, the slider advances and
loads the next image, the carousel starts on the first item, the marquee
measures a non-zero travel, the popup appears and closes, the homepage shows
exactly three faculty and three publications, the faculty search hides all 176
cards and restores them, and both tab strips switch panels. Plus a check that no
page raised a JS error.

### `tools/shoot.mjs` — pixels

Screenshots 13 pages from two builds at 1440px and 390px and compares the PNGs.
Two things it has to do, or the comparison is worthless:

> **Seed `Math.random`, do not stub it.** The homepage picks three distinct cards
> with `while (chosen.size < 3)`. A `Math.random` that always returns the same
> number makes that loop spin forever and Chrome never produces a screenshot.

> **Chrome must be asked asynchronously.** The pages are served from the same
> Node process; a synchronous spawn blocks the event loop, so the server never
> answers the request Chrome is waiting on and the shot times out. Each Chrome
> also needs its own `--user-data-dir`.

**Animated GIFs make some pages non-comparable.** The NEW badges are animated,
and Chrome samples whatever frame it lands on, so `/rti`, `/tenders` and the
homepage do not match a *second screenshot of themselves*. `HIDE_GIFS=1` hides
them and those pages then compare exactly. The homepage remains unstable even so
— 21 MB of images racing the screenshot timeout — so its layout is checked with
`measure.mjs` instead.

### `tools/measure.mjs` — geometry

Reports the rendered box, computed width/height/padding and `max-width` of any
selector in two builds side by side. This is what turns "the placement page looks
slightly off" into "`max-width` is `150px` here and `100%` there", and what
verifies the homepage where screenshots cannot. The nav item widths at 1440px
must be `61, 91, 80, 102, 104, 94, 108, 127, 113, 96, 151, 79`.

---

## 10. Migration from the legacy site

One-off scripts in `../tools/`, kept for provenance. They are **not** part of
the build and must not be re-run — content is now maintained in `src/data/`, and
re-running would overwrite edits.

| Script | Did |
| --- | --- |
| `extract.mjs` | Slider slides + homepage news out of `home.ctrl.js` |
| `extract2.mjs` | Faculty, publications, events carousel |
| `extract-data.mjs` | All remaining controller arrays → 18 data files |
| `convert-pages.mjs` | 74 static views → HTML bodies + the page list |
| `site/tools/yaml-to-json.mjs` | The later YAML→JSON conversion |

They read `../reference/`, a mirror of the old site — its 102 views, the
controllers, `app.js`, `routes.json` and the original stylesheets. **It is still
on disk**, and it is the authority whenever a question of "what did the original
actually do here?" comes up. If it is ever lost, recreate it with:

```bash
mkdir -p reference/{views,scripts,controllers,styles}
B=https://www.iiitkottayam.ac.in
curl -s "$B/" -o reference/index.html
curl -s "$B/views/home.html" -o reference/views/home.html
curl -s "$B/scripts/app.js" -o reference/scripts/app.js
curl -s "$B/scripts/controllers/home.ctrl.js" -o reference/controllers/home.ctrl.js
curl -s "$B/styles/materialize.min.css" -o reference/styles/materialize.min.css
```

### Transformations applied to migrated markup

- HTML comments stripped — they held retired content that never rendered
  (77 of the original's 151 slides were commented out).
- `ng-show="1"` removed (always true); other `ng-*` attributes stripped as inert.
- `ng-src` / `ng-href` → `src` / `href`.
- `#!route` → `/route`; `data/…` → `/data/…`, including inside CSS `url()`.
- The single `ng-include` (a shared fee table) inlined.
- `#!gallery/…` links repointed to `/events` — the viewer embedded Photobucket
  over `http://`, dead as a service and blocked as mixed content on HTTPS.

---

## 11. Gotchas

Real failures hit during this build. Each cost time; none are obvious.

**Whitespace in a template has width.** Writing

```html
<a>{{ label }}
  {{{ arrow }}}</a>
```

renders a real space, widening every nav item ~5px and wrapping the menu to two
lines. Keep the label and the arrow on one line — `nav.html` carries a comment
saying so. Conversely, the dropdown children *do* have spaces inside their
`<a>`, because the previous build emitted them; `diff-dist.mjs` will tell you if
you remove one.

**`nav ul a` is `font-weight: normal`.** The original declares `bold` and then
overrides it with `font-weight: normal !important` in an earlier rule. Bold
widens the menu enough to wrap. Item widths must be
`61, 91, 80, 102, 104, 94, 108, 127, 113, 96, 151, 79` at 1440px.

**Do not escape `'`.** Every attribute the templates write is double-quoted, so
an apostrophe needs no escaping — and escaping it rewrites
`style="background:url('…')"` into `url(&#39;…&#39;)`. The browser copes, but
every tool that reads URLs out of the markup, `check-links.mjs` included, stops
seeing them.

**Optional attributes must be built, not templated.** `width={undefined}` used to
drop the attribute entirely. `width="{{ width }}"` prints `width=""` instead,
which is not the same thing. Where the original omitted an attribute, the model
assembles the whole string (`sizeAttrs`, `attrs`, `target`) and the template
inserts it raw.

**Attribute order is not free if you are diffing.** The three tab strips emit
`href class data-tab`, `href data-tab class` and `href class target` — three
different orders, inherited. `tab-strip.html` therefore takes one pre-built
`attrs` string rather than separate fields. Nothing renders differently; it just
keeps the comparison honest.

**Check a page against the original view, not against the previous build.**
Nine listings were missing the search box the original site had, because the
previous rebuild had dropped it and every later check compared against *that*.
The legacy views are the authority, and they name the feature plainly:

```bash
# every original view with a search box, and its placeholder
for f in ../reference/views/*.html; do
  grep -qiE 'ng-model="[^"]*search' "$f" &&
    printf '%-28s %s\n' "$(basename "$f" .html)" \
      "$(grep -oiE 'placeholder="[^"]*"' "$f" | head -1)"
done
```

The same trap applies to anything else the original did: `diff-dist.mjs` proves
this build matches the *previous* build, which is a different claim from
matching the original.

**Grid items default to `min-width: auto`.** A wide `<pre>` or table inside a
grid child stretches the page sideways. Set `min-width: 0` on the child.

**Legacy data carries trailing whitespace.** Several `photo` values end in a
space, which 404s the image. `personModel()` trims defensively; do the same in
any new model reading legacy fields.

**The whole page body sits in one 80%-wide framed `.row`.** The homepage's
floated panels depend on it — the tall Welcome column is what pushes the
placement figures and lab logos down the right-hand side. Removing the wrapper
silently changes the layout.

**`status: 0` tenders render nowhere.** The original filter matched only 1/2/3.
15 of 48 tenders carry 0 and are invisible. Reproduced deliberately; flagged in
EDITING.md.

**The active-menu check never matches.** `emit()` passes the path with its
trailing slash on (`/academics/`) while `nav.json` links have none, so only Home
is ever highlighted. That is what the site has been shipping; `navModel()`
documents how to turn real highlighting on, but doing so is a visible change and
belongs to the institute, not to a refactor.

**Injected page bodies are not scoped.** A rule in the component block of
`global.css` styles migrated content too, and a rule inside a migrated page's
own `<style>` styles the chrome. §7 covers the specificity trap this creates.

**Legacy markup uses relative and Windows paths.** `./data/x`, `data\pdf\x.pdf`,
bare `www.example.com`, and bare DOIs (`10.1109/…`) all appear as `href`/`src`
values. Every one resolves under the current route and 404s. `npm run check:links`
catches these; the conversion scripts did not.

---

## 12. Deploying

```bash
npm run build
./deploy.sh user@server:/var/www/iiitkottayam        # add --dry-run first
```

`deploy.sh` rsyncs `dist/` with `--checksum --delete`. Checksum rather than
timestamp matters: `dist/` is **2.4 GB**, almost all of it accumulated PDFs and
images under `public/data/`, so only changed files should cross the wire.

The build itself copies `public/` into `dist/` the same way — file by file, and
only when the size or timestamp differs. A rebuild therefore does not rewrite
2.4 GB, which is what keeps `npm start` usable.

nginx needs no special configuration. Each page is written as `index.html` in
its own folder, so `/placement` is served from `/placement/index.html`:

```nginx
location / {
    try_files $uri $uri/ =404;
}
```

`public/data/…` mirrors the old site's paths exactly, so existing links to PDFs
in search results and old emails keep resolving.

### Highest-value follow-up

First load is 20.9 MB because the source images are unoptimised —
`public/data/images/home/virtual_tour1_2026.gif` alone is 36 MB. Re-encoding the
largest files would bring the homepage under ~3 MB with no visible change. With
no framework in the way this is now a plain matter of re-encoding the files in
`public/data/images/home/` and leaving every path alone.

---

## 13. File reference

```
site/
├── build.mjs               routes, page models, writes dist/
├── build/
│   ├── template.mjs        the {{ }} renderer
│   ├── model.mjs           data loading, link fixing, per-shape transforms
│   └── serve.mjs           dev server for `npm start`
├── deploy.sh               rsync to nginx
├── package.json            no dependencies
├── DEVELOPMENT.md          this file
├── EDITING.md              content editor's handbook
├── README.md               project overview
├── .vscode/settings.json   points the editor at the JSON schemas
├── scripts/
│   ├── check-content.mjs   JSON + asset validation (blocks build)
│   └── check-links.mjs     dist/ reference audit (baseline-gated)
├── tools/                  verification, not part of the build
│   ├── diff-dist.mjs       page-by-page comparison against a frozen build
│   ├── smoke.mjs           12 interaction cases in headless Chrome
│   ├── shoot.mjs           screenshot comparison, two builds
│   ├── measure.mjs         rendered geometry of any selector, two builds
│   ├── gen-schema.mjs      regenerates src/data/_schema/
│   └── yaml-to-json.mjs    the one-off YAML→JSON conversion
├── public/
│   ├── data/               images + PDFs at their original URLs (2.4 GB)
│   ├── js/                 9 client scripts, one per behaviour
│   ├── fonts/              self-hosted Font Awesome, Material Icons, Roboto, Hind
│   └── styles/             font-awesome.min.css
└── src/
    ├── data/               29 JSON files + _schema/
    ├── content/            page bodies: pages/ faculty/ campus/ home/
    ├── partials/           base, masthead, nav, sidenav, footer, page-banner, tab-strip
    ├── templates/          10 page templates
    └── styles/global.css
```
