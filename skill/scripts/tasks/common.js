// Shared helpers for task-tracker collectors (Lark, Jira, Linear, Asana).
//
// Every provider returns normalized rows:
//   {
//     list:       string            // project / tasklist / team name
//     key:        string | null     // e.g. "CLINIC-42", "ENG-12"
//     summary:    string
//     url:        string | null
//     status:     "done" | "open"
//     completedAt: ms | 0           // when it was completed (0 if open)
//     start:      ms | 0
//     due:        ms | 0
//     assignees:  [{ id, name, email }]
//     subs:       [node] | null     // node = { summary, completed_at: ms|0, children: [node] }
//   }
// and this module turns them into the same markdown digest + JSON for every tool.
const fs = require("fs");
const path = require("path");

const SKILL_DIR = path.resolve(__dirname, "..", "..");

function loadConfig() {
  const p = path.join(SKILL_DIR, "config.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

const ms = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (/^\d+$/.test(String(v))) return Number(v);
  const t = Date.parse(String(v).length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(t) ? 0 : t;
};
const day = (v) => (ms(v) ? new Date(ms(v)).toLocaleDateString("en-CA") : "-");

function range(since, until) {
  const S = new Date(`${since}T00:00:00`).getTime();
  const E = new Date(`${until}T23:59:59`).getTime();
  return { S, E, inRange: (v) => ms(v) >= S && ms(v) <= E, untilStart: new Date(`${until}T00:00:00`).getTime() };
}

// People: map ids / emails / names to display names, and drop excluded people.
function people(cfg) {
  const maps = [cfg.taskUsers || {}, cfg.larkUsers || {}, cfg.team || {}];
  const excluded = new Set(((cfg.exclude && cfg.exclude.people) || []).map((s) => String(s).toLowerCase()));
  const lookup = (k) => {
    if (!k) return null;
    for (const m of maps) {
      if (m[k] && k !== "_comment") return m[k];
      const hit = Object.keys(m).find((x) => x !== "_comment" && x.toLowerCase() === String(k).toLowerCase());
      if (hit) return m[hit];
    }
    return null;
  };
  const display = (a) => lookup(a.id) || lookup(a.email) || lookup(a.name) || a.name || a.email || a.id || "Unknown";
  const isExcluded = (a) => [a.id, a.email, a.name, display(a)].some((v) => v && excluded.has(String(v).toLowerCase()));
  const known = (id) => !!(lookup(id));
  return { display, isExcluded, known };
}

// Work items are the leaves: a task without subtasks counts as one item.
function leafStats(row, inRange) {
  const leaves = [];
  const walk = (n) => (n.children && n.children.length ? n.children.forEach(walk) : leaves.push(n));
  if (row.subs && row.subs.length) row.subs.forEach(walk);
  else leaves.push({ _self: row });
  const isDone = (n) => (n._self ? n._self.status === "done" : !!ms(n.completed_at));
  const doneIn = (n) => (n._self ? n._self.status === "done" && (!n._self.completedAt || inRange(n._self.completedAt)) : inRange(n.completed_at));
  return { total: leaves.length, done: leaves.filter(isDone).length, doneThisWeek: leaves.filter(doneIn).length, open: leaves.filter((n) => !isDone(n)).length };
}

// Keep open tasks and tasks completed inside the range; group by display name; drop excluded people.
function group(rows, cfg, since, until) {
  const { inRange, untilStart } = range(since, until);
  const ppl = people(cfg);
  const byDev = {}, unassigned = [];
  for (const r of rows) {
    if (r.status === "done" && r.completedAt && !inRange(r.completedAt)) continue;
    const row = {
      list: r.list, key: r.key || null, summary: r.summary, url: r.url || null, status: r.status,
      completed: day(r.completedAt), start: day(r.start), due: day(r.due),
      overdue: r.status !== "done" && !!r.due && ms(r.due) < untilStart,
      subs: r.subs && r.subs.length ? r.subs : null,
    };
    row.work = leafStats({ ...row, completedAt: r.completedAt }, inRange);
    const as = r.assignees || [];
    if (as.length && as.every(ppl.isExcluded)) continue;
    const names = [...new Set(as.filter((a) => !ppl.isExcluded(a)).map(ppl.display))];
    if (!names.length) unassigned.push(row);
    names.forEach((n) => (byDev[n] = byDev[n] || []).push(row));
  }
  return { byDev, unassigned, inRange };
}

function render({ tool, since, until, sources, rows, cfg, only }) {
  let { byDev, unassigned, inRange } = group(rows, cfg, since, until);
  if (only && only.length) {
    // Individual reports: keep only these people (display names, case-insensitive); drop unassigned.
    const want = new Set(only.map((s) => s.toLowerCase()));
    byDev = Object.fromEntries(Object.entries(byDev).filter(([k]) => want.has(k.toLowerCase())));
    unassigned = [];
  }
  const line = (r) => {
    const sub = r.subs ? ` [subtasks ${r.work.done}/${r.work.total}${r.work.doneThisWeek ? `, ${r.work.doneThisWeek} this week` : ""}]` : "";
    const when = r.status === "done" ? `done ${r.completed}` : `open · start ${r.start} · due ${r.due}${r.overdue ? " · OVERDUE" : ""}`;
    return `- ${r.key ? r.key + " " : ""}${r.summary} — _${r.list}_ · ${when}${sub}`;
  };
  const tree = (nodes, depth) => nodes.map((n) => {
    const d = ms(n.completed_at);
    const mark = d ? `[x] ${n.summary} (${day(d)}${inRange(d) ? ", this week" : ""})` : `[ ] ${n.summary}`;
    return `${"    ".repeat(depth)}- ${mark}\n` + tree(n.children || [], depth + 1);
  }).join("");

  let md = `# Task digest (${tool})\nRange: ${since} → ${until} · ${sources} ${sources === 1 ? "source" : "sources"}\n`;
  md += `Work items = subtask leaves (a task without subtasks counts as one). "Done this week" counts leaves completed in the range, so a parent closed this week whose subtasks finished earlier adds nothing.\n`;
  for (const [dev, list] of Object.entries(byDev).sort()) {
    const done = list.filter((r) => r.status === "done"), open = list.filter((r) => r.status === "open");
    const w = list.reduce((a, r) => ({ dw: a.dw + r.work.doneThisWeek, op: a.op + r.work.open }), { dw: 0, op: 0 });
    md += `\n## ${dev} — work items: ${w.dw} done this week, ${w.op} open · tasks: ${done.length} closed this week, ${open.length} open\n`;
    if (done.length) md += `### Completed\n${done.map((r) => line(r) + "\n" + (r.subs ? tree(r.subs, 1) : "")).join("")}`;
    if (open.length) md += `### Open\n${open.map((r) => line(r) + "\n" + (r.subs ? tree(r.subs, 1) : "")).join("")}`;
  }
  if (unassigned.length) md += `\n## Unassigned\n${unassigned.map(line).join("\n")}\n`;
  if (!Object.keys(byDev).length && !unassigned.length) md += `\n_No open tasks and nothing completed in this range._\n`;
  return { md, json: { tool, since, until, byDev, unassigned } };
}

// Build a parent/child tree from flat issues that reference a parent id.
// items: [{ id, parentId, summary, completedAt }]; returns Map(id -> children nodes)
function childrenMap(items) {
  const m = new Map();
  for (const it of items) {
    if (!it.parentId) continue;
    if (!m.has(it.parentId)) m.set(it.parentId, []);
    m.get(it.parentId).push(it);
  }
  const toNode = (it) => ({ summary: it.key ? `${it.key} ${it.summary}` : it.summary, completed_at: it.completedAt || 0, children: (m.get(it.id) || []).map(toNode) });
  return { childrenOf: (id) => (m.get(id) || []).map(toNode), has: (id) => m.has(id) };
}

function need(value, what, hint) {
  if (value) return value;
  const e = new Error(`${what} is not set. ${hint}`);
  e.setup = true;
  throw e;
}

async function http(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, { method, headers: { Accept: "application/json", ...headers, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.split("?")[0]} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

module.exports = { SKILL_DIR, loadConfig, ms, day, range, people, render, childrenMap, need, http };
