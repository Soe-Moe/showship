// Custom task tool through MCP (Notion, Monday, GitHub Projects, Trello, Jira Server, an in-house tracker, …).
//
// A script can't call the agent's MCP servers, so the agent does the fetching: it uses the MCP
// server named in config, reads open tasks plus tasks completed in the range, and saves them as
// JSON. This provider turns that file into the same digest every other tracker produces.
//
// config.tasks.mcp:
//   {
//     "name": "Notion",                       // shown in the digest and on slides
//     "server": "notion",                     // MCP server the agent should use
//     "lists": ["Sprint board"],              // optional: projects / boards / databases to read
//     "instructions": "Status 'Done' means done; the 'Owner' property is the assignee."   // optional hints
//   }
//
// Usage: node collect_tasks.js <since> <until> --provider mcp --input <dir>/tasks.mcp.json
//
// Input file: an array of tasks, or { "tasks": [...] }. Field names are forgiving:
//   {
//     "project": "Sprint board",              // or "list"
//     "key": "CB-88",                         // or "id" (optional)
//     "title": "Appointment reminders",       // or "summary" / "name"
//     "url": "https://…",                     // optional
//     "status": "done",                       // done | open (also: completed, closed, resolved, true → done)
//     "completed_at": "2026-10-08",           // when it was done (ISO date or time)
//     "start": "2026-10-01", "due": "2026-10-10",
//     "assignees": ["Nina Rao", { "name": "Leo Park", "email": "leo@acme.io", "id": "u_123" }],
//     "subtasks": [ { "title": "Scheduler", "done": true, "completed_at": "2026-10-07", "subtasks": [] } ]
//   }
const fs = require("fs");
const path = require("path");
const { ms, need } = require("./common");

const DONE = new Set(["done", "completed", "complete", "closed", "resolved", "shipped", "true"]);
const isDone = (t) => t.done === true || t.completed === true || DONE.has(String(t.status ?? "").trim().toLowerCase());
const title = (t) => t.title ?? t.summary ?? t.name ?? "(untitled)";
const when = (t) => ms(t.completed_at ?? t.completedAt ?? t.done_at ?? t.closed_at);

function person(a) {
  if (!a) return null;
  if (typeof a === "string") return a.includes("@") && !a.includes(" ") ? { id: null, name: null, email: a } : { id: null, name: a, email: null };
  return { id: a.id ?? null, name: a.name ?? a.displayName ?? null, email: a.email ?? null };
}
function node(t) {
  const kids = t.subtasks ?? t.subs ?? t.children ?? [];
  return { summary: title(t), completed_at: isDone(t) ? (when(t) || 1) : 0, children: kids.map(node) };
}

module.exports = {
  get label() {
    try { return (require("./common").loadConfig().tasks.mcp.name) || "Custom tool (MCP)"; } catch { return "Custom tool (MCP)"; }
  },
  setup: "Connect the tool's MCP server to your agent, set tasks.mcp.server (and tasks.mcp.name) in config.json, then let the agent save the tasks to <dir>/tasks.mcp.json and pass it with --input.",
  async collect({ cfg, argv = process.argv }) {
    const o = (cfg.tasks && cfg.tasks.mcp) || {};
    const i = argv.indexOf("--input");
    const file = need(i >= 0 ? argv[i + 1] : o.input, "--input <tasks.mcp.json>", "The agent fetches the tasks through the MCP server and saves them to a JSON file first.");
    const p = path.resolve(file);
    if (!fs.existsSync(p)) { const e = new Error(`${p} not found.`); e.setup = true; throw e; }
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    const list = Array.isArray(data) ? data : (data.tasks || []);
    const rows = list.map((t) => {
      const done = isDone(t);
      const kids = t.subtasks ?? t.subs ?? t.children ?? [];
      return {
        list: t.project ?? t.list ?? t.board ?? o.name ?? "Tasks",
        key: t.key ?? t.id ?? null,
        summary: title(t),
        url: t.url ?? null,
        status: done ? "done" : "open",
        completedAt: done ? when(t) : 0,
        start: ms(t.start ?? t.start_date),
        due: ms(t.due ?? t.due_date),
        assignees: (Array.isArray(t.assignees) ? t.assignees : [t.assignee].filter(Boolean)).map(person).filter(Boolean),
        subs: kids.length ? kids.map(node) : null,
      };
    });
    return { rows, sources: new Set(rows.map((r) => r.list)).size || 1 };
  },
};
