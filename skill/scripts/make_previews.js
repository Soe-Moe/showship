#!/usr/bin/env node
/**
 * Regenerates the README preview images and the example decks in docs/ from
 * examples/report.example.json, so the pictures always match the current templates.
 *
 * Usage: node make_previews.js [docs-dir]      (default: <repo>/docs)
 *
 * Needs LibreOffice (soffice) and poppler (pdftoppm). Writes:
 *   example-deck.pptx (classic), example-deck-showship.pptx, example-deck-paper.pptx
 *   style-<name>.png      title + dashboard + phase bars strip, one per style
 *   <name>-grid.png       every slide in one sheet (showship, paper); preview-grid.png = showship
 *   slide-*.png           single slides used in the README template table (showship)
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require("sharp");

const SCRIPTS = __dirname;
const REPO = path.resolve(SCRIPTS, "..", "..");
const DOCS = path.resolve(process.argv[2] || path.join(REPO, "docs"));
const REPORT = require(path.join(REPO, "skill", "examples", "report.example.json"));
const { renderPdf } = require("./render_pdf");
const BG = { r: 235, g: 235, b: 230 };
const W = 650, H = 366, PAD = 12;
const STYLES = ["showship", "paper", "classic", "modern", "corporate", "vivid"];
const EXAMPLE_DECK = { classic: "example-deck.pptx", showship: "example-deck-showship.pptx", paper: "example-deck-paper.pptx" };

const work = fs.mkdtempSync(path.join(os.tmpdir(), "showship-prev-"));
fs.mkdirSync(DOCS, { recursive: true });

function render(style) {
  const json = path.join(work, `${style}.json`);
  fs.writeFileSync(json, JSON.stringify({ ...REPORT, style }));
  const pptx = path.join(work, `${style}.pptx`);
  execFileSync("node", [path.join(SCRIPTS, "build_deck.js"), json, pptx], { stdio: "inherit" });
  if (EXAMPLE_DECK[style]) fs.copyFileSync(pptx, path.join(DOCS, EXAMPLE_DECK[style]));
  renderPdf(pptx, work);
  execFileSync("pdftoppm", ["-r", "150", "-png", path.join(work, `${style}.pdf`), path.join(work, style)]);
  return fs.readdirSync(work).filter((f) => f.startsWith(style + "-") && f.endsWith(".png")).sort().map((f) => path.join(work, f));
}

async function sheet(files, cols, out) {
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({
    input: await sharp(f).resize(W, H).png().toBuffer(),
    left: PAD + (i % cols) * (W + PAD), top: PAD + Math.floor(i / cols) * (H + PAD),
  })));
  await sharp({ create: { width: PAD + cols * (W + PAD), height: PAD + rows * (H + PAD), channels: 3, background: BG } })
    .composite(tiles).png().toFile(out);
}

(async () => {
  const types = ["title", ...REPORT.slides.map((s) => s.type), "closing"];
  for (const style of STYLES) {
    const pages = render(style);
    if (pages.length !== types.length) throw new Error(`${style}: expected ${types.length} pages, got ${pages.length}`);
    const pick = (t) => pages[types.indexOf(t)];
    await sheet([pages[0], pick("dashboard"), pick("phase_bars")], 3, path.join(DOCS, `style-${style}.png`));
    if (style === "showship" || style === "paper") {
      await sheet(pages, 3, path.join(DOCS, `${style}-grid.png`));
      if (style === "showship") {
        fs.copyFileSync(path.join(DOCS, "showship-grid.png"), path.join(DOCS, "preview-grid.png"));
        const single = { dashboard: "slide-dashboard", phase_bars: "slide-phase-bars", review_insights: "slide-review-insights", attention: "slide-attention", tracker: "slide-tracker", table: "slide-next-steps" };
        for (const [t, name] of Object.entries(single)) await sharp(pick(t)).resize(961, 540).png().toFile(path.join(DOCS, `${name}.png`));
      }
    }
    console.log(`${style}: ${pages.length} slides`);
  }
  console.log(`Previews written to ${DOCS}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
