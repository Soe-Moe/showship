// Jira Cloud via the REST API v3 (enhanced JQL search).
//
// config.tasks.jira:
//   { "baseUrl": "https://your-team.atlassian.net",
//     "projects": ["CLINIC", "PULSE"],          // project keys (or give "jql" instead)
//     "jql": "optional extra JQL filter, e.g. labels = backend" }
// Credentials (environment): JIRA_EMAIL, JIRA_API_TOKEN
//   Create a token at https://id.atlassian.com/manage-profile/security/api-tokens
//
// Epic → story → sub-task hierarchy becomes the subtask tree: issues whose parent is also in the
// result set are nested under it; the top-level rows are issues without a parent in the set.
const { ms, need, http, childrenMap } = require("./common");

const FIELDS = ["summary", "status", "assignee", "resolutiondate", "statuscategorychangedate", "duedate", "created", "parent", "project", "issuetype", "customfield_10015"];

module.exports = {
  label: "Jira",
  setup: "Set JIRA_EMAIL and JIRA_API_TOKEN (https://id.atlassian.com/manage-profile/security/api-tokens) and tasks.jira.baseUrl + projects in config.json.",
  async collect({ cfg, since }) {
    const o = (cfg.tasks && cfg.tasks.jira) || {};
    const base = need(o.baseUrl || process.env.JIRA_BASE_URL, "tasks.jira.baseUrl", "Add it to config.json, e.g. https://your-team.atlassian.net").replace(/\/+$/, "");
    const email = need(process.env.JIRA_EMAIL || o.email, "JIRA_EMAIL", "Export your Atlassian account email.");
    const token = need(process.env.JIRA_API_TOKEN, "JIRA_API_TOKEN", "Create an API token and export it (never store it in config.json).");
    const auth = { Authorization: "Basic " + Buffer.from(`${email}:${token}`).toString("base64") };

    const scope = [];
    if (o.projects && o.projects.length) scope.push(`project in (${o.projects.map((p) => `"${p}"`).join(",")})`);
    if (o.jql) scope.push(`(${o.jql})`);
    if (!scope.length) need(null, "tasks.jira.projects (or tasks.jira.jql)", "List the project keys to report on.");
    const jql = `${scope.join(" AND ")} AND (statusCategory != Done OR resolved >= "${since}" OR statusCategoryChangedDate >= "${since}") ORDER BY created ASC`;

    const issues = [];
    let next;
    do {
      const d = await http(`${base}/rest/api/3/search/jql`, { method: "POST", headers: auth, body: { jql, fields: FIELDS, maxResults: 100, ...(next ? { nextPageToken: next } : {}) } });
      issues.push(...(d.issues || []));
      next = d.nextPageToken || null;
    } while (next);

    const norm = issues.map((i) => {
      const f = i.fields || {};
      const done = f.status && f.status.statusCategory && f.status.statusCategory.key === "done";
      return {
        id: i.id, key: i.key, parentId: f.parent ? f.parent.id : null,
        summary: f.summary || "", url: `${base}/browse/${i.key}`, list: (f.project && f.project.name) || "",
        status: done ? "done" : "open",
        completedAt: done ? ms(f.resolutiondate || f.statuscategorychangedate) : 0,
        start: ms(f.customfield_10015), due: ms(f.duedate),
        assignees: f.assignee ? [{ id: f.assignee.accountId, name: f.assignee.displayName, email: f.assignee.emailAddress }] : [],
      };
    });
    const ids = new Set(norm.map((n) => n.id));
    const tree = childrenMap(norm.filter((n) => n.parentId && ids.has(n.parentId)));
    const rows = norm
      .filter((n) => !n.parentId || !ids.has(n.parentId))
      .map((n) => ({ ...n, subs: tree.has(n.id) ? tree.childrenOf(n.id) : null }));
    return { rows, sources: (o.projects || []).length || 1 };
  },
};
