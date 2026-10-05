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
    done:     { fill: C.LIME,       text: C.ON_ACCENT, label: "COMPLETED",   ink: STYLE.inks.done },
    progress: { fill: C.LIGHT_LIME, text: C.DARK,      label: "IN PROGRESS", ink: STYLE.inks.progress },
    blocked:  { fill: C.AMBER,      text: C.ON_WARN,   label: "BLOCKED",     ink: STYLE.inks.blocked },
    next:     { fill: C.TRACK,      text: C.BODY,      label: "NOT STARTED", ink: STYLE.inks.next },
  };
  return STATE[s] || STATE.progress;
}

const SKILL_DIR = path.resolve(__dirname, "..");
const DEFAULT_LOGO = path.join(SKILL_DIR, "assets", "logo.png");
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
  const eb = (eyebrow || "").toUpperCase(), t = title || "";
  if (STYLE.header === "band") {
    s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 1.55, fill: { color: C.DARK }, line: { type: "none" } });
    s.addShape("rect", { x: 0, y: 1.55, w: 13.333, h: 0.06, fill: { color: C.LIME }, line: { type: "none" } });
    s.addText(eb, { x: 0.7, y: 0.36, w: 11.9, h: 0.32, fontFace: F.B, fontSize: 12, bold: true, color: C.LIGHT_LIME, charSpacing: 1.5, margin: 0 });
    s.addText(t, { x: 0.7, y: 0.68, w: 11.9, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 28, 28), bold: true, color: "FFFFFF", margin: 0, fit: "shrink" });
    return;
  }
  if (STYLE.header === "editorial") {
    s.addShape("line", { x: 0.7, y: 0.42, w: 11.93, h: 0, line: { color: C.DARK, width: 2 } });
    s.addText(eb, { x: 0.7, y: 0.56, w: 11.9, h: 0.28, fontFace: F.B, fontSize: 10.5, bold: true, color: C.GRAY, charSpacing: 2, margin: 0 });
    s.addText(t, { x: 0.7, y: 0.84, w: 11.9, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 28, 28), bold: false, color: C.DARK, margin: 0, fit: "shrink" });
    s.addShape("line", { x: 0.7, y: 1.64, w: 11.93, h: 0, line: { color: C.DARK, width: 0.75 } });
    return;
  }
  if (STYLE.header === "rule") {
    s.addText(eb, { x: 0.7, y: 0.5, w: 11.9, h: 0.3, fontFace: F.B, fontSize: 11.5, bold: true, color: C.LIME, charSpacing: 1, margin: 0 });
    s.addText(t, { x: 0.7, y: 0.8, w: 11.9, h: 0.7, fontFace: F.H, fontSize: Math.min(size || 26, 26), bold: true, color: C.DARK, margin: 0, fit: "shrink" });
    s.addShape("line", { x: 0.7, y: 1.62, w: 11.93, h: 0, line: { color: C.GRID, width: 1 } });
    s.addShape("rect", { x: 0.7, y: 1.59, w: 1.1, h: 0.06, fill: { color: C.LIME }, line: { type: "none" } });
    return;
  }
  s.addText(eb, {
    x: 0.7, y: 0.55, w: 11.9, h: 0.35, fontFace: F.B, fontSize: 13, bold: true,
    color: C.LIME, charSpacing: 1.5, margin: 0,
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
    s.addText(FOOTER_TEXT, { x: 0.7, y: 7.16, w: 8, h: 0.24, fontFace: F.B, fontSize: 9, color: "9CA3AF", margin: 0 });
    s.addText(String(SLIDE_NO), { x: 11.63, y: 7.16, w: 1.0, h: 0.24, fontFace: F.B, fontSize: 9, bold: true, color: "9CA3AF", align: "right", margin: 0 });
  }
  return s;
}

