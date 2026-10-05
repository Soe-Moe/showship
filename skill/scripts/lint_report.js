#!/usr/bin/env node
/**
 * Plain-language check for report.json before building the deck.
 *
 * Usage: node lint_report.js <report.json> [--audience business|engineering]
 *
 * --audience engineering (for decks shown to engineers / a tech lead): technical terms are fine;
 * only code formatting and file names are flagged.
 *
 * The deck is presented to business, PMs and the CTO in one meeting, so slide text must be
 * understandable without engineering background. This flags developer jargon and suggests
 * plain wording. Exit code 1 if any "fix" findings remain; "check" findings are warnings
 * (fine for the CTO if explained in plain words in the same sentence).
 *
 * Official phase / module names from the lead's plan (e.g. "Profile Management APIs") are
 * allowed in `phases[].name` and `table` → `current` — they are skipped.
 */
const fs = require("fs");

// [regex, level, suggestion]
const RULES = [
  [/\beloquent\b/i, "fix", "drop it — say 'data models' or just describe the data (e.g. 'appointment data structure')"],
  [/\bmigrations?\b/i, "fix", "'database setup' / 'database changes'"],
  [/\bschemas?\b/i, "check", "'data structure' (keep 'schema' only in brackets for the CTO)"],
  [/\bendpoints?\b/i, "fix", "describe the capability: 'patients can now book an appointment'"],
  [/\bpayloads?\b/i, "fix", "'data sent by the app' / 'response data'"],
  [/\bcallback url/i, "fix", "'payment result notifications (success / failure)'"],
  [/\bUAT\b/, "check", "'user acceptance testing (UAT)' on first use, or 'final testing with the client'"],
  [/\bJSON\b/, "fix", "'structured data format' / 'machine-readable data'"],
  [/\bN\+1\b/i, "fix", "'a database performance issue'"],
  [/\b(HTTP\s*)?(500|422|404|403)\b(?!\s*(MMK|%|ms|files|tests))/, "fix", "describe the effect: 'an error screen instead of a clear message'"],
  [/\bmime\b/i, "fix", "'file type'"],
  [/\b(pull request|PRs?)\b/, "check", "fine as a count for the CTO ('3 PRs merged'); otherwise 'code changes' / 'features submitted for review'"],
  [/\bmerged?\b/i, "check", "'approved and integrated' / 'delivered to the main codebase'"],
  [/\bcommits?\b/i, "check", "avoid counting commits as progress; say 'development work'"],
  [/\b(git\s*)?branch(es)?\b/i, "fix", "drop it"],
  [/\brepo(sitor(y|ies))?\b/i, "fix", "name the product/app instead"],
  [/\brefactor(ing|ed)?\b/i, "check", "'restructuring the code for easier future changes'"],
  [/\bmonolith(ic)?\b/i, "check", "'single large codebase' (keep the term in brackets if needed)"],
  [/\bSOA\b|service-oriented/i, "check", "explain the benefit: 'split into independent services so each can change and scale separately'"],
  [/\bmiddleware\b/i, "fix", "drop it or 'security checks'"],
  [/\bORM\b|\bquery\b|\bqueries\b/i, "check", "'database lookups' / 'data loading'"],
  [/\bunit tests?\b|\bphpunit\b|\btest suite\b/i, "check", "'automated tests' (e.g. 'all 212 automated tests pass')"],
  [/\bCI\b|\bpipeline\b/i, "check", "say what it does: 'image processing (resize & compress)' / 'automated build checks'"],
  [/\bdeploy(ed|ment)?\b/i, "check", "'released' / 'went live'"],
  [/\bstaging\b/i, "check", "'test environment'"],
  [/\bAPIs?\b/, "check", "OK in official phase names; elsewhere describe the capability or say 'system connection'"],
  [/\bpolicy\b/i, "check", "if it is an access rule: 'permission rule'"],
  [/\b(null|true|false|enum|ULID|UUID|GD|S3|WebP)\b/, "fix", "too technical — describe the outcome"],
  [/`[^`]+`/, "fix", "remove code formatting / code identifiers"],
  [/\w+\.(php|js|ts|py|json|sql)\b/i, "fix", "remove file names"],
];

const SKIP_KEYS = new Set(["type", "icon", "image", "images", "center", "nodes", "state", "date", "presenter", "closingPresenter", "company", "url"]);

function walk(node, path, out) {
  if (typeof node === "string") { out.push([path, node]); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`, out)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      walk(v, path ? `${path}.${k}` : k, out);
    }
  }
}

const file = process.argv[2];
const ai = process.argv.indexOf("--audience");
const audience = (ai > 0 ? process.argv[ai + 1] : "business") || "business";
const ENGINEERING_KEEP = new Set(["remove code formatting / code identifiers", "remove file names"]);
if (!file) { console.error("Usage: node lint_report.js <report.json>"); process.exit(2); }
const r = JSON.parse(fs.readFileSync(file, "utf8"));
const strings = [];
walk(r.slides || [], "slides", strings);

let fixes = 0, checks = 0;
for (const [p, text] of strings) {
  const officialName = /\.phases\[\d+\]\.name$/.test(p) || /\.current$/.test(p);
  for (const [re, level, hint] of RULES) {
    if (audience === "engineering" && !ENGINEERING_KEEP.has(hint)) continue;
    const m = text.match(re);
    if (!m) continue;
    if (officialName && level === "check") continue;
    const tag = level === "fix" ? "FIX  " : "CHECK";
    level === "fix" ? fixes++ : checks++;
    console.log(`${tag} ${p}: "${m[0]}" → ${hint}\n       in: ${text.length > 140 ? text.slice(0, 140) + "…" : text}`);
  }
}
console.log(`\n${fixes} to fix, ${checks} to check.`);
process.exit(fixes > 0 ? 1 : 0);
