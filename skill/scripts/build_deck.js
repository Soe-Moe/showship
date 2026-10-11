#!/usr/bin/env node
/**
 * Showship — progress report deck builder
 *
 * Usage:
 *   node build_deck.js <report.json> <output.pptx>
 *
 * Builds a branded progress deck (dark title/closing bookends, accent-colour
 * highlights, Cambria headings / Calibri body) from a JSON spec.
 * Branding (company, presenter, logo, theme colours) comes from ../config.json and can be
 * overridden per report in report.json. See ../references/templates.md for the schema.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const Lu = require("react-icons/lu");

// ---------- Design system ----------
// Default theme; override with "theme": { "dark", "accent", "accentLight", "warning" } (hex, no #)
const C = {
  DARK: "141412", LIME: "A8CC3A", LIGHT_LIME: "D6E6A0", WHITE: "FFFFFF",
  GRAY: "B8B8B4", BODY: "58584F", CARD: "F6F7F1", TRACK: "E6E8DF",
  AMBER: "E0A33A", GRID: "E3E5DC",
};
// ---------- Deck styles ----------
// Each style sets palette, fonts, card look, content-slide header, bookend (title/closing) layout and footer.
// Pick with config.json "style" (or report.json "style"): classic | corporate | vivid.
const STYLES = {
  classic: {
    label: "Classic — black & white editorial, serif headings, hairline rules, deep green accent",
    palette: { DARK: "1A1A1A", LIME: "1F5C3A", LIGHT_LIME: "C5D6CA", AMBER: "A4471F", CARD: "FFFFFF", BODY: "4A4A46", TRACK: "ECECE8", GRID: "D6D6D0", BG: "FFFFFF", GRAY: "8C8C86", ON_ACCENT: "FFFFFF", ON_WARN: "FFFFFF", ON_DARK: "A9CDB4", MID: "8DB39A" },
    inks: { done: "1F5C3A", progress: "3F6A4E", blocked: "A4471F", next: "77776F" },
    fonts: { head: "Georgia", body: "Arial" },
    card: { radius: 0, shadow: null, border: "CFCFC8" },
    pillRadius: 0, pillChar: 0.1, header: "editorial", bookend: "editorial", footer: true, layouts: "editorial",
  },
  showship: {
    label: "Showship — signature: colour-coded projects, ship-trail ribbons, gauges and pill tracks",
    palette: { DARK: "17153A", LIME: "6C4CF5", LIGHT_LIME: "D9D1FF", AMBER: "F0503C", CARD: "FFFFFF", BODY: "55536E", TRACK: "ECEAF5", GRID: "E3E0EE", BG: "F7F6FB", GRAY: "9A98B0", ON_ACCENT: "FFFFFF", ON_WARN: "FFFFFF", ON_DARK: "FFC94A" },
    inks: { done: "5B3FE0", progress: "6C4CF5", blocked: "C93A28", next: "8A88A0" },
    fonts: { head: "Poppins", body: "Arial" },
    card: { radius: 0.2, shadow: { opacity: 0.08, blur: 10 }, border: null },
    pillRadius: 0.15, pillChar: 0.095, header: "classic", bookend: "signature", footer: false, layouts: "signature",
    projectColors: ["6C4CF5", "10A6A0", "FF6B4A", "F5A524", "E5487F", "2F7CF6"],
  },
  paper: {
    label: "Paper: printed annual report, paper and ink, one colour per project",
    // DARK = ink, LIME = Showship violet (the brand accent), AMBER = risk only (coral red)
    palette: { DARK: "17153A", LIME: "6C4CF5", LIGHT_LIME: "D9D1FF", AMBER: "D9472B", CARD: "FFFFFF", BODY: "48465C", TRACK: "E6E1D6", GRID: "D6D0C3", BG: "F7F4EE", GRAY: "68667A", ON_ACCENT: "FFFFFF", ON_WARN: "FFFFFF", ON_DARK: "FFFFFF" },
    inks: { done: "5B3FE0", progress: "5B3FE0", blocked: "B83A22", next: "68667A" },
    fonts: { head: "Poppins", body: "Arial" },
    card: { radius: 0, shadow: null, border: "D6D0C3" },
    pillRadius: 0, pillChar: 0.095, header: "classic", bookend: "paper", footer: false, layouts: "paper",
    // project colours are a categorical legend; coral is not among them because it means risk
    projectColors: ["6C4CF5", "10A6A0", "E0A21B", "2F7CF6"],
  },
  ember: {
    label: "Ember: graphite night deck, one amber accent, flat panels, big serif figures",
    // DARK = slide background (theme.dark recolours the whole deck), LIME = amber accent, AMBER = risk only (coral),
    // TEXT = warm white. Surfaces and rules are derived from DARK, so a custom dark colour keeps its contrast.
    palette: { DARK: "12161C", LIME: "F2B134", LIGHT_LIME: "FFD98A", AMBER: "FF7A6B", CARD: "1B2129", BODY: "B9BFC9", TRACK: "2A323D", GRID: "2F3844", BG: "12161C", GRAY: "929AA8", ON_ACCENT: "12161C", ON_WARN: "12161C", ON_DARK: "F2B134", TEXT: "F4F0E8" },
    inks: { done: "F2B134", progress: "FFD98A", blocked: "FF7A6B", next: "929AA8" },
    fonts: { head: "Georgia", body: "Arial" },
    card: { radius: 0, shadow: null, border: null },
    pillRadius: 0, pillChar: 0.095, header: "classic", bookend: "ember", footer: false, layouts: "ember",
    // categorical project colours, all light enough to read on graphite; coral is left out because it means risk
    projectColors: ["F2B134", "5CC8D7", "A99BFF", "9BD17A"],
  },
  modern: {
    label: "Modern — dark bookends, lime accent, serif headings",
    palette: { DARK: "141412", LIME: "A8CC3A", LIGHT_LIME: "D6E6A0", AMBER: "E0A33A", CARD: "F6F7F1", BODY: "58584F", TRACK: "E6E8DF", GRID: "E3E5DC", BG: "FFFFFF", ON_ACCENT: "141412", ON_WARN: "141412" },
    inks: { done: "6E8A1F", progress: "8A7A1F", blocked: "B07A1A", next: "8A8A82" },
    fonts: { head: "Cambria", body: "Calibri" },
    card: { radius: 0.08, shadow: { opacity: 0.08, blur: 6 }, border: null },
    pillRadius: 0.16, pillChar: 0.085, header: "classic", bookend: "classic", footer: false,
  },
  corporate: {
    label: "Corporate — white, navy & blue, clean sans-serif, page numbers",
    palette: { DARK: "1F2A44", LIME: "2563EB", LIGHT_LIME: "C7D7FB", AMBER: "F59E0B", CARD: "F7F9FC", BODY: "4B5563", TRACK: "E5E9F0", GRID: "E5E7EB", BG: "FFFFFF", ON_ACCENT: "FFFFFF", ON_WARN: "1F2A44" },
    inks: { done: "1D4ED8", progress: "2563EB", blocked: "B45309", next: "6B7280" },
    fonts: { head: "Arial", body: "Arial" },
    card: { radius: 0, shadow: null, border: "E2E8F0" },
    pillRadius: 0.05, pillChar: 0.1, header: "rule", bookend: "panel", footer: true,
  },
  vivid: {
    label: "Vivid — teal header bands, orange accent, rounded cards",
    palette: { DARK: "0F4C5C", LIME: "E36414", LIGHT_LIME: "F8C9A6", AMBER: "C1121F", CARD: "FFFFFF", BODY: "4A4A4A", TRACK: "E9E4DC", GRID: "E6E1D8", BG: "F5F2ED", ON_ACCENT: "FFFFFF", ON_WARN: "FFFFFF" },
    inks: { done: "B84A0E", progress: "C2410C", blocked: "9B1C1C", next: "6B6B6B" },
    fonts: { head: "Georgia", body: "Arial" },
    card: { radius: 0.18, shadow: { opacity: 0.12, blur: 10 }, border: null },
    pillRadius: 0.16, pillChar: 0.1, header: "band", bookend: "shapes", footer: false,
  },
};
let STYLE = STYLES.classic;
let BASE_C = null; // original palette, restored before each style is applied
const F = { H: "Cambria", B: "Calibri" };
function applyStyle(name) {
  if (!BASE_C) BASE_C = Object.assign({}, C);
  STYLE = STYLES[name] || STYLES.classic;
  if (name && !STYLES[name]) console.warn(`Unknown style "${name}" — using classic. Available: ${Object.keys(STYLES).join(", ")}`);
  Object.assign(C, BASE_C, STYLE.palette);
  if (!STYLE.palette.ON_DARK) C.ON_DARK = C.LIME; // accent text on dark panels
  F.H = STYLE.fonts.head; F.B = STYLE.fonts.body;
}

function applyTheme(t) {
  if (!t) return;
  const hex = (v) => (typeof v === "string" ? v.replace(/^#/, "").toUpperCase() : null);
  if (hex(t.dark)) C.DARK = hex(t.dark);
  if (hex(t.accent)) { C.LIME = hex(t.accent); if (!STYLE.palette.ON_DARK) C.ON_DARK = C.LIME; }
  if (hex(t.accentLight)) C.LIGHT_LIME = hex(t.accentLight);
  if (hex(t.warning)) C.AMBER = hex(t.warning);
}
function st(s) {
  const STATE = {
    done:     { fill: C.LIME,       text: C.ON_ACCENT, label: "Completed",   ink: STYLE.inks.done },
    progress: { fill: C.LIGHT_LIME, text: C.DARK,      label: "In progress", ink: STYLE.inks.progress },
    blocked:  { fill: C.AMBER,      text: C.ON_WARN,   label: "Blocked",     ink: STYLE.inks.blocked },
    next:     { fill: C.TRACK,      text: C.BODY,      label: "Not started", ink: STYLE.inks.next },
  };
  return STATE[s] || STATE.progress;
}

// A missing font is silently replaced by a wider one on the machine that opens the file, and text overflows.
function warnMissingFonts(names) {
  let installed;
  try { installed = require("child_process").execFileSync("fc-list", [":", "family"], { encoding: "utf8" }); } catch (e) { return; }
  for (const n of new Set(names)) {
    if (!installed.toLowerCase().includes(n.toLowerCase())) console.warn(`Warning: font "${n}" is not installed here. Layout checks will be unreliable and the deck may overflow on machines without it. Install it, or pick a style that uses installed fonts.`);
  }
}

const SKILL_DIR = path.resolve(__dirname, "..");
const DEFAULT_LOGO = path.join(SKILL_DIR, "assets", "logo.svg");
const expandHome = (p) => (typeof p === "string" && p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
let LOGO = null; // { path, aspect } after prepareLogo()
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), "showship-deck-"));

// ---------- Helpers ----------
async function icon(name) {
  const comp = Lu["Lu" + name] || Lu.LuCircle;
  const file = path.join(CACHE, `icon_${name}.png`);
  if (fs.existsSync(file)) return file;
  let svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(comp, { size: 256, color: "#" + C.DARK, strokeWidth: 1.8 })
  );
  svg = svg.replace(/currentColor/g, "#" + C.DARK);
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(file);
  return file;
}

// Hub-and-spoke illustration: center icon + 2–4 satellite icons
async function illustration(spec, key) {
  const SIZE = 900, CX = 450, CR = 125, OR = 88;
  const nodes = spec.nodes || [];
  let pos;
  if (nodes.length === 2) pos = [[155, 450], [745, 450]];
  else if (nodes.length === 3) pos = [[450, 195], [235, 655], [665, 655]];
  else pos = [[450, 160], [740, 450], [450, 740], [160, 450]].slice(0, nodes.length);
  let svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">`;
  pos.forEach(([x, y]) => {
    svg += `<line x1="${CX}" y1="${CX}" x2="${x}" y2="${y}" stroke="#${C.BODY}" stroke-width="3" stroke-dasharray="10 10" opacity="0.45"/>`;
  });
  pos.forEach(([x, y]) => { svg += `<circle cx="${x}" cy="${y}" r="${OR}" fill="#${C.LIME}"/>`; });
  svg += `<circle cx="${CX}" cy="${CX}" r="${CR}" fill="#${C.LIME}"/></svg>`;
  const comps = [];
  for (let i = 0; i < pos.length; i++) {
    const b = await sharp(await icon(nodes[i])).resize(96, 96).toBuffer();
    comps.push({ input: b, left: pos[i][0] - 48, top: pos[i][1] - 48 });
  }
  const cb = await sharp(await icon(spec.center || "Target")).resize(145, 145).toBuffer();
  comps.push({ input: cb, left: CX - 72, top: CX - 72 });
  const file = path.join(CACHE, `illus_${key}.png`);
  await sharp(Buffer.from(svg)).composite(comps).png().toFile(file);
  return file;
}

function header(s, eyebrow, title, size) {
  const eb = (eyebrow || ""), t = title || "";
  if (STYLE.header === "band") {
    s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 1.55, fill: { color: C.DARK }, line: { type: "none" } });
    s.addShape("rect", { x: 0, y: 1.55, w: 13.333, h: 0.06, fill: { color: C.LIME }, line: { type: "none" } });
    s.addText(eb, { x: 0.7, y: 0.36, w: 11.9, h: 0.32, fontFace: F.B, fontSize: 12, bold: true, color: C.LIGHT_LIME, margin: 0 });
    s.addText(t, { x: 0.7, y: 0.68, w: 11.9, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 28, 28), bold: true, color: "FFFFFF", margin: 0, fit: "shrink" });
    return;
  }
  if (STYLE.header === "editorial") {
    s.addShape("line", { x: 0.7, y: 0.42, w: 11.93, h: 0, line: { color: C.DARK, width: 2 } });
    s.addText(eb, { x: 0.7, y: 0.56, w: 11.9, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
    s.addText(t, { x: 0.7, y: 0.84, w: 11.9, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 28, 28), bold: false, color: C.DARK, margin: 0, fit: "shrink" });
    s.addShape("line", { x: 0.7, y: 1.64, w: 11.93, h: 0, line: { color: C.DARK, width: 0.75 } });
    return;
  }
  if (STYLE.header === "rule") {
    s.addText(eb, { x: 0.7, y: 0.5, w: 11.9, h: 0.3, fontFace: F.B, fontSize: 11.5, bold: true, color: C.LIME, margin: 0 });
    s.addText(t, { x: 0.7, y: 0.8, w: 11.9, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 26, 26), bold: true, color: C.DARK, margin: 0, fit: "shrink" });
    s.addShape("line", { x: 0.7, y: 1.62, w: 11.93, h: 0, line: { color: C.GRID, width: 1 } });
    s.addShape("rect", { x: 0.7, y: 1.59, w: 1.1, h: 0.06, fill: { color: C.LIME }, line: { type: "none" } });
    return;
  }
  s.addText(eb, {
    x: 0.7, y: 0.55, w: 11.9, h: 0.35, fontFace: F.B, fontSize: 13, bold: true,
    color: C.LIME, margin: 0,
  });
  s.addText(t, {
    x: 0.7, y: 0.9, w: 11.9, h: 0.75, fontFace: F.H, fontSize: size || 28, bold: true,
    color: C.DARK, margin: 0, fit: "shrink",
  });
}

// New content slide with the style's background and footer.
let SLIDE_NO = 0, FOOTER_TEXT = "";
function newSlide(pres) {
  const s = pres.addSlide();
  SLIDE_NO++;
  s.background = { color: C.BG };
  if (STYLE.footer) {
    if (STYLE.header === "editorial") s.addShape("line", { x: 0.7, y: 7.08, w: 11.93, h: 0, line: { color: C.GRID, width: 0.75 } });
    s.addText(FOOTER_TEXT, { x: 0.7, y: 7.16, w: 8, h: 0.24, fontFace: F.B, fontSize: 11, color: "9CA3AF", margin: 0 });
    s.addText(String(SLIDE_NO), { x: 11.63, y: 7.16, w: 1.0, h: 0.24, fontFace: F.B, fontSize: 11, bold: true, color: "9CA3AF", align: "right", margin: 0 });
  }
  return s;
}

function pill(s, text, x, y, state) {
  text = sentence(text);
  const w = 0.24 + text.length * (STYLE.pillChar || 0.085);
  s.addShape(STYLE.pillRadius ? "roundRect" : "rect", { x, y, w, h: 0.32, rectRadius: STYLE.pillRadius, fill: { color: st(state).fill }, line: { type: "none" } });
  s.addText(text, {
    x, y, w, h: 0.32, fontFace: F.B, fontSize: 11, bold: true, color: st(state).text,
    align: "center", valign: "middle", margin: 0,
  });
  return w;
}

function card(s, x, y, w, h, fill) {
  const k = STYLE.card;
  s.addShape(k.radius ? "roundRect" : "rect", {
    x, y, w, h, rectRadius: k.radius, fill: { color: fill || C.CARD },
    line: k.border ? { color: k.border, width: 0.75 } : { type: "none" },
    ...(k.shadow ? { shadow: { type: "outer", color: "000000", opacity: k.shadow.opacity, blur: k.shadow.blur, offset: 2, angle: 90 } } : {}),
  });
}

function richDesc(desc) {
  // desc may be a string or array of {label, text} sub-bullets (optionally with a lead string)
  if (typeof desc === "string") return [{ text: desc, options: { color: C.BODY } }];
  const runs = [];
  (desc || []).forEach((d, i) => {
    const last = i === desc.length - 1;
    if (typeof d === "string") {
      runs.push({ text: d, options: { color: C.BODY, breakLine: !last, paraSpaceAfter: 5 } });
    } else {
      runs.push({ text: d.label + ":  ", options: { bold: true, color: C.DARK } });
      runs.push({ text: d.text, options: { color: C.BODY, breakLine: !last, paraSpaceAfter: 4 } });
    }
  });
  return runs;
}

// Trim transparent/blank borders so any logo sits tightly; keep its aspect ratio.
async function prepareLogo(logo) {
  if (logo === false || logo === "none") return null;
  const src = expandHome(logo) || DEFAULT_LOGO;
  if (!fs.existsSync(src)) { console.warn(`Logo not found: ${src} — continuing without a logo`); return null; }
  const out = path.join(CACHE, "logo_trimmed.png");
  // SVG logos are rasterised at a high density (about 1600 px wide) so they stay sharp on a projector
  let input = () => sharp(src);
  if (/\.svg$/i.test(src)) {
    const w = (await sharp(src).metadata()).width || 128;
    const density = Math.min(2400, Math.max(72, Math.round(72 * 1600 / w)));
    input = () => sharp(src, { density });
  }
  try { await input().trim().png().toFile(out); } catch { await input().png().toFile(out); }
  const m = await sharp(out).metadata();
  return { path: out, aspect: m.height / m.width, isDefault: src === DEFAULT_LOGO };
}

// ---------- Bookend slides ----------
function bookend(pres, r, kind) {
  if (STYLE.bookend === "panel") return bookendPanel(pres, r, kind);
  if (STYLE.bookend === "shapes") return bookendShapes(pres, r, kind);
  if (STYLE.bookend === "editorial") return bookendEditorial(pres, r, kind);
  return bookendClassic(pres, r, kind);
}

function smallLogo(s, cx, bottom, maxW = 0.85, maxH = 0.69) {
  if (!LOGO) return;
  let lw = maxW, lh = lw * LOGO.aspect;
  if (lh > maxH) { lh = maxH; lw = lh / LOGO.aspect; }
  s.addImage({ path: LOGO.path, x: cx - lw / 2, y: bottom - lh, w: lw, h: lh });
}

// Corporate: navy panel on the left (logo + company), content on white.
function bookendPanel(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  const pw = 4.4;
  s.addShape("rect", { x: 0, y: 0, w: pw, h: 7.5, fill: { color: C.DARK }, line: { type: "none" } });
  s.addShape("rect", { x: pw, y: 0, w: 0.08, h: 7.5, fill: { color: C.LIME }, line: { type: "none" } });
  if (LOGO) {
    smallLogo(s, 1.35, 1.82, 1.0, 1.0);
  }
  s.addText(r.company, { x: 0.7, y: 2.2, w: pw - 1.2, h: 0.8, fontFace: F.B, fontSize: 14, bold: true, color: "FFFFFF", valign: "top", margin: 0 });
  const x = pw + 0.8, w = 13.333 - x - 0.7;
  if (kind === "title") {
    s.addText(r.eyebrow, { x, y: 2.2, w, h: 0.35, fontFace: F.B, fontSize: 13, bold: true, color: C.LIME, margin: 0 });
    s.addText(r.title, { x, y: 2.6, w, h: 1.9, fontFace: F.H, fontSize: 38, bold: true, color: C.DARK, lineSpacingMultiple: 1.05, margin: 0, valign: "top" });
    s.addShape("rect", { x, y: 4.65, w: 1.0, h: 0.07, fill: { color: C.LIME }, line: { type: "none" } });
  } else {
    s.addText("Thank you", { x, y: 2.5, w, h: 1.0, fontFace: F.H, fontSize: 44, bold: true, color: C.DARK, margin: 0 });
    s.addText("Questions & discussion", { x, y: 3.5, w, h: 0.5, fontFace: F.B, fontSize: 20, color: C.LIME, bold: true, margin: 0 });
    s.addShape("rect", { x, y: 4.2, w: 1.0, h: 0.07, fill: { color: C.LIME }, line: { type: "none" } });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  s.addText("Presenter", { x, y: 6.2, w: 3.5, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, color: "9CA3AF", margin: 0 });
  s.addText(presenter, { x, y: 6.48, w: 3.8, h: 0.4, fontFace: F.B, fontSize: 15, bold: true, color: C.DARK, margin: 0 });
  s.addText("Date", { x: x + 4.0, y: 6.2, w: 3.0, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, color: "9CA3AF", margin: 0 });
  s.addText(r.date, { x: x + 4.0, y: 6.48, w: 3.5, h: 0.4, fontFace: F.B, fontSize: 15, bold: true, color: C.DARK, margin: 0 });
}

// Classic: white paper, heavy + hairline rules, large serif title — like a report cover.
function bookendEditorial(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addShape("line", { x: 0.7, y: 0.62, w: 11.93, h: 0, line: { color: C.DARK, width: 3 } });
  s.addShape("line", { x: 0.7, y: 0.72, w: 11.93, h: 0, line: { color: C.DARK, width: 0.75 } });
  if (LOGO) {
    let lw = 0.9, lh = lw * LOGO.aspect;
    if (lh > 0.6) { lh = 0.6; lw = lh / LOGO.aspect; }
    s.addImage({ path: LOGO.path, x: 0.7, y: 1.05, w: lw, h: lh });
  }
  s.addText(r.company, { x: LOGO ? 1.8 : 0.7, y: 1.05, w: 7, h: 0.6, fontFace: F.B, fontSize: 12, bold: true, color: C.DARK, valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(r.eyebrow, { x: 0.7, y: 2.75, w: 9, h: 0.35, fontFace: F.B, fontSize: 12, bold: true, color: C.LIME, margin: 0 });
    s.addText(r.title, { x: 0.7, y: 3.15, w: 11.5, h: 2.2, fontFace: F.H, fontSize: 48, color: C.DARK, lineSpacingMultiple: 1.05, margin: 0, valign: "top" });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.85, w: 11.5, h: 1.2, fontFace: F.H, fontSize: 56, color: C.DARK, margin: 0 });
    s.addText("Questions & discussion", { x: 0.7, y: 4.05, w: 11.5, h: 0.55, fontFace: F.H, fontSize: 22, italic: true, color: C.LIME, margin: 0 });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  s.addShape("line", { x: 0.7, y: 6.05, w: 11.93, h: 0, line: { color: C.DARK, width: 0.75 } });
  s.addText("Presenter", { x: 0.7, y: 6.22, w: 4.5, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
  s.addText(presenter, { x: 0.7, y: 6.5, w: 6, h: 0.42, fontFace: F.H, fontSize: 17, color: C.DARK, margin: 0 });
  s.addText("Date", { x: 8.13, y: 6.22, w: 4.5, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color: C.GRAY, align: "right", margin: 0 });
  s.addText(r.date, { x: 6.63, y: 6.5, w: 6, h: 0.42, fontFace: F.H, fontSize: 17, color: C.DARK, align: "right", margin: 0 });
}

// Vivid: full-colour background with large accent circles.
function bookendShapes(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: C.DARK };
  // one solid accent block on the right: a fixed anchor for the cover instead of floating decoration
  s.addShape("rect", { x: 10.0, y: 0, w: 3.333, h: 7.5, fill: { color: C.LIME }, line: { type: "none" } });
  if (LOGO) {
    smallLogo(s, 1.175, 1.43, 0.72, 0.72);
  }
  s.addText(r.company, { x: LOGO ? 1.85 : 0.7, y: 0.6, w: 5.5, h: 0.95, fontFace: F.B, fontSize: 14, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(r.eyebrow, { x: 0.75, y: 2.75, w: 7.5, h: 0.4, fontFace: F.B, fontSize: 14, bold: true, color: C.LIGHT_LIME, margin: 0 });
    s.addText(r.title, { x: 0.7, y: 3.15, w: 8.2, h: 2.1, fontFace: F.H, fontSize: 46, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.05, margin: 0, valign: "top" });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.8, w: 8.2, h: 1.1, fontFace: F.H, fontSize: 54, bold: true, color: "FFFFFF", margin: 0 });
    s.addText("Questions & discussion", { x: 0.75, y: 3.95, w: 8.0, h: 0.55, fontFace: F.B, fontSize: 22, bold: true, color: C.LIGHT_LIME, margin: 0 });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  s.addShape("roundRect", { x: 0.7, y: 6.1, w: 6.6, h: 0.9, rectRadius: 0.12, fill: { color: "FFFFFF", transparency: 88 }, line: { type: "none" } });
  s.addText([{ text: "Presenter  ", options: { color: C.LIGHT_LIME, fontSize: 11 } }, { text: presenter, options: { color: "FFFFFF", bold: true, fontSize: 15 } }],
    { x: 0.95, y: 6.1, w: 3.7, h: 0.9, fontFace: F.B, valign: "middle", margin: 0 });
  s.addText([{ text: "Date  ", options: { color: C.LIGHT_LIME, fontSize: 11 } }, { text: r.date, options: { color: "FFFFFF", bold: true, fontSize: 15 } }],
    { x: 4.6, y: 6.1, w: 2.6, h: 0.9, fontFace: F.B, valign: "middle", margin: 0 });
}

function bookendClassic(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: C.DARK };
  if (LOGO) {
    // large faint watermark bleeding off the bottom-right
    const ww = 6.6, wh = ww * LOGO.aspect;
    s.addImage({ path: LOGO.path, x: 8.4, y: 3.0, w: ww, h: wh, transparency: 90 });
    // small mark above the company name (fits a 0.85 x 0.69 box, centred at x = 1.5)
    let lw = 0.85, lh = lw * LOGO.aspect;
    if (lh > 0.69) { lh = 0.69; lw = lh / LOGO.aspect; }
    s.addImage({ path: LOGO.path, x: 1.5 - lw / 2, y: 1.185 - lh, w: lw, h: lh });
  }
  s.addText(r.company, {
    x: 0.0, y: 1.17, w: 3.0, h: 0.42, fontFace: F.B, fontSize: 13, bold: true,
    color: C.WHITE, align: "center", margin: 0,
  });
  if (kind === "title") {
    s.addText(r.eyebrow, { x: 0.8, y: 3.05, w: 8, h: 0.4, fontFace: F.B, fontSize: 15, bold: true, color: C.LIME, margin: 0 });
    s.addText(r.title, { x: 0.75, y: 3.45, w: 10.5, h: 2.0, fontFace: F.H, fontSize: 44, bold: true, color: C.WHITE, lineSpacingMultiple: 1.1, margin: 0 });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.9, w: 11.93, h: 1.1, fontFace: F.H, fontSize: 54, bold: true, color: C.WHITE, align: "center", margin: 0 });
    s.addText("Any Questions?", { x: 0.7, y: 4.05, w: 11.93, h: 0.6, fontFace: F.B, fontSize: 22, bold: true, color: C.LIME, align: "center", margin: 0 });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  s.addText("Presenter", { x: 0.8, y: 6.3, w: 4.5, h: 0.3, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0, align: "left" });
  s.addText(presenter, { x: 0.8, y: 6.58, w: 4.5, h: 0.4, fontFace: F.B, fontSize: 16, bold: true, color: C.WHITE, margin: 0, align: "left" });
  s.addText("Date", { x: 8.0, y: 6.3, w: 4.5, h: 0.3, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0, align: "right" });
  s.addText(r.date, { x: 8.0, y: 6.58, w: 4.5, h: 0.4, fontFace: F.B, fontSize: 16, bold: true, color: C.WHITE, margin: 0, align: "right" });
}

// ---------- Content templates ----------
const T = {};

// 1. dashboard — KPI cards (2–4) + optional key-update strip
T.dashboard = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Executive Summary", d.title || "This Week at a Glance", 30);
  const n = d.cards.length, gap = 0.4, cw = (11.93 - (n - 1) * gap) / n, cy = 2.05, ch = d.keyUpdate ? 3.6 : 4.4;
  d.cards.forEach((c, i) => {
    const x = 0.7 + i * (cw + gap);
    card(s, x, cy, cw, ch);
    s.addShape("rect", { x, y: cy, w: cw, h: 0.09, fill: { color: st(c.state).fill }, line: { type: "none" } });
    s.addText(c.label, { x: x + 0.3, y: cy + 0.35, w: cw - 0.6, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, margin: 0 });
    s.addText(c.metric, { x: x + 0.3, y: cy + 0.75, w: cw - 0.6, h: 1.0, fontFace: F.H, fontSize: n > 3 ? 44 : 54, bold: true, color: C.DARK, margin: 0 });
    pill(s, c.status || st(c.state).label, x + 0.3, cy + 1.85, c.state);
    s.addText(c.headline, { x: x + 0.3, y: cy + 2.35, w: cw - 0.6, h: 0.4, fontFace: F.B, fontSize: 16, bold: true, color: C.DARK, margin: 0 });
    s.addText(c.desc, { x: x + 0.3, y: cy + 2.75, w: cw - 0.6, h: ch - 2.85, fontFace: F.B, fontSize: 12.5, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.2 });
  });
  if (d.keyUpdate) {
    s.addShape(STYLE.card.radius ? "roundRect" : "rect", { x: 0.7, y: 6.05, w: 11.93, h: 0.7, rectRadius: STYLE.card.radius, fill: { color: C.DARK }, line: { type: "none" } });
    s.addText([
      { text: "Key update   ", options: { bold: true, color: C.ON_DARK } },
      { text: d.keyUpdate, options: { color: C.WHITE } },
    ], { x: 1.0, y: 6.05, w: 11.4, h: 0.7, fontFace: F.B, fontSize: 13.5, valign: "middle", margin: 0 });
  }
};

// 2. timeline — horizontal milestone track (3–5 steps), states done|blocked|progress|next
T.timeline = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  if (d.badge) pill(s, d.badge.text, 0.7, 1.8, d.badge.state || "done");
  const steps = d.steps, lineY = 3.3, tw = Math.min(2.9, 11.93 / steps.length - 0.15);
  // first and last label columns stay inside the 0.7 in side margins
  const x0 = 0.7 + tw / 2, x1 = 12.633 - tw / 2, sw = (x1 - x0) / (steps.length - 1);
  s.addShape("line", { x: x0, y: lineY, w: x1 - x0, h: 0, line: { color: C.LIME, width: 3 } });
  steps.forEach((p, i) => {
    const cx = x0 + i * sw, r = i === steps.length - 1 ? 0.36 : 0.28;
    const filled = p.state === "done" || p.state === "progress";
    const ring = p.state === "blocked" ? C.AMBER : C.GRAY;
    s.addShape("ellipse", {
      x: cx - r, y: lineY - r, w: 2 * r, h: 2 * r,
      fill: { color: filled ? st(p.state).fill : C.WHITE },
      line: filled ? { type: "none" } : { color: ring, width: 3 },
    });
    const glyph = p.state === "done" ? "✓" : p.state === "blocked" ? "!" : p.state === "progress" ? "•" : String(i + 1);
    s.addText(glyph, { x: cx - r, y: lineY - r, w: 2 * r, h: 2 * r, fontFace: F.B, fontSize: 18, bold: true, color: p.state === "blocked" ? C.AMBER : (p.state === "done" ? C.ON_ACCENT : C.DARK), align: "center", valign: "middle", margin: 0 });
    s.addText((p.tag || ""), { x: cx - tw / 2, y: lineY + 0.6, w: tw, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, color: p.state === "blocked" ? C.AMBER : C.BODY, align: "center", margin: 0 });
    s.addText(p.title, { x: cx - tw / 2, y: lineY + 0.9, w: tw, h: 0.4, fontFace: F.B, fontSize: 16, bold: true, color: C.DARK, align: "center", margin: 0 });
    s.addText(p.desc, { x: cx - tw / 2 + 0.1, y: lineY + 1.32, w: tw - 0.2, h: 0.9, fontFace: F.B, fontSize: 12, color: C.BODY, align: "center", valign: "top", margin: 0, lineSpacingMultiple: 1.2 });
  });
  if (d.impact) {
    card(s, 0.7, 6.0, 11.93, 0.85);
    s.addText([{ text: "Business Impact:  ", options: { bold: true, color: C.DARK } }, { text: d.impact, options: { color: C.BODY } }],
      { x: 1.0, y: 6.0, w: 11.4, h: 0.85, fontFace: F.B, fontSize: 13.5, valign: "middle", margin: 0 });
  }
};

// 3. rings — doughnut charts (2–3) + phase status tiles
T.rings = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  const n = d.rings.length, gap = 0.4, cw = (11.93 - (n - 1) * gap) / n, cy = 1.95, ch = 3.25;
  d.rings.forEach((r, i) => {
    const x = 0.7 + i * (cw + gap);
    card(s, x, cy, cw, ch);
    const dd = 2.1, dx = x + (cw - dd) / 2, dy = cy + 0.2;
    s.addChart(pres.charts.DOUGHNUT, [{ name: r.label, labels: ["Complete", "Remaining"], values: [r.pct, 100 - r.pct] }], {
      x: dx, y: dy, w: dd, h: dd, holeSize: 78, chartColors: [r.dark ? C.DARK : C.LIME, C.TRACK],
      showLegend: false, showValue: false, showPercent: false, showLabel: false, showTitle: false,
      dataBorder: { pt: 0, color: "FFFFFF" },
    });
    s.addText(`${r.pct}%`, { x: dx, y: dy, w: dd, h: dd, fontFace: F.H, fontSize: 24, bold: true, color: C.DARK, align: "center", valign: "middle", margin: 0 });
    s.addText(r.label, { x: x + 0.2, y: cy + 2.4, w: cw - 0.4, h: 0.38, fontFace: F.B, fontSize: 16, bold: true, color: C.DARK, align: "center", margin: 0 });
    s.addText(r.sub || "", { x: x + 0.2, y: cy + 2.78, w: cw - 0.4, h: 0.3, fontFace: F.B, fontSize: 12, color: C.BODY, align: "center", margin: 0 });
  });
  const stats = d.stats || [];
  const sn = stats.length || 1, tw = (11.93 - (sn - 1) * gap) / sn, ty = 5.45, th = 0.95;
  stats.forEach((x0, i) => {
    const x = 0.7 + i * (tw + gap);
    s.addShape(STYLE.card.radius ? "roundRect" : "rect", { x, y: ty, w: tw, h: th, rectRadius: STYLE.card.radius, fill: { color: C.WHITE }, line: { color: C.TRACK, width: 1 } });
    s.addShape("rect", { x, y: ty, w: 0.1, h: th, fill: { color: st(x0.state).fill }, line: { type: "none" } });
    s.addText(String(x0.value), { x: x + 0.3, y: ty, w: 0.8, h: th, fontFace: F.H, fontSize: 32, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText(x0.label, { x: x + 1.1, y: ty, w: tw - 1.3, h: th, fontFace: F.B, fontSize: 14, bold: true, color: C.BODY, valign: "middle", margin: 0 });
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.6, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// 4. phase_bars — per-track stacked bar charts of phase completion (1–2 tracks)
T.phase_bars = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  const n = d.tracks.length, gap = 0.4, cw = (11.93 - (n - 1) * gap) / n, cy = 1.95, ch = 4.85;
  d.tracks.forEach((t, i) => {
    const x = 0.7 + i * (cw + gap);
    card(s, x, cy, cw, ch);
    s.addText(t.title, { x: x + 0.3, y: cy + 0.25, w: cw - 3.2, h: 0.4, fontFace: F.B, fontSize: 17, bold: true, color: C.DARK, margin: 0 });
    if (t.owner) s.addText(`Dev: ${t.owner}`, { x: x + cw - 3.0, y: cy + 0.25, w: 2.7, h: 0.4, fontFace: F.B, fontSize: 12, bold: true, color: C.BODY, align: "right", margin: 0 });
    const labels = t.phases.map((p) => p.pct === 0 ? `${p.name} (Not started)` : p.name);
    const done = t.phases.map((p) => (p.pct >= 100 ? 100 : 0));
    const prog = t.phases.map((p) => (p.pct > 0 && p.pct < 100 ? p.pct : 0));
    s.addChart(pres.charts.BAR, [
      { name: "Completed", labels, values: done },
      { name: "In Progress", labels, values: prog },
    ], {
      x: x + 0.15, y: cy + 0.7, w: cw - 0.3, h: 3.45, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 55,
      chartColors: [C.LIME, C.LIGHT_LIME], catAxisOrientation: "maxMin",
      catAxisLabelFontFace: "Calibri", catAxisLabelFontSize: 10.5, catAxisLabelColor: "3A3A34", catAxisLineShow: false,
      valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, valAxisLabelFormatCode: '0"%"',
      valAxisLabelFontSize: 9, valAxisLabelColor: "8A8A82", valGridLine: { color: C.GRID, style: "solid", size: 0.5 }, valAxisLineShow: false,
      showValue: true, dataLabelFormatCode: '0"%";;;', dataLabelFontSize: 10, dataLabelFontBold: true, dataLabelColor: C.DARK,
      showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: "Calibri",
    });
    if (t.note) s.addText(t.note, { x: x + 0.3, y: cy + 4.25, w: cw - 0.6, h: 0.4, fontFace: F.B, fontSize: 12, italic: true, color: C.BODY, margin: 0 });
  });
};

// 5. workstreams — dark hero card (one finished/metric workstream) + process flow (3–5 steps)
T.workstreams = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title, 26);
  const ly = 1.95, lh = 4.85, lx = 0.7, lw = 3.9, h = d.hero;
  s.addShape(STYLE.card.radius ? "roundRect" : "rect", { x: lx, y: ly, w: lw, h: lh, rectRadius: STYLE.card.radius, fill: { color: C.DARK }, line: { type: "none" } });
  s.addText((h.label || "Workstream 1"), { x: lx + 0.35, y: ly + 0.35, w: lw - 0.7, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.ON_DARK, margin: 0 });
  s.addText(h.title, { x: lx + 0.35, y: ly + 0.7, w: lw - 0.7, h: 0.45, fontFace: F.B, fontSize: 18, bold: true, color: C.WHITE, margin: 0 });
  s.addText(h.metric, { x: lx + 0.35, y: ly + 1.35, w: lw - 0.7, h: 1.1, fontFace: F.H, fontSize: 60, bold: true, color: C.ON_DARK, margin: 0 });
  pill(s, h.status || st(h.state).label, lx + 0.35, ly + 2.55, h.state || "done");
  s.addText(h.desc, { x: lx + 0.35, y: ly + 3.1, w: lw - 0.7, h: 1.5, fontFace: F.B, fontSize: 13, color: "D8D8D2", valign: "top", margin: 0, lineSpacingMultiple: 1.25 });

  const f = d.flow, rx = 5.0, rw = 12.63 - rx;
  card(s, rx, ly, rw, lh);
  s.addText((f.label || "Workstream 2"), { x: rx + 0.35, y: ly + 0.35, w: 4, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, margin: 0 });
  s.addText(f.title, { x: rx + 0.35, y: ly + 0.7, w: rw - 2.4, h: 0.45, fontFace: F.B, fontSize: 18, bold: true, color: C.DARK, margin: 0 });
  pill(s, f.status || st(f.state).label, rx + rw - 1.55, ly + 0.75, f.state || "progress");
  const n = f.steps.length, fg = 0.12, fw = rw - 0.7, bw = (fw - (n - 1) * fg) / n, by = ly + 1.55;
  f.steps.forEach((p, i) => {
    const x = rx + 0.35 + i * (bw + fg), filled = p.state === "done" || p.state === "progress";
    s.addShape("homePlate", { x, y: by, w: bw, h: 0.7, fill: { color: filled ? st(p.state).fill : C.WHITE },
      line: filled ? { type: "none" } : { color: C.GRAY, width: 1, dashType: "dash" } });
    s.addText(`0${i + 1}`, { x: x + 0.15, y: by, w: bw - 0.4, h: 0.7, fontFace: F.H, fontSize: 20, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText(p.title, { x, y: by + 0.85, w: bw - 0.1, h: 0.55, fontFace: F.B, fontSize: 13, bold: true, color: C.DARK, valign: "top", margin: 0 });
    s.addText(p.desc, { x, y: by + 1.4, w: bw - 0.1, h: 0.7, fontFace: F.B, fontSize: 11, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
    const lbl = { done: "Done", progress: "In progress", next: "Next", blocked: "Blocked" }[p.state] || "";
    s.addText(lbl, { x, y: by + 2.05, w: bw - 0.1, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, color: st(p.state).ink, margin: 0 });
  });
  if (f.next) s.addText([{ text: "Next:  ", options: { bold: true, color: C.DARK } }, { text: f.next, options: { color: C.BODY } }],
    { x: rx + 0.35, y: ly + 4.1, w: rw - 0.7, h: 0.5, fontFace: F.B, fontSize: 12.5, valign: "middle", margin: 0 });
};

// 6. rows — icon rows (2–4) with optional right-side visual (screenshot or illustration)
T.rows = async (pres, d, idx) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title, 27);
  let visual = null, aspect = 1;
  if (d.image) {
    visual = path.resolve(d.image);
    const m = await sharp(visual).metadata(); aspect = m.height / m.width;
  } else if (d.illustration) {
    visual = await illustration(d.illustration, idx);
  }
  const leftW = visual ? 6.3 : 11.9, top = 2.05, bottom = 6.91;
  if (visual) {
    const colX = 0.7 + leftW + 0.4, colW = 13.333 - 0.6 - colX, maxH = bottom - top;
    const pad = d.image ? 0.2 : 0.3;
    let fw = Math.min(colW, d.image ? 5.3 : 4.0);
    let fh = (fw - 2 * pad) * aspect + 2 * pad;
    if (fh > maxH) { fh = maxH; fw = (fh - 2 * pad) / aspect + 2 * pad; }
    const fx = colX + (colW - fw) / 2, fy = (top + bottom) / 2 - fh / 2;
    card(s, fx, fy, fw, fh);
    s.addImage({ path: visual, x: fx + pad, y: fy + pad, w: fw - 2 * pad, h: fh - 2 * pad });
  }
  const n = d.rows.length, gap = n >= 4 ? 0.12 : 0.18;
  const weights = d.rows.map((r) => (typeof r.desc === "string" ? 1 : 1 + 0.35 * (r.desc.length - 1)));
  const total = weights.reduce((a, b) => a + b, 0), avail = bottom - top - (n - 1) * gap;
  const big = !visual && n <= 3;
  let y = top;
  for (let i = 0; i < n; i++) {
    const r = d.rows[i], h = (avail * weights[i]) / total;
    s.addShape("ellipse", { x: 0.7, y, w: 0.52, h: 0.52, fill: { color: C.LIME }, line: { type: "none" } });
    s.addImage({ path: await icon(r.icon || "Circle"), x: 0.82, y: y + 0.12, w: 0.28, h: 0.28 });
    s.addText(r.header, { x: 1.42, y, w: leftW - 0.72, h: 0.45, fontFace: F.B, fontSize: big ? 18 : 15.5, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText(richDesc(r.desc), { x: 1.42, y: y + 0.5, w: leftW - 0.72, h: h - 0.5, fontFace: F.B, fontSize: big ? 14 : (n >= 4 ? 11.5 : 12.5), valign: "top", margin: 0, lineSpacingMultiple: 1.22, fit: "shrink" });
    y += h + gap;
  }
};

// 7. table — next steps / owner / status
T.table = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Looking Ahead", d.title || "Next Steps & Focus Areas", 30);
  const hd = (t) => ({ text: t, options: { bold: true, color: C.WHITE, fill: { color: C.DARK }, fontSize: 12 } });
  const rows = [[hd("Project / track"), hd("Owner"), hd("Next focus"), hd("Current")]];
  d.rows.forEach((r) => rows.push([
    { text: r.project, options: { bold: true, color: C.DARK, fontSize: 12.5 } },
    { text: r.owner || "—", options: { color: C.BODY, fontSize: 12.5 } },
    { text: r.focus, options: { color: C.BODY, fontSize: 12.5 } },
    { text: r.current, options: { bold: true, color: st(r.state).text, fontSize: 11, align: "center", fill: { color: st(r.state).fill } } },
  ]));
  const rh = Math.min(0.95, 4.6 / d.rows.length);
  s.addTable(rows, {
    x: 0.7, y: 2.05, w: 11.93, colW: [2.7, 2.1, 5.43, 1.7], fontFace: F.B, valign: "middle",
    rowH: [0.5, ...d.rows.map(() => rh)], border: { type: "solid", pt: 0.75, color: C.GRID }, margin: [0.08, 0.15, 0.08, 0.15],
  });
};

// 8. gallery — screenshot strip (2–7 images) with step labels
T.gallery = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title, 27);
  const imgs = d.images.map((p) => path.resolve(p));
  const metas = await Promise.all(imgs.map((p) => sharp(p).metadata()));
  const aspect = metas[0].height / metas[0].width, n = imgs.length;
  const gap = n > 4 ? 0.15 : 0.3, pad = n > 4 ? 0.1 : 0.15;
  let fw = (11.93 - (n - 1) * gap) / n, fh = (fw - 2 * pad) * aspect + 2 * pad;
  const maxH = 4.3;
  if (fh > maxH) { fh = maxH; fw = (fh - 2 * pad) / aspect + 2 * pad; }
  const totalW = n * fw + (n - 1) * gap, x0 = 0.7 + (11.93 - totalW) / 2;
  const fy = 2.05 + (4.86 - (fh + 0.42)) / 2;
  imgs.forEach((p, i) => {
    const x = x0 + i * (fw + gap);
    card(s, x, fy, fw, fh);
    s.addImage({ path: p, x: x + pad, y: fy + pad, w: fw - 2 * pad, h: fh - 2 * pad });
    const lbl = (d.labels && d.labels[i]) || `Step ${i + 1}`;
    s.addText(lbl, { x, y: fy + fh + 0.12, w: fw, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.LIME, align: "center", margin: 0 });
  });
};

// 9. activity — engineering throughput per person (commits / PRs / reviews) + KPI tiles
T.activity = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Engineering Activity", d.title || "Team Delivery Activity This Week");
  const kpis = d.kpis || [];
  const chartW = kpis.length ? 8.4 : 11.93, top = 1.95, h = 4.85;
  card(s, 0.7, top, chartW, h);
  const labels = d.people.map((p) => p.name);
  const data = d.series.map((name, i) => ({ name, labels, values: d.people.map((p) => p.values[i] || 0) }));
  s.addChart(pres.charts.BAR, data, {
    x: 0.85, y: top + 0.2, w: chartW - 0.3, h: h - (d.note ? 0.75 : 0.35),
    barDir: "col", barGrouping: "clustered", barGapWidthPct: 70,
    chartColors: [C.LIME, C.DARK, C.LIGHT_LIME, "8A8A82"].slice(0, d.series.length),
    catAxisLabelFontFace: "Calibri", catAxisLabelFontSize: 11, catAxisLabelColor: "3A3A34", catAxisLineShow: false,
    valAxisLabelFontSize: 9, valAxisLabelColor: "8A8A82", valGridLine: { color: C.GRID, style: "solid", size: 0.5 }, valAxisLineShow: false,
    showValue: true, dataLabelFontSize: 10, dataLabelFontBold: true, dataLabelColor: C.DARK, dataLabelPosition: "outEnd",
    showLegend: true, legendPos: "b", legendFontSize: 10.5, legendFontFace: "Calibri",
  });
  if (d.note) s.addText(d.note, { x: 1.0, y: top + h - 0.5, w: chartW - 0.6, h: 0.35, fontFace: F.B, fontSize: 11, italic: true, color: C.BODY, margin: 0 });
  if (kpis.length) {
    const kx = 0.7 + chartW + 0.35, kw = 12.63 - kx, kg = 0.2, kh = (h - (kpis.length - 1) * kg) / kpis.length;
    kpis.forEach((k, i) => {
      const y = top + i * (kh + kg);
      s.addShape(STYLE.card.radius ? "roundRect" : "rect", { x: kx, y, w: kw, h: kh, rectRadius: STYLE.card.radius, fill: { color: i === 0 ? C.DARK : C.WHITE }, line: i === 0 ? { type: "none" } : { color: C.TRACK, width: 1 } });
      s.addText(String(k.value), { x: kx + 0.25, y: y + 0.12, w: kw - 0.5, h: kh * 0.55, fontFace: F.H, fontSize: kpis.length > 3 ? 26 : 32, bold: true, color: i === 0 ? C.ON_DARK : C.DARK, valign: "bottom", margin: 0 });
      s.addText(k.label, { x: kx + 0.25, y: y + kh * 0.6, w: kw - 0.5, h: kh * 0.35, fontFace: F.B, fontSize: 12, bold: true, color: i === 0 ? "D8D8D2" : C.BODY, valign: "top", margin: 0 });
    });
  }
};

// 10. review_insights — code-review outcomes: stats column + findings list with area tags and status
T.review_insights = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Quality & Code Review", d.title || "Code Review Insights This Week");
  const top = 1.95, h = 4.85, lw = 3.3;
  s.addShape(STYLE.card.radius ? "roundRect" : "rect", { x: 0.7, y: top, w: lw, h, rectRadius: STYLE.card.radius, fill: { color: C.DARK }, line: { type: "none" } });
  const stats = d.stats || [];
  const sh = (h - 0.5) / Math.max(stats.length, 1);
  stats.forEach((k, i) => {
    const y = top + 0.25 + i * sh;
    s.addText(String(k.value), { x: 1.0, y, w: lw - 0.6, h: sh * 0.58, fontFace: F.H, fontSize: 34, bold: true, color: i === 0 ? C.ON_DARK : C.WHITE, valign: "bottom", margin: 0 });
    s.addText(k.label, { x: 1.0, y: y + sh * 0.6, w: lw - 0.6, h: sh * 0.36, fontFace: F.B, fontSize: 12, bold: true, color: "D8D8D2", valign: "top", margin: 0 });
    if (i < stats.length - 1) s.addShape("line", { x: 1.0, y: y + sh - 0.02, w: lw - 0.6, h: 0, line: { color: "3A3A34", width: 0.75 } });
  });

  const rx = 0.7 + lw + 0.35, rw = 12.63 - rx, f = d.findings || [];
  card(s, rx, top, rw, h);
  const gap = 0.12, rowsTop = top + 0.25, avail = h - 0.5 - (d.note ? 0.4 : 0);
  const rh = (avail - (f.length - 1) * gap) / Math.max(f.length, 1);
  const lbl = { done: "Resolved", progress: "In progress", blocked: "Open risk", next: "Planned" };
  f.forEach((it, i) => {
    const y = rowsTop + i * (rh + gap);
    s.addShape("rect", { x: rx + 0.25, y: y + 0.08, w: 0.07, h: rh - 0.16, fill: { color: st(it.state).fill }, line: { type: "none" } });
    s.addText((it.area || ""), { x: rx + 0.45, y: y + 0.04, w: rw - 2.5, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, margin: 0 });
    s.addText(it.text, { x: rx + 0.45, y: y + 0.32, w: rw - 2.4, h: rh - 0.36, fontFace: F.B, fontSize: f.length > 4 ? 11.5 : 12.5, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
    const pt = it.status || lbl[it.state] || "";
    if (pt) { const pw = 0.24 + pt.length * (STYLE.pillChar || 0.085); pill(s, pt, rx + rw - pw - 0.25, y + 0.06, it.state); }
  });
  if (d.note) s.addText(d.note, { x: rx + 0.45, y: top + h - 0.5, w: rw - 0.7, h: 0.35, fontFace: F.B, fontSize: 11, italic: true, color: C.BODY, margin: 0 });
};

// 11. attention — what needs the audience's attention: blockers/risks (left) + decisions needed (right)
T.attention = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Needs Attention", d.title || "Blockers & Decisions Needed");
  const top = 1.95, gap = 0.4, cw = (11.93 - gap) / 2, ig = 0.15;
  const maxN = Math.max((d.blockers || []).length, (d.decisions || []).length, 1);
  const ih = Math.min(1.35, (4.85 - 1.0 - (maxN - 1) * ig) / maxN);
  const h = Math.max(2.6, 0.8 + maxN * ih + (maxN - 1) * ig + 0.3);
  const cols = [
    { x: 0.7, head: d.blockersTitle || "Blockers & Risks", items: d.blockers || [], accent: C.AMBER, empty: d.noBlockers || "No open blockers this week." },
    { x: 0.7 + cw + gap, head: d.decisionsTitle || "Decisions Needed", items: d.decisions || [], accent: C.DARK, empty: "No decisions needed this week." },
  ];
  cols.forEach((col, ci) => {
    card(s, col.x, top, cw, h);
    s.addShape("rect", { x: col.x, y: top, w: cw, h: 0.09, fill: { color: col.accent }, line: { type: "none" } });
    s.addText(col.head, { x: col.x + 0.3, y: top + 0.28, w: cw - 0.6, h: 0.32, fontFace: F.B, fontSize: 12, bold: true, color: ci === 0 ? st("blocked").ink : C.DARK, margin: 0 });
    const items = col.items;
    if (!items.length) {
      s.addText(col.empty, { x: col.x + 0.3, y: top + 0.8, w: cw - 0.6, h: 0.5, fontFace: F.B, fontSize: 14, italic: true, color: C.BODY, margin: 0 });
      return;
    }
    const itTop = top + 0.8;
    items.forEach((it, i) => {
      const y = itTop + i * (ih + ig);
      s.addShape("ellipse", { x: col.x + 0.3, y: y + 0.02, w: 0.36, h: 0.36, fill: { color: ci === 0 ? C.AMBER : C.LIME }, line: { type: "none" } });
      s.addText(ci === 0 ? "!" : "?", { x: col.x + 0.3, y: y + 0.02, w: 0.36, h: 0.36, fontFace: F.B, fontSize: 14, bold: true, color: ci === 0 ? C.ON_WARN : C.ON_ACCENT, align: "center", valign: "middle", margin: 0 });
      const runs = [{ text: it.title, options: { bold: true, color: C.DARK, fontSize: 13.5, breakLine: true } }];
      if (it.text) runs.push({ text: it.text, options: { color: C.BODY, fontSize: 12, breakLine: !!it.meta } });
      if (it.meta) runs.push({ text: it.meta, options: { color: "8A8A82", fontSize: 11, italic: true } });
      s.addText(runs, { x: col.x + 0.8, y, w: cw - 1.1, h: ih, fontFace: F.B, valign: "top", margin: 0, lineSpacingMultiple: 1.15, paraSpaceAfter: 3, fit: "shrink" });
    });
  });
};

// 12. tracker — one card per developer: project, done/open task counts (task tracker), progress bar, focus, item list
T.tracker = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Team · Task Tracker", d.title || "Developer Task Track");
  const devs = d.devs || [], n = Math.max(devs.length, 1), gap = 0.3;
  const cw = (11.93 - (n - 1) * gap) / n, top = 1.95, h = 4.85;
  devs.forEach((v, i) => {
    const x = 0.7 + i * (cw + gap), ix = x + 0.32, iw = cw - 0.55;
    card(s, x, top, cw, h);
    s.addShape("rect", { x, y: top, w: 0.09, h, fill: { color: st(v.state).fill }, line: { type: "none" } });
    s.addText(v.name, { x: ix, y: top + 0.22, w: iw, h: 0.36, fontFace: F.B, fontSize: 15, bold: true, color: C.DARK, margin: 0 });
    s.addText((v.project || ""), { x: ix, y: top + 0.56, w: iw, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color: st("done").ink, margin: 0 });
    // done / open counters
    const cy = top + 0.9;
    s.addText(String(v.done ?? 0), { x: ix, y: cy, w: 0.45, h: 0.5, fontFace: F.H, fontSize: 26, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText("done this\nweek", { x: ix + 0.5, y: cy, w: 0.9, h: 0.5, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, valign: "middle", margin: 0 });
    s.addText(String(v.open ?? 0), { x: ix + 1.45, y: cy, w: 0.45, h: 0.5, fontFace: F.H, fontSize: 26, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText("open", { x: ix + 1.95, y: cy, w: 0.8, h: 0.5, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, valign: "middle", margin: 0 });
    // progress bar
    const by = top + 1.55, bw = iw - 0.6, pct = Math.max(0, Math.min(100, v.pct || 0));
    s.addShape("roundRect", { x: ix, y: by, w: bw, h: 0.13, rectRadius: 0.065, fill: { color: C.TRACK }, line: { type: "none" } });
    if (pct > 0) s.addShape("roundRect", { x: ix, y: by, w: Math.max(0.13, bw * pct / 100), h: 0.13, rectRadius: 0.065, fill: { color: pct >= 100 ? C.LIME : C.LIGHT_LIME }, line: { type: "none" } });
    s.addText(`${pct}%`, { x: ix + bw, y: by - 0.08, w: 0.6, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.DARK, align: "right", valign: "middle", margin: 0 });
    // focus
    s.addText(v.focus || "", { x: ix, y: top + 1.83, w: iw, h: 0.6, fontFace: F.B, fontSize: 11, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.1, fit: "shrink" });
    s.addShape("line", { x: ix, y: top + 2.5, w: iw, h: 0, line: { color: "E0E2D8", width: 0.75 } });
    // items
    const items = v.items || [], iy0 = top + 2.65, avail = h - 2.8, ih = Math.min(0.5, avail / Math.max(items.length, 1));
    items.forEach((it, k) => {
      const y = iy0 + k * ih;
      s.addShape("ellipse", { x: ix, y: y + 0.07, w: 0.13, h: 0.13, fill: { color: st(it.state).fill }, line: { type: "none" } });
      s.addText(it.text, { x: ix + 0.24, y, w: iw - 0.24, h: ih, fontFace: F.B, fontSize: 11, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.05, fit: "shrink" });
    });
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.9, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// ---------- Classic (editorial) layouts ----------
// Classic has its own composition, not just its own colours: no boxes, a lede column,
// large serif figures, numbered entries, heavy + hairline rules and text status tags.
const TE = {};
const E = { L: 0.7, R: 12.633, W: 11.933, TOP: 1.95, BOT: 6.85 };
const num2 = (i) => String(i + 1).padStart(2, "0");
function hl(s, x, y, w, pt = 0.75, color = C.GRID) { s.addShape("line", { x, y, w, h: 0, line: { color, width: pt } }); }
function vl(s, x, y, h, color = C.GRID) { s.addShape("line", { x, y, w: 0, h, line: { color, width: 0.75 } }); }
function caps(s, text, x, y, w, color = C.GRAY, opts = {}) {
  s.addText(String(text || ""), { x, y, w, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color, margin: 0, valign: "middle", ...opts });
}
function markColor(state) {
  return { done: C.LIME, progress: C.MID || C.LIGHT_LIME, blocked: C.AMBER, next: C.GRAY }[state] || C.MID || C.LIGHT_LIME;
}
function tag(s, text, x, y, w, state, align = "left") {
  s.addText([
    { text: "■  ", options: { color: markColor(state) } },
    { text: String(text || ""), options: { color: st(state).ink } },
  ], { x, y, w, h: 0.28, fontFace: F.B, fontSize: 11, bold: true, margin: 0, align, valign: "middle" });
}
function meter(s, x, y, w, pct) {
  pct = Math.max(0, Math.min(100, pct || 0));
  s.addShape("rect", { x, y, w, h: 0.05, fill: { color: C.TRACK }, line: { type: "none" } });
  if (pct > 0) s.addShape("rect", { x, y, w: w * pct / 100, h: 0.05, fill: { color: pct >= 100 ? C.LIME : (C.MID || C.LIGHT_LIME) }, line: { type: "none" } });
}
function lede(s, label, text, x, y, w, h, labelColor = C.LIME) {
  hl(s, x, y, w, 2, C.DARK);
  if (label) caps(s, label, x, y + 0.15, w, labelColor);
  if (text) s.addText(text, { x, y: y + 0.5, w, h: h - 0.5, fontFace: F.H, fontSize: 19, italic: true, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
}

TE.dashboard = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Executive Summary", d.title || "This Week at a Glance", 30);
  let x0 = E.L;
  if (d.keyUpdate) {
    const lw = 3.3;
    lede(s, "Key update", d.keyUpdate, E.L, E.TOP, lw, E.BOT - E.TOP);
    x0 = E.L + lw + 0.6;
    vl(s, x0 - 0.3, E.TOP, E.BOT - E.TOP);
  }
  const n = d.cards.length, gap = 0.45, cw = (E.R - x0 - (n - 1) * gap) / n;
  d.cards.forEach((c, i) => {
    const x = x0 + i * (cw + gap);
    hl(s, x, E.TOP, cw, 2, C.DARK);
    s.addText(String(c.label || ""), { x, y: E.TOP + 0.15, w: cw, h: 0.45, fontFace: F.B, fontSize: 11, bold: true, color: C.GRAY, margin: 0, valign: "top" });
    s.addText(c.metric, { x, y: E.TOP + 0.65, w: cw, h: 1.35, fontFace: F.H, fontSize: n > 3 ? 48 : 62, color: C.DARK, margin: 0, valign: "middle", fit: "shrink" });
    tag(s, c.status || st(c.state).label, x, E.TOP + 2.1, cw, c.state);
    hl(s, x, E.TOP + 2.55, cw);
    s.addText(c.headline, { x, y: E.TOP + 2.72, w: cw, h: 0.7, fontFace: F.H, fontSize: 17, bold: true, color: C.DARK, margin: 0, valign: "top", fit: "shrink" });
    s.addText(c.desc, { x, y: E.TOP + 3.5, w: cw, h: E.BOT - E.TOP - 3.5, fontFace: F.B, fontSize: 12.5, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.3, fit: "shrink" });
    if (i < n - 1) vl(s, x + cw + gap / 2, E.TOP + 0.15, E.BOT - E.TOP - 0.15);
  });
};

TE.timeline = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  const lw = 3.3, rx = E.L + lw + 0.6, rw = E.R - rx;
  hl(s, E.L, E.TOP, lw, 2, C.DARK);
  if (d.badge) tag(s, d.badge.text, E.L, E.TOP + 0.14, lw, d.badge.state || "done");
  if (d.impact) {
    caps(s, "Business impact", E.L, E.TOP + 0.65, lw, C.GRAY);
    s.addText(d.impact, { x: E.L, y: E.TOP + 1.0, w: lw, h: 3.8, fontFace: F.H, fontSize: 18, italic: true, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
  }
  vl(s, rx - 0.3, E.TOP, E.BOT - E.TOP);
  const steps = d.steps, n = steps.length, rh = (E.BOT - E.TOP) / n, mx = rx + 0.05;
  hl(s, rx, E.TOP, rw, 2, C.DARK);
  if (n > 1) vl(s, mx + 0.08, E.TOP + 0.38, rh * (n - 1), C.DARK);
  const lbl = { done: "Done", progress: "In progress", next: "Next", blocked: "Blocked" };
  steps.forEach((p, i) => {
    const y = E.TOP + i * rh;
    s.addShape("rect", { x: mx, y: y + 0.3, w: 0.16, h: 0.16, fill: { color: p.state === "next" ? C.WHITE : markColor(p.state) }, line: p.state === "next" ? { color: C.GRAY, width: 1 } : { type: "none" } });
    caps(s, p.tag, rx + 0.5, y + 0.25, 1.6, p.state === "blocked" ? st("blocked").ink : C.GRAY);
    s.addText(p.title, { x: rx + 2.2, y: y + 0.17, w: rw - 4.3, h: 0.42, fontFace: F.H, fontSize: 17, color: C.DARK, margin: 0, valign: "middle" });
    tag(s, lbl[p.state] || "", E.R - 2.0, y + 0.24, 2.0, p.state, "right");
    s.addText(p.desc, { x: rx + 2.2, y: y + 0.6, w: rw - 2.2, h: rh - 0.68, fontFace: F.B, fontSize: 12, color: C.BODY, margin: 0, valign: "top", fit: "shrink" });
    if (i < n - 1) hl(s, rx + 0.5, y + rh, rw - 0.5);
  });
};

TE.rings = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  const rings = d.rings || [];
  const li = Math.max(0, rings.findIndex((r) => r.dark));
  const lead = rings[li], others = rings.filter((_, i) => i !== li);
  const top = E.TOP, lw = 4.0;
  hl(s, E.L, top, E.W, 2, C.DARK);
  if (lead) {
    caps(s, lead.label, E.L, top + 0.15, lw, C.LIME);
    s.addText(`${lead.pct}%`, { x: E.L, y: top + 0.45, w: lw, h: 1.4, fontFace: F.H, fontSize: 88, color: C.DARK, margin: 0, valign: "middle" });
    meter(s, E.L, top + 1.95, lw - 0.3, lead.pct);
    s.addText(lead.sub || "", { x: E.L, y: top + 2.1, w: lw - 0.3, h: 0.4, fontFace: F.B, fontSize: 11, color: C.BODY, margin: 0, valign: "top" });
  }
  const ox = E.L + lw + 0.5, m = Math.max(others.length, 1), gap = 0.5, cw = (E.R - ox - (m - 1) * gap) / m;
  vl(s, ox - 0.25, top + 0.15, 2.4);
  others.forEach((r, i) => {
    const x = ox + i * (cw + gap);
    s.addText(r.label, { x, y: top + 0.15, w: cw, h: 0.4, fontFace: F.H, fontSize: 17, color: C.DARK, margin: 0, valign: "middle" });
    s.addText(r.sub || "", { x, y: top + 0.55, w: cw, h: 0.3, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0 });
    s.addText(`${r.pct}%`, { x, y: top + 0.85, w: cw, h: 1.0, fontFace: F.H, fontSize: 54, color: C.DARK, margin: 0, valign: "middle" });
    meter(s, x, top + 1.95, cw, r.pct);
    if (i < others.length - 1) vl(s, x + cw + gap / 2, top + 0.15, 2.4);
  });
  const stats = d.stats || [], ty = top + 2.9;
  if (stats.length) {
    hl(s, E.L, ty, E.W, 0.75, C.DARK);
    const sn = stats.length, sg = 0.5, sw = (E.W - (sn - 1) * sg) / sn;
    stats.forEach((k, i) => {
      const x = E.L + i * (sw + sg);
      s.addText(String(k.value), { x, y: ty + 0.2, w: 1.0, h: 0.9, fontFace: F.H, fontSize: 42, color: C.DARK, margin: 0, valign: "middle" });
      s.addText([{ text: "■  ", options: { color: markColor(k.state) } }, { text: k.label, options: { color: C.DARK } }],
        { x: x + 1.05, y: ty + 0.2, w: sw - 1.05, h: 0.9, fontFace: F.B, fontSize: 13, bold: true, margin: 0, valign: "middle" });
      if (i < sn - 1) vl(s, x + sw + sg / 2, ty + 0.25, 0.8);
    });
  }
  if (d.footnote) s.addText(d.footnote, { x: E.L, y: 6.5, w: E.W, h: 0.3, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

TE.phase_bars = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  const n = d.tracks.length, gap = 0.7, cw = (E.W - (n - 1) * gap) / n;
  d.tracks.forEach((t, i) => {
    const x = E.L + i * (cw + gap);
    hl(s, x, E.TOP, cw, 2, C.DARK);
    s.addText(t.title, { x, y: E.TOP + 0.12, w: cw, h: 0.45, fontFace: F.H, fontSize: 20, color: C.DARK, margin: 0, valign: "middle" });
    if (t.owner) caps(s, `Owner · ${t.owner}`, x, E.TOP + 0.6, cw, C.GRAY);
    const ph = t.phases, ry0 = E.TOP + 1.1, avail = (E.BOT - ry0) - (t.note ? 0.5 : 0), rh = Math.min(0.9, avail / ph.length);
    hl(s, x, ry0 - 0.12, cw, 0.75, C.DARK);
    ph.forEach((p, k) => {
      const y = ry0 + k * rh, ns = !p.pct;
      s.addText(p.name, { x, y, w: cw - 1.3, h: 0.38, fontFace: F.B, fontSize: 12.5, color: ns ? C.GRAY : C.DARK, margin: 0, valign: "bottom", fit: "shrink" });
      s.addText(ns ? "Not started" : `${p.pct}%`, { x: x + cw - 1.3, y, w: 1.3, h: 0.38, fontFace: F.H, fontSize: ns ? 11.5 : 18, italic: ns, color: ns ? C.GRAY : C.DARK, align: "right", margin: 0, valign: "bottom" });
      meter(s, x, y + 0.48, cw, p.pct);
    });
    if (t.note) s.addText(t.note, { x, y: E.BOT - 0.42, w: cw, h: 0.38, fontFace: F.H, fontSize: 12, italic: true, color: C.BODY, margin: 0 });
    if (i < n - 1) vl(s, x + cw + gap / 2, E.TOP + 0.15, E.BOT - E.TOP - 0.15);
  });
};

TE.workstreams = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title, 26);
  const h = d.hero, f = d.flow, lw = 3.5, rx = E.L + lw + 0.6, rw = E.R - rx;
  hl(s, E.L, E.TOP, lw, 2, C.DARK);
  caps(s, h.label || "Workstream 1", E.L, E.TOP + 0.15, lw, C.GRAY);
  s.addText(h.title, { x: E.L, y: E.TOP + 0.45, w: lw, h: 0.8, fontFace: F.H, fontSize: 20, color: C.DARK, margin: 0, valign: "top", fit: "shrink" });
  s.addText(h.metric, { x: E.L, y: E.TOP + 1.25, w: lw, h: 1.2, fontFace: F.H, fontSize: 72, color: C.LIME, margin: 0, valign: "middle" });
  tag(s, h.status || st(h.state || "done").label, E.L, E.TOP + 2.55, lw, h.state || "done");
  s.addText(h.desc || "", { x: E.L, y: E.TOP + 3.0, w: lw, h: 1.85, fontFace: F.B, fontSize: 12.5, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.25, fit: "shrink" });
  vl(s, rx - 0.3, E.TOP, E.BOT - E.TOP);
  hl(s, rx, E.TOP, rw, 2, C.DARK);
  caps(s, f.label || "Workstream 2", rx, E.TOP + 0.15, rw - 2.3, C.GRAY);
  tag(s, f.status || st(f.state || "progress").label, rx + rw - 2.3, E.TOP + 0.14, 2.3, f.state || "progress", "right");
  s.addText(f.title, { x: rx, y: E.TOP + 0.45, w: rw, h: 0.55, fontFace: F.H, fontSize: 20, color: C.DARK, margin: 0, valign: "middle" });
  const n = f.steps.length, gap = 0.3, bw = (rw - (n - 1) * gap) / n, by = E.TOP + 1.35;
  const lbl = { done: "Done", progress: "In progress", next: "Next", blocked: "Blocked" };
  f.steps.forEach((p, i) => {
    const x = rx + i * (bw + gap);
    s.addShape("rect", { x, y: by, w: bw, h: 0.06, fill: { color: p.state === "next" ? C.GRID : markColor(p.state) }, line: { type: "none" } });
    s.addText(num2(i), { x, y: by + 0.15, w: bw, h: 0.65, fontFace: F.H, fontSize: 30, color: p.state === "next" ? C.GRAY : C.DARK, margin: 0, valign: "middle" });
    s.addText(p.title, { x, y: by + 0.85, w: bw, h: 0.55, fontFace: F.B, fontSize: 13, bold: true, color: C.DARK, valign: "top", margin: 0, fit: "shrink" });
    s.addText(p.desc || "", { x, y: by + 1.4, w: bw, h: 0.8, fontFace: F.B, fontSize: 11, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
    tag(s, lbl[p.state] || "", x, by + 2.25, bw, p.state);
  });
  if (f.next) {
    hl(s, rx, E.BOT - 0.75, rw);
    s.addText([{ text: "Next: ", options: { italic: true, color: C.DARK } }, { text: f.next, options: { color: C.BODY } }],
      { x: rx, y: E.BOT - 0.65, w: rw, h: 0.55, fontFace: F.H, fontSize: 13, margin: 0, valign: "middle" });
  }
};

TE.rows = async (pres, d, idx) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title, 27);
  let visual = null, aspect = 1;
  if (d.image) { visual = path.resolve(d.image); const m = await sharp(visual).metadata(); aspect = m.height / m.width; }
  else if (d.illustration) visual = await illustration(d.illustration, idx);
  const leftW = visual ? 6.5 : E.W, top = E.TOP, bottom = E.BOT;
  if (visual) {
    const colX = E.L + leftW + 0.5, colW = E.R - colX, maxH = bottom - top - 0.3;
    let fw = Math.min(colW, d.image ? 5.2 : 3.9), fh = fw * aspect;
    if (fh > maxH) { fh = maxH; fw = fh / aspect; }
    const fx = colX + (colW - fw) / 2, fy = top + 0.15;
    vl(s, colX - 0.25, top, bottom - top);
    s.addImage({ path: visual, x: fx, y: fy, w: fw, h: fh });
    if (d.image) s.addShape("rect", { x: fx, y: fy, w: fw, h: fh, fill: { type: "none" }, line: { color: C.GRID, width: 0.75 } });
  }
  const n = d.rows.length;
  const weights = d.rows.map((r) => (typeof r.desc === "string" ? 1 : 1 + 0.35 * (r.desc.length - 1)));
  const total = weights.reduce((a, b) => a + b, 0), avail = bottom - top;
  hl(s, E.L, top, leftW, 2, C.DARK);
  let y = top;
  for (let i = 0; i < n; i++) {
    const r = d.rows[i], h = (avail * weights[i]) / total;
    s.addText(num2(i), { x: E.L, y: y + 0.12, w: 0.8, h: 0.55, fontFace: F.H, fontSize: 26, color: C.LIME, margin: 0, valign: "top" });
    s.addText(r.header, { x: E.L + 0.95, y: y + 0.14, w: leftW - 0.95, h: 0.45, fontFace: F.H, fontSize: 18, color: C.DARK, valign: "middle", margin: 0 });
    s.addText(richDesc(r.desc), { x: E.L + 0.95, y: y + 0.62, w: leftW - 0.95, h: h - 0.72, fontFace: F.B, fontSize: n >= 4 ? 11.5 : 12.5, valign: "top", margin: 0, lineSpacingMultiple: 1.22, fit: "shrink" });
    if (i < n - 1) hl(s, E.L, y + h, leftW);
    y += h;
  }
};

TE.table = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Looking Ahead", d.title || "Next Steps & Focus Areas", 30);
  const none = { type: "none" }, heavy = { type: "solid", pt: 2, color: C.DARK };
  const thin = { type: "solid", pt: 0.75, color: C.DARK }, hair = { type: "solid", pt: 0.5, color: C.GRID };
  const hd = (t, align = "left") => ({ text: t, options: { bold: true, color: C.GRAY, fontSize: 11, align, border: [heavy, none, thin, none] } });
  const rows = [[hd("Project / track"), hd("Owner"), hd("Next focus"), hd("Current")]];
  d.rows.forEach((r) => rows.push([
    { text: r.project, options: { fontFace: F.H, fontSize: 14, color: C.DARK, border: [none, none, hair, none] } },
    { text: r.owner || "—", options: { color: C.BODY, fontSize: 12, border: [none, none, hair, none] } },
    { text: r.focus, options: { color: C.BODY, fontSize: 12, border: [none, none, hair, none] } },
    { text: `■  ${String(r.current || "")}`, options: { bold: true, color: st(r.state).ink, fontSize: 11, border: [none, none, hair, none] } },
  ]));
  const rh = Math.min(0.95, 4.5 / d.rows.length);
  s.addTable(rows, {
    x: E.L, y: E.TOP, w: E.W, colW: [3.0, 2.1, 5.13, 1.7], fontFace: F.B, valign: "middle",
    rowH: [0.45, ...d.rows.map(() => rh)], margin: [0.08, 0.12, 0.08, 0.0],
  });
};

TE.gallery = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title, 27);
  const imgs = d.images.map((p) => path.resolve(p));
  const metas = await Promise.all(imgs.map((p) => sharp(p).metadata()));
  const aspect = metas[0].height / metas[0].width, n = imgs.length, gap = n > 4 ? 0.2 : 0.35;
  let fw = (E.W - (n - 1) * gap) / n, fh = fw * aspect;
  if (fh > 4.1) { fh = 4.1; fw = fh / aspect; }
  const totalW = n * fw + (n - 1) * gap, x0 = E.L + (E.W - totalW) / 2, fy = E.TOP + 0.25;
  hl(s, E.L, E.TOP, E.W, 2, C.DARK);
  imgs.forEach((p, i) => {
    const x = x0 + i * (fw + gap);
    s.addImage({ path: p, x, y: fy, w: fw, h: fh });
    s.addShape("rect", { x, y: fy, w: fw, h: fh, fill: { type: "none" }, line: { color: C.GRID, width: 0.75 } });
    const lbl = (d.labels && d.labels[i]) || `Step ${i + 1}`;
    s.addText([{ text: `Fig. ${i + 1}: `, options: { italic: true, color: C.GRAY } }, { text: lbl, options: { italic: true, color: C.DARK } }],
      { x, y: fy + fh + 0.1, w: fw, h: 0.32, fontFace: F.H, fontSize: n > 4 ? 10 : 12, margin: 0 });
  });
};

TE.activity = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Engineering Activity", d.title || "Team Delivery Activity");
  const kpis = d.kpis || [], lw = kpis.length ? 3.0 : 0, cx = kpis.length ? E.L + lw + 0.6 : E.L, cw = E.R - cx;
  if (kpis.length) {
    hl(s, E.L, E.TOP, lw, 2, C.DARK);
    const kh = (E.BOT - E.TOP) / kpis.length;
    kpis.forEach((k, i) => {
      const y = E.TOP + i * kh;
      s.addText(String(k.value), { x: E.L, y: y + 0.1, w: lw, h: kh * 0.55, fontFace: F.H, fontSize: kpis.length > 3 ? 34 : 44, color: i === 0 ? C.LIME : C.DARK, margin: 0, valign: "bottom" });
      s.addText(k.label, { x: E.L, y: y + 0.1 + kh * 0.57, w: lw, h: kh * 0.35, fontFace: F.B, fontSize: 12, color: C.BODY, margin: 0, valign: "top" });
      if (i < kpis.length - 1) hl(s, E.L, y + kh, lw);
    });
    vl(s, cx - 0.3, E.TOP, E.BOT - E.TOP);
  }
  hl(s, cx, E.TOP, cw, 2, C.DARK);
  const labels = d.people.map((p) => p.name);
  const data = d.series.map((name, i) => ({ name, labels, values: d.people.map((p) => p.values[i] || 0) }));
  s.addChart(pres.charts.BAR, data, {
    x: cx - 0.1, y: E.TOP + 0.15, w: cw + 0.1, h: E.BOT - E.TOP - (d.note ? 0.55 : 0.15),
    barDir: "col", barGrouping: "clustered", barGapWidthPct: 80,
    chartColors: [C.LIME, C.DARK, C.MID || C.LIGHT_LIME, C.GRAY].slice(0, d.series.length),
    catAxisLabelFontFace: F.B, catAxisLabelFontSize: 11, catAxisLabelColor: C.DARK, catAxisLineShow: true,
    valAxisHidden: true, valGridLine: { style: "none" },
    showValue: true, dataLabelFontFace: F.H, dataLabelFontSize: 11, dataLabelColor: C.DARK, dataLabelPosition: "outEnd",
    showLegend: true, legendPos: "t", legendFontSize: 10.5, legendFontFace: F.B,
  });
  if (d.note) s.addText(d.note, { x: cx, y: E.BOT - 0.38, w: cw, h: 0.35, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

TE.review_insights = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Quality & Code Review", d.title || "Code Review Insights");
  const stats = d.stats || [], sn = Math.max(stats.length, 1), sg = 0.5, sw = (E.W - (sn - 1) * sg) / sn;
  hl(s, E.L, E.TOP, E.W, 2, C.DARK);
  stats.forEach((k, i) => {
    const x = E.L + i * (sw + sg);
    s.addText(String(k.value), { x, y: E.TOP + 0.12, w: 1.6, h: 0.95, fontFace: F.H, fontSize: 48, color: i === 0 ? C.LIME : C.DARK, margin: 0, valign: "middle" });
    s.addText(k.label, { x: x + 1.65, y: E.TOP + 0.12, w: sw - 1.65, h: 0.95, fontFace: F.B, fontSize: 12.5, color: C.BODY, margin: 0, valign: "middle" });
    if (i < sn - 1) vl(s, x + sw + sg / 2, E.TOP + 0.2, 0.8);
  });
  const f = d.findings || [], fy0 = E.TOP + 1.35;
  hl(s, E.L, fy0, E.W, 0.75, C.DARK);
  const avail = E.BOT - fy0 - (d.note ? 0.45 : 0.05), rh = avail / Math.max(f.length, 1);
  const lbl = { done: "Resolved", progress: "In progress", blocked: "Open risk", next: "Planned" };
  f.forEach((it, i) => {
    const y = fy0 + i * rh;
    s.addText(num2(i), { x: E.L, y: y + 0.12, w: 0.7, h: 0.45, fontFace: F.H, fontSize: 22, color: C.GRAY, margin: 0, valign: "top" });
    caps(s, it.area, E.L + 0.85, y + 0.14, E.W - 3.4, C.DARK);
    tag(s, it.status || lbl[it.state] || "", E.R - 2.5, y + 0.13, 2.5, it.state, "right");
    s.addText(it.text, { x: E.L + 0.85, y: y + 0.44, w: E.W - 3.4, h: rh - 0.5, fontFace: F.B, fontSize: f.length > 4 ? 11.5 : 12.5, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
    if (i < f.length - 1) hl(s, E.L + 0.85, y + rh, E.W - 0.85);
  });
  if (d.note) s.addText(d.note, { x: E.L, y: E.BOT - 0.38, w: E.W, h: 0.35, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

TE.attention = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Needs Attention", d.title || "Blockers & Decisions Needed");
  const gap = 0.8, cw = (E.W - gap) / 2;
  const cols = [
    { x: E.L, head: d.blockersTitle || "Blockers & Risks", items: d.blockers || [], rule: C.AMBER, ink: st("blocked").ink, empty: d.noBlockers || "No open blockers." },
    { x: E.L + cw + gap, head: d.decisionsTitle || "Decisions Needed", items: d.decisions || [], rule: C.DARK, ink: C.LIME, empty: "No decisions needed." },
  ];
  vl(s, E.L + cw + gap / 2, E.TOP, E.BOT - E.TOP);
  const maxN = Math.max(cols[0].items.length, cols[1].items.length, 1);
  const ih = Math.min(1.6, (E.BOT - E.TOP - 0.6) / maxN);
  cols.forEach((col) => {
    hl(s, col.x, E.TOP, cw, 3, col.rule);
    caps(s, col.head, col.x, E.TOP + 0.16, cw, col.ink);
    if (!col.items.length) {
      s.addText(col.empty, { x: col.x, y: E.TOP + 0.6, w: cw, h: 0.5, fontFace: F.H, fontSize: 15, italic: true, color: C.GRAY, margin: 0 });
      return;
    }
    col.items.forEach((it, i) => {
      const y = E.TOP + 0.6 + i * ih;
      s.addText(num2(i), { x: col.x, y: y + 0.05, w: 0.7, h: 0.5, fontFace: F.H, fontSize: 24, color: col.ink, margin: 0, valign: "top" });
      const runs = [{ text: it.title, options: { fontFace: F.H, fontSize: 15, color: C.DARK, breakLine: true } }];
      if (it.text) runs.push({ text: it.text, options: { fontSize: 12, color: C.BODY, breakLine: !!it.meta } });
      if (it.meta) runs.push({ text: it.meta, options: { fontSize: 11, italic: true, color: C.GRAY } });
      s.addText(runs, { x: col.x + 0.8, y: y + 0.05, w: cw - 0.8, h: ih - 0.15, fontFace: F.B, valign: "top", margin: 0, lineSpacingMultiple: 1.15, paraSpaceAfter: 4, fit: "shrink" });
      if (i < col.items.length - 1) hl(s, col.x + 0.8, y + ih - 0.05, cw - 0.8);
    });
  });
};

TE.tracker = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow || "Team · Task Tracker", d.title || "Developer Task Track");
  const devs = d.devs || [], n = Math.max(devs.length, 1), gap = 0.5, cw = (E.W - (n - 1) * gap) / n;
  const bottom = d.footnote ? E.BOT - 0.4 : E.BOT;
  devs.forEach((v, i) => {
    const x = E.L + i * (cw + gap);
    hl(s, x, E.TOP, cw, 2, C.DARK);
    s.addText(v.name, { x, y: E.TOP + 0.1, w: cw, h: 0.45, fontFace: F.H, fontSize: 18, color: C.DARK, margin: 0, valign: "middle", fit: "shrink" });
    caps(s, v.project, x, E.TOP + 0.55, cw, C.LIME, { fit: "shrink" });
    const ny = E.TOP + 0.9;
    s.addText(String(v.done ?? 0), { x, y: ny, w: 0.6, h: 0.6, fontFace: F.H, fontSize: 32, color: C.DARK, margin: 0, valign: "middle" });
    caps(s, "Done", x + 0.62, ny + 0.17, 0.8, C.GRAY);
    s.addText(String(v.open ?? 0), { x: x + 1.45, y: ny, w: 0.6, h: 0.6, fontFace: F.H, fontSize: 32, color: C.DARK, margin: 0, valign: "middle" });
    caps(s, "Open", x + 2.07, ny + 0.17, 0.8, C.GRAY);
    s.addText(`${v.pct ?? 0}%`, { x: x + cw - 1.0, y: ny, w: 1.0, h: 0.6, fontFace: F.H, fontSize: 20, color: C.DARK, align: "right", margin: 0, valign: "middle" });
    meter(s, x, ny + 0.7, cw, v.pct);
    s.addText(v.focus || "", { x, y: ny + 0.85, w: cw, h: 0.65, fontFace: F.H, fontSize: 11.5, italic: true, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.1, fit: "shrink" });
    const iy0 = ny + 1.6;
    hl(s, x, iy0 - 0.05, cw);
    const items = v.items || [], ih = Math.min(0.48, (bottom - iy0) / Math.max(items.length, 1));
    items.forEach((it, k) => {
      const y = iy0 + 0.08 + k * ih;
      s.addText([{ text: "■  ", options: { color: markColor(it.state) } }, { text: it.text, options: { color: it.state === "next" ? C.GRAY : C.DARK } }],
        { x, y, w: cw, h: ih, fontFace: F.B, fontSize: 11, valign: "top", margin: 0, fit: "shrink" });
    });
    if (i < n - 1) vl(s, x + cw + gap / 2, E.TOP + 0.15, bottom - E.TOP - 0.15);
  });
  if (d.footnote) s.addText(d.footnote, { x: E.L, y: E.BOT - 0.3, w: E.W, h: 0.3, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// ---------- Showship signature layouts ----------
// Colour-coded projects (one colour per project, carried across every slide), "ship trail"
// ribbons as the recurring motif, semicircle gauges, pill-track phase charts.
const TS = {};
const PROJ = {};
let PROJ_N = 0;
function projColor(name, explicit) {
  if (explicit) return String(explicit).replace(/^#/, "").toUpperCase();
  const key = String(name || "").trim().split(/[\s·:\-]+/)[0].toLowerCase() || "_";
  if (!(key in PROJ)) PROJ[key] = STYLE.projectColors[PROJ_N++ % STYLE.projectColors.length];
  return PROJ[key];
}
function shade(hex, t) {
  const n = parseInt(hex, 16), mix = (c) => Math.round(c * (1 - t)).toString(16).padStart(2, "0");
  return (mix(n >> 16) + mix((n >> 8) & 255) + mix(n & 255)).toUpperCase();
}
function tint(hex, t) {
  const n = parseInt(hex, 16), mix = (c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0");
  return (mix(n >> 16) + mix((n >> 8) & 255) + mix(n & 255)).toUpperCase();
}
const TRAIL = ["6C4CF5", "10A6A0", "FF6B4A", "F5A524"];
async function trailArt(kind) {
  const file = path.join(CACHE, `trail_${kind}.png`);
  if (fs.existsSync(file)) return file;
  let svg;
  if (kind === "bookend") {
    const W = 1920, H = 1080;
    const ribbons = TRAIL.map((c, i) => {
      const y0 = 1180 - i * 10, y1 = 120 + i * 85, w = [34, 22, 14, 9][i];
      return `<defs><linearGradient id="g${i}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#${c}" stop-opacity="0"/><stop offset="0.55" stop-color="#${c}" stop-opacity="0.85"/><stop offset="1" stop-color="#${c}"/></linearGradient></defs>
        <path d="M ${560 + i * 40} ${y0} C ${1100 + i * 30} ${900 - i * 40}, ${1250 - i * 20} ${420 + i * 30}, ${2000} ${y1}" fill="none" stroke="url(#g${i})" stroke-width="${w}" stroke-linecap="round"/>`;
    }).join("");
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#17153A"/>
      ${ribbons}</svg>`;
  } else if (kind === "corner") {
    const W = 1100, H = 330;
    const ribbons = TRAIL.map((c, i) => `<path d="M ${120 + i * 50} ${H + 20} C ${520 + i * 20} ${250 - i * 15}, ${700} ${120 + i * 25}, ${W + 40} ${30 + i * 32}" fill="none" stroke="#${c}" stroke-opacity="${0.55 - i * 0.07}" stroke-width="${[14, 10, 7, 5][i]}" stroke-linecap="round"/>`).join("");
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ribbons}</svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 128 128"><g transform="translate(64 64) scale(0.86) translate(-63.5 -71.9)"><path d="M24.0 96.0 C48.0 94.0 70.0 74.0 92.0 40.0" fill="none" stroke="#6C4CF5" stroke-width="14" stroke-linecap="round"/><path d="M36.1 110.7 C60.1 108.7 82.1 88.7 100.8 59.7" fill="none" stroke="#10A6A0" stroke-width="10" stroke-linecap="round"/><path d="M45.6 122.2 C69.6 120.2 91.6 100.2 106.6 77.2" fill="none" stroke="#FF6B4A" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="27" r="9" fill="#F5A524"/></g></svg>`;
  }
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}
async function sigHeader(s, eyebrow, title, size) {
  s.addImage({ path: await trailArt("corner"), x: 10.0, y: 0, w: 3.333, h: 0.8 });
  s.addShape("ellipse", { x: 0.7, y: 0.6, w: 0.13, h: 0.13, fill: { color: C.LIME }, line: { type: "none" } });
  s.addText(String(eyebrow || ""), { x: 0.92, y: 0.5, w: 9, h: 0.32, fontFace: F.H, fontSize: 11.5, bold: true, color: C.LIME, margin: 0, valign: "middle" });
  s.addText(title || "", { x: 0.7, y: 0.85, w: 10.5, h: 0.75, fontFace: F.H, fontSize: Math.min(size || 28, 28), bold: true, color: C.DARK, margin: 0, fit: "shrink", valign: "middle" });
}
async function sigFooter(s) {
  s.addImage({ path: await trailArt("mark"), x: 10.62, y: 7.1, w: 0.22, h: 0.22 });
  s.addText([{ text: "Shipped with ", options: { color: C.GRAY } }, { text: "Showship", options: { color: C.DARK, bold: true } }],
    { x: 10.9, y: 7.08, w: 1.5, h: 0.26, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
  s.addText(String(SLIDE_NO), { x: 12.33, y: 7.08, w: 0.3, h: 0.26, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, align: "right", margin: 0, valign: "middle" });
}
async function sigSlide(pres, eyebrow, title, size) {
  const s = pres.addSlide();
  SLIDE_NO++;
  s.background = { color: C.BG };
  await sigHeader(s, eyebrow, title, size);
  if (STYLE.signature !== false) await sigFooter(s);
  return s;
}
function chip(s, text, x, y, color, filled = true) {
  text = sentence(text);
  const w = 0.3 + String(text).length * 0.085;
  s.addShape("roundRect", { x, y, w, h: 0.3, rectRadius: 0.15, fill: { color: filled ? color : tint(color, 0.85) }, line: { type: "none" } });
  s.addText(String(text), { x, y, w, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: filled ? "FFFFFF" : color, align: "center", valign: "middle", margin: 0 });
  return w;
}
function stateColor(state, proj) {
  return { done: proj, progress: proj, blocked: C.AMBER, next: C.GRAY }[state] || proj;
}
function gauge(s, cx, cy, r, pct, color) {
  const box = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
  s.addShape("blockArc", { ...box, angleRange: [180, 0], arcThicknessRatio: 0.22, fill: { color: tint(color, 0.85) }, line: { type: "none" } });
  const p = Math.max(0, Math.min(100, pct));
  if (p > 0) s.addShape("blockArc", { ...box, angleRange: [180, (180 + 180 * p / 100) % 360], arcThicknessRatio: 0.22, fill: { color }, line: { type: "none" } });
}

async function sigBookend(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: C.DARK };
  s.addImage({ path: await trailArt("bookend"), x: 0, y: 0, w: 13.333, h: 7.5 });
  if (LOGO) {
    smallLogo(s, 1.15, 1.38, 0.66, 0.66);
  }
  s.addText(r.company, { x: LOGO ? 1.8 : 0.7, y: 0.6, w: 6, h: 0.9, fontFace: F.H, fontSize: 14, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(r.eyebrow, { x: 0.7, y: 2.55, w: 8, h: 0.4, fontFace: F.H, fontSize: 14, bold: true, color: C.ON_DARK, margin: 0 });
    s.addText(r.title, { x: 0.7, y: 2.95, w: 8.2, h: 2.2, fontFace: F.H, fontSize: 48, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.0, margin: 0, valign: "top" });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.7, w: 8.2, h: 1.2, fontFace: F.H, fontSize: 60, bold: true, color: "FFFFFF", margin: 0 });
    s.addText("Questions & discussion", { x: 0.7, y: 3.9, w: 8.2, h: 0.6, fontFace: F.H, fontSize: 22, color: C.ON_DARK, margin: 0 });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  let x = 0.7;
  for (const [k, v] of [["Presenter", presenter], ["Date", r.date]]) {
    const w = 1.0 + String(v || "").length * 0.11;
    s.addShape("roundRect", { x, y: 6.1, w, h: 0.62, rectRadius: 0.31, fill: { color: "FFFFFF", transparency: 88 }, line: { color: "FFFFFF", transparency: 70, width: 0.75 } });
    s.addText([{ text: `${k}  `, options: { color: "B9B5E8", fontSize: 11 } }, { text: v || "", options: { color: "FFFFFF", bold: true, fontSize: 13 } }],
      { x, y: 6.1, w, h: 0.62, fontFace: F.H, align: "center", valign: "middle", margin: 0 });
    x += w + 0.25;
  }
  if (STYLE.signature !== false) {
    s.addImage({ path: await trailArt("mark"), x: 10.55, y: 6.3, w: 0.28, h: 0.28 });
    s.addText([{ text: "Shipped with ", options: { color: "B9B5E8" } }, { text: "Showship", options: { color: "FFFFFF", bold: true } }],
      { x: 10.9, y: 6.27, w: 1.75, h: 0.34, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
  }
}

TS.dashboard = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow || "Executive Summary", d.title || "This Week at a Glance", 30);
  const n = d.cards.length, gap = 0.35, cw = (11.93 - (n - 1) * gap) / n, cy = 1.95, ch = d.keyUpdate ? 3.95 : 4.75;
  for (let i = 0; i < n; i++) {
    const c = d.cards[i], x = 0.7 + i * (cw + gap), col = projColor(c.label, c.color);
    s.addShape("roundRect", { x, y: cy, w: cw, h: ch, rectRadius: 0.22, fill: { color: "FFFFFF" }, line: { color: tint(col, 0.75), width: 1 },
      shadow: { type: "outer", color: col, opacity: 0.12, blur: 12, offset: 3, angle: 90 } });
    s.addShape("roundRect", { x: x + 0.25, y: cy + 0.25, w: cw - 0.5, h: 0.42, rectRadius: 0.21, fill: { color: tint(col, 0.88) }, line: { type: "none" } });
    s.addShape("ellipse", { x: x + 0.38, y: cy + 0.4, w: 0.12, h: 0.12, fill: { color: col }, line: { type: "none" } });
    s.addText(String(c.label), { x: x + 0.58, y: cy + 0.25, w: cw - 0.95, h: 0.42, fontFace: F.H, fontSize: 11, bold: true, color: col, margin: 0, valign: "middle", fit: "shrink" });
    const m = String(c.metric).match(/^(\d+(?:\.\d+)?)\s*%$/), f = String(c.metric).match(/^(\d+)\s*\/\s*(\d+)$/);
    const gy = cy + 0.85, gr = Math.min(1.05, cw / 2 - 0.45), gcx = x + cw / 2;
    if (m) {
      gauge(s, gcx, gy + gr, gr, Number(m[1]), col);
      s.addText(c.metric, { x: gcx - gr, y: gy + gr * 0.42, w: 2 * gr, h: gr * 0.6, fontFace: F.H, fontSize: 30, bold: true, color: C.DARK, align: "center", valign: "bottom", margin: 0 });
    } else if (f) {
      const done = +f[1], tot = Math.max(1, +f[2]), sw = Math.min(0.9, (2 * gr - (tot - 1) * 0.12) / tot), sx = gcx - (tot * sw + (tot - 1) * 0.12) / 2;
      s.addText(c.metric, { x: gcx - gr, y: gy, w: 2 * gr, h: gr * 0.75, fontFace: F.H, fontSize: 34, bold: true, color: C.DARK, align: "center", valign: "middle", margin: 0 });
      for (let k = 0; k < tot; k++) s.addShape("roundRect", { x: sx + k * (sw + 0.12), y: gy + gr * 0.8, w: sw, h: 0.2, rectRadius: 0.1, fill: { color: k < done ? col : tint(col, 0.85) }, line: { type: "none" } });
    } else {
      s.addText(c.metric, { x: gcx - gr, y: gy, w: 2 * gr, h: gr, fontFace: F.H, fontSize: 34, bold: true, color: C.DARK, align: "center", valign: "middle", margin: 0 });
    }
    const sty = gy + gr + 0.15, st0 = c.status || st(c.state).label, sw2 = 0.3 + st0.length * 0.085;
    chip(s, st0, gcx - sw2 / 2, sty, stateColor(c.state, col), c.state === "done");
    s.addText(c.headline, { x: x + 0.3, y: sty + 0.45, w: cw - 0.6, h: 0.42, fontFace: F.H, fontSize: 14.5, bold: true, color: C.DARK, align: "center", margin: 0, valign: "top", fit: "shrink" });
    s.addText(c.desc, { x: x + 0.3, y: sty + 0.85, w: cw - 0.6, h: cy + ch - sty - 0.95, fontFace: F.B, fontSize: 11.5, color: C.BODY, align: "center", valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
  }
  if (d.keyUpdate) {
    const y = 6.1;
    s.addShape("roundRect", { x: 0.7, y, w: 11.93, h: 0.7, rectRadius: 0.35, fill: { color: C.DARK }, line: { type: "none" } });
    s.addShape("roundRect", { x: 0.8, y: y + 0.1, w: 1.65, h: 0.5, rectRadius: 0.25, fill: { color: C.ON_DARK }, line: { type: "none" } });
    s.addText("Key update", { x: 0.8, y: y + 0.1, w: 1.65, h: 0.5, fontFace: F.H, fontSize: 11, bold: true, color: C.DARK, align: "center", valign: "middle", margin: 0 });
    s.addText(d.keyUpdate, { x: 2.65, y, w: 9.8, h: 0.7, fontFace: F.H, fontSize: 12, color: "FFFFFF", valign: "middle", margin: 0, fit: "shrink" });
  }
};

TS.phase_bars = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow, d.title);
  const tracks = d.tracks, n = tracks.length, top = 1.95, gap = 0.3, th = (4.95 - (n - 1) * gap) / n;
  tracks.forEach((t, i) => {
    // tracks of one project share the project's colour family: base colour, then a deeper shade
    const y = top + i * (th + gap), base = d.color ? projColor("", d.color) : projFor([d.project, d.eyebrow, d.title]);
    const c = t.color ? projColor("", t.color) : (i === 0 ? base : shade(base, 0.3 * i));
    s.addShape("roundRect", { x: 0.7, y, w: 11.93, h: th, rectRadius: 0.22, fill: { color: "FFFFFF" }, line: { color: tint(c, 0.78), width: 1 } });
    const avg = Math.round(t.phases.reduce((a, p) => a + (p.pct || 0), 0) / t.phases.length);
    s.addShape("ellipse", { x: 1.0, y: y + 0.33, w: 0.16, h: 0.16, fill: { color: c }, line: { type: "none" } });
    s.addText(t.title, { x: 1.25, y: y + 0.2, w: 6, h: 0.42, fontFace: F.H, fontSize: 17, bold: true, color: C.DARK, margin: 0, valign: "middle" });
    if (t.owner) s.addText(t.owner, { x: 1.25, y: y + 0.58, w: 6, h: 0.3, fontFace: F.H, fontSize: 11, color: C.GRAY, margin: 0, valign: "middle" });
    s.addText([{ text: `${avg}%`, options: { fontSize: 30, bold: true, color: c } }, { text: "  track", options: { fontSize: 11, color: C.GRAY } }],
      { x: 9.6, y: y + 0.15, w: 2.75, h: 0.7, fontFace: F.H, align: "right", valign: "middle", margin: 0 });
    const ph = t.phases, px = 1.0, pw = 11.33, pg = 0.08, sw = (pw - (ph.length - 1) * pg) / ph.length, py = y + 1.05, hh = 0.42;
    ph.forEach((p, k) => {
      const x = px + k * (sw + pg), pct = Math.max(0, Math.min(100, p.pct || 0));
      s.addShape("roundRect", { x, y: py, w: sw, h: hh, rectRadius: 0.21, fill: { color: pct === 0 ? "F1F0F6" : tint(c, 0.82) }, line: pct === 0 ? { color: "C9C6D8", width: 1, dashType: "dash" } : { type: "none" } });
      if (pct > 0) s.addShape("roundRect", { x, y: py, w: Math.max(hh, sw * pct / 100), h: hh, rectRadius: 0.21, fill: { color: c }, line: { type: "none" } });
      const fw = Math.max(hh, sw * pct / 100), inside = pct >= 50;
      s.addText(pct >= 100 ? "✓  100%" : pct > 0 ? `${pct}%` : "Not started", { x: pct > 0 && !inside ? x + fw + 0.08 : x + 0.12, y: py, w: sw - 0.24, h: hh, fontFace: F.H, fontSize: 11, bold: true, color: inside ? "FFFFFF" : (pct > 0 ? c : C.GRAY), valign: "middle", margin: 0 });
      s.addText(p.name, { x, y: py + hh + 0.08, w: sw, h: 0.5, fontFace: F.H, fontSize: 11, color: pct === 0 ? C.GRAY : C.DARK, valign: "top", margin: 0, fit: "shrink" });
    });
    if (t.note) s.addText(t.note, { x: 1.0, y: y + th - 0.45, w: 11.3, h: 0.32, fontFace: F.H, fontSize: 11, italic: true, color: C.BODY, margin: 0, valign: "middle" });
  });
};

// project colour for a slide: the registered project whose name appears first in the given texts
function projFor(texts, fallback) {
  const hay = texts.filter(Boolean).join("  ").toLowerCase();
  let best = null, bi = Infinity;
  for (const k of Object.keys(PROJ)) {
    const m = hay.match(new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`));
    if (m && m.index < bi) { bi = m.index; best = k; }
  }
  if (best) return PROJ[best];
  return fallback === undefined ? projColor(texts.find(Boolean)) : fallback;
}
async function iconC(name, hex) {
  const comp = Lu["Lu" + name] || Lu.LuCircle;
  const file = path.join(CACHE, `iconc_${name}_${hex}.png`);
  if (fs.existsSync(file)) return file;
  let svg = ReactDOMServer.renderToStaticMarkup(React.createElement(comp, { size: 256, color: "#" + hex, strokeWidth: 2 }));
  svg = svg.replace(/currentColor/g, "#" + hex);
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(file);
  return file;
}
function rcard(s, x, y, w, h, col, opts = {}) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: opts.r ?? 0.22, fill: { color: opts.fill || "FFFFFF" },
    line: opts.noline ? { type: "none" } : { color: col ? tint(col, 0.78) : C.GRID, width: 1 },
    ...(opts.shadow === false ? {} : { shadow: { type: "outer", color: col || "17153A", opacity: 0.1, blur: 10, offset: 2, angle: 90 } }) });
}
function stChip(s, state, text, x, y, col, align = "left") {
  const t = String(text || st(state).label);
  const c = state === "blocked" ? C.AMBER : state === "next" ? C.GRAY : col;
  const w = 0.3 + t.length * 0.085, xx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  chip(s, t, xx, y, c, state === "done" || state === "blocked");
  return w;
}
const initials = (n) => String(n || "").replace(/@\S+/g, "").trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

TS.timeline = async (pres, d, idx) => {
  const s = await sigSlide(pres, d.eyebrow, d.title);
  const col = projFor([d.title, d.eyebrow]);
  if (d.badge) stChip(s, d.badge.state || "done", d.badge.text, 12.63, 0.98, col, "right");
  const steps = d.steps, n = steps.length, colW = Math.min(2.8, 11.93 / n - 0.15);
  const X0 = 0.7 + colW / 2, X1 = 12.633 - colW / 2, sw = (X1 - X0) / Math.max(n - 1, 1);
  const pts = steps.map((_, i) => [X0 + i * sw, 3.05 + (i % 2 ? 0.32 : -0.12)]);
  let last = -1; steps.forEach((p, i) => { if (p.state === "done" || p.state === "progress") last = i; });
  // trail: future part tinted + dashed feel, travelled part solid in the project colour
  const PX = 150, ox = 0.7, oy = 2.2, W = Math.round(11.93 * PX), H = Math.round(1.8 * PX);
  const P = pts.map(([x, y]) => [Math.round((x - ox) * PX), Math.round((y - oy) * PX)]);
  const full = smoothPath([[0, P[0][1] + 40], ...P, [W, P[P.length - 1][1] - 40]]);
  const done = last >= 0 ? smoothPath([[0, P[0][1] + 40], ...P.slice(0, last + 1)]) : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <path d="${full}" fill="none" stroke="#${tint(col, 0.75)}" stroke-width="16" stroke-linecap="round" stroke-dasharray="2 26"/>
    ${done ? `<path d="${done}" fill="none" stroke="#${col}" stroke-width="16" stroke-linecap="round"/>` : ""}</svg>`;
  const file = path.join(CACHE, `trail_tl_${idx}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  s.addImage({ path: file, x: ox, y: oy, w: 11.93, h: 1.8 });
  steps.forEach((p, i) => {
    const [cx, cy] = pts[i], r = 0.3;
    const fill = p.state === "done" ? col : p.state === "blocked" ? C.AMBER : "FFFFFF";
    s.addShape("ellipse", { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: fill },
      line: p.state === "progress" ? { color: col, width: 3 } : p.state === "next" ? { color: C.GRAY, width: 2, dashType: "dash" } : { color: "FFFFFF", width: 3 },
      shadow: { type: "outer", color: fill === "FFFFFF" ? "17153A" : fill, opacity: 0.25, blur: 8, offset: 2, angle: 90 } });
    const glyph = p.state === "done" ? "✓" : p.state === "blocked" ? "!" : String(i + 1);
    s.addText(glyph, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fontFace: F.H, fontSize: 16, bold: true, color: p.state === "done" || p.state === "blocked" ? "FFFFFF" : (p.state === "next" ? C.GRAY : col), align: "center", valign: "middle", margin: 0 });
    if (i === last && last < n - 1) chip(s, "Now", cx - 0.35, cy - r - 0.42, C.ON_DARK === "FFC94A" ? "F5A524" : col, true);
    const tw = colW, ty = 4.15;
    s.addText(String(p.tag || ""), { x: cx - tw / 2, y: ty, w: tw, h: 0.26, fontFace: F.H, fontSize: 11, bold: true, color: p.state === "blocked" ? C.AMBER : col, align: "center", margin: 0 });
    s.addText(p.title, { x: cx - tw / 2, y: ty + 0.28, w: tw, h: 0.4, fontFace: F.H, fontSize: 15, bold: true, color: C.DARK, align: "center", margin: 0, fit: "shrink" });
    s.addText(p.desc || "", { x: cx - tw / 2, y: ty + 0.7, w: tw, h: 0.8, fontFace: F.B, fontSize: 11, color: C.BODY, align: "center", valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
  });
  if (d.impact) {
    const y = 6.1;
    s.addShape("roundRect", { x: 0.7, y, w: 11.93, h: 0.7, rectRadius: 0.35, fill: { color: tint(col, 0.88) }, line: { type: "none" } });
    s.addShape("roundRect", { x: 0.8, y: y + 0.1, w: 1.95, h: 0.5, rectRadius: 0.25, fill: { color: col }, line: { type: "none" } });
    s.addText("Business impact", { x: 0.8, y: y + 0.1, w: 1.95, h: 0.5, fontFace: F.H, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(d.impact, { x: 2.95, y, w: 9.5, h: 0.7, fontFace: F.H, fontSize: 12.5, color: C.DARK, valign: "middle", margin: 0, fit: "shrink" });
  }
};

TS.rings = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow, d.title);
  const col = projFor([d.eyebrow, d.title]);
  const rings = d.rings || [], li = Math.max(0, rings.findIndex((r) => r.dark));
  const lead = rings[li], others = rings.filter((_, i) => i !== li);
  const top = 1.95, h = 4.85;
  rcard(s, 0.7, top, 5.3, h, col);
  if (lead) {
    gauge(s, 3.35, top + 2.75, 1.85, lead.pct, col);
    s.addText(`${lead.pct}%`, { x: 1.5, y: top + 1.55, w: 3.7, h: 1.2, fontFace: F.H, fontSize: 48, bold: true, color: C.DARK, align: "center", valign: "bottom", margin: 0 });
    s.addText(lead.label, { x: 1.0, y: top + 3.05, w: 4.7, h: 0.45, fontFace: F.H, fontSize: 17, bold: true, color: C.DARK, align: "center", margin: 0 });
    s.addText(lead.sub || "", { x: 1.0, y: top + 3.5, w: 4.7, h: 0.35, fontFace: F.H, fontSize: 11, color: C.GRAY, align: "center", margin: 0 });
    if (d.footnote) s.addText(d.footnote, { x: 1.0, y: top + h - 0.6, w: 4.7, h: 0.4, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, align: "center", margin: 0, fit: "shrink" });
  }
  const rx = 6.3, rw = 12.63 - rx, m = Math.max(others.length, 1), g = 0.3, ow = (rw - (m - 1) * g) / m, oh = 2.4;
  others.forEach((r, i) => {
    const x = rx + i * (ow + g), c = shade(col, 0.25 * i);
    rcard(s, x, top, ow, oh, c);
    gauge(s, x + ow / 2, top + 1.45, 0.85, r.pct, c);
    s.addText(`${r.pct}%`, { x: x + ow / 2 - 0.85, y: top + 0.85, w: 1.7, h: 0.6, fontFace: F.H, fontSize: 22, bold: true, color: C.DARK, align: "center", valign: "bottom", margin: 0 });
    s.addText(r.label, { x: x + 0.2, y: top + 1.6, w: ow - 0.4, h: 0.38, fontFace: F.H, fontSize: 14, bold: true, color: C.DARK, align: "center", margin: 0 });
    s.addText(r.sub || "", { x: x + 0.2, y: top + 1.95, w: ow - 0.4, h: 0.3, fontFace: F.H, fontSize: 11, color: C.GRAY, align: "center", margin: 0, fit: "shrink" });
  });
  const stats = d.stats || [];
  if (stats.length) {
    const y = top + oh + 0.3, hh = h - oh - 0.3;
    rcard(s, rx, y, rw, hh, col);
    s.addText("Phases", { x: rx + 0.3, y: y + 0.2, w: 3, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
    const cells = []; stats.forEach((k) => { for (let j = 0; j < (Number(k.value) || 0); j++) cells.push(k.state); });
    const N = Math.max(cells.length, 1), cs = Math.min(0.5, (rw - 0.6 - (N - 1) * 0.1) / N);
    cells.forEach((stt, j) => s.addShape("roundRect", { x: rx + 0.3 + j * (cs + 0.1), y: y + 0.6, w: cs, h: cs, rectRadius: 0.1,
      fill: { color: stt === "done" ? col : stt === "progress" ? tint(col, 0.6) : "ECEAF5" }, line: stt === "next" ? { color: "C9C6D8", width: 1, dashType: "dash" } : { type: "none" } }));
    const lw = (rw - 0.6) / stats.length;
    stats.forEach((k, j) => {
      const x = rx + 0.3 + j * lw, c = k.state === "done" ? col : k.state === "progress" ? tint(col, 0.6) : "C9C6D8";
      s.addShape("ellipse", { x, y: y + 1.42, w: 0.14, h: 0.14, fill: { color: c }, line: { type: "none" } });
      s.addText([{ text: String(k.value), options: { fontSize: 20, bold: true, color: C.DARK, breakLine: true } }, { text: k.label, options: { fontSize: 11, color: C.BODY } }],
        { x: x + 0.22, y: y + 1.25, w: lw - 0.25, h: 0.85, fontFace: F.H, valign: "top", margin: 0 });
    });
  }
};

TS.workstreams = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow, d.title, 26);
  const col = projFor([d.eyebrow, d.title]), h = d.hero, f = d.flow, top = 1.95, H = 4.85;
  s.addShape("roundRect", { x: 0.7, y: top, w: 3.9, h: H, rectRadius: 0.25, fill: { color: col }, line: { type: "none" }, shadow: { type: "outer", color: col, opacity: 0.3, blur: 14, offset: 4, angle: 90 } });
  s.addImage({ path: await trailArt("corner"), x: 0.7, y: top + H - 1.0, w: 3.9, h: 1.0, transparency: 40 });
  s.addText((h.label || "Workstream 1"), { x: 1.0, y: top + 0.3, w: 3.3, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: tint(col, 0.6), margin: 0 });
  s.addText(h.title, { x: 1.0, y: top + 0.6, w: 3.3, h: 0.8, fontFace: F.H, fontSize: 19, bold: true, color: "FFFFFF", margin: 0, valign: "top", fit: "shrink" });
  s.addText(h.metric, { x: 1.0, y: top + 1.45, w: 3.3, h: 1.1, fontFace: F.H, fontSize: 60, bold: true, color: "FFFFFF", margin: 0, valign: "middle" });
  const hs = h.status || st(h.state || "done").label;
  s.addShape("roundRect", { x: 1.0, y: top + 2.65, w: 0.3 + hs.length * 0.085, h: 0.3, rectRadius: 0.15, fill: { color: "FFFFFF" }, line: { type: "none" } });
  s.addText(hs, { x: 1.0, y: top + 2.65, w: 0.3 + hs.length * 0.085, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: col, align: "center", valign: "middle", margin: 0 });
  s.addText(h.desc || "", { x: 1.0, y: top + 3.1, w: 3.3, h: 1.1, fontFace: F.B, fontSize: 11.5, color: "FFFFFF", valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
  const rx = 4.9, rw = 12.63 - rx;
  rcard(s, rx, top, rw, H, col);
  s.addText((f.label || "Workstream 2"), { x: rx + 0.35, y: top + 0.3, w: 4, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
  stChip(s, f.state || "progress", f.status, rx + rw - 0.35, top + 0.3, col, "right");
  s.addText(f.title, { x: rx + 0.35, y: top + 0.6, w: rw - 0.7, h: 0.5, fontFace: F.H, fontSize: 19, bold: true, color: C.DARK, margin: 0 });
  const n = f.steps.length, g = 0.1, bw = (rw - 0.7 - (n - 1) * g) / n, by = top + 1.45;
  f.steps.forEach((p, i) => {
    const x = rx + 0.35 + i * (bw + g), on = p.state === "done", pr = p.state === "progress";
    s.addShape("roundRect", { x, y: by, w: bw, h: 0.5, rectRadius: 0.25, fill: { color: on ? col : pr ? tint(col, 0.7) : "F1F0F6" }, line: p.state === "next" ? { color: "C9C6D8", width: 1, dashType: "dash" } : { type: "none" } });
    s.addText(`${num2(i)}  ${on ? "✓" : ""}`, { x: x + 0.18, y: by, w: bw - 0.3, h: 0.5, fontFace: F.H, fontSize: 13, bold: true, color: on ? "FFFFFF" : pr ? shade(col, 0.3) : C.GRAY, valign: "middle", margin: 0 });
    s.addText(p.title, { x, y: by + 0.65, w: bw, h: 0.5, fontFace: F.H, fontSize: 13, bold: true, color: C.DARK, valign: "top", margin: 0, fit: "shrink" });
    s.addText(p.desc || "", { x, y: by + 1.15, w: bw, h: 0.9, fontFace: F.B, fontSize: 11, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
  });
  if (f.next) {
    const y = top + H - 0.95;
    s.addShape("roundRect", { x: rx + 0.35, y, w: rw - 0.7, h: 0.6, rectRadius: 0.3, fill: { color: tint(col, 0.9) }, line: { type: "none" } });
    s.addText([{ text: "Next  ", options: { bold: true, color: col, fontSize: 11 } }, { text: f.next, options: { color: C.DARK, fontSize: 12 } }],
      { x: rx + 0.6, y, w: rw - 1.2, h: 0.6, fontFace: F.H, valign: "middle", margin: 0, fit: "shrink" });
  }
};

TS.rows = async (pres, d, idx) => {
  const s = await sigSlide(pres, d.eyebrow, d.title, 27);
  const col = projFor([d.eyebrow, d.title], C.LIME);
  let visual = null, aspect = 1;
  if (d.image) { visual = path.resolve(d.image); const m = await sharp(visual).metadata(); aspect = m.height / m.width; }
  else if (d.illustration) visual = await illustration(d.illustration, idx);
  const leftW = visual ? 6.6 : 11.93, top = 1.95, bottom = 6.85, n = d.rows.length, g = 0.18;
  if (visual) {
    const colX = 0.7 + leftW + 0.35, colW = 12.63 - colX;
    rcard(s, colX, top, colW, bottom - top, col, { fill: tint(col, 0.92) });
    let fw = Math.min(colW - 0.6, d.image ? 5.0 : 3.6), fh = fw * aspect;
    if (fh > bottom - top - 0.6) { fh = bottom - top - 0.6; fw = fh / aspect; }
    s.addImage({ path: visual, x: colX + (colW - fw) / 2, y: top + (bottom - top - fh) / 2, w: fw, h: fh });
  }
  const weights = d.rows.map((r) => (typeof r.desc === "string" ? 1 : 1 + 0.35 * (r.desc.length - 1)));
  const total = weights.reduce((a, b) => a + b, 0), avail = bottom - top - (n - 1) * g;
  let y = top;
  for (let i = 0; i < n; i++) {
    const r = d.rows[i], h = (avail * weights[i]) / total, c = i === 0 ? col : shade(col, Math.min(0.45, 0.18 * i));
    rcard(s, 0.7, y, leftW, h, c);
    s.addShape("ellipse", { x: 0.95, y: y + 0.22, w: 0.62, h: 0.62, fill: { color: c }, line: { type: "none" } });
    s.addImage({ path: await iconC(r.icon || "Circle", "FFFFFF"), x: 1.1, y: y + 0.37, w: 0.32, h: 0.32 });
    s.addText(r.header, { x: 1.8, y: y + 0.18, w: leftW - 1.3, h: 0.42, fontFace: F.H, fontSize: 16, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText(richDesc(r.desc), { x: 1.8, y: y + 0.62, w: leftW - 1.3, h: h - 0.72, fontFace: F.B, fontSize: n >= 4 ? 11 : 12, valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
    y += h + g;
  }
};

TS.table = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow || "Looking Ahead", d.title || "Next Steps", 30);
  const cols = [{ k: "Project / track", w: 3.2 }, { k: "Owner", w: 2.0 }, { k: "Next focus", w: 4.73 }, { k: "Status", w: 2.0 }];
  let x = 0.7; const xs = cols.map((c) => { const v = x; x += c.w; return v; });
  cols.forEach((c, i) => s.addText(c.k, { x: xs[i] + (i === 0 ? 0.45 : 0), y: 1.85, w: c.w, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0 }));
  const n = d.rows.length, g = 0.14, rh = Math.min(0.95, (4.6 - (n - 1) * g) / n);
  d.rows.forEach((r, i) => {
    const y = 2.25 + i * (rh + g), c = projFor([r.project]);
    rcard(s, 0.7, y, 11.93, rh, c, { r: 0.18 });
    s.addShape("roundRect", { x: 0.7, y, w: 0.14, h: rh, rectRadius: 0.07, fill: { color: c }, line: { type: "none" } });
    s.addText(r.project, { x: xs[0] + 0.45, y, w: cols[0].w - 0.55, h: rh, fontFace: F.H, fontSize: 13, bold: true, color: C.DARK, valign: "middle", margin: 0, fit: "shrink" });
    s.addShape("ellipse", { x: xs[1], y: y + rh / 2 - 0.2, w: 0.4, h: 0.4, fill: { color: tint(c, 0.82) }, line: { type: "none" } });
    s.addText(initials(r.owner), { x: xs[1], y: y + rh / 2 - 0.2, w: 0.4, h: 0.4, fontFace: F.H, fontSize: 11, bold: true, color: c, align: "center", valign: "middle", margin: 0 });
    s.addText(r.owner || "—", { x: xs[1] + 0.5, y, w: cols[1].w - 0.55, h: rh, fontFace: F.H, fontSize: 11, color: C.BODY, valign: "middle", margin: 0, fit: "shrink" });
    s.addText(r.focus, { x: xs[2], y, w: cols[2].w - 0.25, h: rh, fontFace: F.B, fontSize: 11.5, color: C.BODY, valign: "middle", margin: 0, fit: "shrink" });
    stChip(s, r.state, r.current, xs[3] + cols[3].w - 0.25, y + rh / 2 - 0.15, c, "right");
  });
};

TS.gallery = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow, d.title, 27);
  const col = projFor([d.eyebrow, d.title], C.LIME);
  const imgs = d.images.map((p) => path.resolve(p));
  const metas = await Promise.all(imgs.map((p) => sharp(p).metadata()));
  const aspect = metas[0].height / metas[0].width, n = imgs.length, gap = n > 4 ? 0.2 : 0.35, pad = 0.12;
  let fw = (11.93 - (n - 1) * gap) / n, fh = (fw - 2 * pad) * aspect + 2 * pad;
  if (fh > 4.0) { fh = 4.0; fw = (fh - 2 * pad) / aspect + 2 * pad; }
  const totalW = n * fw + (n - 1) * gap, x0 = 0.7 + (11.93 - totalW) / 2, fy = 2.1;
  imgs.forEach((p, i) => {
    const x = x0 + i * (fw + gap);
    rcard(s, x, fy, fw, fh, col, { r: 0.15 });
    s.addImage({ path: p, x: x + pad, y: fy + pad, w: fw - 2 * pad, h: fh - 2 * pad });
    s.addShape("ellipse", { x: x + fw / 2 - 0.22, y: fy + fh + 0.15, w: 0.44, h: 0.44, fill: { color: col }, line: { type: "none" } });
    s.addText(String(i + 1), { x: x + fw / 2 - 0.22, y: fy + fh + 0.15, w: 0.44, h: 0.44, fontFace: F.H, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText((d.labels && d.labels[i]) || `Step ${i + 1}`, { x, y: fy + fh + 0.65, w: fw, h: 0.35, fontFace: F.H, fontSize: n > 4 ? 10.5 : 12, bold: true, color: C.DARK, align: "center", margin: 0, fit: "shrink" });
  });
};

TS.activity = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow || "Engineering Activity", d.title || "Team Delivery Activity");
  const kpis = d.kpis || [], chartW = kpis.length ? 8.45 : 11.93, top = 1.95, h = 4.85;
  rcard(s, 0.7, top, chartW, h, C.LIME);
  const labels = d.people.map((p) => p.name);
  const data = d.series.map((name, i) => ({ name, labels, values: d.people.map((p) => p.values[i] || 0) }));
  s.addChart(pres.charts.BAR, data, {
    x: 0.9, y: top + 0.15, w: chartW - 0.4, h: h - (d.note ? 0.7 : 0.3), barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: ["6C4CF5", "17153A", "B9AEFF", "10A6A0"].slice(0, d.series.length),
    catAxisLabelFontFace: F.H, catAxisLabelFontSize: 11, catAxisLabelColor: C.DARK, catAxisLineShow: false,
    valAxisHidden: true, valGridLine: { color: "EEECF6", style: "solid", size: 0.5 },
    showValue: true, dataLabelFontFace: F.H, dataLabelFontSize: 10, dataLabelFontBold: true, dataLabelColor: C.DARK, dataLabelPosition: "outEnd",
    showLegend: true, legendPos: "t", legendFontSize: 10.5, legendFontFace: F.H,
  });
  if (d.note) s.addText(d.note, { x: 1.0, y: top + h - 0.5, w: chartW - 0.6, h: 0.35, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
  if (kpis.length) {
    const kx = 0.7 + chartW + 0.3, kw = 12.63 - kx, kg = 0.22, kh = (h - (kpis.length - 1) * kg) / kpis.length;
    kpis.forEach((k, i) => {
      const y = top + i * (kh + kg), c = C.LIME, first = i === 0;
      s.addShape("roundRect", { x: kx, y, w: kw, h: kh, rectRadius: 0.22, fill: { color: first ? c : "FFFFFF" }, line: first ? { type: "none" } : { color: tint(c, 0.75), width: 1 },
        shadow: { type: "outer", color: c, opacity: first ? 0.3 : 0.1, blur: 10, offset: 2, angle: 90 } });
      s.addText(String(k.value), { x: kx + 0.3, y: y + 0.1, w: kw - 0.6, h: kh * 0.45, fontFace: F.H, fontSize: kpis.length > 3 ? 26 : kpis.length === 3 ? 30 : 34, bold: true, color: first ? "FFFFFF" : c, valign: "bottom", margin: 0 });
      s.addText(k.label, { x: kx + 0.3, y: y + kh * 0.58, w: kw - 0.6, h: kh * 0.35, fontFace: F.H, fontSize: 11.5, color: first ? "FFFFFF" : C.BODY, valign: "top", margin: 0, fit: "shrink" });
    });
  }
};

TS.review_insights = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow || "Quality & Code Review", d.title || "Code Review Insights");
  const stats = d.stats || [], top = 1.95, h = 4.85, lw = 3.4, sg = 0.2, sh = (h - (stats.length - 1) * sg) / Math.max(stats.length, 1);
  stats.forEach((k, i) => {
    const y = top + i * (sh + sg), c = i === 0 ? C.LIME : C.DARK;
    s.addShape("roundRect", { x: 0.7, y, w: lw, h: sh, rectRadius: 0.22, fill: { color: i === 0 ? tint(C.LIME, 0.85) : "FFFFFF" }, line: i === 0 ? { type: "none" } : { color: C.GRID, width: 1 } });
    s.addText(String(k.value), { x: 1.0, y, w: 1.4, h: sh, fontFace: F.H, fontSize: 34, bold: true, color: c, valign: "middle", margin: 0, fit: "shrink" });
    s.addText(k.label, { x: 2.35, y, w: lw - 1.8, h: sh, fontFace: F.H, fontSize: 11.5, bold: true, color: C.DARK, valign: "middle", margin: 0, fit: "shrink" });
  });
  const f = d.findings || [], rx = 0.7 + lw + 0.3, rw = 12.63 - rx, g = 0.18;
  const avail = h - (d.note ? 0.4 : 0), rh = (avail - (f.length - 1) * g) / Math.max(f.length, 1);
  const lbl = { done: "Resolved", progress: "In progress", blocked: "Open risk", next: "Planned" };
  const ic = { done: "Check", progress: "Wrench", blocked: "TriangleAlert", next: "Clock" };
  for (let i = 0; i < f.length; i++) {
    const it = f[i], y = top + i * (rh + g), c = it.state === "blocked" ? C.AMBER : it.state === "progress" ? "F5A524" : it.state === "next" ? C.GRAY : "10A6A0";
    rcard(s, rx, y, rw, rh, c);
    s.addShape("ellipse", { x: rx + 0.25, y: y + rh / 2 - 0.3, w: 0.6, h: 0.6, fill: { color: c }, line: { type: "none" } });
    s.addImage({ path: await iconC(ic[it.state] || "Check", "FFFFFF"), x: rx + 0.4, y: y + rh / 2 - 0.15, w: 0.3, h: 0.3 });
    s.addText((it.area || ""), { x: rx + 1.05, y: y + 0.14, w: rw - 3.6, h: 0.28, fontFace: F.H, fontSize: 11, bold: true, color: c, margin: 0 });
    s.addText(it.text, { x: rx + 1.05, y: y + 0.42, w: rw - 3.5, h: rh - 0.5, fontFace: F.B, fontSize: f.length > 4 ? 11 : 12, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
    const t = it.status || lbl[it.state] || "", w = 0.3 + t.length * 0.085;
    chip(s, t, rx + rw - w - 0.25, y + 0.14, c, it.state === "done" || it.state === "blocked");
  }
  if (d.note) s.addText(d.note, { x: rx, y: top + h - 0.32, w: rw, h: 0.3, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

TS.attention = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow || "Needs Attention", d.title || "Blockers & Decisions Needed");
  const top = 1.95, gap = 0.35, cw = (11.93 - gap) / 2;
  // card height follows the content so a single item does not leave a hollow panel
  const maxN = Math.max((d.blockers || []).length, (d.decisions || []).length, 1);
  const h = Math.min(4.85, Math.max(2.9, 1.25 + maxN * 1.2));
  const cols = [
    { x: 0.7, head: d.blockersTitle || "Blockers & Risks", items: d.blockers || [], c: C.AMBER, icon: "TriangleAlert", empty: d.noBlockers || "No open blockers." },
    { x: 0.7 + cw + gap, head: d.decisionsTitle || "Decisions Needed", items: d.decisions || [], c: C.LIME, icon: "MessageCircleQuestion", empty: "No decisions needed." },
  ];
  for (const col of cols) {
    rcard(s, col.x, top, cw, h, col.c);
    s.addShape("roundRect", { x: col.x, y: top, w: cw, h: 0.85, rectRadius: 0.22, fill: { color: col.c }, line: { type: "none" } });
    s.addShape("rect", { x: col.x, y: top + 0.5, w: cw, h: 0.35, fill: { color: col.c }, line: { type: "none" } });
    s.addImage({ path: await iconC(col.icon, "FFFFFF"), x: col.x + 0.3, y: top + 0.25, w: 0.36, h: 0.36 });
    s.addText(col.head, { x: col.x + 0.8, y: top, w: cw - 1.8, h: 0.85, fontFace: F.H, fontSize: 16, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
    s.addText(String(col.items.length), { x: col.x + cw - 0.95, y: top + 0.17, w: 0.65, h: 0.5, fontFace: F.H, fontSize: 20, bold: true, color: "FFFFFF", align: "right", valign: "middle", margin: 0 });
    if (!col.items.length) { s.addText(col.empty, { x: col.x + 0.35, y: top + 1.1, w: cw - 0.7, h: 0.5, fontFace: F.H, fontSize: 14, italic: true, color: C.GRAY, margin: 0 }); continue; }
    const ih = Math.min(1.5, (h - 1.15) / col.items.length);
    col.items.forEach((it, i) => {
      const y = top + 1.1 + i * ih;
      s.addShape("ellipse", { x: col.x + 0.35, y: y + 0.02, w: 0.44, h: 0.44, fill: { color: tint(col.c, 0.85) }, line: { type: "none" } });
      s.addText(String(i + 1), { x: col.x + 0.35, y: y + 0.02, w: 0.44, h: 0.44, fontFace: F.H, fontSize: 13, bold: true, color: col.c, align: "center", valign: "middle", margin: 0 });
      const runs = [{ text: it.title, options: { bold: true, fontSize: 14, color: C.DARK, breakLine: true } }];
      if (it.text) runs.push({ text: it.text, options: { fontSize: 11.5, color: C.BODY, breakLine: !!it.meta } });
      if (it.meta) runs.push({ text: it.meta, options: { fontSize: 11, italic: true, color: C.GRAY } });
      s.addText(runs, { x: col.x + 0.95, y, w: cw - 1.3, h: ih - 0.12, fontFace: F.H, valign: "top", margin: 0, lineSpacingMultiple: 1.1, paraSpaceAfter: 4, fit: "shrink" });
    });
  }
};

TS.tracker = async (pres, d) => {
  const s = await sigSlide(pres, d.eyebrow || "Team · Task Tracker", d.title || "Developer Task Track");
  const devs = d.devs || [], n = Math.max(devs.length, 1), gap = 0.3, cw = (11.93 - (n - 1) * gap) / n, top = 1.95, h = d.footnote ? 4.6 : 4.85;
  devs.forEach((v, i) => {
    const x = 0.7 + i * (cw + gap), c = projFor([v.project]), ix = x + 0.3, iw = cw - 0.6;
    rcard(s, x, top, cw, h, c);
    s.addShape("ellipse", { x: ix, y: top + 0.3, w: 0.62, h: 0.62, fill: { color: c }, line: { type: "none" } });
    s.addText(initials(v.name), { x: ix, y: top + 0.3, w: 0.62, h: 0.62, fontFace: F.H, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(v.name, { x: ix + 0.75, y: top + 0.28, w: iw - 0.75, h: 0.36, fontFace: F.H, fontSize: 14, bold: true, color: C.DARK, margin: 0, valign: "middle", fit: "shrink" });
    s.addText(v.project || "", { x: ix + 0.75, y: top + 0.62, w: iw - 0.75, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: c, margin: 0, valign: "middle", fit: "shrink" });
    // waffle: done vs open tasks
    const dn = v.done ?? 0, op = v.open ?? 0, tot = Math.max(dn + op, 1), cs = Math.min(0.32, (iw - (tot - 1) * 0.07) / tot);
    for (let k = 0; k < tot; k++) s.addShape("roundRect", { x: ix + k * (cs + 0.07), y: top + 1.15, w: cs, h: cs, rectRadius: 0.06, fill: { color: k < dn ? c : tint(c, 0.82) }, line: { type: "none" } });
    s.addText([{ text: `${dn}`, options: { bold: true, color: C.DARK } }, { text: " done   ", options: { color: C.GRAY } }, { text: `${op}`, options: { bold: true, color: C.DARK } }, { text: " open", options: { color: C.GRAY } }],
      { x: ix, y: top + 1.55, w: iw - 0.9, h: 0.3, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
    s.addText(`${v.pct ?? 0}%`, { x: ix + iw - 1.0, y: top + 1.5, w: 1.0, h: 0.4, fontFace: F.H, fontSize: 18, bold: true, color: c, align: "right", margin: 0, valign: "middle" });
    const pct = Math.max(0, Math.min(100, v.pct || 0));
    s.addShape("roundRect", { x: ix, y: top + 1.98, w: iw, h: 0.14, rectRadius: 0.07, fill: { color: tint(c, 0.85) }, line: { type: "none" } });
    if (pct) s.addShape("roundRect", { x: ix, y: top + 1.98, w: Math.max(0.14, iw * pct / 100), h: 0.14, rectRadius: 0.07, fill: { color: c }, line: { type: "none" } });
    s.addText(v.focus || "", { x: ix, y: top + 2.22, w: iw, h: 0.6, fontFace: F.H, fontSize: 11, italic: true, color: C.BODY, valign: "top", margin: 0, fit: "shrink" });
    const items = v.items || [], iy0 = top + 2.95, ih = Math.min(0.42, (h - 3.05) / Math.max(items.length, 1));
    items.forEach((it, k) => {
      const y = iy0 + k * ih, on = it.state === "done", pr = it.state === "progress";
      s.addShape("ellipse", { x: ix, y: y + 0.06, w: 0.18, h: 0.18, fill: { color: on ? c : pr ? tint(c, 0.6) : "FFFFFF" }, line: it.state === "next" ? { color: "C9C6D8", width: 1 } : { type: "none" } });
      s.addText(it.text, { x: ix + 0.3, y, w: iw - 0.3, h: ih, fontFace: F.H, fontSize: 11, color: it.state === "next" ? C.GRAY : C.DARK, valign: "top", margin: 0, fit: "shrink" });
    });
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: top + h + 0.08, w: 11.93, h: 0.28, fontFace: F.H, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// ---------- Paper layouts (printed annual report) ----------
// Direction: DESIGN.md (the "paper" style). Paper and ink, one project colour per slide as the accent, rules instead of
// floating cards, big figures as the focal point, coral red reserved for risk. Every slide type has
// its own composition (RHYTHM 3) so consecutive slides never look alike.
const TP = {};
function lum(hex) {
  const n = parseInt(hex, 16), ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// darken a colour until it reads as text on the paper (WCAG AA 4.5:1)
function ink(col, bg = C.BG) { let c = col, t = 0; while (contrast(c, bg) < 4.5 && t < 0.9) { t += 0.05; c = shade(col, t); } return c; }
const sentence = (t) => { const s = String(t || "").trim(); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
const RIBBONS = ["6C4CF5", "10A6A0", "FF6B4A", "F5A524"];

async function paperArt(kind) {
  const file = path.join(CACHE, `paper_${kind}.png`);
  if (fs.existsSync(file)) return file;
  let svg;
  if (kind === "cover") {
    // printed ribbons: solid strokes, no glow, no fades, no orbs
    const W = 1200, H = 1080;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` + RIBBONS.map((c, i) =>
      `<path d="M ${-60 + i * 46} ${1140} C ${520 + i * 24} ${980 - i * 30}, ${640 - i * 10} ${430 + i * 40}, ${1260} ${150 + i * 74}" fill="none" stroke="#${c}" stroke-width="${[30, 20, 13, 8][i]}" stroke-linecap="round"/>`).join("") + `</svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 128 128">${MARK_SVG}</svg>`;
  }
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}
const MARK_SVG = `<g transform="translate(64 64) scale(0.86) translate(-63.5 -71.9)"><path d="M24.0 96.0 C48.0 94.0 70.0 74.0 92.0 40.0" fill="none" stroke="#6C4CF5" stroke-width="14" stroke-linecap="round"/><path d="M36.1 110.7 C60.1 108.7 82.1 88.7 100.8 59.7" fill="none" stroke="#10A6A0" stroke-width="10" stroke-linecap="round"/><path d="M45.6 122.2 C69.6 120.2 91.6 100.2 106.6 77.2" fill="none" stroke="#FF6B4A" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="27" r="9" fill="#F5A524"/></g>`;

function pRule(s, x, y, w, color = C.GRID, pt = 0.75) { s.addShape("line", { x, y, w, h: 0, line: { color, width: pt } }); }
// status: a small marker + sentence-case word. Filled = done, ring = in progress, grey ring = not started, red = risk
function pStatus(s, state, text, x, y, w, col, align = "left") {
  const label = sentence(text || st(state).label), r = 0.13;
  const tw = Math.min(w, 0.35 + label.length * 0.08), bx = align === "right" ? x + w - tw : x;
  const risk = state === "blocked", c = risk ? C.AMBER : state === "next" ? C.GRAY : col;
  s.addShape("ellipse", { x: bx, y: y + 0.07, w: r, h: r, fill: { color: state === "done" || risk ? c : C.BG }, line: { color: c, width: state === "done" || risk ? 0 : 1.5 } });
  s.addText(label, { x: bx + 0.22, y, w: tw, h: 0.28, fontFace: F.H, fontSize: 11, bold: true, color: risk ? ink(C.AMBER) : state === "next" ? C.GRAY : ink(c), margin: 0, valign: "middle" });
  return tw + 0.22;
}
function pBar(s, x, y, w, pct, col, h = 0.08) {
  const p = Math.max(0, Math.min(100, pct || 0));
  s.addShape("rect", { x, y, w, h, fill: { color: C.TRACK }, line: { type: "none" } });
  if (p) s.addShape("rect", { x, y, w: w * p / 100, h, fill: { color: col }, line: { type: "none" } });
}
async function paperSlide(pres, eyebrow, title, col, size) {
  const s = pres.addSlide();
  SLIDE_NO++;
  s.background = { color: C.BG };
  s.addText(sentence(eyebrow || ""), { x: 0.7, y: 0.5, w: 11, h: 0.3, fontFace: F.H, fontSize: 12, bold: true, color: ink(col || C.LIME), margin: 0, valign: "middle" });
  s.addText(title || "", { x: 0.7, y: 0.8, w: 11.93, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 28, 28), bold: true, color: C.DARK, margin: 0, fit: "shrink", valign: "middle" });
  pRule(s, 0.7, 1.62, 11.93, C.DARK, 1);
  s.addText(FOOTER_TEXT, { x: 0.7, y: 7.05, w: 7, h: 0.26, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0, valign: "middle" });
  if (STYLE.signature !== false) {
    s.addImage({ path: await paperArt("mark"), x: 10.62, y: 7.07, w: 0.22, h: 0.22 });
    s.addText([{ text: "Shipped with ", options: { color: C.GRAY } }, { text: "Showship", options: { color: C.DARK, bold: true } }],
      { x: 10.9, y: 7.05, w: 1.5, h: 0.26, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
  }
  s.addText(String(SLIDE_NO), { x: 12.33, y: 7.05, w: 0.3, h: 0.26, fontFace: F.H, fontSize: 11, bold: true, color: C.DARK, align: "right", margin: 0, valign: "middle" });
  return s;
}

async function paperBookend(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: C.BG };
  s.addImage({ path: await paperArt("cover"), x: 7.78, y: 0, w: 5.556, h: 7.5 });
  if (LOGO) { let lw = 0.62, lh = lw * LOGO.aspect; if (lh > 0.62) { lh = 0.62; lw = lh / LOGO.aspect; } s.addImage({ path: LOGO.path, x: 0.7, y: 0.62, w: lw, h: lh }); }
  s.addText(r.company, { x: LOGO ? 1.5 : 0.7, y: 0.62, w: 6, h: 0.62, fontFace: F.H, fontSize: 13, bold: true, color: C.DARK, valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(sentence(r.eyebrow), { x: 0.7, y: 2.45, w: 7, h: 0.4, fontFace: F.H, fontSize: 15, bold: true, color: ink(C.LIME), margin: 0 });
    s.addText(r.title, { x: 0.7, y: 2.9, w: 7.4, h: 2.3, fontFace: F.H, fontSize: 44, bold: true, color: C.DARK, lineSpacingMultiple: 1.0, margin: 0, valign: "top", fit: "shrink" });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.7, w: 7, h: 1.2, fontFace: F.H, fontSize: 60, bold: true, color: C.DARK, margin: 0 });
    s.addText("Questions and discussion", { x: 0.7, y: 3.9, w: 7, h: 0.6, fontFace: F.H, fontSize: 22, color: ink(C.LIME), margin: 0 });
  }
  pRule(s, 0.7, 5.95, 6.6, C.DARK, 1);
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  [["Presenter", presenter, 0.7], ["Date", r.date, 4.2]].forEach(([k, v, x]) => {
    s.addText(k, { x, y: 6.1, w: 3.2, h: 0.28, fontFace: F.H, fontSize: 11, color: C.GRAY, margin: 0 });
    s.addText(v || "", { x, y: 6.38, w: 3.4, h: 0.4, fontFace: F.H, fontSize: 15, bold: true, color: C.DARK, margin: 0 });
  });
  if (STYLE.signature !== false && kind === "title") {
    s.addText([{ text: "Shipped with ", options: { color: C.GRAY } }, { text: "Showship", options: { color: C.DARK, bold: true } }],
      { x: 0.7, y: 6.95, w: 3, h: 0.3, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
  }
}

// dashboard: lede column with the key update + a ruled list of projects, each led by its figure
TP.dashboard = async (pres, d) => {
  d.cards.forEach((c) => projColor(c.label, c.color));
  const s = await paperSlide(pres, d.eyebrow || "Executive summary", d.title || "At a glance", C.LIME, 30);
  let x0 = 0.7;
  if (d.keyUpdate) {
    s.addText("Key update", { x: 0.7, y: 1.95, w: 3.6, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: ink(C.LIME), margin: 0 });
    s.addText(d.keyUpdate, { x: 0.7, y: 2.3, w: 3.6, h: 4.4, fontFace: F.H, fontSize: 20, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
    x0 = 4.9;
  }
  const n = d.cards.length, top = 1.95, rh = (6.85 - top) / n, w = 12.63 - x0;
  d.cards.forEach((c, i) => {
    const y = top + i * rh, col = projColor(c.label, c.color);
    if (i) pRule(s, x0, y, w);
    s.addText(c.metric, { x: x0, y: y + 0.12, w: 2.3, h: rh - 0.24, fontFace: F.H, fontSize: n > 3 ? 34 : 44, bold: true, color: ink(col), margin: 0, valign: "middle", fit: "shrink" });
    s.addText(c.label, { x: x0 + 2.5, y: y + 0.16, w: w - 4.6, h: 0.28, fontFace: F.H, fontSize: 11, bold: true, color: ink(col), margin: 0, valign: "middle" });
    pStatus(s, c.state, c.status, x0 + w - 2.2, y + 0.16, 2.2, col, "right");
    s.addText(c.headline, { x: x0 + 2.5, y: y + 0.45, w: w - 2.5, h: 0.4, fontFace: F.H, fontSize: 15, bold: true, color: C.DARK, margin: 0, valign: "middle", fit: "shrink" });
    s.addText(c.desc || "", { x: x0 + 2.5, y: y + 0.86, w: w - 2.5, h: rh - 0.98, fontFace: F.B, fontSize: 11.5, color: C.BODY, margin: 0, valign: "top", lineSpacingMultiple: 1.15, fit: "shrink" });
  });
};

// timeline: the impact as a lede sentence, then the trail itself, travelled part solid
TP.timeline = async (pres, d, idx) => {
  const col = projFor([d.title, d.eyebrow]);
  const s = await paperSlide(pres, d.eyebrow, d.title, col);
  if (d.badge) pStatus(s, d.badge.state || "done", d.badge.text, 9.63, 1.95, 3.0, col, "right");
  if (d.impact) s.addText(d.impact, { x: 0.7, y: 1.95, w: 8.6, h: 1.0, fontFace: F.H, fontSize: 19, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
  const steps = d.steps, n = steps.length, X0 = 0.95, X1 = 12.35, sw = (X1 - X0) / Math.max(n - 1, 1), Y = 3.75;
  let last = -1; steps.forEach((p, i) => { if (p.state === "done" || p.state === "progress") last = i; });
  const PX = 150, W = Math.round(11.93 * PX), H = Math.round(0.6 * PX), cy = H / 2;
  const px = (x) => Math.round((x - 0.7) * PX);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <line x1="${px(X0)}" y1="${cy}" x2="${px(X1)}" y2="${cy}" stroke="#${C.GRID}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 16"/>
    ${last > 0 ? `<line x1="${px(X0)}" y1="${cy}" x2="${px(X0 + last * sw)}" y2="${cy}" stroke="#${col}" stroke-width="8" stroke-linecap="round"/>` : ""}</svg>`;
  const file = path.join(CACHE, `paper_tl_${idx}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  s.addImage({ path: file, x: 0.7, y: Y - 0.3, w: 11.93, h: 0.6 });
  steps.forEach((p, i) => {
    const cx = X0 + i * sw, r = 0.17, risk = p.state === "blocked", on = p.state === "done";
    s.addShape("ellipse", { x: cx - r, y: Y - r, w: 2 * r, h: 2 * r, fill: { color: on ? col : risk ? C.AMBER : C.BG }, line: { color: risk ? C.AMBER : p.state === "next" ? C.GRAY : col, width: on || risk ? 0 : 2 } });
    const tw = Math.min(2.6, sw - 0.15), tx = i === n - 1 ? cx - tw + r : i === 0 ? cx - r : cx - tw / 2, al = i === n - 1 ? "right" : i === 0 ? "left" : "center";
    s.addText(sentence(p.tag || ""), { x: tx, y: Y + 0.4, w: tw, h: 0.26, fontFace: F.H, fontSize: 11, bold: true, color: risk ? ink(C.AMBER) : C.GRAY, align: al, margin: 0 });
    s.addText(p.title, { x: tx, y: Y + 0.68, w: tw, h: 0.4, fontFace: F.H, fontSize: 15, bold: true, color: C.DARK, align: al, margin: 0, fit: "shrink" });
    s.addText(p.desc || "", { x: tx, y: Y + 1.1, w: tw, h: 0.9, fontFace: F.B, fontSize: 11, color: C.BODY, align: al, valign: "top", margin: 0, lineSpacingMultiple: 1.15, fit: "shrink" });
  });
};

// rings: one semicircle for the combined figure, then a ruled table of tracks, phases as a sentence
TP.rings = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title]);
  const s = await paperSlide(pres, d.eyebrow, d.title, col);
  const rings = d.rings || [], li = Math.max(0, rings.findIndex((r) => r.dark)), lead = rings[li], others = rings.filter((_, i) => i !== li);
  if (lead) {
    const cx = 3.0, cy = 4.55, R = 1.9, box = { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R };
    s.addShape("blockArc", { ...box, angleRange: [180, 0], arcThicknessRatio: 0.12, fill: { color: C.TRACK }, line: { type: "none" } });
    if (lead.pct > 0) s.addShape("blockArc", { ...box, angleRange: [180, (180 + 180 * Math.min(100, lead.pct) / 100) % 360], arcThicknessRatio: 0.12, fill: { color: col }, line: { type: "none" } });
    s.addText(`${lead.pct}%`, { x: cx - 1.6, y: cy - 1.25, w: 3.2, h: 1.15, fontFace: F.H, fontSize: 54, bold: true, color: C.DARK, align: "center", valign: "bottom", margin: 0 });
    s.addText(lead.label, { x: 0.7, y: cy + 0.15, w: 4.6, h: 0.4, fontFace: F.H, fontSize: 16, bold: true, color: C.DARK, align: "center", margin: 0 });
    s.addText(lead.sub || "", { x: 0.7, y: cy + 0.55, w: 4.6, h: 0.32, fontFace: F.B, fontSize: 11, color: C.GRAY, align: "center", margin: 0 });
  }
  const tx = 6.1, tw = 12.63 - tx;
  s.addText([{ text: "Track", options: {} }], { x: tx, y: 1.95, w: 3, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
  s.addText("Progress", { x: tx + tw - 1.5, y: 1.95, w: 1.5, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, align: "right", margin: 0 });
  pRule(s, tx, 2.3, tw, C.DARK, 0.75);
  others.forEach((r, i) => {
    const y = 2.4 + i * 1.05, c = i === 0 ? col : shade(col, 0.3 * i);
    s.addText(r.label, { x: tx, y, w: tw - 1.6, h: 0.4, fontFace: F.H, fontSize: 16, bold: true, color: C.DARK, margin: 0, valign: "middle" });
    s.addText(r.sub || "", { x: tx, y: y + 0.38, w: tw - 1.6, h: 0.3, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0 });
    s.addText(`${r.pct}%`, { x: tx + tw - 1.5, y, w: 1.5, h: 0.6, fontFace: F.H, fontSize: 26, bold: true, color: ink(c), align: "right", margin: 0, valign: "middle" });
    pBar(s, tx, y + 0.78, tw, r.pct, c, 0.07);
    pRule(s, tx, y + 1.0, tw);
  });
  const stats = d.stats || [];
  if (stats.length) {
    const y = 2.4 + Math.max(others.length, 1) * 1.05 + 0.25;
    const runs = [];
    stats.forEach((k, j) => {
      if (j) runs.push({ text: "     ", options: {} });
      runs.push({ text: "●  ", options: { color: k.state === "done" ? col : k.state === "progress" ? tint(col, 0.5) : C.GRID } });
      runs.push({ text: String(k.value), options: { bold: true, color: C.DARK, fontSize: 18 } });
      runs.push({ text: " " + sentence(k.label).toLowerCase(), options: { color: C.BODY } });
    });
    s.addText(runs, { x: tx, y, w: tw, h: 0.5, fontFace: F.H, fontSize: 12, margin: 0, valign: "middle", fit: "shrink" });
  }
  if (d.footnote) s.addText(d.footnote, { x: tx, y: 6.45, w: tw, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// phase_bars: each track is a printed progress strip, segments sized equally, figures above
TP.phase_bars = async (pres, d) => {
  const base = d.color ? projColor("", d.color) : projFor([d.project, d.eyebrow, d.title]);
  const s = await paperSlide(pres, d.eyebrow, d.title, base);
  const tracks = d.tracks, n = tracks.length, top = 1.95, th = (6.85 - top) / n;
  tracks.forEach((t, i) => {
    const y = top + i * th, c = t.color ? projColor("", t.color) : (i === 0 ? base : shade(base, 0.3 * i));
    if (i) pRule(s, 0.7, y - 0.05, 11.93);
    const avg = Math.round(t.phases.reduce((a, p) => a + (p.pct || 0), 0) / t.phases.length);
    s.addText(t.title, { x: 0.7, y: y + 0.12, w: 7, h: 0.45, fontFace: F.H, fontSize: 19, bold: true, color: C.DARK, margin: 0, valign: "middle" });
    if (t.owner) s.addText(`Owner: ${t.owner}`, { x: 0.7, y: y + 0.55, w: 7, h: 0.3, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0 });
    s.addText([{ text: `${avg}%`, options: { fontSize: 30, bold: true, color: ink(c) } }, { text: "  of the track", options: { fontSize: 11, color: C.GRAY } }],
      { x: 8.6, y: y + 0.1, w: 4.03, h: 0.7, fontFace: F.H, align: "right", valign: "middle", margin: 0 });
    const ph = t.phases, g = 0.12, sw = (11.93 - (ph.length - 1) * g) / ph.length, py = y + 1.45;
    ph.forEach((p, k) => {
      const x = 0.7 + k * (sw + g), pct = Math.max(0, Math.min(100, p.pct || 0)), ns = !pct;
      s.addText(p.name, { x, y: py - 0.5, w: sw - 0.9, h: 0.4, fontFace: F.B, fontSize: 11, color: ns ? C.GRAY : C.DARK, margin: 0, valign: "bottom", fit: "shrink" });
      s.addText(ns ? "Not started" : `${pct}%`, { x: x + sw - 1.0, y: py - 0.5, w: 1.0, h: 0.4, fontFace: F.H, fontSize: ns ? 10 : 13, bold: !ns, italic: ns, color: ns ? C.GRAY : ink(c), align: "right", margin: 0, valign: "bottom" });
      pBar(s, x, py, sw, pct, c, 0.16);
    });
    if (t.note) s.addText(t.note, { x: 0.7, y: py + 0.3, w: 11.93, h: 0.35, fontFace: F.B, fontSize: 11, italic: true, color: C.BODY, margin: 0, valign: "middle" });
  });
};

// workstreams: a finished workstream as one big figure, the next one as a numbered vertical list
TP.workstreams = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title]), h = d.hero, f = d.flow;
  const s = await paperSlide(pres, d.eyebrow, d.title, col, 26);
  s.addText(h.label || "Workstream 1", { x: 0.7, y: 1.95, w: 4.6, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
  s.addText(h.metric, { x: 0.7, y: 2.3, w: 4.6, h: 1.4, fontFace: F.H, fontSize: 80, bold: true, color: ink(col), margin: 0, valign: "middle" });
  s.addText(h.title, { x: 0.7, y: 3.8, w: 4.6, h: 0.5, fontFace: F.H, fontSize: 18, bold: true, color: C.DARK, margin: 0, valign: "top", fit: "shrink" });
  pStatus(s, h.state || "done", h.status, 0.7, 4.38, 4.6, col);
  s.addText(h.desc || "", { x: 0.7, y: 4.8, w: 4.6, h: 1.8, fontFace: F.B, fontSize: 12, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
  const rx = 6.1, rw = 12.63 - rx;
  pRule(s, 5.7, 1.95, 0, C.GRID); s.addShape("line", { x: 5.7, y: 1.95, w: 0, h: 4.9, line: { color: C.GRID, width: 0.75 } });
  s.addText(f.label || "Workstream 2", { x: rx, y: 1.95, w: 3, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0 });
  pStatus(s, f.state || "progress", f.status, rx + rw - 2.4, 1.95, 2.4, col, "right");
  s.addText(f.title, { x: rx, y: 2.3, w: rw, h: 0.5, fontFace: F.H, fontSize: 19, bold: true, color: C.DARK, margin: 0 });
  const steps = f.steps, avail = (f.next ? 5.9 : 6.75) - 3.0, rh = Math.min(1.0, avail / steps.length);
  steps.forEach((p, i) => {
    const y = 3.0 + i * rh, on = p.state === "done";
    pRule(s, rx, y, rw);
    s.addText(String(i + 1).padStart(2, "0"), { x: rx, y: y + 0.1, w: 0.8, h: 0.5, fontFace: F.H, fontSize: 22, bold: true, color: p.state === "next" ? C.GRAY : ink(col), margin: 0, valign: "top" });
    s.addText(p.title, { x: rx + 0.9, y: y + 0.12, w: rw - 3.2, h: 0.36, fontFace: F.H, fontSize: 14, bold: true, color: C.DARK, margin: 0, valign: "middle" });
    s.addText(p.desc || "", { x: rx + 0.9, y: y + 0.48, w: rw - 3.2, h: rh - 0.55, fontFace: F.B, fontSize: 11, color: C.BODY, margin: 0, valign: "top", fit: "shrink" });
    pStatus(s, p.state, { done: "Done", progress: "In progress", next: "Next", blocked: "Blocked" }[p.state], rx + rw - 2.2, y + 0.16, 2.2, col, "right");
  });
  if (f.next) s.addText([{ text: "Next: ", options: { bold: true, color: ink(col) } }, { text: f.next, options: { color: C.DARK } }],
    { x: rx, y: 6.2, w: rw, h: 0.5, fontFace: F.H, fontSize: 13, margin: 0, valign: "middle", fit: "shrink" });
};

// rows: numbered paragraphs; a screenshot sits beside them. Generated icon illustrations are not used
// in this style (no generic icons); the text takes the full width instead.
TP.rows = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title], C.LIME);
  const s = await paperSlide(pres, d.eyebrow, d.title, col, 27);
  let img = null, aspect = 1;
  if (d.image) { img = path.resolve(d.image); const m = await sharp(img).metadata(); aspect = m.height / m.width; }
  const n = d.rows.length, two = !img && n >= 2 && n <= 4, cols = two ? 2 : 1, perCol = Math.ceil(n / cols); // reads left to right
  const areaW = img ? 6.6 : 11.93, cw = (areaW - (cols - 1) * 0.6) / cols, rh = (6.85 - 1.95) / perCol;
  if (img) {
    const colX = 7.8, colW = 12.63 - colX; let fw = colW, fh = fw * aspect;
    if (fh > 4.7) { fh = 4.7; fw = fh / aspect; }
    s.addImage({ path: img, x: colX + (colW - fw) / 2, y: 1.95, w: fw, h: fh });
    s.addShape("rect", { x: colX + (colW - fw) / 2, y: 1.95, w: fw, h: fh, fill: { type: "none" }, line: { color: C.GRID, width: 0.75 } });
  }
  d.rows.forEach((r, i) => {
    const ci = i % cols, ri = Math.floor(i / cols), x = 0.7 + ci * (cw + 0.6), y = 1.95 + ri * rh;
    if (ri) pRule(s, x, y, cw);
    s.addText(String(i + 1).padStart(2, "0"), { x, y: y + 0.15, w: 0.9, h: 0.6, fontFace: F.H, fontSize: 28, bold: true, color: ink(col), margin: 0, valign: "top" });
    s.addText(r.header, { x: x + 1.0, y: y + 0.18, w: cw - 1.0, h: 0.42, fontFace: F.H, fontSize: 16, bold: true, color: C.DARK, margin: 0, valign: "middle" });
    s.addText(richDesc(r.desc), { x: x + 1.0, y: y + 0.65, w: cw - 1.0, h: rh - 0.8, fontFace: F.B, fontSize: 12, valign: "top", margin: 0, lineSpacingMultiple: 1.2, fit: "shrink" });
  });
};

// table: a ruled table; the project name carries the project colour, nothing else does
TP.table = async (pres, d) => {
  const s = await paperSlide(pres, d.eyebrow || "Looking ahead", d.title || "Next steps", C.LIME, 30);
  const cols = [{ k: "Project / track", w: 3.3 }, { k: "Owner", w: 2.2 }, { k: "Next focus", w: 4.43 }, { k: "Status", w: 2.0 }];
  let x = 0.7; const xs = cols.map((c) => { const v = x; x += c.w; return v; });
  cols.forEach((c, i) => s.addText(c.k, { x: xs[i], y: 1.9, w: c.w - 0.2, h: 0.3, fontFace: F.H, fontSize: 11, bold: true, color: C.GRAY, margin: 0, align: i === 3 ? "right" : "left" }));
  pRule(s, 0.7, 2.25, 11.93, C.DARK, 0.75);
  const n = d.rows.length, rh = Math.min(1.0, 4.5 / n);
  d.rows.forEach((r, i) => {
    const y = 2.3 + i * rh, c = projFor([r.project]);
    s.addText(r.project, { x: xs[0], y, w: cols[0].w - 0.25, h: rh, fontFace: F.H, fontSize: 13, bold: true, color: ink(c), margin: 0, valign: "middle", fit: "shrink" });
    s.addText(r.owner || "", { x: xs[1], y, w: cols[1].w - 0.25, h: rh, fontFace: F.B, fontSize: 11.5, color: C.BODY, margin: 0, valign: "middle", fit: "shrink" });
    s.addText(r.focus, { x: xs[2], y, w: cols[2].w - 0.3, h: rh, fontFace: F.B, fontSize: 11.5, color: C.DARK, margin: 0, valign: "middle", fit: "shrink" });
    pStatus(s, r.state, r.current, xs[3], y + rh / 2 - 0.14, cols[3].w, c, "right");
    pRule(s, 0.7, y + rh, 11.93);
  });
};

TP.gallery = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title], C.LIME);
  const s = await paperSlide(pres, d.eyebrow, d.title, col, 27);
  const imgs = d.images.map((p) => path.resolve(p));
  const metas = await Promise.all(imgs.map((p) => sharp(p).metadata()));
  const aspect = metas[0].height / metas[0].width, n = imgs.length, gap = n > 4 ? 0.2 : 0.35;
  let fw = (11.93 - (n - 1) * gap) / n, fh = fw * aspect;
  if (fh > 4.0) { fh = 4.0; fw = fh / aspect; }
  const x0 = 0.7 + (11.93 - (n * fw + (n - 1) * gap)) / 2, fy = 2.0;
  imgs.forEach((p, i) => {
    const x = x0 + i * (fw + gap);
    s.addImage({ path: p, x, y: fy, w: fw, h: fh });
    s.addShape("rect", { x, y: fy, w: fw, h: fh, fill: { type: "none" }, line: { color: C.GRID, width: 0.75 } });
    s.addText([{ text: `${i + 1}  `, options: { bold: true, color: ink(col) } }, { text: (d.labels && d.labels[i]) || `Step ${i + 1}`, options: { color: C.DARK } }],
      { x, y: fy + fh + 0.12, w: fw, h: 0.35, fontFace: F.H, fontSize: n > 4 ? 10.5 : 12, margin: 0, fit: "shrink" });
  });
};

// activity: the figures first (lede column), the chart after them
TP.activity = async (pres, d) => {
  const s = await paperSlide(pres, d.eyebrow || "Engineering activity", d.title || "Team delivery activity", C.LIME);
  const kpis = d.kpis || [], lw = kpis.length ? 3.0 : 0, cx = kpis.length ? 4.2 : 0.7, cw = 12.63 - cx;
  const kh = 4.9 / Math.max(kpis.length, 1);
  kpis.forEach((k, i) => {
    const y = 1.95 + i * kh;
    if (i) pRule(s, 0.7, y, lw);
    s.addText(String(k.value), { x: 0.7, y: y + 0.1, w: lw, h: kh * 0.58, fontFace: F.H, fontSize: i === 0 ? 44 : 32, bold: true, color: i === 0 ? ink(C.LIME) : C.DARK, margin: 0, valign: "bottom" });
    s.addText(k.label, { x: 0.7, y: y + 0.1 + kh * 0.6, w: lw, h: kh * 0.32, fontFace: F.H, fontSize: 12, color: C.BODY, margin: 0, valign: "top" });
  });
  const labels = d.people.map((p) => p.name);
  const data = d.series.map((name, i) => ({ name, labels, values: d.people.map((p) => p.values[i] || 0) }));
  s.addChart(pres.charts.BAR, data, {
    x: cx, y: 1.9, w: cw, h: 4.9 - (d.note ? 0.4 : 0), barDir: "col", barGrouping: "clustered", barGapWidthPct: 70,
    chartColors: [C.LIME, C.DARK, tint(C.LIME, 0.55), "A9A6B8"].slice(0, d.series.length),
    catAxisLabelFontFace: F.H, catAxisLabelFontSize: 11, catAxisLabelColor: C.DARK, catAxisLineShow: true,
    valAxisHidden: true, valGridLine: { style: "none" },
    showValue: true, dataLabelFontFace: F.H, dataLabelFontSize: 10.5, dataLabelFontBold: true, dataLabelColor: C.DARK, dataLabelPosition: "outEnd",
    showLegend: true, legendPos: "t", legendFontSize: 10.5, legendFontFace: F.H,
  });
  if (d.note) s.addText(d.note, { x: cx, y: 6.45, w: cw, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// review_insights: the figures run across the top like a results line, findings below as a ruled list
TP.review_insights = async (pres, d) => {
  const s = await paperSlide(pres, d.eyebrow || "Quality and code review", d.title || "Code review insights", C.LIME);
  const stats = d.stats || [], sw = 11.93 / Math.max(stats.length, 1);
  stats.forEach((k, i) => {
    const x = 0.7 + i * sw;
    s.addText(String(k.value), { x, y: 1.9, w: sw - 0.3, h: 0.85, fontFace: F.H, fontSize: 44, bold: true, color: i === 0 ? ink(C.LIME) : C.DARK, margin: 0, valign: "middle" });
    s.addText(k.label, { x, y: 2.72, w: sw - 0.3, h: 0.32, fontFace: F.H, fontSize: 11.5, color: C.BODY, margin: 0 });
  });
  const f = d.findings || [], top = 3.25, avail = 6.85 - top - (d.note ? 0.35 : 0), rh = avail / Math.max(f.length, 1);
  const lbl = { done: "Resolved", progress: "In progress", blocked: "Open risk", next: "Planned" };
  pRule(s, 0.7, top, 11.93, C.DARK, 0.75);
  f.forEach((it, i) => {
    const y = top + i * rh;
    if (i) pRule(s, 0.7, y, 11.93);
    s.addText(it.area || "", { x: 0.7, y: y + 0.12, w: 3.0, h: rh - 0.2, fontFace: F.H, fontSize: 13, bold: true, color: C.DARK, margin: 0, valign: "top" });
    s.addText(it.text, { x: 3.9, y: y + 0.12, w: 6.2, h: rh - 0.2, fontFace: F.B, fontSize: 12, color: C.DARK, margin: 0, valign: "top", lineSpacingMultiple: 1.15, fit: "shrink" });
    pStatus(s, it.state, it.status || lbl[it.state], 10.33, y + 0.12, 2.3, it.state === "progress" ? C.LIME : C.LIME, "right");
  });
  if (d.note) s.addText(d.note, { x: 0.7, y: 6.5, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// attention: two columns of numbered items under a heavy rule; red only on the risk side
TP.attention = async (pres, d) => {
  const s = await paperSlide(pres, d.eyebrow || "Needs attention", d.title || "Blockers and decisions needed", C.AMBER);
  const gap = 0.8, cw = (11.93 - gap) / 2;
  const cols = [
    { x: 0.7, head: d.blockersTitle || "Blockers and risks", items: d.blockers || [], c: C.AMBER, empty: d.noBlockers || "No open blockers." },
    { x: 0.7 + cw + gap, head: d.decisionsTitle || "Decisions needed", items: d.decisions || [], c: C.DARK, empty: "No decisions needed." },
  ];
  cols.forEach((col) => {
    pRule(s, col.x, 1.95, cw, col.c, 3);
    s.addText([{ text: col.head, options: { bold: true, color: col.c === C.DARK ? C.DARK : ink(col.c) } }, { text: `   ${col.items.length}`, options: { color: C.GRAY } }],
      { x: col.x, y: 2.05, w: cw, h: 0.45, fontFace: F.H, fontSize: 16, margin: 0, valign: "middle" });
    if (!col.items.length) { s.addText(col.empty, { x: col.x, y: 2.7, w: cw, h: 0.5, fontFace: F.H, fontSize: 14, italic: true, color: C.GRAY, margin: 0 }); return; }
    const ih = Math.min(1.7, 4.2 / col.items.length);
    col.items.forEach((it, i) => {
      const y = 2.7 + i * ih;
      if (i) pRule(s, col.x, y - 0.08, cw);
      s.addText(`${i + 1}.`, { x: col.x, y, w: 0.5, h: 0.45, fontFace: F.H, fontSize: 18, bold: true, color: col.c === C.DARK ? C.DARK : ink(col.c), margin: 0, valign: "top" });
      const runs = [{ text: it.title, options: { bold: true, fontSize: 15, color: C.DARK, breakLine: true } }];
      if (it.text) runs.push({ text: it.text, options: { fontSize: 12, color: C.BODY, breakLine: !!it.meta } });
      if (it.meta) runs.push({ text: it.meta, options: { fontSize: 11, italic: true, color: C.GRAY } });
      s.addText(runs, { x: col.x + 0.55, y, w: cw - 0.55, h: ih - 0.15, fontFace: F.H, valign: "top", margin: 0, lineSpacingMultiple: 1.12, paraSpaceAfter: 4, fit: "shrink" });
    });
  });
};

// tracker: one row per person (not cards), so the team reads like a ledger
TP.tracker = async (pres, d) => {
  const s = await paperSlide(pres, d.eyebrow || "Team and task tracker", d.title || "Developer task track", C.LIME);
  const devs = d.devs || [], bottom = d.footnote ? 6.5 : 6.85, rh = (bottom - 1.95) / Math.max(devs.length, 1);
  devs.forEach((v, i) => {
    const y = 1.95 + i * rh, c = projFor([v.project]);
    if (i) pRule(s, 0.7, y, 11.93);
    s.addText(v.name, { x: 0.7, y: y + 0.12, w: 3.4, h: 0.38, fontFace: F.H, fontSize: 15, bold: true, color: C.DARK, margin: 0, valign: "middle", fit: "shrink" });
    s.addText(v.project || "", { x: 0.7, y: y + 0.48, w: 3.4, h: 0.28, fontFace: F.H, fontSize: 11, bold: true, color: ink(c), margin: 0, valign: "middle", fit: "shrink" });
    s.addText(v.focus || "", { x: 0.7, y: y + 0.8, w: 3.4, h: rh - 0.9, fontFace: F.B, fontSize: 11, italic: true, color: C.BODY, margin: 0, valign: "top", fit: "shrink" });
    const mx = 4.4, mw = 2.6, dn = v.done ?? 0, op = v.open ?? 0, tot = Math.max(dn + op, 1), cs = Math.min(0.24, (mw - (tot - 1) * 0.06) / tot);
    for (let k = 0; k < tot; k++) s.addShape("rect", { x: mx + k * (cs + 0.06), y: y + 0.2, w: cs, h: cs, fill: { color: k < dn ? c : C.BG }, line: { color: c, width: 1 } });
    s.addText(`${dn} done, ${op} open`, { x: mx, y: y + 0.52, w: mw, h: 0.28, fontFace: F.H, fontSize: 11, color: C.BODY, margin: 0 });
    s.addText(`${v.pct ?? 0}%`, { x: mx, y: y + 0.82, w: mw, h: 0.45, fontFace: F.H, fontSize: 22, bold: true, color: ink(c), margin: 0, valign: "middle" });
    pBar(s, mx, y + 1.3, mw, v.pct, c, 0.06);
    const items = v.items || [], ix = 7.5, iw = 12.63 - ix, half = Math.ceil(items.length / 2), ih = Math.min(0.36, (rh - 0.3) / Math.max(half, 1));
    items.forEach((it, k) => {
      const colI = Math.floor(k / half), row = k % half, x = ix + colI * (iw / 2), yy = y + 0.18 + row * ih;
      const on = it.state === "done", pr = it.state === "progress";
      s.addShape("ellipse", { x, y: yy + 0.08, w: 0.12, h: 0.12, fill: { color: on ? c : C.BG }, line: { color: it.state === "next" ? C.GRAY : c, width: on ? 0 : 1.25 } });
      s.addText(it.text, { x: x + 0.22, y: yy, w: iw / 2 - 0.3, h: ih, fontFace: F.B, fontSize: 11, color: it.state === "next" ? C.GRAY : C.DARK, margin: 0, valign: "top", fit: "shrink" });
    });
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.55, w: 11.93, h: 0.28, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// ---------- Ember layouts (graphite night deck) ----------
// Direction: a dark deck for rooms where the projector is the brightest thing. Slides sit on graphite, content groups
// live on flat lighter panels (no shadow, no border, square corners), one amber accent marks the focal point,
// coral is reserved for risk. Figures are set in Georgia. A big slide number in the header band is the repeated motif.
// Dials: ENERGY 2 / RHYTHM 3 / MOTION 1. Every slide type has its own composition.
const TEM = {};
const eText = () => C.TEXT || "F4F0E8";
const eCard = () => tint(C.DARK, 0.07);   // panel surface
const eTrk = () => tint(C.DARK, 0.15);    // empty part of a bar
const eRule = () => tint(C.DARK, 0.22);   // hairlines and dashed trails
// lighten a colour until it reads as text on the given surface (WCAG AA 4.5:1)
function eInk(col, bg) { bg = bg || C.DARK; let c = col, t = 0; while (contrast(c, bg) < 4.5 && t < 0.9) { t += 0.05; c = tint(col, t); } return c; }
function ePanel(s, x, y, w, h, fill) { s.addShape("rect", { x, y, w, h, fill: { color: fill || eCard() }, line: { type: "none" } }); }
function eBar(s, x, y, w, pct, col, h = 0.1) {
  const p = Math.max(0, Math.min(100, pct || 0));
  s.addShape("rect", { x, y, w, h, fill: { color: eTrk() }, line: { type: "none" } });
  if (p) s.addShape("rect", { x, y, w: w * p / 100, h, fill: { color: col }, line: { type: "none" } });
}
// status tag: solid = done, coral solid = risk, outline = in progress, grey outline = not started. Always a word.
function eTag(s, state, text, x, y, w, col, align = "left") {
  const label = sentence(text || st(state).label), tw = Math.min(w, 0.3 + label.length * 0.088), bx = align === "right" ? x + w - tw : x;
  const risk = state === "blocked", solid = state === "done" || risk, c = risk ? C.AMBER : state === "next" ? C.GRAY : eInk(col, eCard());
  s.addShape("rect", { x: bx, y, w: tw, h: 0.3, fill: solid ? { color: c } : { type: "none" }, line: solid ? { type: "none" } : { color: c, width: 1 } });
  s.addText(label, { x: bx, y, w: tw, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: solid ? C.DARK : c, align: "center", valign: "middle", margin: 0 });
  return tw;
}
function eDesc(desc) {
  if (typeof desc === "string") return [{ text: desc, options: { color: C.BODY } }];
  const runs = [];
  (desc || []).forEach((d, i) => {
    const last = i === desc.length - 1;
    if (typeof d === "string") runs.push({ text: d, options: { color: C.BODY, breakLine: !last, paraSpaceAfter: 5 } });
    else {
      runs.push({ text: d.label + ":  ", options: { bold: true, color: eText() } });
      runs.push({ text: d.text, options: { color: C.BODY, breakLine: !last, paraSpaceAfter: 4 } });
    }
  });
  return runs;
}

async function emberSlide(pres, eyebrow, title, col) {
  const s = pres.addSlide();
  SLIDE_NO++;
  s.background = { color: C.DARK };
  s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 1.62, fill: { color: eCard() }, line: { type: "none" } });
  s.addShape("rect", { x: 0, y: 1.62, w: 13.333, h: 0.04, fill: { color: C.LIME }, line: { type: "none" } });
  s.addText(sentence(eyebrow || ""), { x: 0.7, y: 0.4, w: 9.5, h: 0.3, fontFace: F.B, fontSize: 12, bold: true, color: eInk(col || C.LIME, eCard()), margin: 0, valign: "middle" });
  s.addText(String(SLIDE_NO).padStart(2, "0"), { x: 11.13, y: 0.3, w: 1.5, h: 0.5, fontFace: F.H, fontSize: 28, italic: true, color: C.GRAY, align: "right", margin: 0, valign: "middle" });
  s.addText(title || "", { x: 0.7, y: 0.8, w: 11.93, h: 0.7, fontFace: F.H, fontSize: 26, color: eText(), margin: 0, valign: "middle", fit: "shrink" });
  s.addText(FOOTER_TEXT, { x: 0.7, y: 7.05, w: 7, h: 0.26, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0, valign: "middle" });
  if (STYLE.signature !== false) {
    s.addImage({ path: await paperArt("mark"), x: 10.62, y: 7.07, w: 0.22, h: 0.22 });
    s.addText([{ text: "Shipped with ", options: { color: C.GRAY } }, { text: "Showship", options: { color: eText(), bold: true } }],
      { x: 10.9, y: 7.05, w: 1.73, h: 0.26, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
  }
  return s;
}

// cover and closing: progress bars on the right start part-filled and end full, so the deck ends on "done"
async function emberBookend(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: C.DARK };
  const bars = [100, 82, 66, 52, 38, 24], bx = 8.6, bw = 4.03, bh = 0.3;
  bars.forEach((p, i) => {
    const y = 1.2 + i * 0.78;
    s.addShape("rect", { x: bx, y, w: bw, h: bh, fill: { color: eTrk() }, line: { type: "none" } });
    s.addShape("rect", { x: bx, y, w: bw * (kind === "closing" ? 1 : p / 100), h: bh, fill: { color: i === 0 ? C.LIME : C.BODY }, line: { type: "none" } });
  });
  if (LOGO) { let lw = 0.62, lh = lw * LOGO.aspect; if (lh > 0.62) { lh = 0.62; lw = lh / LOGO.aspect; } s.addImage({ path: LOGO.path, x: 0.7, y: 0.62, w: lw, h: lh }); }
  s.addText(r.company, { x: LOGO ? 1.5 : 0.7, y: 0.62, w: 6, h: 0.62, fontFace: F.B, fontSize: 13, bold: true, color: eText(), valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(sentence(r.eyebrow), { x: 0.7, y: 2.45, w: 7, h: 0.4, fontFace: F.B, fontSize: 15, bold: true, color: eInk(C.LIME), margin: 0 });
    s.addText(r.title, { x: 0.7, y: 2.9, w: 7.4, h: 2.3, fontFace: F.H, fontSize: 44, color: eText(), lineSpacingMultiple: 1.0, margin: 0, valign: "top", fit: "shrink" });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.7, w: 7, h: 1.2, fontFace: F.H, fontSize: 60, color: eText(), margin: 0 });
    s.addText("Questions and discussion", { x: 0.7, y: 3.9, w: 7, h: 0.6, fontFace: F.H, fontSize: 22, italic: true, color: eInk(C.LIME), margin: 0 });
  }
  s.addShape("line", { x: 0.7, y: 5.95, w: 6.6, h: 0, line: { color: eRule(), width: 1 } });
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  [["Presenter", presenter, 0.7], ["Date", r.date, 4.2]].forEach(([k, v, x]) => {
    s.addText(k, { x, y: 6.1, w: 3.2, h: 0.28, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0 });
    s.addText(v || "", { x, y: 6.38, w: 3.4, h: 0.4, fontFace: F.H, fontSize: 15, bold: true, color: eText(), margin: 0 });
  });
  if (STYLE.signature !== false && kind === "title") {
    s.addText([{ text: "Shipped with ", options: { color: C.GRAY } }, { text: "Showship", options: { color: eText(), bold: true } }],
      { x: 0.7, y: 6.95, w: 3, h: 0.3, fontFace: F.H, fontSize: 11, margin: 0, valign: "middle" });
  }
}

// dashboard: the first card is the hero panel with a giant figure, the rest stack beside it, key update as a labelled strip
TEM.dashboard = async (pres, d) => {
  d.cards.forEach((c) => projColor(c.label, c.color));
  const s = await emberSlide(pres, d.eyebrow || "Executive summary", d.title || "At a glance");
  const cards = d.cards, n = cards.length, top = 1.95, h = d.keyUpdate ? 3.85 : 4.9, hw = n > 1 ? 5.2 : 11.93;
  const hero = cards[0], hc = projColor(hero.label, hero.color), off = h - 3.85, len = String(hero.metric).length;
  ePanel(s, 0.7, top, hw, h);
  s.addText(hero.label, { x: 1.0, y: top + 0.25, w: hw - 0.6, h: 0.3, fontFace: F.B, fontSize: 12, bold: true, color: eInk(hc, eCard()), margin: 0, valign: "middle" });
  if (n === 1) {
    // a single card gets the whole width: the figure on the left, the words on the right
    s.addText(String(hero.metric), { x: 1.0, y: top + 0.7, w: 5.6, h: h - 1.2, fontFace: F.H, fontSize: len <= 3 ? 120 : len <= 5 ? 96 : len <= 8 ? 64 : 48, bold: true, color: eInk(hc, eCard()), margin: 0, valign: "middle" });
    s.addText(hero.headline, { x: 7.2, y: top + 0.9, w: 5.1, h: 1.0, fontFace: F.H, fontSize: 22, bold: true, color: eText(), margin: 0, valign: "top" });
    eTag(s, hero.state, hero.status, 7.2, top + 2.0, 5.1, hc);
    s.addText(hero.desc || "", { x: 7.2, y: top + 2.5, w: 5.1, h: h - 3.0, fontFace: F.B, fontSize: 14, color: C.BODY, margin: 0, valign: "top", lineSpacingMultiple: 1.2 });
  } else {
    s.addText(String(hero.metric), { x: 1.0, y: top + 0.6, w: hw - 0.6, h: 1.25 + off, fontFace: F.H, fontSize: len <= 3 ? 96 : len <= 5 ? 72 : len <= 8 ? 54 : 40, bold: true, color: eInk(hc, eCard()), margin: 0, valign: "middle" });
    const long = String(hero.headline).length > 26;
    s.addText(hero.headline, { x: 1.0, y: top + 1.9 + off, w: hw - 0.6, h: 0.55, fontFace: F.H, fontSize: long ? 15 : 18, bold: true, color: eText(), margin: 0, valign: "top" });
    eTag(s, hero.state, hero.status, 1.0, top + 2.5 + off, hw - 0.6, hc);
    s.addText(hero.desc || "", { x: 1.0, y: top + 2.9 + off, w: hw - 0.6, h: 0.8, fontFace: F.B, fontSize: 12, color: C.BODY, margin: 0, valign: "top", lineSpacingMultiple: 1.15 });
  }
  const m = n - 1, rx = 0.7 + hw + 0.3, rw = 12.63 - rx, gap = 0.2, ph = m ? (h - (m - 1) * gap) / m : 0;
  cards.slice(1).forEach((c, i) => {
    const y = top + i * (ph + gap), col = projColor(c.label, c.color), ml = String(c.metric).length;
    ePanel(s, rx, y, rw, ph);
    s.addText(String(c.metric), { x: rx + 0.25, y: y + 0.1, w: 1.65, h: Math.min(0.75, ph * 0.5), fontFace: F.H, fontSize: ml <= 4 ? 34 : 24, bold: true, color: eInk(col, eCard()), margin: 0, valign: "middle" });
    eTag(s, c.state, c.status, rx + 0.25, y + ph - 0.4, 1.65, col);
    const tx = rx + 2.0, tw = rw - 2.0 - 0.2, tight = ph < 1.3;
    s.addText(c.label, { x: tx, y: y + 0.08, w: tw, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color: eInk(col, eCard()), margin: 0, valign: "middle" });
    s.addText(c.headline, { x: tx, y: y + 0.34, w: tw, h: 0.3, fontFace: F.H, fontSize: tight ? 13 : 14, bold: true, color: eText(), margin: 0, valign: "middle" });
    s.addText(c.desc || "", { x: tx, y: y + 0.66, w: tw, h: ph - 0.72, fontFace: F.B, fontSize: tight ? 11 : 11.5, color: C.BODY, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
  });
  if (d.keyUpdate) {
    const y = top + h + 0.25;
    s.addShape("rect", { x: 0.7, y, w: 1.9, h: 0.8, fill: { color: C.LIME }, line: { type: "none" } });
    s.addText("Key update", { x: 0.7, y, w: 1.9, h: 0.8, fontFace: F.B, fontSize: 13, bold: true, color: C.ON_ACCENT, align: "center", valign: "middle", margin: 0 });
    ePanel(s, 2.6, y, 10.03, 0.8);
    s.addText(d.keyUpdate, { x: 2.85, y, w: 9.55, h: 0.8, fontFace: F.B, fontSize: 13.5, color: eText(), valign: "middle", margin: 0 });
  }
};

// timeline: the trail runs across the middle, steps hang above and below it in turn
TEM.timeline = async (pres, d) => {
  const col = projFor([d.title, d.eyebrow]);
  const s = await emberSlide(pres, d.eyebrow, d.title, col);
  if (d.badge) eTag(s, d.badge.state || "done", d.badge.text, 9.63, 1.95, 3.0, col, "right");
  if (d.impact) s.addText(d.impact, { x: 0.7, y: 1.95, w: 8.6, h: 0.95, fontFace: F.H, fontSize: 17, color: eText(), valign: "top", margin: 0, lineSpacingMultiple: 1.12 });
  const steps = d.steps, n = steps.length, X0 = 1.0, X1 = 12.33, sw = (X1 - X0) / Math.max(n - 1, 1), Y = 4.75, nr = 0.15;
  let last = -1; steps.forEach((p, i) => { if (p.state === "done" || p.state === "progress") last = i; });
  s.addShape("line", { x: X0, y: Y, w: X1 - X0, h: 0, line: { color: eRule(), width: 2.5, dashType: "dash" } });
  if (last > 0) s.addShape("line", { x: X0, y: Y, w: last * sw, h: 0, line: { color: C.LIME, width: 3 } });
  const bw = Math.min(3.4, sw - 0.2);
  steps.forEach((p, i) => {
    const cx = X0 + i * sw, above = i % 2 === 0, risk = p.state === "blocked", on = p.state === "done";
    const c = risk ? C.AMBER : p.state === "next" ? C.GRAY : C.LIME;
    const flip = cx + 0.14 + bw > 12.63, tx = flip ? cx - 0.14 - bw : cx + 0.14, al = flip ? "right" : "left";
    const by = above ? Y - 1.75 : Y + 0.3;
    s.addShape("line", { x: cx, y: above ? Y - 1.75 : Y + nr, w: 0, h: 1.75 - nr, line: { color: eRule(), width: 1 } });
    s.addShape("rect", { x: cx - nr, y: Y - nr, w: 2 * nr, h: 2 * nr, fill: on || risk ? { color: c } : { color: C.DARK }, line: on || risk ? { type: "none" } : { color: c, width: 2 } });
    s.addText(sentence(p.tag || ""), { x: tx, y: by, w: bw, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color: risk ? C.AMBER : C.GRAY, align: al, margin: 0, valign: "middle" });
    s.addText(p.title, { x: tx, y: by + 0.28, w: bw, h: 0.55, fontFace: F.H, fontSize: 14, bold: true, color: eText(), align: al, margin: 0, valign: "top" });
    s.addText(p.desc || "", { x: tx, y: by + 0.85, w: bw, h: 0.65, fontFace: F.B, fontSize: 11, color: C.BODY, align: al, valign: "top", margin: 0, lineSpacingMultiple: 1.1 });
  });
};

// rings: each track is a vertical pillar filled from the bottom; the combined figure is the amber one
TEM.rings = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title]);
  const s = await emberSlide(pres, d.eyebrow, d.title, col);
  const rings = d.rings || [], stats = d.stats || [], li = Math.max(0, rings.findIndex((r) => r.dark));
  const top = 1.95, ph = 4.5, pw = stats.length ? 6.8 : 11.93, n = Math.max(rings.length, 1), cw = pw / n;
  ePanel(s, 0.7, top, pw, ph);
  rings.forEach((r, i) => {
    const cx = 0.7 + cw * i + cw / 2, lead = i === li, c = lead ? C.LIME : C.BODY, pl = Math.min(1.2, cw - 0.6);
    s.addText(`${r.pct}%`, { x: cx - cw / 2 + 0.1, y: top + 0.2, w: cw - 0.2, h: 0.65, fontFace: F.H, fontSize: 34, bold: true, color: lead ? eInk(C.LIME, eCard()) : eText(), align: "center", margin: 0, valign: "middle" });
    const py = top + 0.95, pH = 2.0, p = Math.max(0, Math.min(100, r.pct || 0));
    s.addShape("rect", { x: cx - pl / 2, y: py, w: pl, h: pH, fill: { color: eTrk() }, line: { type: "none" } });
    if (p) s.addShape("rect", { x: cx - pl / 2, y: py + pH * (1 - p / 100), w: pl, h: pH * p / 100, fill: { color: c }, line: { type: "none" } });
    s.addText(r.label, { x: cx - cw / 2 + 0.1, y: top + 3.05, w: cw - 0.2, h: 0.5, fontFace: F.H, fontSize: 13, bold: true, color: eText(), align: "center", margin: 0, valign: "top" });
    s.addText(r.sub || "", { x: cx - cw / 2 + 0.1, y: top + 3.58, w: cw - 0.2, h: 0.8, fontFace: F.B, fontSize: 11, color: C.GRAY, align: "center", margin: 0, valign: "top" });
  });
  if (stats.length) {
    const sx = 7.9, sw = 12.63 - sx, rh = Math.min(1.1, ph / stats.length);
    stats.forEach((k, i) => {
      const y = top + i * rh, on = k.state === "done", risk = k.state === "blocked", c = risk ? C.AMBER : k.state === "next" ? C.GRAY : C.LIME;
      if (i) s.addShape("line", { x: sx, y, w: sw, h: 0, line: { color: eRule(), width: 0.75 } });
      s.addShape("rect", { x: sx, y: y + rh / 2 - 0.08, w: 0.16, h: 0.16, fill: on || risk ? { color: c } : { type: "none" }, line: on || risk ? { type: "none" } : { color: c, width: 1.5 } });
      s.addText(String(k.value), { x: sx + 0.4, y, w: 1.5, h: rh, fontFace: F.H, fontSize: 30, bold: true, color: eText(), margin: 0, valign: "middle" });
      s.addText(k.label, { x: sx + 2.0, y, w: sw - 2.0, h: rh, fontFace: F.B, fontSize: 13, color: C.BODY, margin: 0, valign: "middle" });
    });
  }
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.55, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// phase_bars: one panel per track, every phase a block that fills left to right
TEM.phase_bars = async (pres, d) => {
  const base = d.color ? projColor("", d.color) : projFor([d.project, d.eyebrow, d.title]);
  const s = await emberSlide(pres, d.eyebrow, d.title, base);
  const tracks = d.tracks, n = tracks.length, top = 1.9, gap = 0.15, tall = n === 1, th = tall ? 3.95 : (5.05 - gap) / n;
  tracks.forEach((t, i) => {
    const y = top + i * (th + gap), c = t.color ? projColor("", t.color) : (i === 0 ? base : tint(base, 0.35 * i)), ci = eInk(c, eCard());
    ePanel(s, 0.7, y, 11.93, th);
    const avg = Math.round(t.phases.reduce((a, p) => a + (p.pct || 0), 0) / t.phases.length);
    s.addText(t.title, { x: 1.0, y: y + 0.1, w: 7.5, h: 0.38, fontFace: F.H, fontSize: 18, bold: true, color: eText(), margin: 0, valign: "middle" });
    if (t.owner) s.addText(`Owner: ${t.owner}`, { x: 1.0, y: y + 0.48, w: 7.5, h: 0.24, fontFace: F.B, fontSize: 11, color: C.GRAY, margin: 0, valign: "middle" });
    s.addText([{ text: `${avg}%`, options: { fontSize: 30, bold: true, color: ci } }, { text: "  of the track", options: { fontSize: 11, color: C.GRAY } }],
      { x: 8.6, y: y + 0.08, w: 3.75, h: 0.66, fontFace: F.H, align: "right", valign: "middle", margin: 0 });
    const ph = t.phases, g = 0.1, sw = (11.33 - (ph.length - 1) * g) / ph.length, ty = y + 0.8, tH = tall ? 1.7 : 0.4;
    ph.forEach((p, k) => {
      const x = 1.0 + k * (sw + g), pct = Math.max(0, Math.min(100, p.pct || 0));
      s.addShape("rect", { x, y: ty, w: sw, h: tH, fill: { color: eTrk() }, line: { type: "none" } });
      if (pct) s.addShape("rect", { x, y: ty, w: sw * pct / 100, h: tH, fill: { color: c }, line: { type: "none" } });
      s.addText(pct ? `${pct}%` : "Not started", { x, y: ty + tH + 0.03, w: sw, h: 0.26, fontFace: F.H, fontSize: pct ? 13 : 11, bold: !!pct, italic: !pct, color: pct ? ci : C.GRAY, margin: 0, valign: "middle" });
      s.addText(p.name, { x, y: ty + tH + 0.3, w: sw - 0.05, h: 0.58, fontFace: F.B, fontSize: 11, color: pct ? eText() : C.GRAY, margin: 0, valign: "top" });
    });
    if (t.note) s.addText(t.note, { x: 1.0, y: y + th - 0.3, w: 11.33, h: 0.24, fontFace: F.B, fontSize: 11, italic: true, color: C.BODY, margin: 0, valign: "middle" });
  });
};

// workstreams: the finished workstream as a hero panel, the next one as a connected vertical path
TEM.workstreams = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title]), h = d.hero, f = d.flow, ci = eInk(col, eCard());
  const s = await emberSlide(pres, d.eyebrow, d.title, col);
  ePanel(s, 0.7, 1.95, 4.9, 4.9);
  s.addText(h.label || "Workstream 1", { x: 1.0, y: 2.2, w: 4.3, h: 0.3, fontFace: F.B, fontSize: 12, bold: true, color: C.GRAY, margin: 0, valign: "middle" });
  s.addText(String(h.metric), { x: 1.0, y: 2.55, w: 4.3, h: 1.4, fontFace: F.H, fontSize: 80, bold: true, color: ci, margin: 0, valign: "middle" });
  s.addText(h.title, { x: 1.0, y: 4.0, w: 4.3, h: 0.6, fontFace: F.H, fontSize: 17, bold: true, color: eText(), margin: 0, valign: "top" });
  eTag(s, h.state || "done", h.status, 1.0, 4.72, 4.3, col);
  s.addText(h.desc || "", { x: 1.0, y: 5.18, w: 4.3, h: 1.5, fontFace: F.B, fontSize: 12, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
  const rx = 6.1, rw = 12.63 - rx;
  s.addText(f.label || "Workstream 2", { x: rx, y: 1.95, w: 3, h: 0.3, fontFace: F.B, fontSize: 12, bold: true, color: C.GRAY, margin: 0, valign: "middle" });
  eTag(s, f.state || "progress", f.status, rx + rw - 2.4, 1.95, 2.4, col, "right");
  s.addText(f.title, { x: rx, y: 2.3, w: rw, h: 0.5, fontFace: F.H, fontSize: 19, bold: true, color: eText(), margin: 0, valign: "middle" });
  const steps = f.steps, y0 = 3.05, avail = (f.next ? 6.0 : 6.8) - y0, rh = Math.min(1.0, avail / steps.length);
  s.addShape("line", { x: rx + 0.11, y: y0 + 0.2, w: 0, h: rh * (steps.length - 1), line: { color: eRule(), width: 1.5 } });
  steps.forEach((p, i) => {
    const y = y0 + i * rh, on = p.state === "done", risk = p.state === "blocked", c = risk ? C.AMBER : p.state === "next" ? C.GRAY : C.LIME;
    s.addShape("rect", { x: rx, y: y + 0.09, w: 0.22, h: 0.22, fill: on || risk ? { color: c } : { color: C.DARK }, line: on || risk ? { type: "none" } : { color: c, width: 1.75 } });
    s.addText(p.title, { x: rx + 0.5, y: y + 0.04, w: rw - 2.8, h: 0.32, fontFace: F.H, fontSize: 14, bold: true, color: p.state === "next" ? C.BODY : eText(), margin: 0, valign: "middle" });
    s.addText(p.desc || "", { x: rx + 0.5, y: y + 0.38, w: rw - 2.8, h: rh - 0.42, fontFace: F.B, fontSize: 11, color: C.BODY, margin: 0, valign: "top" });
    eTag(s, p.state, { done: "Done", progress: "In progress", next: "Next", blocked: "Blocked" }[p.state], rx + rw - 2.1, y + 0.05, 2.1, col, "right");
  });
  if (f.next) {
    ePanel(s, rx, 6.15, rw, 0.7);
    s.addText([{ text: "Next:  ", options: { bold: true, color: eInk(C.LIME, eCard()) } }, { text: f.next, options: { color: eText() } }],
      { x: rx + 0.25, y: 6.15, w: rw - 0.5, h: 0.7, fontFace: F.B, fontSize: 12.5, margin: 0, valign: "middle" });
  }
};

// rows: one full-width band per point, a large numeral in the first cell; a screenshot sits beside them
TEM.rows = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title], C.LIME), ci = eInk(col, eCard());
  const s = await emberSlide(pres, d.eyebrow, d.title, col);
  let img = null, aspect = 1;
  if (d.image) { img = path.resolve(d.image); const m = await sharp(img).metadata(); aspect = m.height / m.width; }
  const n = d.rows.length, aw = img ? 6.8 : 11.93, gap = 0.2, rh = (4.9 - (n - 1) * gap) / n;
  if (img) {
    const colX = 7.8, colW = 12.63 - colX; let fw = colW - 0.3, fh = fw * aspect;
    if (fh > 4.6) { fh = 4.6; fw = fh / aspect; }
    ePanel(s, colX, 1.95, colW, fh + 0.3);
    s.addImage({ path: img, x: colX + (colW - fw) / 2, y: 2.1, w: fw, h: fh });
  }
  d.rows.forEach((r, i) => {
    const y = 1.95 + i * (rh + gap);
    ePanel(s, 0.7, y, aw, rh);
    s.addText(String(i + 1).padStart(2, "0"), { x: 0.9, y, w: 1.2, h: rh, fontFace: F.H, fontSize: 40, bold: true, color: ci, margin: 0, valign: "middle" });
    s.addText(r.header, { x: 2.2, y: y + 0.14, w: aw - 1.7, h: 0.4, fontFace: F.H, fontSize: 16, bold: true, color: eText(), margin: 0, valign: "middle" });
    s.addText(eDesc(r.desc), { x: 2.2, y: y + 0.58, w: aw - 1.7, h: rh - 0.7, fontFace: F.B, fontSize: 12, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
  });
};

// table: a filled header row and banded rows; the project name carries the project colour
TEM.table = async (pres, d) => {
  const s = await emberSlide(pres, d.eyebrow || "Looking ahead", d.title || "Next steps");
  const cols = [{ k: "Project / track", w: 3.0 }, { k: "Owner", w: 1.9 }, { k: "Next focus", w: 4.33 }, { k: "Status", w: 2.7 }];
  let x = 0.7; const xs = cols.map((c) => { const v = x; x += c.w; return v; });
  ePanel(s, 0.7, 1.95, 11.93, 0.5, tint(C.DARK, 0.12));
  cols.forEach((c, i) => s.addText(c.k, { x: xs[i] + 0.2, y: 1.95, w: c.w - 0.4, h: 0.5, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, margin: 0, valign: "middle", align: i === 3 ? "right" : "left" }));
  const n = d.rows.length, rh = Math.min(1.0, 4.35 / n);
  d.rows.forEach((r, i) => {
    const y = 2.45 + i * rh, c = projFor([r.project]), bg = i % 2 === 0 ? eCard() : C.DARK;
    ePanel(s, 0.7, y, 11.93, rh, bg);
    s.addText(r.project, { x: xs[0] + 0.2, y, w: cols[0].w - 0.45, h: rh, fontFace: F.H, fontSize: 13, bold: true, color: eInk(c, bg), margin: 0, valign: "middle" });
    s.addText(r.owner || "", { x: xs[1] + 0.2, y, w: cols[1].w - 0.45, h: rh, fontFace: F.B, fontSize: 11.5, color: C.BODY, margin: 0, valign: "middle" });
    s.addText(r.focus, { x: xs[2] + 0.2, y, w: cols[2].w - 0.5, h: rh, fontFace: F.B, fontSize: 11.5, color: eText(), margin: 0, valign: "middle" });
    eTag(s, r.state, r.current, xs[3], y + rh / 2 - 0.15, cols[3].w - 0.2, c, "right");
  });
};

// gallery: each screenshot sits on its own panel with a numbered caption bar
TEM.gallery = async (pres, d) => {
  const col = projFor([d.eyebrow, d.title], C.LIME), ci = eInk(col, eCard());
  const s = await emberSlide(pres, d.eyebrow, d.title, col);
  const imgs = d.images.map((p) => path.resolve(p));
  const metas = await Promise.all(imgs.map((p) => sharp(p).metadata()));
  const aspect = metas[0].height / metas[0].width, n = imgs.length, gap = n > 4 ? 0.2 : 0.3, pad = 0.1, cap = 0.5;
  let fw = (11.93 - (n - 1) * gap) / n - 2 * pad, fh = fw * aspect;
  if (fh > 3.9) { fh = 3.9; fw = fh / aspect; }
  const pw = fw + 2 * pad, x0 = 0.7 + (11.93 - (n * pw + (n - 1) * gap)) / 2, fy = 2.0;
  imgs.forEach((p, i) => {
    const x = x0 + i * (pw + gap);
    ePanel(s, x, fy, pw, fh + 2 * pad + cap);
    s.addImage({ path: p, x: x + pad, y: fy + pad, w: fw, h: fh });
    s.addText([{ text: `${i + 1}  `, options: { bold: true, color: ci } }, { text: (d.labels && d.labels[i]) || `Step ${i + 1}`, options: { color: eText() } }],
      { x: x + pad + 0.05, y: fy + fh + 2 * pad, w: fw - 0.1, h: cap, fontFace: F.H, fontSize: n > 4 ? 10.5 : 12, margin: 0, valign: "middle" });
  });
};

// activity: figures as a row of panels on top, the chart below across the full width
TEM.activity = async (pres, d) => {
  const s = await emberSlide(pres, d.eyebrow || "Engineering activity", d.title || "Team delivery activity");
  const kpis = d.kpis || [], gap = 0.2, kw = kpis.length ? (11.93 - (kpis.length - 1) * gap) / kpis.length : 0, ky = 1.95, kh = 1.15;
  kpis.forEach((k, i) => {
    const x = 0.7 + i * (kw + gap);
    ePanel(s, x, ky, kw, kh);
    s.addText(String(k.value), { x: x + 0.25, y: ky + 0.08, w: kw - 0.5, h: 0.65, fontFace: F.H, fontSize: 34, bold: true, color: i === 0 ? eInk(C.LIME, eCard()) : eText(), margin: 0, valign: "middle" });
    s.addText(k.label, { x: x + 0.25, y: ky + 0.74, w: kw - 0.5, h: 0.3, fontFace: F.B, fontSize: 12, color: C.BODY, margin: 0, valign: "middle" });
  });
  const cy = kpis.length ? ky + kh + 0.2 : 1.9, ch = 6.85 - (d.note ? 0.4 : 0) - cy;
  const labels = d.people.map((p) => p.name);
  const data = d.series.map((name, i) => ({ name, labels, values: d.people.map((p) => p.values[i] || 0) }));
  s.addChart(pres.charts.BAR, data, {
    x: 0.7, y: cy, w: 11.93, h: ch, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70,
    chartColors: [C.LIME, C.BODY, "5CC8D7", "6B7482"].slice(0, d.series.length),
    catAxisLabelFontFace: F.H, catAxisLabelFontSize: 11, catAxisLabelColor: eText(), catAxisLineShow: true,
    valAxisHidden: true, valGridLine: { style: "none" },
    showValue: true, dataLabelFontFace: F.H, dataLabelFontSize: 10.5, dataLabelFontBold: true, dataLabelColor: eText(), dataLabelPosition: "outEnd",
    showLegend: true, legendPos: "t", legendFontSize: 10.5, legendFontFace: F.H, legendColor: eText(),
  });
  if (d.note) s.addText(d.note, { x: 0.7, y: 6.5, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// review_insights: the figures stand in a left column, each finding is its own band with a status tag
TEM.review_insights = async (pres, d) => {
  const s = await emberSlide(pres, d.eyebrow || "Quality and code review", d.title || "Code review insights");
  const stats = d.stats || [], sw = 3.2, f = d.findings || [], fgap = 0.15, noteH = d.note ? 0.4 : 0;
  const rh = Math.min(1.35, (4.9 - noteH - (f.length - 1) * fgap) / Math.max(f.length, 1)), fTotal = f.length * rh + (f.length - 1) * fgap;
  const sh = (fTotal - 0.2 * (stats.length - 1)) / Math.max(stats.length, 1);
  stats.forEach((k, i) => {
    const y = 1.95 + i * (sh + 0.2);
    ePanel(s, 0.7, y, sw, sh);
    const vs = sh < 1.2 ? 28 : sh < 1.5 ? 34 : (i === 0 ? 44 : 36);
    s.addText(String(k.value), { x: 0.95, y: y + 0.06, w: sw - 0.5, h: sh * 0.5, fontFace: F.H, fontSize: vs, bold: true, color: i === 0 ? eInk(C.LIME, eCard()) : eText(), margin: 0, valign: "middle" });
    s.addText(k.label, { x: 0.95, y: y + sh * 0.55, w: sw - 0.5, h: sh * 0.4, fontFace: F.B, fontSize: sh < 1.2 ? 11 : 11.5, color: C.BODY, margin: 0, valign: "top" });
  });
  const fx = 4.2, fw = 12.63 - fx, top = 1.95, gap = fgap;
  const lbl = { done: "Resolved", progress: "In progress", blocked: "Open risk", next: "Planned" };
  f.forEach((it, i) => {
    const y = top + i * (rh + gap);
    ePanel(s, fx, y, fw, rh);
    const cm = rh < 1.0;   // five findings: area and text sit closer together
    s.addText(it.area || "", { x: fx + 0.25, y: y + (cm ? 0.06 : 0.12), w: fw - 2.6, h: 0.3, fontFace: F.H, fontSize: 13, bold: true, color: eText(), margin: 0, valign: "middle" });
    s.addText(it.text, { x: fx + 0.25, y: y + (cm ? 0.36 : 0.45), w: fw - 0.5, h: rh - (cm ? 0.4 : 0.55), fontFace: F.B, fontSize: cm ? 11 : 12, color: C.BODY, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
    eTag(s, it.state, it.status || lbl[it.state], fx + fw - 2.35, y + (cm ? 0.06 : 0.12), 2.1, C.LIME, "right");
  });
  if (d.note) s.addText(d.note, { x: fx, y: top + fTotal + 0.1, w: fw, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// attention: two panels; the risk panel is topped with a coral bar, the decisions panel with the amber accent
TEM.attention = async (pres, d) => {
  const s = await emberSlide(pres, d.eyebrow || "Needs attention", d.title || "Blockers and decisions needed", C.AMBER);
  const gap = 0.3, cw = (11.93 - gap) / 2, top = 1.95, tw = cw - 1.15;
  const cols = [
    { x: 0.7, head: d.blockersTitle || "Blockers and risks", items: d.blockers || [], c: C.AMBER, empty: d.noBlockers || "No open blockers." },
    { x: 0.7 + cw + gap, head: d.decisionsTitle || "Decisions needed", items: d.decisions || [], c: C.LIME, empty: "No decisions needed." },
  ];
  // items stack by their estimated text height (type steps down when they would not fit); both panels share one height
  const lines = (t, pt, k) => Math.max(1, Math.ceil(String(t || "").length * pt * k / 72 / tw));
  const heights = (items, fs) => items.map((it) => lines(it.title, fs[0], 0.58) * fs[0] * 1.25 / 72 + (it.text ? lines(it.text, fs[1], 0.5) * fs[1] * 1.3 / 72 : 0) + (it.meta ? lines(it.meta, fs[2], 0.5) * fs[2] * 1.3 / 72 : 0) + 0.3);
  const sum = (a) => a.reduce((x, y) => x + y, 0), avail = 4.9 - 1.0;
  cols.forEach((col) => {
    col.fs = [15, 12, 11]; col.hs = heights(col.items, col.fs);
    if (sum(col.hs) > avail) { col.fs = [13, 11, 11]; col.hs = heights(col.items, col.fs); }
  });
  const ph = Math.min(4.9, 1.0 + Math.max(sum(cols[0].hs), sum(cols[1].hs), 0.9) + 0.1);
  cols.forEach((col) => {
    ePanel(s, col.x, top, cw, ph);
    s.addShape("rect", { x: col.x, y: top, w: cw, h: 0.08, fill: { color: col.c }, line: { type: "none" } });
    s.addText([{ text: col.head, options: { bold: true, color: eText() } }, { text: `   ${col.items.length}`, options: { color: C.GRAY } }],
      { x: col.x + 0.3, y: top + 0.25, w: cw - 0.6, h: 0.45, fontFace: F.H, fontSize: 17, margin: 0, valign: "middle" });
    if (!col.items.length) { s.addText(col.empty, { x: col.x + 0.3, y: top + 0.95, w: cw - 0.6, h: 0.5, fontFace: F.H, fontSize: 14, italic: true, color: C.GRAY, margin: 0 }); return; }
    let y = top + 0.9;
    col.items.forEach((it, i) => {
      if (i) s.addShape("line", { x: col.x + 0.3, y: y - 0.1, w: cw - 0.6, h: 0, line: { color: eRule(), width: 0.75 } });
      s.addText(String(i + 1), { x: col.x + 0.3, y, w: 0.45, h: 0.5, fontFace: F.H, fontSize: 24, bold: true, color: eInk(col.c, eCard()), margin: 0, valign: "top" });
      const runs = [{ text: it.title, options: { bold: true, fontSize: col.fs[0], color: eText(), breakLine: true } }];
      if (it.text) runs.push({ text: it.text, options: { fontSize: col.fs[1], color: C.BODY, breakLine: !!it.meta } });
      if (it.meta) runs.push({ text: it.meta, options: { fontSize: col.fs[2], italic: true, color: C.GRAY } });
      s.addText(runs, { x: col.x + 0.85, y, w: tw, h: col.hs[i] - 0.15, fontFace: F.H, valign: "top", margin: 0, lineSpacingMultiple: 1.1, paraSpaceAfter: 3 });
      y += col.hs[i];
    });
  });
};

// tracker: up to three developers as full-width bands, four as a 2 x 2 grid of panels
TEM.tracker = async (pres, d) => {
  const s = await emberSlide(pres, d.eyebrow || "Team and task tracker", d.title || "Developer task track");
  const devs = d.devs || [], n = devs.length, bottom = d.footnote ? 6.55 : 6.85, grid = n === 4, gap = 0.2;
  const cols = grid ? 2 : 1, rows = Math.ceil(n / cols), pw = (11.93 - (cols - 1) * gap) / cols, ph = (bottom - 1.95 - (rows - 1) * gap) / Math.max(rows, 1);
  devs.forEach((v, i) => {
    const x = 0.7 + (i % cols) * (pw + gap), y = 1.95 + Math.floor(i / cols) * (ph + gap), c = projFor([v.project]), ci = eInk(c, eCard());
    ePanel(s, x, y, pw, ph);
    const items = v.items || [], half = Math.ceil(items.length / 2);
    if (grid) {
      s.addText(v.name, { x: x + 0.25, y: y + 0.08, w: pw - 0.5, h: 0.36, fontFace: F.H, fontSize: 15, bold: true, color: eText(), margin: 0, valign: "middle" });
      s.addText(v.project || "", { x: x + 0.25, y: y + 0.44, w: pw - 1.8, h: 0.26, fontFace: F.B, fontSize: 11, bold: true, color: ci, margin: 0, valign: "middle" });
      s.addText(`${v.pct ?? 0}%`, { x: x + pw - 1.45, y: y + 0.4, w: 1.2, h: 0.36, fontFace: F.H, fontSize: 20, bold: true, color: ci, align: "right", margin: 0, valign: "middle" });
      eBar(s, x + 0.25, y + 0.8, pw - 0.5, v.pct, c, 0.08);
      const iw = (pw - 0.5) / 2, ih = Math.min(0.4, (ph - 1.05) / Math.max(half, 1));
      items.forEach((it, k) => {
        const cx = x + 0.25 + Math.floor(k / half) * iw, cyy = y + 0.98 + (k % half) * ih, on = it.state === "done";
        s.addShape("rect", { x: cx, y: cyy + 0.07, w: 0.12, h: 0.12, fill: on ? { color: c } : { type: "none" }, line: on ? { type: "none" } : { color: it.state === "next" ? C.GRAY : c, width: 1.25 } });
        s.addText(it.text, { x: cx + 0.22, y: cyy, w: iw - 0.4, h: ih, fontFace: F.B, fontSize: 11, color: it.state === "next" ? C.GRAY : eText(), margin: 0, valign: "top" });
      });
    } else {
      const two = (v.name || "").length > 26, nh = two ? 0.5 : 0.32;
      s.addText(v.name, { x: x + 0.25, y: y + 0.1, w: 3.6, h: nh, fontFace: F.H, fontSize: two ? 13 : 15, bold: true, color: eText(), margin: 0, valign: "top" });
      s.addText(v.project || "", { x: x + 0.25, y: y + 0.12 + nh, w: 3.6, h: 0.24, fontFace: F.B, fontSize: 11, bold: true, color: ci, margin: 0, valign: "middle", fit: "shrink" });
      s.addText(v.focus || "", { x: x + 0.25, y: y + 0.4 + nh, w: 3.6, h: ph - 0.45 - nh, fontFace: F.B, fontSize: 11, italic: true, color: C.BODY, margin: 0, valign: "top" });
      const mx = x + 4.2, mw = 2.3;
      s.addText(`${v.pct ?? 0}%`, { x: mx, y: y + 0.1, w: mw, h: 0.6, fontFace: F.H, fontSize: 28, bold: true, color: ci, margin: 0, valign: "middle" });
      s.addText(`${v.done ?? 0} done, ${v.open ?? 0} open`, { x: mx, y: y + 0.72, w: mw, h: 0.28, fontFace: F.B, fontSize: 11, color: C.BODY, margin: 0, valign: "middle" });
      eBar(s, mx, y + ph - 0.3, mw, v.pct, c, 0.08);
      const ix = x + 6.85, iw = (x + pw - ix - 0.25) / 2, ih = Math.min(0.4, (ph - 0.3) / Math.max(half, 1));
      items.forEach((it, k) => {
        const cx = ix + Math.floor(k / half) * iw, cyy = y + 0.15 + (k % half) * ih, on = it.state === "done";
        s.addShape("rect", { x: cx, y: cyy + 0.07, w: 0.12, h: 0.12, fill: on ? { color: c } : { type: "none" }, line: on ? { type: "none" } : { color: it.state === "next" ? C.GRAY : c, width: 1.25 } });
        s.addText(it.text, { x: cx + 0.22, y: cyy, w: iw - 0.35, h: ih, fontFace: F.B, fontSize: 11, color: it.state === "next" ? C.GRAY : eText(), margin: 0, valign: "top" });
      });
    }
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.62, w: 11.93, h: 0.28, fontFace: F.B, fontSize: 11, italic: true, color: C.GRAY, margin: 0 });
};

// ---------- Text measuring ----------
// Arial advance widths (1/1000 em) for ASCII; used to count wrapped lines of body text without rendering. Other body fonts are
// narrower or close, so the estimate errs on the tall side.
const ARIAL_W = (() => {
  const t = {}; const set = (chars, w) => { for (const c of chars) t[c] = w; };
  set(" .,:;/!|", 278); set("fjt", 278); set("il", 222); set("rI", 333); set("-()[]`", 333); set("ckvxyzsJ", 500); set("'", 191); set("\"", 355);
  set("abdeghnopqu0123456789?_#$L", 556); set("FTZ", 611); set("ABEKPSVXY&", 667); set("CDHNRUw", 722); set("GOQ", 778);
  set("m", 833); set("M", 833); set("W", 944); set("%", 889); set("+<=>~", 584); set("@", 1015); set("*", 389); set("\\", 278);
  return t;
})();
function textWidth(text, pt, bold) { let w = 0; for (const c of String(text)) w += ARIAL_W[c] || 600; return w / 1000 * pt / 72 * (bold ? 1.06 : 1); }
// number of lines `text` takes in a box `width` inches wide (greedy word wrap, 3% safety margin)
function wrapLines(text, pt, width, bold) {
  const max = width * 0.97; let n = 1, cur = 0; const space = textWidth(" ", pt, bold);
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    const w = textWidth(word, pt, bold);
    if (cur && cur + space + w > max) { n++; cur = w; } else cur = cur ? cur + space + w : w;
  }
  return n;
}

// ---------- task_detail: tasks written out in full (every style) ----------
// One column per task (1 to 3): status, title, owner, a plain-language summary, then the subtasks or steps with their own
// state. One task gets the whole width: the words on the left, the steps on the right. The body is shared; each style
// supplies its slide chrome, panel, status tag and colours through a "look".
function taskDetailBody(s, d, L) {
  const tasks = d.tasks || [], n = tasks.length, top = 1.95, bottom = d.footnote ? 6.5 : 6.85, hMax = bottom - top, gap = 0.3;
  const cw = n === 1 ? 11.93 : (11.93 - (n - 1) * gap) / n, wide = n === 1, pad = 0.25;
  // title height estimate for the heading face: characters x point size x average glyph width, over the box width
  const tlines = (t, pt, w) => Math.max(1, Math.ceil(String(t || "").length * pt * 0.6 / 72 / w));
  // first pass: how tall is each task's content, so the panels can be sized to it instead of leaving them half empty
  const plans = tasks.map((t) => {
    const lw = wide ? 4.9 : cw - 2 * pad, pw = wide ? cw - 2 * pad - lw - 0.5 : lw, tfs = wide ? 18 : 15;
    const th = tlines(t.title, tfs, lw) * tfs * 1.25 / 72, y = 0.58 + th + 0.05 + (t.owner ? 0.3 : 0);
    const hasImg = !!t.image, cap = hasImg && t.caption ? 0.3 : 0;
    let ih = 0, iw = 0;
    if (hasImg) { const box = wide ? { w: pw, h: 2.6 } : { w: lw, h: 1.3 }; iw = Math.min(box.w, box.h / t.imageAspect); ih = iw * t.imageAspect; }
    const pts = t.points || [], pfs = wide ? 13 : 11, pstep = (p) => wrapLines(p.text, pfs, pw - 0.27) * pfs * 1.2 / 72 + (wide ? 0.18 : 0.06);
    const ptsH = pts.reduce((a, p) => a + pstep(p), 0) + (pts.length ? 0.3 : 0);
    let sfs = wide ? 13 : 12, sh = wrapLines(t.summary, sfs, lw) * sfs * 1.3 / 72;
    if (!wide && y + sh + 0.15 + ptsH + (hasImg ? ih + cap + 0.15 : 0) > hMax) { sfs = 11; sh = wrapLines(t.summary, sfs, lw) * sfs * 1.3 / 72; }
    const left = y + sh, right = wide ? 0.2 + (hasImg ? ih + cap + 0.15 : 0) + ptsH : y + sh + 0.15 + (hasImg ? ih + cap + 0.15 : 0) + ptsH;
    return { lw, pw, tfs, th, y, hasImg, cap, ih, iw, pts, pfs, pstep, sfs, sh, need: Math.max(left, right) };
  });
  const need = Math.max(...plans.map((q) => q.need)), h = Math.min(hMax, Math.max(wide ? 3.4 : 2.6, need + 0.3));
  plans.forEach((q, i) => {
    if (!wide && q.need > hMax + 0.02) console.warn(`Warning: task_detail "${d.title}", task "${tasks[i].title}": too much text for ${n} columns, it will run past the panel. Use fewer tasks on this slide, fewer points, no image, or shorter text.`);
  });
  tasks.forEach((t, i) => {
    const q = plans[i], x = 0.7 + i * (cw + gap), col = L.col(t, d), px = wide ? x + pad + q.lw + 0.5 : x + pad;
    L.panel(s, x, top, cw, h, col, i);
    L.tag(s, t.state, t.status, x + pad, top + 0.2, q.lw, col);
    s.addText(t.title, { x: x + pad, y: top + 0.58, w: q.lw, h: q.th, fontFace: F.H, fontSize: q.tfs, bold: true, color: L.text(), valign: "top", margin: 0 });
    let y = top + 0.58 + q.th + 0.05;
    if (t.owner) { s.addText(`Owner: ${t.owner}`, { x: x + pad, y, w: q.lw, h: 0.25, fontFace: F.B, fontSize: 11, color: L.gray(), margin: 0, valign: "middle" }); y += 0.3; }
    s.addText(t.summary || "", { x: x + pad, y, w: q.lw, h: wide ? Math.max(q.sh, 0.4) + 0.1 : q.sh, fontFace: F.B, fontSize: q.sfs, color: L.softText(), valign: "top", margin: 0, lineSpacingMultiple: 1.1 });
    y += q.sh + 0.15;
    let py = wide ? top + 0.2 : y;
    if (q.hasImg) {
      const ix = wide ? px : x + pad, iy = wide ? py : y;
      s.addImage({ path: t.image, x: ix, y: iy, w: q.iw, h: q.ih, altText: t.caption || t.title });
      s.addShape("rect", { x: ix, y: iy, w: q.iw, h: q.ih, fill: { type: "none" }, line: { color: L.rule(), width: 0.75 } });
      if (t.caption) s.addText(t.caption, { x: ix, y: iy + q.ih + 0.04, w: wide ? q.pw : q.lw, h: 0.26, fontFace: F.B, fontSize: 11, italic: true, color: L.gray(), margin: 0, valign: "middle" });
      py = iy + q.ih + q.cap + 0.15;
    }
    if (q.pts.length) { s.addText("Details", { x: px, y: py, w: q.pw, h: 0.25, fontFace: F.B, fontSize: 11, bold: true, color: L.gray(), margin: 0, valign: "middle" }); py += 0.3; }
    q.pts.forEach((p) => {
      const state = p.state || "done", c = state === "blocked" ? C.AMBER : state === "next" ? C.GRAY : col, solid = state === "done" || state === "blocked", st2 = q.pstep(p);
      s.addShape("ellipse", { x: px, y: py + 0.06, w: 0.13, h: 0.13, fill: solid ? { color: c } : { type: "none" }, line: solid ? { type: "none" } : { color: c, width: 1.5 } });
      s.addText(p.text, { x: px + 0.27, y: py, w: q.pw - 0.27, h: st2, fontFace: F.B, fontSize: q.pfs, color: state === "next" ? L.gray() : L.text(), valign: "top", margin: 0 });
      py += st2;
    });
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: Math.min(top + h + 0.15, 6.55), w: 11.93, h: 0.3, fontFace: F.B, fontSize: 11, italic: true, color: L.gray(), margin: 0 });
}
const tdCol = (t, d) => projFor([t.project, d.project, d.eyebrow, d.title], C.LIME);
const TD_CARD = {
  slide: async (pres, d) => { const s = newSlide(pres); header(s, d.eyebrow || "Task details", d.title || "Task details", 28); return s; },
  col: () => C.LIME,
  panel: (s, x, y, w, h) => card(s, x, y, w, h),
  tag: (s, state, text, x, y) => pill(s, text || st(state).label, x, y, state),
  text: () => C.DARK, softText: () => C.BODY, gray: () => C.BODY, rule: () => C.GRID,
};
function tdLook(base, over) { const L = Object.assign({}, base, over); F.H = F.H; F.B = F.B; return L; }
T.task_detail = async (pres, d) => { const L = tdLook(TD_CARD, {}); taskDetailBody(await L.slide(pres, d), d, L); };
TE.task_detail = async (pres, d) => {
  const L = tdLook(TD_CARD, { panel: (s, x, y, w, h, col, i) => { if (i) vl(s, x - 0.15, y, h); hl(s, x, y, w, 2, C.DARK); },
    tag: (s, state, text, x, y, w) => tag(s, text || st(state).label, x, y + 0.02, w, state) });
  taskDetailBody(await L.slide(pres, d), d, L);
};
TS.task_detail = async (pres, d) => {
  const L = tdLook(TD_CARD, { slide: (p, dd) => sigSlide(p, dd.eyebrow || "Task details", dd.title || "Task details", 28), col: tdCol,
    panel: (s, x, y, w, h, col) => { rcard(s, x, y, w, h, col); s.addShape("rect", { x: x + 0.25, y, w: 0.9, h: 0.07, fill: { color: col }, line: { type: "none" } }); },
    tag: (s, state, text, x, y, w, col) => stChip(s, state, text || st(state).label, x, y, col) });
  taskDetailBody(await L.slide(pres, d), d, L);
};
TP.task_detail = async (pres, d) => {
  const L = tdLook(TD_CARD, { slide: (p, dd) => paperSlide(p, dd.eyebrow || "Task details", dd.title || "Task details", tdCol({}, dd)), col: tdCol,
    panel: (s, x, y, w, h, col, i) => { pRule(s, x, y, w, C.DARK, 2); if (i) s.addShape("line", { x: x - 0.15, y, w: 0, h, line: { color: C.GRID, width: 0.75 } }); },
    tag: (s, state, text, x, y, w, col) => pStatus(s, state, text, x, y, w, col), gray: () => C.GRAY });
  taskDetailBody(await L.slide(pres, d), d, L);
};
TEM.task_detail = async (pres, d) => {
  const L = tdLook(TD_CARD, { slide: (p, dd) => emberSlide(p, dd.eyebrow || "Task details", dd.title || "Task details", tdCol({}, dd)), col: tdCol,
    panel: (s, x, y, w, h) => ePanel(s, x, y, w, h),
    tag: (s, state, text, x, y, w, col) => eTag(s, state, text, x, y, w, col), text: eText, softText: () => C.BODY, gray: () => C.GRAY, rule: eRule });
  taskDetailBody(await L.slide(pres, d), d, L);
};

// ---------- Images (screenshots and photos the user provides) ----------
// Every image named in report.json (rows.image, gallery.images, task_detail tasks[].image) is checked and normalised before
// any template sees it: the file must exist, phone photos are rotated upright, the format becomes PNG or JPEG (PowerPoint
// cannot show WebP, AVIF or TIFF), and oversized originals are scaled down so the deck stays small. A gallery whose images
// differ in shape is padded to one shape so nothing is stretched. Problems are reported and the image is skipped, never fatal.
const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".tif", ".tiff", ".svg", ".bmp"]);
const IMG_MAX = 1800;
let IMG_N = 0;
async function prepareImage(src) {
  const full = path.resolve(expandHome(src));
  if (/^https?:/i.test(String(src))) { console.warn(`Warning: image "${src}" is a web address; download it into the report folder and use that file. Skipped.`); return null; }
  if (!fs.existsSync(full)) { console.warn(`Warning: image not found: ${src} (paths are relative to report.json). Skipped.`); return null; }
  const ext = path.extname(full).toLowerCase();
  if (!IMG_EXT.has(ext)) { console.warn(`Warning: image "${src}" is not a supported type (use PNG, JPG, GIF, WebP, SVG; convert HEIC photos to JPG first). Skipped.`); return null; }
  try {
    const photo = [".jpg", ".jpeg", ".avif", ".tif", ".tiff"].includes(ext);
    let pipe = sharp(full, ext === ".svg" ? { density: 192 } : {}).rotate().resize({ width: IMG_MAX, height: IMG_MAX, fit: "inside", withoutEnlargement: ext !== ".svg" });
    pipe = photo ? pipe.flatten({ background: "#ffffff" }).jpeg({ quality: 86 }) : pipe.png();
    const { data, info } = await pipe.toBuffer({ resolveWithObject: true });
    const out = path.join(CACHE, `img_${++IMG_N}${photo ? ".jpg" : ".png"}`);
    fs.writeFileSync(out, data);
    return { path: out, w: info.width, h: info.height, buf: data, photo };
  } catch (e) { console.warn(`Warning: could not read image ${src} (${e.message}). Skipped.`); return null; }
}
// pad an image with transparency to the given height/width ratio (centred, never cropped or stretched)
async function padToAspect(img, aspect) {
  const a = img.h / img.w;
  if (Math.abs(a - aspect) / aspect < 0.03) return img;
  const w = a > aspect ? Math.round(img.h / aspect) : img.w, h = a > aspect ? img.h : Math.round(img.w * aspect);
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img.buf, left: Math.round((w - img.w) / 2), top: Math.round((h - img.h) / 2) }]).png().toBuffer();
  const out = path.join(CACHE, `img_${++IMG_N}.png`);
  fs.writeFileSync(out, buf);
  return { path: out, w, h, buf, photo: false };
}
async function normalizeImages(r) {
  const keep = [];
  for (const sl of r.slides) {
    if (sl.type === "rows" && sl.image) {
      const im = await prepareImage(sl.image);
      if (im) sl.image = im.path; else delete sl.image;
    } else if (sl.type === "gallery") {
      const names = sl.images || [], labels = sl.labels || [], got = [];
      for (let i = 0; i < names.length; i++) { const im = await prepareImage(names[i]); if (im) got.push({ im, label: labels[i] }); }
      if (got.length < 2) { console.warn(`Warning: gallery "${sl.title}" has ${got.length} usable image(s); a gallery needs at least 2, so the slide is left out.`); continue; }
      const aspect = got[0].im.h / got[0].im.w;
      for (const g of got) g.im = await padToAspect(g.im, aspect);
      sl.images = got.map((g) => g.im.path); sl.labels = got.map((g) => g.label);
    } else if (sl.type === "task_detail") {
      for (const t of sl.tasks || []) {
        if (!t.image) continue;
        const im = await prepareImage(t.image);
        if (im) { t.image = im.path; t.imageAspect = im.h / im.w; } else delete t.image;
      }
    }
    keep.push(sl);
  }
  r.slides = keep;
}

// ---------- Main ----------
(async () => {
  const [, , inFile, outFile] = process.argv;
  if (!inFile || !outFile) { console.error("Usage: node build_deck.js <report.json> <output.pptx>"); process.exit(1); }
  const r = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const outPath = path.resolve(outFile);
  // Branding defaults from the skill's config.json; report.json values win.
  const cfgPath = path.join(SKILL_DIR, "config.json");
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {};
  for (const k of ["company", "presenter", "closingPresenter", "logo", "style"]) if (r[k] === undefined && cfg[k] !== undefined) r[k] = cfg[k];
  applyStyle(r.style || "classic");
  applyTheme(Object.assign({}, cfg.theme || {}, r.theme || {}));
  warnMissingFonts([F.H, F.B]);
  LOGO = await prepareLogo(r.logo);
  process.chdir(path.dirname(path.resolve(inFile))); // relative image paths resolve against the JSON
  await normalizeImages(r);
  r.company = r.company || "";
  r.presenter = r.presenter || "";
  r.eyebrow = r.eyebrow || "Progress report";
  // Default title follows the reporting period: weekly | biweekly | sprint | monthly | custom
  const period = String(r.period || cfg.period || "weekly").toLowerCase();
  const PERIOD_TITLE = {
    weekly: "Weekly Development\nProgress Report",
    biweekly: "Biweekly Development\nProgress Report",
    sprint: r.sprint ? `Sprint ${r.sprint}\nProgress Report` : "Sprint Development\nProgress Report",
    monthly: "Monthly Development\nProgress Report",
  };
  r.title = r.title || PERIOD_TITLE[period] || "Development\nProgress Report";

  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  if (r.signature !== undefined) STYLE.signature = r.signature; else if (cfg.signature !== undefined) STYLE.signature = cfg.signature;
  if (STYLE.bookend === "signature") await sigBookend(pres, r, "title"); else if (STYLE.bookend === "paper") await paperBookend(pres, r, "title"); else if (STYLE.bookend === "ember") await emberBookend(pres, r, "title"); else bookend(pres, r, "title");
  SLIDE_NO = 1;
  FOOTER_TEXT = [r.company, r.date].filter(Boolean).join("  ·  ");
  for (let i = 0; i < r.slides.length; i++) {
    const sl = r.slides[i];
    if (!T[sl.type]) throw new Error(`Unknown slide type "${sl.type}" (slide ${i + 2})`);
    const tpl = (STYLE.layouts === "editorial" && TE[sl.type]) || (STYLE.layouts === "signature" && TS[sl.type]) || (STYLE.layouts === "paper" && TP[sl.type]) || (STYLE.layouts === "ember" && TEM[sl.type]) || T[sl.type];
    await tpl(pres, sl, i);
  }
  if (STYLE.bookend === "signature") await sigBookend(pres, r, "closing"); else if (STYLE.bookend === "paper") await paperBookend(pres, r, "closing"); else if (STYLE.bookend === "ember") await emberBookend(pres, r, "closing"); else bookend(pres, r, "closing");
  await pres.writeFile({ fileName: outPath });
  console.log(`Wrote ${outFile} (${r.slides.length + 2} slides)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
