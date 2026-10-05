// Linear via the GraphQL API.
//
// config.tasks.linear:
//   { "teams": ["ENG", "MOBILE"] }   // team keys (optional — default: every team you can see)
// Credentials (environment): LINEAR_API_KEY
//   Create a personal API key in Linear: Settings → Security & access → Personal API keys
//
// Issues completed in the range plus every issue that isn't completed or canceled.
// Sub-issues are nested under their parent when both are in the result set.
const { ms, need, http, childrenMap } = require("./common");

const QUERY = `query Issues($filter: IssueFilter, $after: String) {
  issues(filter: $filter, first: 100, after: $after) {
    nodes {
      id identifier title url completedAt canceledAt dueDate startedAt
      state { type name }
      assignee { id name displayName email }
      parent { id }
      project { name }
      team { key name }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

module.exports = {
  label: "Linear",
  setup: "Set LINEAR_API_KEY (Linear → Settings → Security & access → Personal API keys); optionally tasks.linear.teams in config.json.",
  async collect({ cfg, since }) {
    const o = (cfg.tasks && cfg.tasks.linear) || {};
    const key = need(process.env.LINEAR_API_KEY, "LINEAR_API_KEY", "Create a personal API key and export it (never store it in config.json).");
    const status = { or: [{ completedAt: { gte: `${since}T00:00:00.000Z` } }, { state: { type: { nin: ["completed", "canceled"] } } }] };
    const filter = o.teams && o.teams.length ? { and: [status, { team: { key: { in: o.teams } } }] } : status;

    const nodes = [];
    let after = null;
    do {
      const d = await http("https://api.linear.app/graphql", { method: "POST", headers: { Authorization: key }, body: { query: QUERY, variables: { filter, after } } });
      if (d.errors) throw new Error(`Linear API: ${JSON.stringify(d.errors).slice(0, 300)}`);
      const page = d.data.issues;
      nodes.push(...page.nodes);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    const norm = nodes.filter((n) => !n.canceledAt).map((n) => ({
      id: n.id, key: n.identifier, parentId: n.parent ? n.parent.id : null,
      summary: n.title, url: n.url, list: (n.project && n.project.name) || (n.team && n.team.name) || "",
      status: n.completedAt ? "done" : "open", completedAt: ms(n.completedAt),
      start: ms(n.startedAt), due: ms(n.dueDate),
      assignees: n.assignee ? [{ id: n.assignee.id, name: n.assignee.name || n.assignee.displayName, email: n.assignee.email }] : [],
    }));
    const ids = new Set(norm.map((n) => n.id));
    const tree = childrenMap(norm.filter((n) => n.parentId && ids.has(n.parentId)));
    const rows = norm
      .filter((n) => !n.parentId || !ids.has(n.parentId))
      .map((n) => ({ ...n, subs: tree.has(n.id) ? tree.childrenOf(n.id) : null }));
    return { rows, sources: (o.teams || []).length || new Set(norm.map((n) => n.list)).size };
  },
};
