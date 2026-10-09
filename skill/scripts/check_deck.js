#!/usr/bin/env node
/**
 * Layout QA for a built deck: renders it with LibreOffice, then checks every page.
 *
 * Usage: node check_deck.js <deck.pptx> [--png] [--margin 0.45]
 *
 * Needs LibreOffice (soffice) and poppler (pdftotext, pdftoppm).
 * Flags, per slide:
 *   EDGE     text that sits closer to the slide edge than the margin (default 0.45 in)
 *   OVERLAP  two text lines whose boxes intersect (text colliding with text)
 * --png also writes <deck>-qa/slide-N.png so each slide can be looked at.
 * Exit code 1 if anything is flagged.
 *
 * Fonts: the check is only as honest as the fonts it renders with. Poppins and Arial must be
 * installed on this machine (render_pdf.js hands them to LibreOffice), otherwise a substitute
 * font is used and the result is unreliable.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const deck = args.find((a) => !a.startsWith("--") && a.endsWith(".pptx"));
const wantPng = args.includes("--png");
const mi = args.indexOf("--margin");
const MARGIN = mi >= 0 ? parseFloat(args[mi + 1]) : 0.45;
if (!deck) { console.error("Usage: node check_deck.js <deck.pptx> [--png] [--margin 0.45]"); process.exit(2); }

const { renderPdf } = require("./render_pdf");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "showship-qa-"));
let pdf;
try { pdf = renderPdf(deck, work); } catch (e) { console.error("Could not render with LibreOffice (soffice). Install it to run this check."); process.exit(2); }
const xhtml = path.join(work, "bbox.html");
execFileSync("pdftotext", ["-bbox-layout", pdf, xhtml]);
const html = fs.readFileSync(xhtml, "utf8");

const pages = html.split(/<page /).slice(1);
let problems = 0;
pages.forEach((pg, i) => {
  const W = +pg.match(/width="([\d.]+)"/)[1], H = +pg.match(/height="([\d.]+)"/)[1];
  const ptPerIn = W / 13.333;
  const m = MARGIN * ptPerIn;
  const lines = [];
  for (const lm of pg.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g)) {
    const words = [...lm[5].matchAll(/>([^<]+)<\/word>/g)].map((w) => w[1]);
    lines.push({ x0: +lm[1], y0: +lm[2], x1: +lm[3], y1: +lm[4], text: words.join(" ").replace(/&apos;/g, "'").replace(/&amp;/g, "&") });
  }
  const say = (kind, msg) => { problems++; console.log(`slide ${i + 1}  ${kind.padEnd(7)} ${msg}`); };
  for (const l of lines) {
    if (l.x1 > W - m || l.x0 < m || l.y1 > H - m * 0.3 || l.y0 < 0) {
      // the footer sits low on purpose; only flag horizontal drift there
      if (l.y0 > H * 0.93 && l.x0 >= m && l.x1 <= W - m) continue;
      say("EDGE", `"${l.text.slice(0, 60)}" (${(l.x0 / ptPerIn).toFixed(2)}–${(l.x1 / ptPerIn).toFixed(2)} in of 13.33)`);
    }
  }
  for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
    const p = lines[a], q = lines[b];
    const ox = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0);
    const oy = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
    const minH = Math.min(p.y1 - p.y0, q.y1 - q.y0);
    if (ox > 2 && oy > minH * 0.35) say("OVERLAP", `"${p.text.slice(0, 40)}" × "${q.text.slice(0, 40)}"`);
  }
});

if (wantPng) {
  const out = deck.replace(/\.pptx$/i, "-qa");
  fs.mkdirSync(out, { recursive: true });
  execFileSync("pdftoppm", ["-r", "80", "-png", pdf, path.join(out, "slide")]);
  console.log(`Slide images: ${out}/`);
}
console.log(problems ? `\n${problems} layout problem(s) in ${pages.length} slides.` : `\nAll ${pages.length} slides clear: nothing near the edges, no colliding text.`);
process.exit(problems ? 1 : 0);
