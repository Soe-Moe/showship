// Asana via the REST API.
//
// config.tasks.asana:
//   { "projects": ["1201234567890123", "1209876543210987"] }   // project gids (from the project URL)
// Credentials (environment): ASANA_TOKEN
//   Create a personal access token: Asana → Settings → Apps → Developer apps → Personal access tokens
//
// Uses completed_since, which returns incomplete tasks plus tasks completed since the start of the range.
// Subtasks are fetched recursively.
const { ms, need, http } = require("./common");

const API = "https://app.asana.com/api/1.0";
const FIELDS = "name,completed,completed_at,due_on,start_on,assignee.name,assignee.email,permalink_url,num_subtasks,projects.name";

module.exports = {
  label: "Asana",
  setup: "Set ASANA_TOKEN (Asana → Settings → Apps → Developer apps → Personal access tokens) and tasks.asana.projects (project gids) in config.json.",
  async collect({ cfg, since }) {
    const o = (cfg.tasks && cfg.tasks.asana) || {};
    const token = need(process.env.ASANA_TOKEN, "ASANA_TOKEN", "Create a personal access token and export it (never store it in config.json).");
    const projects = need(o.projects && o.projects.length ? o.projects : null, "tasks.asana.projects", "Add the project gids (the number in the project URL) to config.json.");
    const H = { Authorization: `Bearer ${token}` };

    const pages = async (url) => {
      const out = [];
      let offset = null;
      do {
        const d = await http(`${url}${url.includes("?") ? "&" : "?"}limit=100${offset ? `&offset=${offset}` : ""}`, { headers: H });
        out.push(...(d.data || []));
        offset = d.next_page ? d.next_page.offset : null;
      } while (offset);
      return out;
    };
    const subtree = async (gid) => {
      const subs = await pages(`${API}/tasks/${gid}/subtasks?opt_fields=${FIELDS}`);
      return Promise.all(subs.map(async (s) => ({
        summary: s.name, completed_at: s.completed ? ms(s.completed_at) : 0,
        children: s.num_subtasks ? await subtree(s.gid) : [],
      })));
    };

    const rows = [];
    for (const pid of projects) {
      const proj = await http(`${API}/projects/${pid}?opt_fields=name`, { headers: H });
      const list = (proj.data && proj.data.name) || pid;
      const tasks = await pages(`${API}/projects/${pid}/tasks?completed_since=${since}T00:00:00.000Z&opt_fields=${FIELDS}`);
      for (const t of tasks) {
        rows.push({
          list, key: null, summary: t.name, url: t.permalink_url,
          status: t.completed ? "done" : "open", completedAt: t.completed ? ms(t.completed_at) : 0,
          start: ms(t.start_on), due: ms(t.due_on),
          assignees: t.assignee ? [{ id: t.assignee.gid, name: t.assignee.name, email: t.assignee.email }] : [],
          subs: t.num_subtasks ? await subtree(t.gid) : null,
        });
      }
    }
    return { rows, sources: projects.length };
  },
};
