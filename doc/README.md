# doc/

The content editor's handbook, as a web page.

| File | What it is |
| --- | --- |
| `handbook.html` | **The source.** Edit this, then republish it. |

A saved copy of the previous handbook also lived here. It was written against
the YAML data layer and has been deleted, because a document that confidently
explains a format the site no longer uses is worse than no document.



It is private until shared from the share menu on the page itself.

## Keeping it in step

`handbook.html` and [`../site/EDITING.md`](../site/EDITING.md) say the same
things to the same person — one as a web page, one as a file next to the code.
**Change both, or neither.** If they disagree, `EDITING.md` is the one sitting
beside the files being described, so treat it as correct and fix the handbook.

## Design

The page carries its own stylesheet — tokens at the top of the `<style>` block,
a serif body face against sans headings, and a green accent taken from the
institute's own palette. It handles light and dark, and the three coloured
callouts mean specific things:

| Callout | Used for |
| --- | --- |
| green | reassurance — something that cannot go wrong |
| amber | a real trap, but recoverable |
| red | the "must fix" state that blocks publishing |

Keep those meanings. They are the fastest thing on the page to read, and a green
box on a warning would actively mislead.
