# Looking after the IIIT Kottayam website

This is the handbook for keeping the website up to date. It assumes you are not
a programmer, and it does not expect you to become one.

Everything you will normally do — posting a notice, adding a staff member,
swapping a PDF, putting up a new banner — is editing a **JSON** file and saving
it. There is no programming involved.

> The same handbook is also a web page, which is easier to read and to send to
> someone: <https://claude.ai/code/artifact/72f3e8f2-2ba2-4d35-adc1-7ea95a4b9bfc>
> Its source is `doc/handbook.html`. If you change one, change the other.

---

## First, the reassuring part

**You cannot break the live website by editing files here.**

The website people visit is a *copy*. The files on this computer are the
original. Changing a file here does nothing to the live site until someone
deliberately uploads the new version. Until then you can experiment freely.

**The computer checks your work before anything is published.** If you make a
typing mistake, a check runs automatically and refuses to publish, telling you
which file and which line to look at. A mistake means "try again", not
"the website is down".

**The only thing you should be careful about** is deleting files from the
`public` folder — that is where every photo and PDF the website has ever used
is stored. Adding is always safe; deleting is the one thing worth pausing over.

---

## Setting up, once

You need two free programs.

1. **Node.js** — go to <https://nodejs.org> and download the version marked
   **LTS**. Install it, accepting all the default options.
2. **Visual Studio Code** — <https://code.visualstudio.com>. Any text editor
   works, but this one understands JSON: it completes the field names for you,
   explains what each one does when you hover over it, and underlines a mistake
   in red the moment you make it. That is worth a lot.

Then open the `site` folder in VS Code. There is nothing to install — the
website is built with nothing but Node.js itself.

---

## The three commands

Open a **terminal** in the `site` folder. In VS Code that is
*Terminal → New Terminal*; it opens in the right place already.

| Command | What it does |
| --- | --- |
| `npm start` | Opens the website on your own computer so you can see your changes |
| `npm run check` | Checks your files for mistakes |
| `npm run build` | Prepares the finished website for uploading |

### Seeing your changes

```
npm start
```

Wait for it to print a web address — `http://localhost:4321` — and open that in
your browser. This is the website running on your own computer. Nobody else can
see it.

Leave that terminal window open while you work. Every time you save a file, the
site rebuilds by itself; refresh the page in the browser to see it. When you are
finished, click the terminal and press **Ctrl+C** to stop it.

### Checking your work

```
npm run check
```

This reads every content file and tells you about two kinds of problem:

- **✗ MUST FIX** — a file has a typing mistake and the website cannot be built
  until it is corrected. The message gives you the file name, the line and the
  character.
- **! worth a look** — something points at a photo or PDF that is not there.
  The website still works; that one link just will not open. Some of these were
  already missing on the old website, so they may need to be requested from the
  office rather than fixed here.

### Publishing

```
npm run build
```

This runs the check first, and stops if there is anything that must be fixed.
When it succeeds it creates a folder called `dist` — that folder *is* the
website. Hand it to whoever manages the server, or ask them to run `deploy.sh`.

---

## Where everything lives

Two folders matter. Everything else you can ignore.

### `src/data` — the lists

Files ending in `.json`. These hold anything that appears as a list: menus,
news, staff, tenders, events.

| What you want to change | File |
| --- | --- |
| The menu across the top | `nav.json` |
| The footer links at the bottom | `footer.json` |
| Logo, popup, institute name | `site.json` |
| Homepage banner slideshow | `slides.json` |
| Homepage — scrolling red notice, lab logos, virtual tours | `home.json` |
| "Latest News" box on the homepage | `news.json` |
| "Meet the Faculty" panel on the homepage | `faculty.json` |
| "Research Publication" panel on the homepage | `publications.json` |
| The full News page | `news_full.json` |
| Events box on the homepage | `events.json` |
| The full Events page | `events_full.json` |
| Faculty | `faculty_full.json` |
| Administration | `administration.json` |
| Administrative Staff | `adminstaff.json` |
| Head of Department | `dept_head.json` |
| Technical Staff | `technical.json` |
| Professional Support Staff | `professional.json` |
| Faculty In-Charge | `faculty_incharge.json` |
| B.Tech students | `btech_students.json` |
| M.Tech / iM.Tech / e-M.Tech students | `mtech_students.json`, `imtech_students.json`, `emtech_students.json` |
| Research Scholars | `research_scholars.json` |
| Tenders | `tenders.json` |
| Career / job openings | `careers.json` |
| Recruiters on the Placement page | `recruiters.json` |
| Press coverage (@Media) | `media.json` |
| Titles of the ordinary pages | `pages.json` |
| Titles of the staff profile pages | `faculty_pages.json` |