function pill(s, text, x, y, state) {
  const w = 0.24 + text.length * (STYLE.pillChar || 0.085);
  s.addShape(STYLE.pillRadius ? "roundRect" : "rect", { x, y, w, h: 0.32, rectRadius: STYLE.pillRadius, fill: { color: st(state).fill }, line: { type: "none" } });
  s.addText(text, {
    x, y, w, h: 0.32, fontFace: F.B, fontSize: 10, bold: true, color: st(state).text,
    align: "center", valign: "middle", charSpacing: 1, margin: 0,
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
  try { await sharp(src).trim().png().toFile(out); } catch { await sharp(src).png().toFile(out); }
  const m = await sharp(out).metadata();
  return { path: out, aspect: m.height / m.width };
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
    // white tile so any logo colour reads on navy
    s.addShape("rect", { x: 0.7, y: 0.7, w: 1.3, h: 1.3, fill: { color: "FFFFFF" }, line: { type: "none" } });
    smallLogo(s, 1.35, 1.82, 1.0, 1.0);
  }
  s.addText(r.company, { x: 0.7, y: 2.2, w: pw - 1.2, h: 0.8, fontFace: F.B, fontSize: 14, bold: true, color: "FFFFFF", valign: "top", margin: 0 });
  const x = pw + 0.8, w = 13.333 - x - 0.7;
  if (kind === "title") {
    s.addText(r.eyebrow, { x, y: 2.2, w, h: 0.35, fontFace: F.B, fontSize: 13, bold: true, color: C.LIME, charSpacing: 2, margin: 0 });
    s.addText(r.title, { x, y: 2.6, w, h: 1.9, fontFace: F.H, fontSize: 38, bold: true, color: C.DARK, lineSpacingMultiple: 1.05, margin: 0, valign: "top" });
    s.addShape("rect", { x, y: 4.65, w: 1.0, h: 0.07, fill: { color: C.LIME }, line: { type: "none" } });
  } else {
    s.addText("Thank you", { x, y: 2.5, w, h: 1.0, fontFace: F.H, fontSize: 44, bold: true, color: C.DARK, margin: 0 });
    s.addText("Questions & discussion", { x, y: 3.5, w, h: 0.5, fontFace: F.B, fontSize: 20, color: C.LIME, bold: true, margin: 0 });
    s.addShape("rect", { x, y: 4.2, w: 1.0, h: 0.07, fill: { color: C.LIME }, line: { type: "none" } });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  s.addText("PRESENTER", { x, y: 6.2, w: 3.5, h: 0.28, fontFace: F.B, fontSize: 9.5, bold: true, color: "9CA3AF", charSpacing: 1.5, margin: 0 });
  s.addText(presenter, { x, y: 6.48, w: 3.8, h: 0.4, fontFace: F.B, fontSize: 15, bold: true, color: C.DARK, margin: 0 });
  s.addText("DATE", { x: x + 4.0, y: 6.2, w: 3.0, h: 0.28, fontFace: F.B, fontSize: 9.5, bold: true, color: "9CA3AF", charSpacing: 1.5, margin: 0 });
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
  s.addText(r.company, { x: LOGO ? 1.8 : 0.7, y: 1.05, w: 7, h: 0.6, fontFace: F.B, fontSize: 12, bold: true, color: C.DARK, charSpacing: 1, valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(r.eyebrow, { x: 0.7, y: 2.75, w: 9, h: 0.35, fontFace: F.B, fontSize: 12, bold: true, color: C.LIME, charSpacing: 3, margin: 0 });
    s.addText(r.title, { x: 0.7, y: 3.15, w: 11.5, h: 2.2, fontFace: F.H, fontSize: 48, color: C.DARK, lineSpacingMultiple: 1.05, margin: 0, valign: "top" });
  } else {
    s.addText("Thank you", { x: 0.7, y: 2.85, w: 11.5, h: 1.2, fontFace: F.H, fontSize: 56, color: C.DARK, margin: 0 });
    s.addText("Questions & discussion", { x: 0.7, y: 4.05, w: 11.5, h: 0.55, fontFace: F.H, fontSize: 22, italic: true, color: C.LIME, margin: 0 });
  }
  const presenter = kind === "title" ? r.presenter : (r.closingPresenter || r.presenter);
  s.addShape("line", { x: 0.7, y: 6.05, w: 11.93, h: 0, line: { color: C.DARK, width: 0.75 } });
  s.addText("PRESENTER", { x: 0.7, y: 6.22, w: 4.5, h: 0.26, fontFace: F.B, fontSize: 9.5, bold: true, color: C.GRAY, charSpacing: 2, margin: 0 });
  s.addText(presenter, { x: 0.7, y: 6.5, w: 6, h: 0.42, fontFace: F.H, fontSize: 17, color: C.DARK, margin: 0 });
  s.addText("DATE", { x: 8.13, y: 6.22, w: 4.5, h: 0.26, fontFace: F.B, fontSize: 9.5, bold: true, color: C.GRAY, charSpacing: 2, align: "right", margin: 0 });
  s.addText(r.date, { x: 6.63, y: 6.5, w: 6, h: 0.42, fontFace: F.H, fontSize: 17, color: C.DARK, align: "right", margin: 0 });
}

// Vivid: full-colour background with large accent circles.
function bookendShapes(pres, r, kind) {
  const s = pres.addSlide();
  s.background = { color: C.DARK };
  s.addShape("ellipse", { x: 8.6, y: -2.2, w: 6.4, h: 6.4, fill: { color: C.LIME, transparency: 10 }, line: { type: "none" } });
  s.addShape("ellipse", { x: 10.9, y: 4.3, w: 3.4, h: 3.4, fill: { color: C.LIGHT_LIME, transparency: 35 }, line: { type: "none" } });
  s.addShape("ellipse", { x: 7.6, y: 5.6, w: 1.2, h: 1.2, fill: { color: "FFFFFF", transparency: 80 }, line: { type: "none" } });
  if (LOGO) {
    s.addShape("roundRect", { x: 0.7, y: 0.6, w: 0.95, h: 0.95, rectRadius: 0.15, fill: { color: "FFFFFF" }, line: { type: "none" } });
    smallLogo(s, 1.175, 1.43, 0.72, 0.72);
  }
  s.addText(r.company, { x: LOGO ? 1.85 : 0.7, y: 0.6, w: 5.5, h: 0.95, fontFace: F.B, fontSize: 14, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
  if (kind === "title") {
    s.addText(r.eyebrow, { x: 0.75, y: 2.75, w: 7.5, h: 0.4, fontFace: F.B, fontSize: 14, bold: true, color: C.LIGHT_LIME, charSpacing: 3, margin: 0 });
    s.addText(r.title, { x: 0.7, y: 3.15, w: 8.2, h: 2.1, fontFace: F.H, fontSize: 46, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.05, margin: 0, valign: "top" });
  } else {
    s.addText("Thank You!", { x: 0.7, y: 2.8, w: 8.2, h: 1.1, fontFace: F.H, fontSize: 54, bold: true, color: "FFFFFF", margin: 0 });
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
    s.addText(r.eyebrow, { x: 0.8, y: 3.05, w: 8, h: 0.4, fontFace: F.B, fontSize: 15, bold: true, color: C.LIME, charSpacing: 3, margin: 0 });
    s.addText(r.title, { x: 0.75, y: 3.45, w: 10.5, h: 2.0, fontFace: F.H, fontSize: 44, bold: true, color: C.WHITE, lineSpacingMultiple: 1.1, margin: 0 });
  } else {
    s.addText("Thank You!", { x: 0.7, y: 2.9, w: 11.93, h: 1.1, fontFace: F.H, fontSize: 54, bold: true, color: C.WHITE, align: "center", margin: 0 });
    s.addText("Any Questions?", { x: 0.7, y: 4.05, w: 11.93, h: 0.6, fontFace: F.B, fontSize: 22, bold: true, color: C.LIME, charSpacing: 1, align: "center", margin: 0 });
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
    s.addText(c.label.toUpperCase(), { x: x + 0.3, y: cy + 0.35, w: cw - 0.6, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, charSpacing: 1.5, margin: 0 });
    s.addText(c.metric, { x: x + 0.3, y: cy + 0.75, w: cw - 0.6, h: 1.0, fontFace: F.H, fontSize: n > 3 ? 44 : 54, bold: true, color: C.DARK, margin: 0 });
    pill(s, c.status || st(c.state).label, x + 0.3, cy + 1.85, c.state);
    s.addText(c.headline, { x: x + 0.3, y: cy + 2.35, w: cw - 0.6, h: 0.4, fontFace: F.B, fontSize: 16, bold: true, color: C.DARK, margin: 0 });
    s.addText(c.desc, { x: x + 0.3, y: cy + 2.75, w: cw - 0.6, h: ch - 2.85, fontFace: F.B, fontSize: 12.5, color: C.BODY, valign: "top", margin: 0, lineSpacingMultiple: 1.2 });
  });
  if (d.keyUpdate) {
    s.addShape(STYLE.card.radius ? "roundRect" : "rect", { x: 0.7, y: 6.05, w: 11.93, h: 0.7, rectRadius: STYLE.card.radius, fill: { color: C.DARK }, line: { type: "none" } });
    s.addText([
      { text: "KEY UPDATE   ", options: { bold: true, color: C.ON_DARK, charSpacing: 1.5 } },
      { text: d.keyUpdate, options: { color: C.WHITE } },
    ], { x: 1.0, y: 6.05, w: 11.4, h: 0.7, fontFace: F.B, fontSize: 13.5, valign: "middle", margin: 0 });
  }
};

// 2. timeline — horizontal milestone track (3–5 steps), states done|blocked|progress|next
T.timeline = async (pres, d) => {
  const s = newSlide(pres);
  header(s, d.eyebrow, d.title);
  if (d.badge) pill(s, d.badge.text, 0.7, 1.8, d.badge.state || "done");
  const steps = d.steps, lineY = 3.3, x0 = 1.5, x1 = 11.8, sw = (x1 - x0) / (steps.length - 1);
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
    const tw = 2.9;
    s.addText((p.tag || "").toUpperCase(), { x: cx - tw / 2, y: lineY + 0.6, w: tw, h: 0.28, fontFace: F.B, fontSize: 10, bold: true, color: p.state === "blocked" ? C.AMBER : C.BODY, charSpacing: 1.5, align: "center", margin: 0 });
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
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.6, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 10, italic: true, color: C.GRAY, margin: 0 });
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
  s.addText((h.label || "Workstream 1").toUpperCase(), { x: lx + 0.35, y: ly + 0.35, w: lw - 0.7, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.ON_DARK, charSpacing: 1.5, margin: 0 });
  s.addText(h.title, { x: lx + 0.35, y: ly + 0.7, w: lw - 0.7, h: 0.45, fontFace: F.B, fontSize: 18, bold: true, color: C.WHITE, margin: 0 });
  s.addText(h.metric, { x: lx + 0.35, y: ly + 1.35, w: lw - 0.7, h: 1.1, fontFace: F.H, fontSize: 60, bold: true, color: C.ON_DARK, margin: 0 });
  pill(s, h.status || st(h.state).label, lx + 0.35, ly + 2.55, h.state || "done");
  s.addText(h.desc, { x: lx + 0.35, y: ly + 3.1, w: lw - 0.7, h: 1.5, fontFace: F.B, fontSize: 13, color: "D8D8D2", valign: "top", margin: 0, lineSpacingMultiple: 1.25 });

  const f = d.flow, rx = 5.0, rw = 12.63 - rx;
  card(s, rx, ly, rw, lh);
  s.addText((f.label || "Workstream 2").toUpperCase(), { x: rx + 0.35, y: ly + 0.35, w: 4, h: 0.3, fontFace: F.B, fontSize: 11, bold: true, color: C.BODY, charSpacing: 1.5, margin: 0 });
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
    const lbl = { done: "DONE", progress: "IN PROGRESS", next: "NEXT", blocked: "BLOCKED" }[p.state] || "";
    s.addText(lbl, { x, y: by + 2.05, w: bw - 0.1, h: 0.28, fontFace: F.B, fontSize: 10, bold: true, color: st(p.state).ink, charSpacing: 1.5, margin: 0 });
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
  const hd = (t) => ({ text: t, options: { bold: true, color: C.WHITE, fill: { color: C.DARK }, fontSize: 12, charSpacing: 1 } });
  const rows = [[hd("PROJECT / TRACK"), hd("OWNER"), hd("NEXT FOCUS"), hd("CURRENT")]];
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
    const lbl = (d.labels && d.labels[i]) || `STEP ${i + 1}`;
    s.addText(lbl.toUpperCase(), { x, y: fy + fh + 0.12, w: fw, h: 0.3, fontFace: F.B, fontSize: 10.5, bold: true, color: C.LIME, charSpacing: 1, align: "center", margin: 0 });
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
  const lbl = { done: "RESOLVED", progress: "IN PROGRESS", blocked: "OPEN RISK", next: "PLANNED" };
  f.forEach((it, i) => {
    const y = rowsTop + i * (rh + gap);
    s.addShape("rect", { x: rx + 0.25, y: y + 0.08, w: 0.07, h: rh - 0.16, fill: { color: st(it.state).fill }, line: { type: "none" } });
    s.addText((it.area || "").toUpperCase(), { x: rx + 0.45, y: y + 0.04, w: rw - 2.5, h: 0.28, fontFace: F.B, fontSize: 10, bold: true, color: C.BODY, charSpacing: 1.5, margin: 0 });
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
    s.addText(col.head.toUpperCase(), { x: col.x + 0.3, y: top + 0.28, w: cw - 0.6, h: 0.32, fontFace: F.B, fontSize: 12, bold: true, color: ci === 0 ? st("blocked").ink : C.DARK, charSpacing: 1.5, margin: 0 });
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
      if (it.meta) runs.push({ text: it.meta, options: { color: "8A8A82", fontSize: 10.5, italic: true } });
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
    s.addText((v.project || "").toUpperCase(), { x: ix, y: top + 0.56, w: iw, h: 0.26, fontFace: F.B, fontSize: 9.5, bold: true, color: st("done").ink, charSpacing: 1, margin: 0 });
    // done / open counters
    const cy = top + 0.9;
    s.addText(String(v.done ?? 0), { x: ix, y: cy, w: 0.45, h: 0.5, fontFace: F.H, fontSize: 26, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText("DONE THIS\nWEEK", { x: ix + 0.5, y: cy, w: 0.9, h: 0.5, fontFace: F.B, fontSize: 8.5, bold: true, color: C.BODY, valign: "middle", margin: 0, charSpacing: 0.5 });
    s.addText(String(v.open ?? 0), { x: ix + 1.45, y: cy, w: 0.45, h: 0.5, fontFace: F.H, fontSize: 26, bold: true, color: C.DARK, valign: "middle", margin: 0 });
    s.addText("OPEN", { x: ix + 1.95, y: cy, w: 0.8, h: 0.5, fontFace: F.B, fontSize: 8.5, bold: true, color: C.BODY, valign: "middle", margin: 0, charSpacing: 0.5 });
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
      s.addText(it.text, { x: ix + 0.24, y, w: iw - 0.24, h: ih, fontFace: F.B, fontSize: 10.5, color: C.DARK, valign: "top", margin: 0, lineSpacingMultiple: 1.05, fit: "shrink" });
    });
  });
  if (d.footnote) s.addText(d.footnote, { x: 0.7, y: 6.9, w: 11.93, h: 0.3, fontFace: F.B, fontSize: 10, italic: true, color: C.GRAY, margin: 0 });
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
  s.addText(String(text || "").toUpperCase(), { x, y, w, h: 0.26, fontFace: F.B, fontSize: 9.5, bold: true, color, charSpacing: 2, margin: 0, valign: "middle", ...opts });
}
function markColor(state) {
  return { done: C.LIME, progress: C.MID || C.LIGHT_LIME, blocked: C.AMBER, next: C.GRAY }[state] || C.MID || C.LIGHT_LIME;
}
function tag(s, text, x, y, w, state, align = "left") {
  s.addText([
    { text: "■  ", options: { color: markColor(state) } },
    { text: String(text || "").toUpperCase(), options: { color: st(state).ink } },
  ], { x, y, w, h: 0.28, fontFace: F.B, fontSize: 9.5, bold: true, charSpacing: 1.5, margin: 0, align, valign: "middle" });
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
    s.addText(String(c.label || "").toUpperCase(), { x, y: E.TOP + 0.15, w: cw, h: 0.45, fontFace: F.B, fontSize: 9.5, bold: true, color: C.GRAY, charSpacing: 2, margin: 0, valign: "top" });
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
  if (d.footnote) s.addText(d.footnote, { x: E.L, y: 6.5, w: E.W, h: 0.3, fontFace: F.H, fontSize: 10.5, italic: true, color: C.GRAY, margin: 0 });
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
    s.addText([{ text: "Next — ", options: { italic: true, color: C.DARK } }, { text: f.next, options: { color: C.BODY } }],
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
  const hd = (t, align = "left") => ({ text: t, options: { bold: true, color: C.GRAY, fontSize: 9.5, charSpacing: 2, align, border: [heavy, none, thin, none] } });
  const rows = [[hd("PROJECT / TRACK"), hd("OWNER"), hd("NEXT FOCUS"), hd("CURRENT")]];
  d.rows.forEach((r) => rows.push([
    { text: r.project, options: { fontFace: F.H, fontSize: 14, color: C.DARK, border: [none, none, hair, none] } },
    { text: r.owner || "—", options: { color: C.BODY, fontSize: 12, border: [none, none, hair, none] } },
    { text: r.focus, options: { color: C.BODY, fontSize: 12, border: [none, none, hair, none] } },
    { text: `■  ${String(r.current || "").toUpperCase()}`, options: { bold: true, color: st(r.state).ink, fontSize: 10, charSpacing: 1, border: [none, none, hair, none] } },
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
    s.addText([{ text: `Fig. ${i + 1} — `, options: { italic: true, color: C.GRAY } }, { text: lbl, options: { italic: true, color: C.DARK } }],
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
      if (it.meta) runs.push({ text: it.meta, options: { fontSize: 10.5, italic: true, color: C.GRAY } });
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
        { x, y, w: cw, h: ih, fontFace: F.B, fontSize: 10.5, valign: "top", margin: 0, fit: "shrink" });
    });
    if (i < n - 1) vl(s, x + cw + gap / 2, E.TOP + 0.15, bottom - E.TOP - 0.15);
  });
  if (d.footnote) s.addText(d.footnote, { x: E.L, y: E.BOT - 0.3, w: E.W, h: 0.3, fontFace: F.H, fontSize: 10.5, italic: true, color: C.GRAY, margin: 0 });
};

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
  LOGO = await prepareLogo(r.logo);
  process.chdir(path.dirname(path.resolve(inFile))); // relative image paths resolve against the JSON
  r.company = r.company || "";
  r.presenter = r.presenter || "";
  r.eyebrow = r.eyebrow || "PROGRESS REPORT";
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
  bookend(pres, r, "title");
  SLIDE_NO = 1;
  FOOTER_TEXT = [r.company, r.date].filter(Boolean).join("  ·  ");
  for (let i = 0; i < r.slides.length; i++) {
    const sl = r.slides[i];
    if (!T[sl.type]) throw new Error(`Unknown slide type "${sl.type}" (slide ${i + 2})`);
    const tpl = (STYLE.layouts === "editorial" && TE[sl.type]) || T[sl.type];
    await tpl(pres, sl, i);
  }
  bookend(pres, r, "closing");
  await pres.writeFile({ fileName: outPath });
  console.log(`Wrote ${outFile} (${r.slides.length + 2} slides)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
