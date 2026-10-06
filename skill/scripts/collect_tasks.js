#!/usr/bin/env node
// Collect this week's tasks from your project-management tool as a markdown digest, grouped by person.
//
// Usage:
//   node collect_tasks.js <since YYYY-MM-DD> <until YYYY-MM-DD> [--json out.json] [--provider lark|jira|linear|asana|clickup|mcp]
//                         [--input tasks.mcp.json]                # provider "mcp": tasks the agent fetched through an MCP server
//                         [--people "Name @Nick,Other @Nick"]   # only these people (e.g. just you)
//
// Supported: Lark, Jira Cloud, Linear, Asana, ClickUp, and any other tool through MCP (provider "mcp"). The tool comes from config.json "tasks.provider" (or --provider). Output is the same for every
// tool: open tasks + tasks completed in the range, per assignee, with nested subtasks, subtask
// counts and overdue flags. Assignees are mapped to display names via config "taskUsers"
// (ids, emails or names → "Name @Nick"; "larkUsers" and "team" are also used); people in
// "exclude.people" are left out.
//
// Exit codes: 0 ok · 2 not configured / provider "none" · 1 error.
const fs = require("fs");
const path = require("path");
const common = require("./tasks/common");

const PROVIDERS = {
  lark: () => require("./tasks/lark"),
  jira: () => require("./tasks/jira"),
  linear: () => require("./tasks/linear"),
  asana: () => require("./tasks/asana"),
  clickup: () => require("./tasks/clickup"),
  mcp: () => require("./tasks/mcp"),
};

(async () => {
  const argv = process.argv.slice(2);
  const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  const [since, until] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  if (!since || !until) {
    console.error("Usage: node collect_tasks.js <since YYYY-MM-DD> <until YYYY-MM-DD> [--json out.json] [--provider lark|jira|linear|asana|clickup|mcp] [--input tasks.mcp.json]");
    process.exit(1);
  }
  const cfg = common.loadConfig();
  const name = (opt("--provider") || (cfg.tasks && cfg.tasks.provider) || (cfg.larkUsers ? "lark" : "none")).toLowerCase();
  if (name === "none") {
    console.log(`# Task digest\n_No task tracker configured (config.json → tasks.provider is "none")._`);
    process.exit(2);
  }
  if (!PROVIDERS[name]) {
    console.error(`Unknown task provider "${name}". Supported: ${Object.keys(PROVIDERS).join(", ")}, none`);
    process.exit(1);
  }
  const provider = PROVIDERS[name]();
  try {
    const range = common.range(since, until);
    const people = common.people(cfg);
    const { rows, sources } = await provider.collect({ cfg, since, until, range, people });
    const only = opt("--people") ? opt("--people").split(",").map((x) => x.trim()).filter(Boolean) : null;
    const { md, json } = common.render({ tool: provider.label, since, until, sources, rows, cfg, only });
    process.stdout.write(md);
    const out = opt("--json");
    if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(json, null, 2));
  } catch (e) {
    if (e.setup) {
      console.log(`# Task digest (${provider.label})\n_Not collected: ${e.message}_\n_Setup: ${provider.setup}_`);
      process.exit(2);
    }
    console.error(`${provider.label} collection failed: ${e.message}`);
    process.exit(1);
  }
})();
