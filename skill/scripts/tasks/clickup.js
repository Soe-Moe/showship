// ClickUp via the REST API v2.
//
// config.tasks.clickup — either specific lists, or a whole workspace (optionally narrowed to spaces/lists):
//   { "lists": ["901234567", "901234568"] }                       // list ids (from the list URL)
//   { "workspaceId": "9012345", "spaces": ["90123"], "lists": [] } // workspace ("team") id + optional filters
// Credentials (environment): CLICKUP_TOKEN
//   Personal API token: ClickUp → Settings → Apps → API Token (starts with "pk_")
//
// Open tasks plus tasks completed in the range. Subtasks are nested under their parent when both
// are in the result set. "Done" = a status of type "done" or "closed".
const { ms, need, http, childrenMap } = require("./common");

const API = "https://api.clickup.com/api/v2";

module.exports = {
  label: "ClickUp",
  setup: "Set CLICKUP_TOKEN (ClickUp → Settings → Apps → API Token) and tasks.clickup.lists (list ids) or tasks.clickup.workspaceId in config.json.",
  async collect({ cfg, range }) {
    const o = (cfg.tasks && cfg.tasks.clickup) || {};
    const token = need(process.env.CLICKUP_TOKEN, "CLICKUP_TOKEN", "Create a personal API token and export it (never store it in config.json).");
    const H = { Authorization: token };
    const lists = o.lists || [];
    const spaces = o.spaces || [];
    if (!o.workspaceId && !lists.length) need(null, "tasks.clickup.lists (or tasks.clickup.workspaceId)", "Add the list ids (the number in the list URL) or your workspace id to config.json.");

    const fetchAll = async (base) => {
      const out = [];
      for (let page = 0; ; page++) {
        const d = await http(`${base}${base.includes("?") ? "&" : "?"}page=${page}&subtasks=true&include_closed=true`, { headers: H });
        out.push(...(d.tasks || []));
        if (d.last_page !== false || !(d.tasks || []).length) break;
      }
      return out;
    };

    let tasks = [];
    if (o.workspaceId) {
      const q = [...spaces.map((s) => `space_ids[]=${encodeURIComponent(s)}`), ...lists.map((l) => `list_ids[]=${encodeURIComponent(l)}`)].join("&");
      tasks = await fetchAll(`${API}/team/${o.workspaceId}/task${q ? "?" + q : ""}`);
    } else {
      for (const id of lists) tasks.push(...(await fetchAll(`${API}/list/${id}/task`)));
    }

    const seen = new Set();
    const norm = [];
    for (const t of tasks) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const type = t.status && t.status.type;
      const done = type === "done" || type === "closed";
      const completedAt = done ? ms(t.date_done || t.date_closed) : 0;
      norm.push({
        id: t.id, key: t.custom_id || null, parentId: t.parent || null,
        summary: t.name, url: t.url, list: (t.list && t.list.name) || "",
        status: done ? "done" : "open", completedAt, start: ms(t.start_date), due: ms(t.due_date),
        assignees: (t.assignees || []).map((a) => ({ id: String(a.id), name: a.username, email: a.email })),
      });
    }
    const ids = new Set(norm.map((n) => n.id));
    const tree = childrenMap(norm.filter((n) => n.parentId && ids.has(n.parentId)));
    // Subtasks closed in earlier weeks stay in their parent's tree (so "3/5" counts are right);
    // top-level tasks closed before the range are dropped.
    const rows = norm
      .filter((n) => !n.parentId || !ids.has(n.parentId))
      .filter((n) => !(n.status === "done" && n.completedAt && !range.inRange(n.completedAt)))
      .map((n) => ({ ...n, subs: tree.has(n.id) ? tree.childrenOf(n.id) : null }));
    return { rows, sources: lists.length || spaces.length || 1 };
  },
};