Ignore the `_schema` folder inside `src/data`. That is what tells VS Code how to
help you, and it is generated — there is nothing in it to edit.

### `src/content` — the written pages

| Folder | Holds |
| --- | --- |
| `content/home/` | The Welcome, Vision and Mission paragraphs |
| `content/pages/` | The wording of ordinary pages — RTI, Academics, Scholarship… |
| `content/faculty/` | Each staff member's own profile page |
| `content/campus/` | The Hostel, Sports, Medical and other facilities tabs |

### `public/data` — photos and PDFs

| Put this here | Folder |
| --- | --- |
| Notices, results, tender documents (PDF) | `public/data/pdf/` |
| Homepage and slideshow pictures | `public/data/images/home/` |
| Event photos | `public/data/images/events/` |
| Staff portraits | `public/data/images/` |

---

## What a data file looks like

Every file has the same three parts:

```json
{
  "$schema": "./_schema/news.json",
  "_help": [
    "Newest item at the top.",
    "new: true shows the animated NEW badge"
  ],
  "items": [
    { "text": "UG Admission 2026 Updates", "link": "/admission26", "new": true },
    { "text": "Convocation notice", "link": "/data/pdf/convo.pdf", "new": false }
  ]
}
```

- **`$schema`** — leave it alone. It is what makes VS Code help you.
- **`_help`** — notes to yourself. Read them; the website ignores them. You may
  add to them freely.
- **`items`** — the actual content. This is what you edit.

A few files hold settings rather than a list — `site.json`, `home.json`,
`footer.json` — and those have named sections instead of `items`. The `_help` at
the top of each one explains its sections.

---

## Four rules that prevent almost every mistake

**1. Copy an existing entry, then change it.** Never type a new one from
scratch. The shape is then always right.

**2. Commas between entries, never after the last one.** This is the single
most common JSON mistake:

```json
"items": [
  { "text": "First" },      ← comma, because another entry follows
  { "text": "Second" }      ← NO comma, because this is the last one
]
```

**3. Every piece of text goes in double quotes.** `"like this"`. Numbers
(`170`) and the words `true` and `false` do not.

**4. If the text itself contains a double quote, put a backslash in front of
it:**

```json
"text": "The \"Gyaan\" laboratory"
```

VS Code underlines all four of these in red as you type, and `npm run check`
catches them before anything is published.

---

## How to do the common jobs

### Post a news item

Open `src/data/news_full.json` for the News page, or `src/data/news.json` for
the box on the homepage. **The newest item goes at the top of `items`.** Copy an
entry and edit it:

```json
{
  "text": "Notice regarding the December examination timetable",
  "link": "/data/pdf/exam-timetable-dec.pdf",
  "new": true
}
```

- `text` — the headline people click
- `link` — the PDF you uploaded, or a page such as `/placement`
- `new` — `true` shows the animated **NEW** badge, `false` hides it

To remove an item, delete it from its opening `{` to its closing `}`, and make
sure the commas between the entries that remain are still right.

### Add a photo or a PDF

1. Put the file in the right folder — see the table above. PDFs go in
   `public/data/pdf/`.
2. Refer to it starting with `/data/`, and **leave out the word `public`**:

   > A file saved at `public/data/pdf/notice.pdf`
   > is written in the data file as `"/data/pdf/notice.pdf"`

**Use names without spaces** — `exam-timetable.pdf`, not `exam timetable.pdf`.
Both work, but names without spaces cause far fewer headaches later. Capital
letters matter: `Notice.pdf` and `notice.pdf` are different files.

### Add or update a staff member

Open the right file from the table — `faculty_full.json` for teaching staff.
Copy an existing person and edit:

```json
{
  "name": "Dr. Example Name",
  "designation": "Assistant Professor",
  "photo": "example.jpg",
  "area": ["Machine Learning", "Computer Vision"],
  "contact": {
    "email": "example at iiitkottayam dot ac.in",
    "phone": "0482-2202100",
    "room": "AC 301"
  }
}
```

Upload the portrait to `public/data/images/` first. Here `photo` is just the
file name, with no folder in front of it.

Email addresses are written as **`name at iiitkottayam dot ac.in`** on purpose —
it is how the site stops spam robots collecting them. Keep that style.

To remove someone, delete their whole entry, from `{` to `}`.

### Change the homepage slideshow

