# Accessibility Statement

Showship produces PowerPoint decks, runs as a command-line installer and skill, and has a documentation website at <https://showship.github.io/>. This page says what is in place for each, and what is not.

This statement describes the project as written in the repository. It is not the result of a formal audit, and no screen reader or assistive-technology test has been recorded.

## Generated decks (.pptx)

What the design rules require of every style (see [`skill/references/design_rules.md`](skill/references/design_rules.md)):

- Body text is at least 12 pt and nothing is below 11 pt. Slide titles are at least 26 pt.
- Body text has a contrast ratio of at least 4.5:1 against its background, and large text at least 3:1.
- Colour never carries meaning alone. Status is shown as colour plus a word (Completed, At risk, Blocked).
- Text is sized to fit its box. It does not rely on auto-shrink, which some programs ignore.
- Every deck is rendered and checked for text that crosses the margins or collides before it is delivered.
- Seven designs are available. The `classic` design is black and white, and `ember` is a dark design for bright rooms.

Known limitations:

- Alt text is set for a task's screenshot (taken from its caption or title). Other pictures, such as gallery and row images and decorative marks, do not yet have alt text set by the builder. Add it in PowerPoint if the deck will be read with a screen reader.
- Slide reading order follows the order shapes are drawn, which has not been checked with a screen reader.
- Chart values, percentages and status words are also written as text on the slide, but chart alt text has not been reviewed.

## Website

- A "Skip to content" link, one `h1` per page, and descriptive page titles.
- Light and dark themes that follow the system setting, with body text kept at 4.5:1 contrast in both. Movement is reduced when the system asks for it (`prefers-reduced-motion`).
- Keyboard focus is visible. Tables that scroll sideways on small screens can be reached and scrolled with the keyboard.
- Every image has alt text. The build fails if one is missing. Pages also fail the check for broken links and anchors.
- The site is readable without JavaScript. Search, the theme toggle, copy buttons and the image viewer need it.
- The layout works from phone to large desktop widths.

Known limitations:

- The demo video has no captions or transcript yet.
- Search and the image viewer have not been tested with a screen reader.

## Installer and scripts

The installer asks questions in the terminal and can run without prompts using flags (`--yes` and the options in the README), which helps when a prompt interface is hard to use. Output is plain text.

## Report a problem

If something here is hard to use, tell us. Open an [issue](https://github.com/Soe-Moe/showship/issues) and say what you were trying to do, the tool or assistive technology you use, and what got in the way. If you would rather not post it publicly, email soemoeoo.info@gmail.com.

Fixes to accessibility problems are welcome as pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md).
