# Deck design rules

Rules for anyone (human or AI) who builds or edits a Showship slide template or deck. The deck is shown on a projector to business people, so it has to read like a designer made it: calm, aligned, legible from the back of the room.

Read this before changing `scripts/build_deck.js`, adding a style, or adding a slide type. `DESIGN.md` holds the direction for the `paper` style; these rules apply to every style.

## 1. Nothing leaves its box

- Every piece of text sits inside its shape and inside the 0.7 in side margins. The first and last columns of a row (timeline, table, tracker) are placed from the margin inward, never centred on a point near the edge.
- Size containers from the content, not the other way round. A card with one item is short; do not leave a hollow panel.
- Text never relies on `fit: "shrink"` to survive. PowerPoint applies it only when someone edits the box, and LibreOffice ignores it, so the shrunk text overflows on the machine that matters. Write the limits (below) so text fits at its set size.
- Respect the character limits in `references/templates.md`. `scripts/lint_report.js` enforces them and fails the build input when text is too long. Shorten the sentence; do not shrink the font.
- A title is one line. Eyebrows are short labels, not sentences.

## 2. Legible at presentation size

| Role | Minimum |
|---|---|
| Slide title | 26 pt |
| Big figure | 32 pt |
| Body text, table cells, list items | 12 pt (11 pt only for secondary notes) |
| Labels, tags, chips, footnotes | 11 pt |
| Nothing | below 11 pt |

- Body text contrast is at least 4.5:1 against its background, large text 3:1. Pale grey text on a tinted card fails; use the style's BODY colour.
- Colour never carries meaning alone. Status is colour plus a word.

## 3. Typography

- Two typefaces at most: one for headings and figures, one for body. Both are installed on the machine that opens the file (Poppins and Arial for the default styles; the build warns if a font is missing).
- Sentence case for labels, eyebrows, column heads, chips and status words. No all-caps with wide letter-spacing: it is a template reflex, and it is hard to read.
- A figure is big because it is the point of the slide. One focal figure or one focal sentence per slide; everything else defers to it.
- No em dashes in slide text. Use a comma, colon, period or parentheses.
- No emoji, no decorative symbols in text.

## 4. Colour

- One neutral base, one ink, one accent per slide, plus a state colour (risk = coral or amber, used only for risk).
- A project keeps one colour on every slide. A colour that means "risk" is never also a project colour.
- No default blue-to-purple gradients, glow, neon, or pastel rainbows. A gradient is allowed only when it carries meaning (a ribbon trail that is the brand motif, a progress fill).
- Do not tint every element with the accent. The accent marks the one thing to look at.

## 5. Composition

- Layout comes from the content. A slide that shows one number does not get four cards.
- Never the same layout on two consecutive slides. Alternate dense (table, chart) with sparse (one figure, one sentence).
- Align to a grid: 0.7 in side margins, 11.93 in content width, the same left edge for title, content and footnote.
- Whitespace separates groups. Equal gaps inside a group, larger gaps between groups. Leftover space at the bottom of a slide is fine; a half-empty card is not.
- Prefer rules, figures and type over boxes. A card exists to group content that needs grouping, not to decorate.
- Decoration must be the brand motif (the ship trail) or nothing. No floating circles or blobs, no grid or dot backgrounds, no coloured stripe on a card edge unless it encodes a state.
- Radius, shadow and border follow the style's single setting. A style does not mix pill and square corners, and soft shadows go on at most one level of elevation.
- Icons only when they explain the row. If an icon is the generic glyph for "anything", leave it out.

## 6. Content honesty

- Every number comes from the collected data or the user. No placeholder numbers, no invented percentages, no invented names. If a value is unknown, state the status in words.
- A chart answers a question that the slide title states. A donut with no question is decoration.

## 7. Verify every build (mandatory)

Building is not finishing. After every build, render and check:

```bash
node scripts/lint_report.js <dir>/report.json --audience <business|engineering>   # language and length
node scripts/build_deck.js  <dir>/report.json <dir>/<name>.pptx
node scripts/check_deck.js  <dir>/<name>.pptx --png                                # render + overflow check
```

1. `check_deck.js` must print "All N slides clear". It flags text closer to the slide edge than 0.45 in and text lines that collide.
2. Open the PNGs in `<name>-qa/` and look at every slide. The script cannot see a half-empty card, a faded label or an unbalanced layout; your eyes can. Check against sections 1 to 6.
3. Fix the source (`report.json` text first, then the template) and rebuild. Repeat until both the script and your eyes pass.
4. If LibreOffice is not installed, say so, and review each slide against the character limits instead. Do not claim the deck was rendered.

## 8. Changing a template

- Change a style by editing its definition in `STYLES` and its layout functions. Do not patch the generated `.pptx` or rewrite the script with a one-off helper.
- After any template change, build the example in all six styles and run `check_deck.js` on each, then add a long-text case (labels at their character limits) and run it again. A template that only works with short example text is not finished.
- A new slide type needs: its schema in `references/templates.md` with character limits, the limits added to `lint_report.js`, an implementation for every style, and an entry in the example report.
