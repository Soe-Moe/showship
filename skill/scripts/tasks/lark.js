// Lark (Feishu) tasks via lark-cli, signed in as the user (--as user).
// Reads every tasklist the user can see, with nested subtasks.
// config.tasks.lark (optional): { "tasklists": ["name or guid", ...] }  — limit to these lists
const { execFileSync } = require("child_process");
const { ms } = require("./common");

module.exports = {
  label: "Lark",
  setup: "Install lark-cli and sign in as yourself; collection runs with --as user.",
  async collect({ cfg, range, people }) {
    const opts = (cfg.tasks && cfg.tasks.lark) || {};
    const lark = (args) => {
      let out;
      try {
        out = execFileSync("lark-cli", [...args, "--as", "user"], { encoding: "utf8", maxBuffer: 64 << 20 });
      } catch (e) {
        if (e.code === "ENOENT") { const err = new Error("lark-cli is not installed or not on PATH."); err.setup = true; throw err; }
        throw e;
      }
      const d = JSON.parse(out);
      if (!d.ok) throw new Error(`lark-cli ${args.slice(0, 3).join(" ")} failed: ${JSON.stringify(d.error || d).slice(0, 300)}`);
      return d.data;
    };
    const paged = (args, params) => {
      const items = [];
      let token;
      do {
        const p = { ...params, page_size: params.page_size || 100 };
        if (token) p.page_token = token;
        const d = lark([...args, "--params", JSON.stringify(p)]);
        items.push(...(d.items || []));
        token = d.has_more ? d.page_token : null;
      } while (token);
      return items;
    };
    const nameCache = {};
    const nameOf = (id) => {
      if (people.known(id)) return null; // mapped in config — no lookup needed
      if (id in nameCache) return nameCache[id];
      try { const d = lark(["contact", "+get-user", "--user-id", id]); nameCache[id] = (d.user || d).name || null; }
      catch { nameCache[id] = null; }
      return nameCache[id];
    };
    const subtree = (guid) => paged(["task", "subtasks", "list"], { task_guid: guid, page_size: 50 }).map((n) => ({
      summary: n.summary, completed_at: ms(n.completed_at), children: n.subtask_count ? subtree(n.guid) : [],
    }));

    let lists = paged(["task", "tasklists", "list"], {});
    if (opts.tasklists && opts.tasklists.length) {
      const want = new Set(opts.tasklists.map((s) => String(s).toLowerCase()));
      lists = lists.filter((l) => want.has(String(l.name).toLowerCase()) || want.has(String(l.guid).toLowerCase()));
    }
    const rows = [];
    for (const l of lists) {
      for (const t of paged(["task", "tasklists", "tasks"], { tasklist_guid: l.guid })) {
        const done = ms(t.completed_at);
        if (done && !range.inRange(done)) continue; // completed before the range
        rows.push({
          list: l.name, key: null, summary: t.summary, url: t.url, status: done ? "done" : "open",
          completedAt: done, start: ms(t.start && t.start.timestamp), due: ms(t.due && t.due.timestamp),
          assignees: (t.members || []).filter((m) => m.role === "assignee").map((m) => ({ id: m.id, name: nameOf(m.id) })),
          subs: t.subtask_count ? subtree(t.guid) : null,
        });
      }
    }
    return { rows, sources: lists.length };
  },
};