Open `src/data/slides.json`. The top entry appears first.

```json
{
  "image": "/data/images/home/convocation-2027.jpg",
  "caption": "8th Convocation",
  "link": ""
}
```

Use a **wide** picture, roughly 1150 × 400 pixels. A tall photo will be cropped
top and bottom. Leave `"caption": ""` for a slide with no text over it, and
`"link": ""` if clicking it should do nothing.

### Update a tender

Open `src/data/tenders.json`. The `status` number decides which tab it shows
under:

| status | Appears under |
| --- | --- |
| 1 | Live Tenders |
| 2 | Closed Tenders |
| 3 | Cancelled Tenders |

⚠️ **`"status": 0` shows nowhere at all.** 15 tenders currently have status 0
and are invisible on the site. The old website behaved the same way, so this is
not new — but if one of those should be visible, change its number to 1, 2 or 3.

### Add a new student batch

Open the matching students file. Each batch is a short key followed by the
names. Copy the newest block and change the key:

```json
"b27": [
  "First Student",
  "Second Student"
]
```

The tab label is worked out from the key, so `b27` becomes "2027 Batch"
automatically.

### Change the scrolling red notice

Open `src/data/home.json` and find the `"marquee"` section. To remove the
scrolling notice entirely, leave it as an empty list: `"marquee": []`.

### Change the popup that appears on arrival

Open `src/data/site.json`, find `"popup"`, and change one word to switch it off:

```json
"popup": {
  "enabled": false
}
```

### Change a menu item

Open `src/data/nav.json`. Each menu entry has a `label` (what people see) and
either a `link` or a list of `children` for a drop-down. To reorder the menu,
move a whole entry up or down inside `items`.

### Change the wording on an ordinary page

Pages such as RTI and Academics are files in `src/content/pages/`, named after
the page — `/rti` is `src/content/pages/rti.html`.

These contain tags in angle brackets. **Change the words, leave the tags
alone:**

```html
<li><a href="/data/pdf/PIO-IIITK.pdf">Public Information Officer</a></li>
```

Here you would change `Public Information Officer`, which is what people read,
or `/data/pdf/PIO-IIITK.pdf`, which is the file it opens. Leave `<li>`,
`<a href=` and `</a>` exactly as they are.

To change the title shown in the browser tab, edit `pages.json`.

### Change the Welcome, Vision or Mission text

Open the matching file in `src/content/home/`. They are HTML: each paragraph is
wrapped in `<p>…</p>` and each bullet point in `<li>…</li>`. Change the words
between the tags and leave the tags themselves alone.

The headings above them ("Vision", "Mission") are in `src/data/home.json`, under
`"headings"`.

---

## When something goes wrong

Run `npm run check`. It will name the file and the line.

**"Expected ',' or ']'"** or **"Expected double-quoted property name"** — a
missing comma between two entries, or a comma left after the last one.

**"Unexpected end of JSON input"** — a `{`, `[` or `"` was opened and never
closed. Look at the end of the file, and at the entry you last edited.

**A red squiggle under a field name** — that field is not one this file
supports. Usually a spelling slip: `titel` for `title`. Hover over it to see
what is expected.

**A photo does not appear** — check three things: the file really is in
`public/data/images/`, the spelling matches exactly including capital letters,
and there is no stray space inside the quotes.

**The page looks completely wrong** — you have probably deleted a tag by
accident in one of the `.html` files. Undo your changes (Ctrl+Z) until it looks
right again.

**If you are truly stuck:** close the file without saving. Nothing you have
done can reach the live website, so abandoning an edit is always safe.

---

## A small glossary

| Word | What it means here |
| --- | --- |
| **Terminal** / command prompt | The window where you type the three commands |
| **JSON** | The kind of file the lists are kept in — the ones ending `.json` |
| **HTML** | The kind of file page wording is kept in — angle-bracket tags |
| **Schema** | The hidden file that teaches VS Code which fields a data file may have |
| **Build** | Turning your text files into the finished website |
| **Deploy** / publish | Uploading the finished website to the server |
| **`dist` folder** | The finished website, created by `npm run build` |
| **`public` folder** | Where every photo and PDF is stored |

---

## Handing over to a developer

Some things are deliberately not in this handbook because they need someone
technical. If you need any of these, `README.md` in this folder is written for
them:

- adding a completely new kind of page
- changing colours, fonts or layout
- adding a brand new field to a data file (the schema has to learn about it)
- uploading the finished site to the server for the first time
- the list of files that were already missing from the old website
