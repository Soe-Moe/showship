#!/usr/bin/env node
/**
 * Showship — show what you shipped. Installer for the "showship" agent skill.
 *
 *   npx showship                         # interactive: pick the agent and where to install
 *   npx showship --yes                   # non-interactive with defaults (Claude Code, global)
 *   npx showship --agent codex --project
 *   npx showship --dir <path>            # install into a custom skill folder
 *   npx showship --skip-deps             # don't run npm install for the deck builder
 *   npx showship --uninstall             # remove the skill (config is backed up first)
 *
 * Updating is the same command. Your config.json and node_modules are kept; the previous
 * skill files are backed up to ~/.showship/backups/<timestamp>/ before they are replaced.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");

const SKILL_NAME = "showship";
const SRC = path.resolve(__dirname, "..", "skill");
const PKG = require(path.resolve(__dirname, "..", "package.json"));
const KEEP = new Set(["config.json", "node_modules", "package-lock.json"]);
const HOME = os.homedir();

// Supported agents — anything that reads Agent Skills (a folder with SKILL.md).
const AGENTS = [
  {
    id: "claude",
    label: "Claude Code",
    hint: "~/.claude/skills",
    globalDir: path.join(HOME, ".claude", "skills"),
    projectDir: (cwd) => path.join(cwd, ".claude", "skills"),
    run: "claude",
  },
  {
    id: "codex",
    label: "Codex",
    hint: "~/.codex/skills · experimental",
    globalDir: path.join(HOME, ".codex", "skills"),
    projectDir: (cwd) => path.join(cwd, ".agents", "skills"),
    run: "codex",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    hint: "~/.gemini/config/skills · experimental",
    globalDir: path.join(HOME, ".gemini", "config", "skills"),
    projectDir: (cwd) => path.join(cwd, ".agents", "skills"),
    run: "antigravity",
  },
  {
    id: "agents",
    label: "Other agents",
    hint: "~/.agents/skills — shared folder read by several agents · experimental",
    globalDir: path.join(HOME, ".agents", "skills"),
    projectDir: (cwd) => path.join(cwd, ".agents", "skills"),
    run: "your agent",
  },
];
const BACKUP_BASE = path.join(HOME, ".showship", "backups");

// Project / task-management tools the skill can read. Secrets always come from environment variables.
const TRACKERS = [
  { id: "none",   label: "None",        hint: "git commits + GitHub PRs only" },
  { id: "lark",   label: "Lark",        hint: "via lark-cli (signed in as you)",
    skeleton: { tasklists: [] },
    setup: ["Install lark-cli and sign in as yourself.", "Optional: tasks.lark.tasklists to limit which lists are read; map open_ids in \"taskUsers\"."] },
  { id: "jira",   label: "Jira Cloud",  hint: "REST API · JIRA_EMAIL + JIRA_API_TOKEN",
    skeleton: { baseUrl: "https://your-team.atlassian.net", projects: ["KEY"] },
    setup: ["export JIRA_EMAIL=you@company.com", "export JIRA_API_TOKEN=…   (https://id.atlassian.com/manage-profile/security/api-tokens)", "Set tasks.jira.baseUrl and tasks.jira.projects in config.json."] },
  { id: "linear", label: "Linear",      hint: "GraphQL API · LINEAR_API_KEY",
    skeleton: { teams: [] },
    setup: ["export LINEAR_API_KEY=lin_api_…   (Linear → Settings → Security & access → Personal API keys)", "Optional: tasks.linear.teams (team keys) in config.json."] },
  { id: "asana",  label: "Asana",       hint: "REST API · ASANA_TOKEN",
    skeleton: { projects: ["project gid"] },
    setup: ["export ASANA_TOKEN=…   (Asana → Settings → Apps → Developer apps → Personal access tokens)", "Set tasks.asana.projects (project gids from the URL) in config.json."] },
  { id: "clickup", label: "ClickUp",    hint: "REST API · CLICKUP_TOKEN",
    skeleton: { lists: ["list id"] },
    setup: ["export CLICKUP_TOKEN=pk_…   (ClickUp → Settings → Apps → API Token)", "Set tasks.clickup.lists (list ids from the URL) — or tasks.clickup.workspaceId (+ optional spaces) — in config.json."] },
];

const ROLES = [
  { id: "lead",   label: "Team lead",  hint: "report the whole team's work (everyone's commits, PRs, tasks)" },
  { id: "member", label: "Individual", hint: "report your own work (developer, freelancer, contractor, founder)" },
];
const PERIODS = [
  { id: "weekly",   label: "Weekly",    hint: "every week (default)" },
  { id: "biweekly", label: "Biweekly",  hint: "every two weeks" },
  { id: "sprint",   label: "Sprint",    hint: "per sprint — length set by sprintDays (default 14)" },
  { id: "monthly",  label: "Monthly",   hint: "once a month" },
  { id: "custom",   label: "Custom",    hint: "you give the dates each time" },
];
const AUDIENCES = [
  { id: "business",    label: "Business",    hint: "management, PMs, clients — plain language" },
  { id: "engineering", label: "Engineering", hint: "tech lead, engineering manager — technical terms OK" },
];

// Deck designs (see skill/scripts/build_deck.js STYLES)
const STYLES = [
  { id: "classic",   label: "Classic",   hint: "black & white editorial · serif headings · hairline rules" },
  { id: "modern",    label: "Modern",    hint: "dark title slides · lime accent · serif headings" },
  { id: "corporate", label: "Corporate", hint: "white · navy & blue · sans-serif · page numbers" },
  { id: "vivid",     label: "Vivid",     hint: "teal header bands · orange accent · rounded cards" },
  { id: "showship",  label: "Showship",  hint: "signature · colour-coded projects · gauges · ship-trail ribbons" },
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const tty = process.stdout.isTTY;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c("1"), green = c("32"), yellow = c("33"), dim = c("2"), red = c("31"), cyan = c("36");

function help() {
  console.log(`
${bold("Showship")} ${dim("v" + PKG.version)} — show what you shipped. Installs the "${SKILL_NAME}" skill.

Usage:
  npx showship [options]

Without options it asks which agent to install for, where, how you'll use it, how often you report, which task tracker you use and which deck design you like.

Options:
  --agent <id>     Agent to install for: ${AGENTS.map((a) => a.id).join(", ")}
  --tasks <tool>   Task tracker to read: ${TRACKERS.map((t) => t.id).join(", ")}
  --style <name>   Deck design: ${STYLES.map((t) => t.id).join(", ")}
  --role <role>    Whose work: lead (whole team) or member (your own work)
  --audience <a>   Who reads it: business (plain language) or engineering
  --period <p>     How often you report: ${PERIODS.map((t) => t.id).join(", ")}
  --global         Install for your user (default)
  --project        Install into the current project only
  --dir <path>     Install into a custom folder (the skill folder itself)
  -y, --yes        Don't ask; use defaults for anything not given
  --skip-deps      Skip "npm install" for the deck builder dependencies
  --uninstall      Remove the skill (config.json is backed up first)
  -h, --help       Show this help
`);
}

// ---------- interactive select (no dependencies) ----------
function select(question, options, initial = 0) {
  return new Promise((resolve) => {
    let i = initial;
    const out = process.stdout, inp = process.stdin;
    readline.emitKeypressEvents(inp);
    if (inp.isTTY) inp.setRawMode(true);
    inp.resume();
    out.write("\x1b[?25l"); // hide cursor
    const lines = options.length + 2;
    const render = (first) => {
      if (!first) out.write(`\x1b[${lines}A`);
      out.write(`\x1b[2K${cyan("?")} ${bold(question)} ${dim("(↑/↓, Enter)")}\n`);
      options.forEach((o, k) => {
        const sel = k === i;
        const label = sel ? cyan(`❯ ${o.label}`) : `  ${o.label}`;
        out.write(`\x1b[2K${label}${o.hint ? "  " + dim(o.hint) : ""}\n`);
      });
      out.write("\x1b[2K\n");
    };
    const done = (val) => {
      inp.removeListener("keypress", onKey);
      if (inp.isTTY) inp.setRawMode(false);
      inp.pause();
      out.write(`\x1b[${lines}A`);
      for (let k = 0; k < lines; k++) out.write("\x1b[2K\n");
      out.write(`\x1b[${lines}A`);
      out.write(`${green("✔")} ${bold(question)} ${cyan(options[val].label)}\n`);
      out.write("\x1b[?25h");
      resolve(options[val].value);
    };
    const onKey = (_s, key = {}) => {
      if (key.ctrl && key.name === "c") { out.write("\x1b[?25h\n"); process.exit(130); }
      if (key.name === "up" || key.name === "k") i = (i - 1 + options.length) % options.length;
      else if (key.name === "down" || key.name === "j" || key.name === "tab") i = (i + 1) % options.length;
      else if (key.name === "return" || key.name === "enter") return done(i);
      else return;
      render(false);
    };
    inp.on("keypress", onKey);
    render(true);
  });
}

function copyDir(from, to, { skip = () => false } = {}) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b, { skip });
    else fs.copyFileSync(a, b);
  }
}

async function main() {
  if (has("-h") || has("--help")) { help(); return; }

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) { console.error(red(`Node.js 18 or newer is required (found ${process.versions.node}).`)); process.exit(1); }

  const interactive = process.stdin.isTTY && tty && !has("-y") && !has("--yes");
  console.log(`\n${bold("Showship")} ${dim("v" + PKG.version)}  ${dim("— show what you shipped: GitHub activity + project management tools → a deck your audience understands")}\n`);

  // 1. agent
  let agent;
  if (val("--agent")) {
    agent = AGENTS.find((a) => a.id === val("--agent"));
    if (!agent) { console.error(red(`Unknown agent "${val("--agent")}". Supported: ${AGENTS.map((a) => a.id).join(", ")}`)); process.exit(1); }
  } else if (interactive) {
    agent = await select("Which agent do you want to install for?", AGENTS.map((a) => ({ label: a.label, hint: a.hint, value: a })));
  } else {
    agent = AGENTS[0];
  }

  // 2. scope / target folder
  let target;
  if (val("--dir")) {
    target = path.resolve(val("--dir").replace(/^~(?=$|\/|\\)/, HOME));
  } else {
    let scope = has("--project") ? "project" : has("--global") ? "global" : null;
    if (!scope && interactive && !has("--uninstall")) {
      scope = await select("Where do you want to install it?", [
        { label: "Global", hint: `all projects  ${agent.globalDir.replace(HOME, "~")}/${SKILL_NAME}`, value: "global" },
        { label: "This project", hint: `this folder only  ${agent.projectDir(process.cwd()).replace(HOME, "~")}/${SKILL_NAME}`, value: "project" },
      ]);
    }
    target = scope === "project"
      ? path.join(agent.projectDir(process.cwd()), SKILL_NAME)
      : path.join(agent.globalDir, SKILL_NAME);
  }

  // 2b. role and audience
  const pick = async (flag, list, question, cfgKey) => {
    if (val(flag)) {
      const v = list.find((t) => t.id === String(val(flag)).toLowerCase());
      if (!v) { console.error(red(`Unknown ${flag.slice(2)} "${val(flag)}". Supported: ${list.map((t) => t.id).join(", ")}`)); process.exit(1); }
      return v;
    }
    if (!interactive || has("--uninstall")) return null;
    let cur = null; try { cur = JSON.parse(fs.readFileSync(path.join(target, "config.json"), "utf8"))[cfgKey]; } catch {}
    return select(question, list.map((t) => ({ label: t.label + (t.id === cur ? " (current)" : ""), hint: t.hint, value: t })),
      Math.max(0, list.findIndex((t) => t.id === (cur || list[0].id))));
  };
  const role = await pick("--role", ROLES, "How will you use it?", "role");
  const audience = await pick("--audience", AUDIENCES, "Who will read the report?", "audience");
  const period = await pick("--period", PERIODS, "How often do you report?", "period");

  // 3. task tracker
  const cfgFile = path.join(target, "config.json");
  const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile, "utf8")); } catch { return null; } };
  let tracker = null;
  if (val("--tasks")) {
    tracker = TRACKERS.find((t) => t.id === String(val("--tasks")).toLowerCase());
    if (!tracker) { console.error(red(`Unknown task tracker "${val("--tasks")}". Supported: ${TRACKERS.map((t) => t.id).join(", ")}`)); process.exit(1); }
  } else if (interactive && !has("--uninstall")) {
    const cur = readCfg();
    const curId = cur && ((cur.tasks && cur.tasks.provider) || (cur.larkUsers ? "lark" : null));
    const init = Math.max(0, TRACKERS.findIndex((t) => t.id === curId));
    tracker = await select("Which project / task management tool does your team use?",
      TRACKERS.map((t) => ({ label: t.label + (t.id === curId ? " (current)" : ""), hint: t.hint, value: t })), init);
  }

  // 4. deck style
  let style = null;
  if (val("--style")) {
    style = STYLES.find((t) => t.id === String(val("--style")).toLowerCase());
    if (!style) { console.error(red(`Unknown style "${val("--style")}". Supported: ${STYLES.map((t) => t.id).join(", ")}`)); process.exit(1); }
  } else if (interactive && !has("--uninstall")) {
    const cur = readCfg();
    const curId = (cur && cur.style) || "classic";
    style = await select("Which deck design do you want?",
      STYLES.map((t) => ({ label: t.label + (cur && cur.style === t.id ? " (current)" : ""), hint: t.hint, value: t })),
      Math.max(0, STYLES.findIndex((t) => t.id === curId)));
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupRoot = path.join(BACKUP_BASE, stamp);
  const backup = (dir) => {
    // everything except node_modules, outside the skills folder so it isn't loaded as a second skill
    copyDir(dir, backupRoot, { skip: (n) => n === "node_modules" || n === ".DS_Store" });
    return backupRoot;
  };

  // ---------- uninstall ----------
  if (has("--uninstall")) {
    if (!fs.existsSync(target)) { console.log(yellow(`Nothing to remove: ${target} does not exist.`)); return; }
    const b = backup(target);
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`${green("✔")} Removed ${target}`);
    console.log(dim(`  Backup (incl. config.json): ${b}`));
    return;
  }

  // ---------- install / update ----------
  console.log(`\n${bold(`Installing for ${agent.label}`)}`);
  if (/experimental/.test(agent.hint)) console.log(yellow(`  ${agent.label} support is experimental — please report anything that doesn't work: ${PKG.bugs ? PKG.bugs.url : ""}`));
  console.log(dim(`  → ${target}\n`));

  const updating = fs.existsSync(path.join(target, "SKILL.md"));
  if (updating) {
    const b = backup(target);
    console.log(`${yellow("•")} Existing installation found — backed up to ${dim(b)}`);
  }
  // Shipped files are overwritten; config.json, node_modules and files you added yourself are left untouched.
  copyDir(SRC, target, { skip: (n) => KEEP.has(n) || n === ".DS_Store" });
  for (const f of ["scripts/collect_commits.sh", "scripts/collect_prs.sh", "scripts/build_deck.js", "scripts/lint_report.js", "scripts/collect_tasks.js", "scripts/collect_lark_tasks.js"]) {
    const p = path.join(target, f);
    if (fs.existsSync(p)) try { fs.chmodSync(p, 0o755); } catch {}
  }
  console.log(`${green("✔")} Skill files ${updating ? "updated" : "installed"}`);

  const existing = readCfg();
  if (role || audience || period) {
    const cfg = readCfg() || {};
    if (role) cfg.role = role.id;
    if (audience) cfg.audience = audience.id;
    if (period) cfg.period = period.id;
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + "\n");
    if (role) console.log(`${green("✔")} Role set to ${bold(role.label)} ${dim(`(config.json → role = "${role.id}")`)}`);
    if (audience) console.log(`${green("✔")} Audience set to ${bold(audience.label)} ${dim(`(config.json → audience = "${audience.id}")`)}`);
    if (period) console.log(`${green("✔")} Reporting period set to ${bold(period.label)} ${dim(`(config.json → period = "${period.id}")`)}`);
  }
  if (style) {
    const cfg = readCfg() || {};
    cfg.style = style.id;
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + "\n");
    console.log(`${green("✔")} Deck design set to ${bold(style.label)} ${dim(`(config.json → style = "${style.id}")`)}`);
  }
  if (tracker) {
    // Record the choice; keep everything else in config.json as it is.
    const cfg = readCfg() || {};
    cfg.tasks = Object.assign({}, cfg.tasks || {}, { provider: tracker.id });
    if (tracker.skeleton && !cfg.tasks[tracker.id]) cfg.tasks[tracker.id] = tracker.skeleton;
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + "\n");
    console.log(`${green("✔")} Task tracker set to ${bold(tracker.label)} ${dim(`(config.json → tasks.provider = "${tracker.id}")`)}`);
    if (existing) console.log(`${green("✔")} Kept the rest of your config.json`);
    else console.log(`${yellow("•")} The rest of config.json (company, logo, team…) will be set up on first use`);
  } else {
    console.log(existing
      ? `${green("✔")} Kept your config.json`
      : `${yellow("•")} The rest of config.json (company, logo, team…) will be set up on first use`);
  }

  if (!has("--skip-deps")) {
    console.log(`${dim("…")} Installing deck builder dependencies (pptxgenjs, sharp, react-icons) — this can take a minute`);
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const r = spawnSync(npm, ["install", "--no-audit", "--no-fund", "--loglevel=error"], {
      cwd: path.join(target, "scripts"), stdio: "inherit", shell: process.platform === "win32",
    });
    if (r.status === 0) console.log(`${green("✔")} Dependencies installed`);
    else console.log(red(`✖ npm install failed — run it manually:  cd "${path.join(target, "scripts")}" && npm install`));
  }

  // ---------- environment checks ----------
  const which = (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" }).status === 0;
  console.log("");
  if (!which("git")) console.log(`${yellow("!")} git not found — needed to collect commits`);
  if (which("gh")) {
    const auth = spawnSync("gh", ["auth", "status"], { stdio: "ignore" }).status === 0;
    console.log(auth ? `${green("✔")} GitHub CLI is signed in (PR data enabled)` : `${yellow("!")} GitHub CLI found but not signed in — run: gh auth login`);
  } else {
    console.log(`${yellow("!")} GitHub CLI (gh) not found — needed for pull requests and reviews: https://cli.github.com  (then: gh auth login)`);
  }
  if (!which("soffice")) console.log(dim("  Optional: LibreOffice lets the agent render slides to images and check the layout."));
  if (tracker && tracker.setup) {
    console.log(`\n${bold(`${tracker.label} setup`)}`);
    tracker.setup.forEach((l) => console.log(`  ${l}`));
    if (tracker.id !== "lark") console.log(dim("  Put the export lines in ~/.zshrc (or ~/.bashrc) so the agent sees them; never store tokens in config.json."));
    if (tracker.id === "lark" && !which("lark-cli")) console.log(`${yellow("!")} lark-cli not found on PATH`);
  }

  console.log(`
${bold("Next steps")}
  1. Open ${agent.label} inside one of your repos:   ${dim(`cd my-repo && ${agent.run}`)}
  2. Ask:  ${bold('"Collect this week\'s commits and PRs for Showship"')}  ${dim("(or this sprint's / month's)")}
     Repeat in each repo that had work in the period.
  3. Then: ${bold('"Build the report"')}  →  a .pptx in your reports folder

  On first use it sets up config.json (company, logo, presenter, team names, reports folder).
  Docs: ${PKG.homepage || "see README.md"}
`);
}

main().catch((e) => { process.stdout.write("\x1b[?25h"); console.error(red(e.stack || e.message)); process.exit(1); });
