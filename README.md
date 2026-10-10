<p align="center">
  <img src="https://raw.githubusercontent.com/Soe-Moe/showship/master/brand/showship-logo.png" alt="Showship — show what you shipped" width="420">
</p>

# Showship

**Show what you shipped.**

[![Status: Beta](https://img.shields.io/badge/status-beta-orange)](https://github.com/Soe-Moe/showship/issues)
[![Version](https://img.shields.io/npm/v/showship?include_prereleases&label=version&color=blue)](https://www.npmjs.com/package/showship)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933)](https://nodejs.org)
[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-Claude%20Code%20·%20Codex%20·%20Antigravity-D97757)](#install)

**Turns GitHub activity plus Jira, Linear, Asana, ClickUp & Lark tasks into a plain-language progress deck (PPTX) for your boss or client to understand weekly, per sprint, monthly or for any date range.**



https://github.com/user-attachments/assets/29e9b05b-637f-4db9-9bdb-6ad82487b57e



Showship is an Agent Skill (a `SKILL.md` folder) for anyone who has to report what they built — **team leads** reporting the whole team to management, and **individuals** (developers, freelancers, contractors, founders) reporting their own work to a manager, tech lead or client. Run it in each repo you touched; your AI coding agent reads the commits, PRs, reviews and replies, translates them into plain business language (or keeps it technical for engineers), and builds a polished slide deck — with charts, owners, progress, blockers and the plan for next period.

Works with **Claude Code**, plus **Codex** and **Antigravity** _(experimental)_ and other agents that read `SKILL.md` folders.

```bash
npx showship
```

> [!TIP]
> **Use `npx`, not `npm i`.** Showship isn't a library you import — `npx showship` runs the installer, which copies the skill into your agent's skills folder (`~/.claude/skills/showship`, …). Prefer a global command? `npm i -g showship`, then run `showship`.

> [!NOTE]
> **Beta.** Slide templates, config keys and installer options may still change between releases. The Jira, Linear, Asana and ClickUp integrations and the Codex / Antigravity installs have not yet been tested against many real setups. Please [open an issue](https://github.com/Soe-Moe/showship/issues) with feedback or bugs.

![Example deck](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/preview-grid.png)

<sub>Shown in the Showship signature style. All names and data are fictional. Download the example deck: [Showship](https://github.com/Soe-Moe/showship/raw/master/docs/example-deck-showship.pptx) · [Classic](https://github.com/Soe-Moe/showship/raw/master/docs/example-deck.pptx).</sub>

---

## Why

Every week, sprint or month someone has to explain what got built — a team lead to business people, PMs, the boss and the CTO; a developer to their manager; a freelancer to their client. The raw material lives in GitHub ("add appointments migration", "fix N+1 on doctors list", a 2,000-word review on PR #12) and in the task tracker. Turning that into slides takes hours, and the result is often too technical for half the room.

Showship does the translation for you. The deck answers the questions every audience asks:

1. **What are we working on?**
2. **What has been delivered?**
3. **How far along is it?** (percent, phases)
4. **Who is doing what?**
5. **What is blocked, and what do you need from us?** (blockers, decisions needed)
6. **What happens next?** (next week, sprint or month)

## Who it's for

| You are…                                                        | Set                                     | You get                                                                                                             |
| --------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Team lead** reporting to business / management                | `role: lead`, `audience: business`      | the whole team's progress in plain language: owners, percentages, blockers, decisions needed, what's next           |
| **Team lead** reporting to a CTO or engineering org             | `role: lead`, `audience: engineering`   | the same, with technical detail kept (architecture, test status, review findings)                                   |
| **Developer** reporting to a tech lead or manager               | `role: member`, `audience: engineering` | only _your_ commits, PRs you authored/reviewed and _your_ tasks — what you shipped, what's in review, what you need |
| **Freelancer / contractor** reporting to a client               | `role: member`, `audience: business`    | a client-ready update of your work, in their language, with your logo                                               |
| **Solo founder / indie dev** updating investors or a co-founder | `role: member`, `audience: business`    | a short, polished progress deck from your repos                                                                     |

The installer asks these questions; you can change them in `config.json` at any time.

## Features

- **Any reporting rhythm** — `weekly`, `biweekly`, `sprint`, `monthly` or `custom`. The period sets the default date range, the deck title ("Sprint 14 Progress Report") and the "next…" slide. Any request can override it: _"the last two weeks"_, _"September"_, _"Oct 1 to Oct 9"_.
- **Reads everything that matters** — commits on all branches, every PR with activity in the period, full PR descriptions, reviews (approved / changes requested), conversation and inline review comments, in chronological order. Bots are filtered out.
- **Understands your reviews** — comments from the lead's GitHub account are tagged `(LEAD)` and treated as the most authoritative source. Structured reviews (summary, subtask coverage, blockers, decisions, verdict) map straight onto progress, status, risks and "decisions needed".
- **Plain language by default, technical when you want it** — set `audience` to `business` or `engineering`. A built-in jargon check (`lint_report.js`) flags terms like _endpoint, schema, payload, JSON, 500 error, N+1_ and suggests business wording before the deck is built.
- **Never invents numbers** — percentages, owners, dates and blockers come from your data or from you. The agent asks one consolidated question for anything GitHub can't tell it.
- **12 slide templates, chosen to fit the data** — KPI dashboard, milestone timeline, doughnut progress, phase bar charts, workstreams, icon rows with generated illustrations, screenshot gallery, code-review insights, blockers & decisions, developer task tracker, team activity chart, next-steps table. Consecutive slides never reuse the same layout.
- **6 deck designs** — the colourful _Showship_ signature style, plus _Paper_, _Classic_, _Modern_, _Corporate_ and _Vivid_; every slide type works in all six.
- **Checks its own layout** — after the build the deck is rendered and every slide is checked for text crossing the margins or colliding, and text that is too long for its slot is caught before the build.
- **Your branding** — company name, logo (auto-trimmed) and colour overrides from one config file.
- **Works across changing repos** — collect per repo, build once. The set of repos can change every period.
- **Task tracker integrations** — pull tasks, subtasks, assignees and due dates from **Jira, Linear, Asana, ClickUp or Lark**, or any other tool your agent reaches through **MCP** for "who is doing what", progress evidence and overdue risks.
- **Any language in chat** — talk to the agent in your own language; the deck is written in your configured deck language (English by default).
- **Local-first** — data stays on your machine; your personal config is never shipped.

## How it works

```
 repo A ──┐  "collect"  → reads commits + PRs + reviews → <report>/repo-A.md  (business-language draft)
 repo B ──┤  "collect"  → …                              → <report>/repo-B.md
 repo C ──┘  "collect"  → …                              → <report>/repo-C.md
 (tracker)   once       → Jira / Linear / Asana / ClickUp / Lark → <report>/tasks.md (optional)

 anywhere    "build"    → merges drafts + your notes → asks what's missing → jargon check
                         → report.json → Sprint_14_Progress_Report_<date>.pptx
```

Everything for one report lives in one folder, e.g. `~/Showship/2026-10-09/`. The deck is generated from `report.json`, so edits are just "change slide 4's title" → the agent edits the JSON and rebuilds.

## Requirements

| Tool                                        | Why                                                         | Install                                                                          |
| ------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| An AI coding agent                          | runs the skill                                              | [Claude Code](https://docs.claude.com/en/docs/claude-code), Codex or Antigravity |
| Node.js ≥ 18                                | installer and deck builder                                  | [nodejs.org](https://nodejs.org)                                                 |
| git                                         | reads commits                                               | —                                                                                |
| [GitHub CLI](https://cli.github.com) (`gh`) | reads PRs, reviews, comments                                | `brew install gh && gh auth login`                                               |
| LibreOffice _(optional)_                    | lets the agent render slides to images and check the layout | `brew install --cask libreoffice`                                                |
| A task tracker _(optional)_                 | Jira Cloud, Linear, Asana, ClickUp or Lark                  | see [Task tracker integrations](#task-tracker-integrations)                      |

`gh auth login` with **your own** account is enough — you can read your teammates' PRs just as you do in the browser. If your organisation uses SAML SSO, authorise the token for the org when GitHub asks.

## Install

```bash
npx showship
```

The installer asks a few questions (↑/↓ to choose, Enter to confirm, ← or Esc to go back a step and change an earlier answer):

```
? Which agent do you want to install for?
❯ Claude Code   ~/.claude/skills
  Codex         ~/.codex/skills · experimental
  Antigravity   ~/.gemini/config/skills · experimental
  Other agents  ~/.agents/skills — shared folder read by several agents · experimental

? Where do you want to install it?
❯ Global        all projects       ~/.claude/skills/showship
  This project  this folder only   ./.claude/skills/showship

? How will you use it?
❯ Team lead     report the whole team's work (everyone's commits, PRs, tasks)
  Individual    report your own work (developer, freelancer, contractor, founder)

? Who will read the report?
❯ Business      management, PMs, clients — plain language
  Engineering   tech lead, engineering manager — technical terms OK

? How often do you report?
❯ Weekly        every week (default)
  Biweekly      every two weeks
  Sprint        per sprint — length set by sprintDays (default 14)
  Monthly       once a month
  Custom        you give the dates each time

? Which project / task management tool does your team use?
❯ None          git commits + GitHub PRs only
  Lark · Jira Cloud · Linear · Asana · ClickUp · Custom (MCP)

? Which deck design do you want?
❯ Classic       black & white editorial · serif headings · hairline rules
  Modern        dark title slides · lime accent · serif headings
  Corporate     white · navy & blue · sans-serif · page numbers
  Vivid         teal header bands · orange accent · rounded cards
  Showship      signature · colour-coded projects · gauges · ship-trail ribbons
  Paper         printed annual report · paper and ink · one colour per project
```

Then it copies the skill, records your choices in `config.json` (keeping anything already there), installs the deck builder's dependencies, checks for `git`, `gh` and LibreOffice, and prints the setup steps for the tracker you picked.

| Agent                         | Global folder                      | Project folder              |
| ----------------------------- | ---------------------------------- | --------------------------- |
| Claude Code                   | `~/.claude/skills/showship`        | `./.claude/skills/showship` |
| Codex _(experimental)_        | `~/.codex/skills/showship`         | `./.agents/skills/showship` |
| Antigravity _(experimental)_  | `~/.gemini/config/skills/showship` | `./.agents/skills/showship` |
| Other agents _(experimental)_ | `~/.agents/skills/showship`        | `./.agents/skills/showship` |

**Without prompts** (CI, scripts, or if you already know what you want):

```bash
npx showship --yes                                   # Claude Code, global, weekly
npx showship --agent codex --project                 # Codex, this project
npx showship --yes --period sprint --tasks jira --style corporate
```

| Option                   | Effect                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| `--agent <id>`           | `claude`, `codex`, `antigravity` or `agents`                       |
| `--global` / `--project` | install for your user / for the current project only               |
| `--period <p>`           | `weekly`, `biweekly`, `sprint`, `monthly`, `custom`                |
| `--tasks <tool>`         | task tracker: `none`, `lark`, `jira`, `linear`, `asana`, `clickup`, `mcp` |
| `--mcp-server <name>`    | with `--tasks mcp`: the MCP server to read tasks from (plus `--mcp-name`, `--mcp-lists "A, B"`, `--mcp-instructions "…"`) |
| `--style <name>`         | deck design: `showship`, `paper`, `classic`, `modern`, `corporate`, `vivid` |
| `--role <role>`          | `lead` (whole team) or `member` (your own work)                    |
| `--audience <a>`         | `business` (plain language) or `engineering`                       |
| `--dir <path>`           | install into a custom skill folder                                 |
| `-y`, `--yes`            | don't ask; defaults for anything not given                         |
| `--skip-deps`            | skip `npm install` for the deck builder                            |
| `--uninstall`            | remove the skill (backs up `config.json` first)                    |

### Updating

Run the installer again with `@latest`. Without it, `npx` may reuse an older copy from its cache.

```bash
npx showship@latest                # asks again, with your current answers pre-selected
npx showship@latest --yes          # no questions: update the files, keep every setting (Claude Code, global)
npx showship@latest --yes --agent codex      # same for another agent: codex, antigravity or agents
npx showship@latest --yes --project          # installed into a project? run this inside that project
```

Your `config.json` (company, logo, team, tracker, style…) and `node_modules` are kept; only the skill files are replaced, and the previous ones are backed up to `~/.showship/backups/<timestamp>/`. Restart your agent afterwards: skills are loaded when a session starts. The installer prints the version it installs; `npm view showship version` shows the newest one.

**You are told when there is an update.** The skill records the version it was installed with (`VERSION` in the skill folder). At the start of a session the agent looks up the newest release on npm (one request, only the package name is sent) and, if yours is older, tells you the exact command to run (`npx showship@<version> --yes`). You can ignore it and carry on; it is shown again next session until you update. Set `"updateCheck": false` in `config.json` to turn it off. Installs made before this feature (up to `0.1.0-beta.10`) have no `VERSION` file, so they only start checking after one manual update.

To try the latest code on GitHub before it reaches npm: `npx github:Soe-Moe/showship`.

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/Soe-Moe/showship.git
cp -r showship/skill ~/.claude/skills/showship        # or your agent's skills folder
cd ~/.claude/skills/showship/scripts && npm install
```

</details>

## Quick start

```bash
cd ~/code/clinicbook-api
claude            # or: codex, antigravity
```

> Collect this week's commits and PRs for Showship

On first use the agent creates `config.json` and asks for anything the installer didn't set: your role, audience, reporting period, company, logo, presenter name, where to store reports and who's who. Then it collects the repo, writes a draft and shows you what it found. Repeat in each repo that had work in the period, then:

> Build the report

The agent merges the drafts, asks one consolidated question (progress percentages, blockers outside GitHub, non-code work), runs the jargon check and writes the `.pptx` into the report folder.

You can talk to it in any language — e.g. _"ဒီတစ်ပတ် report အတွက် collect လုပ်ပေး"_ works just as well.

## Usage examples

Everything is driven by plain requests to your agent — in English or your own language.

### Team lead — weekly team report

```text
# in each repo the team worked on this week
> Collect this week's commits and PRs for the report

# the agent asks what GitHub can't tell it — answer in a sentence:
> The booking calendar is at 40%. We're waiting on the SMS provider to approve
  our sender name. Exclude Sam, he's on leave.

# once all repos are collected
> Build the report
```

### Sprint review

```text
# config: period "sprint", sprintDays 14
> Collect sprint 14 for the report
> Build the sprint 14 report — add a slide on what moved to sprint 15
```

### Developer — "what did I do this week" for my tech lead

```text
# config: role "member", audience "engineering"
> Collect my work this week for the report        (run in each repo you touched)
> Build my report — keep it to 5 slides
```

Only your own commits, the PRs you authored or reviewed, and your tasks are collected.

### Freelancer — monthly client update

```text
# config: role "member", audience "business", period "monthly", style "corporate"
> Collect September's work for the client report
> Build the report for Acme — they don't know what an API is, keep it simple
> Add a slide asking the client to approve the new booking screen design
```

### Different time ranges

```text
> Collect the last two weeks — I skipped last Friday's report
> Make a monthly summary for September from all repos
> Collect from Oct 1 to Oct 9 only
```

### Editing the deck

```text
> Change slide 4's title to "Reminders: Ready for Release"
> Use the vivid style this time
> Move the blockers slide before the phase breakdown
> Add a timeline slide for the App Store setup: blocked → documents sent → approved
> The Clinic Dashboard track is 85%, not 80% — fix it everywhere
> Remove the team activity chart
```

### Task tracker & people

```text
> Switch the task tracker to Linear
> Only include the ENG and MOBILE teams from Linear
> "nina-dev" on GitHub is Nina Rao, show her as "Nina Rao @Nina"
> Leave Sam out of all reports from now on
```

### Quality and language

```text
> Run the jargon check and fix anything a non-technical manager wouldn't understand
> Make the deck for engineers this time — keep the technical terms
> Write the slides in Japanese
```

### Re-using past reports

```text
> Rebuild the last report in the corporate style
> Compare this sprint with the last one — what moved, what's still stuck?
> Show me what's been blocked for more than two weeks
```

## Configuration

`<skills folder>/showship/config.json` (created on first run from [`config.example.json`](https://github.com/Soe-Moe/showship/blob/master/skill/config.example.json)):

```jsonc
{
  "role": "lead", // lead = whole team · member = your own work
  "audience": "business", // business = plain language · engineering = technical OK
  "period": "sprint", // weekly | biweekly | sprint | monthly | custom
  "sprintDays": 14, // sprint length (period "sprint")
  "company": "Acme Digital Co., Ltd.",
  "presenter": "Maya Lin @Maya", // title slide
  "closingPresenter": "Maya Lin", // closing slide
  "logo": "~/Pictures/acme-logo.png", // SVG/PNG/JPG; borders trimmed automatically; false = none
  "style": "corporate", // deck design: showship | paper | classic | modern | corporate | vivid
  "updateCheck": true, // true (default) = the agent tells you once per session when a newer Showship exists; false = never check
  "theme": {
    "dark": "141412",
    "accent": "A8CC3A",
    "accentLight": "D6E6A0",
    "warning": "E0A33A",
  },
  "deckLanguage": "English",
  "reportsDir": "~/Showship",

  "leadLogins": ["maya-lin", "Maya Lin"], // YOUR git name(s) + GitHub login: your reviews are tagged (LEAD);
  // in member mode they also select your commits, PRs and tasks
  "team": {
    // git author names AND GitHub logins → display names
    "Leo Park": "Leo Park @Leo",
    "leo-park": "Leo Park @Leo",
    "nina-dev": "Nina Rao @Nina",
    "maya-lin": "Maya Lin @Maya",
  },
  "projects": {
    // local repo folder name → project/service name
    "clinicbook-api": "Booking Service - ClinicBook",
    "pulseboard-web": "Web App - PulseBoard",
  },
  "tasks": {
    // your task tracker — see "Task tracker integrations"
    "provider": "jira", // none | lark | jira | linear | asana | clickup
    "jira": { "baseUrl": "https://acme.atlassian.net", "projects": ["CLINIC"] },
  },
  "taskUsers": { "nina@acme.io": "Nina Rao @Nina" }, // tracker ids / emails / names → display names
  "exclude": { "people": ["former-member", "ou_yyyy"] }, // left out of every count and slide
}
```

Tips:

- **Reporting period** — the range starts the day after your previous report (the newest folder in `reportsDir`); with no earlier report it uses the period's default (7 days, 14 days, `sprintDays`, or the calendar month). Whatever range you name in chat wins.
- **Git name vs. GitHub login** — `git config user.name` ("Maya Lin") is just a label on commits; PRs and comments use the GitHub login ("maya-lin"). Map both. Find them with
  `git log --format='%an' | sort -u` and `gh pr list --state all --limit 50 --json author --jq '.[].author.login' | sort -u`.
- **Project names** are per repo/service; on slides the agent groups them by product and track (e.g. "ClinicBook · Clinic Dashboard").
- Unknown names? The agent asks once and adds them.

## Task tracker integrations

Commits and PRs show what was _built_; the task tracker shows what was _planned_ — phases, subtasks, owners, due dates. With a tracker configured, the agent collects it once per report into `<report>/tasks.md` and uses it for "who is doing what", subtask-based progress ("4 of 5 parts done"), overdue risks and the Developer Task Track slide. The digest looks the same whichever tool you use.

Pick the tool in the installer, or set `tasks.provider` in `config.json` yourself at any time:

| Tool           | `provider` | Settings in `config.json`                                                                         | Credentials (environment)                                                                                      |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Jira Cloud** | `jira`     | `tasks.jira.baseUrl`, `tasks.jira.projects` (keys), optional `tasks.jira.jql`                     | `JIRA_EMAIL`, `JIRA_API_TOKEN` — [create a token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| **Linear**     | `linear`   | optional `tasks.linear.teams` (team keys)                                                         | `LINEAR_API_KEY` — Settings → Security & access → Personal API keys                                            |
| **Asana**      | `asana`    | `tasks.asana.projects` (project gids from the URL)                                                | `ASANA_TOKEN` — Settings → Apps → Developer apps → Personal access tokens                                      |
| **ClickUp**    | `clickup`  | `tasks.clickup.lists` (list ids from the URL), or `tasks.clickup.workspaceId` + optional `spaces` | `CLICKUP_TOKEN` — Settings → Apps → API Token                                                                  |
| **Lark**       | `lark`     | optional `tasks.lark.tasklists`                                                                   | `lark-cli` signed in as you                                                                                    |
| **Any tool via MCP** | `mcp` | `tasks.mcp.name`, `tasks.mcp.server`, optional `lists` and `instructions` — see [below](#custom-tool-via-mcp) | the MCP server's own connection                                                                    |
| —              | `none`     |                                                                                                   | git + GitHub only                                                                                              |

```bash
# ~/.zshrc (or ~/.bashrc) — so your agent sees them; never put tokens in config.json
export JIRA_EMAIL="you@acme.io"
export JIRA_API_TOKEN="…"
```

What gets collected: every open task plus everything completed in the period, grouped by assignee, with nested subtasks (Jira child issues & sub-tasks, Linear sub-issues, Asana/ClickUp/Lark subtasks), subtask counts and overdue flags. Canceled Linear issues are skipped; people in `exclude.people` are left out. Map tool users to display names in `taskUsers` (by id, email or name).

Try it directly:

```bash
node ~/.claude/skills/showship/scripts/collect_tasks.js 2026-10-03 2026-10-09
node ~/.claude/skills/showship/scripts/collect_tasks.js 2026-10-03 2026-10-09 --provider linear
```

### Custom tool via MCP

Using Notion, Monday, GitHub Projects, Trello, Jira Server or an in-house tracker? If your agent can reach it through an MCP server, pick **Custom (MCP)** in the installer. It then asks (all optional, Enter to skip) which MCP server holds your tasks (with Claude Code it lists the servers you already have), the tool's name for the report, which boards or databases to read, and how to read status and assignee in that tool. Without prompts:

```bash
npx showship --yes --tasks mcp --mcp-server notion --mcp-name Notion --mcp-lists "Sprint board"
```

It writes this to `config.json`, which you can also edit by hand:

```jsonc
"tasks": {
  "provider": "mcp",
  "mcp": {
    "name": "Notion",                       // shown in the report
    "server": "notion",                     // the MCP server your agent has connected
    "lists": ["Sprint board"],              // optional: boards / databases / projects to read
    "instructions": "Status 'Done' means done; the 'Owner' property is the assignee."   // optional
  }
}
```

1. Connect the tool's MCP server to your agent (Claude Code: `claude mcp add …`; Codex and Antigravity: their MCP settings).
2. Collect as usual. The agent reads open tasks and the tasks completed in the period through MCP (read-only: it never creates or edits anything), saves them to `<report>/tasks.mcp.json`, and runs the collector on that file:

   ```bash
   node ~/.claude/skills/showship/scripts/collect_tasks.js 2026-10-03 2026-10-09 --provider mcp --input tasks.mcp.json
   ```

3. From there it works like every other tracker: the same digest, `taskUsers` mapping, exclusions and Developer Task Track slide.

The file format (forgiving about field names) is documented in [`tasks/mcp.js`](https://github.com/Soe-Moe/showship/blob/master/skill/scripts/tasks/mcp.js), so you can also export tasks from any tool yourself and pass them with `--input`.

Want a built-in collector for another tool instead? Add a file in `skill/scripts/tasks/` that returns the normalized rows described in [`tasks/common.js`](https://github.com/Soe-Moe/showship/blob/master/skill/scripts/tasks/common.js), register it in `collect_tasks.js` — PRs welcome.

## The workflow

| Step | You say                                                                  | The agent does                                                                                                                     |
| ---- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1    | _"Collect this week's commits and PRs for the report"_ (in each repo)    | runs `collect_commits.sh` + `collect_prs.sh`, analyzes PRs and reviews, writes `<report>/<repo>.md`, shows a summary and questions |
| 2    | answers, extra info ("Phase 3 is at 40%", "waiting on the SMS provider") | records it in `<report>/notes.md`                                                                                                  |
| 3    | _"Build the report"_                                                     | plans slides, writes `report.json`, runs the jargon check, builds and visually checks the deck                                     |
| 4    | _"Change the title on slide 4"_, _"add a decision about X"_              | edits `report.json`, rebuilds                                                                                                      |

Standing instructions (people to exclude, how to count progress, environments) can go in `notes.md`; the agent re-reads the previous report's notes.

## Deck styles

Six designs, chosen to read well in a business meeting. Every slide type works in every style, from the same `report.json`.

**Showship**: the signature style. Every project gets its own colour, carried from the dashboard to the phase tracks, task tracker and next-steps table, so the audience can follow a project by colour alone. Semicircle gauges, pill-track phase charts, a waffle of done/open tasks, a milestone trail for timelines, and the ship-trail ribbons on title slides. Uses the free [Poppins](https://fonts.google.com/specimen/Poppins) font (PowerPoint substitutes it if it isn't installed). A small "Shipped with Showship" mark sits in the footer; turn it off with `"signature": false` in `config.json` or `report.json`.
![Showship](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/style-showship.png)

<sub>All Showship slides: [preview](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/showship-grid.png) · [example deck](https://github.com/Soe-Moe/showship/raw/master/docs/example-deck-showship.pptx)</sub>

**Paper**: set like a printed annual report. Paper background and navy ink, rules instead of cards, one big figure leading every slide, one colour per project, coral red kept for risks only. Every slide type has its own composition. Design brief: [`DESIGN.md`](https://github.com/Soe-Moe/showship/blob/master/DESIGN.md).
![Paper](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/style-paper.png)

<sub>All Paper slides: [preview](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/paper-grid.png) · [example deck](https://github.com/Soe-Moe/showship/raw/master/docs/example-deck-paper.pptx)</sub>

**Classic** — black & white editorial with its own layouts: no boxes, a lede column for the key message, large serif figures, numbered entries, a vertical timeline, phase lists instead of bar charts, heavy and hairline rules, one deep green accent
![Classic](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/style-classic.png)

**Modern** — dark title slides, lime accent, serif headings, soft cards
![Modern](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/style-modern.png)

**Corporate** — white with a navy panel, blue accent, clean sans-serif, footer with page numbers
![Corporate](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/style-corporate.png)

**Vivid** — teal header band on every slide, orange accent, rounded cards
![Vivid](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/style-vivid.png)

Set it once in `config.json` (`"style": "vivid"`), in the installer (`--style vivid`), or for a single report with `"style"` in that report's `report.json`. `theme` colours still override the style's palette, so you can keep a layout and use your brand colours.

## Slide templates

<sub>Shown in the Showship style.</sub>

| Template          | Use it for                                               |                                                                                               |
| ----------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `dashboard`       | executive summary: one KPI card per project + key update | ![](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/slide-dashboard.png)       |
| `phase_bars`      | phase-by-phase completion per track, with owners         | ![](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/slide-phase-bars.png)      |
| `review_insights` | what code review verified and caught before release      | ![](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/slide-review-insights.png) |
| `attention`       | blockers & risks + decisions needed from the business    | ![](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/slide-attention.png)       |
| `tracker`         | developer task track: done/open, progress, focus         | ![](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/slide-tracker.png)         |
| `table`           | next period's plan with owners and status                | ![](https://raw.githubusercontent.com/Soe-Moe/showship/master/docs/slide-next-steps.png)      |

Also: `timeline`, `rings` (doughnut charts), `workstreams`, `rows` (with generated hub-and-spoke illustrations or screenshots), `gallery` (UI screenshots), `activity` (team throughput chart). Every field is described in [`skill/references/templates.md`](https://github.com/Soe-Moe/showship/blob/master/skill/references/templates.md) and defined as a JSON Schema in [`skill/references/report.schema.json`](https://github.com/Soe-Moe/showship/blob/master/skill/references/report.schema.json). `lint_report.js` checks `report.json` against it (wrong or missing fields, bad values, text too long for its slot, typos with a "did you mean" hint), and editors that support JSON Schema give autocomplete.

You can also build a deck directly:

```bash
node ~/.claude/skills/showship/scripts/build_deck.js report.json out.pptx
node ~/.claude/skills/showship/scripts/lint_report.js report.json   # plain-language and structure check (validates against report.schema.json)
node ~/.claude/skills/showship/scripts/check_deck.js out.pptx --png  # render and check every slide
```

### Layout check

Every deck is rendered with LibreOffice and each slide is checked for text that crosses the slide margins or collides with other text. The slide images land in `out-qa/` so you (and the agent) can look at them. The check needs [LibreOffice](https://www.libreoffice.org/) and poppler (`brew install poppler`), plus the deck's fonts installed on the machine; without them it reports that it could not render. `lint_report.js` also fails text that is longer than its slide slot (character limits in [`templates.md`](https://github.com/Soe-Moe/showship/blob/master/skill/references/templates.md)), so overflow is caught before the build.

## Getting the most out of code reviews

Showship is at its best when the lead writes structured reviews. Any format works, but sections like these map directly onto the deck:

```markdown
# Code Review: clinicbook-api PR #12 — CB-88, Phase 4: Appointment Reminders

## Summary → what the feature does (business value)

## Verification → "all 212 automated tests pass"

## Subtask Coverage → ✅ 4 / ⚠️ 1 → "4 of 5 parts verified", suggested ~80%

## Critical / Blocker → "fix needed before release" (described by user impact)

## Product/Policy Decision Needed → "Decisions Needed" slide

## Verdict → APPROVED / NEEDS WORK → status
```

Code, file paths, error codes and raw comments never reach the slides, and problems are attributed to the work, not to people. See the worked example in [`skill/references/translation_guide.md`](https://github.com/Soe-Moe/showship/blob/master/skill/references/translation_guide.md).

## Privacy

- The only network call that is not your own GitHub or tracker access is the update check: `npm view showship dist-tags` at the start of a session. Turn it off with `"updateCheck": false`.
- Everything runs locally. Data is read through `git`, `gh` (GitHub API, your credentials) and optionally your task tracker's API (Jira, Linear, Asana, ClickUp) or `lark-cli`; drafts and decks are written to your reports folder.
- Tracker tokens are read from environment variables only and are never written to config or report files.
- Your AI agent processes the collected text as part of your session, like any other file you open with it.
- `config.json` (names, ids, paths) and generated reports are git-ignored and excluded from the npm package.

## Troubleshooting

| Problem                                                   | Fix                                                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "PR data skipped"                                         | install `gh` and run `gh auth login`; check `gh pr list` works inside the repo                                                                                                   |
| Teammates' commits missing                                | they need to push their branches; the collector reads all remote branches after `git fetch --all`                                                                                |
| Your review comments not tagged `(LEAD)`                  | add your GitHub login to `leadLogins`                                                                                                                                            |
| A name shows as a raw login                               | add it to `team` (git/GitHub) or `taskUsers` (tracker)                                                                                                                           |
| "Task digest — Not collected"                             | the digest says what's missing: a token in your environment, or `tasks.<tool>` settings in `config.json`                                                                         |
| Jira returns HTTP 401/403                                 | check `JIRA_EMAIL` matches the token's account and that you can see the projects in the browser                                                                                  |
| The agent doesn't pick up the skill (Codex / Antigravity) | check the folder in the [install table](#install), restart the agent, and ask it "what skills are available?" — then [open an issue](https://github.com/Soe-Moe/showship/issues) |
| `npm audit` warning about `image-size`                    | the package pins a patched version via `overrides`; delete `node_modules` and `package-lock.json` in `scripts/` and run `npm install` again                                      |
| Fonts look different                                      | Showship and Paper use Poppins + Arial, Classic and Vivid use Georgia + Arial, Modern uses Cambria + Calibri, Corporate uses Arial; install the one your style needs or PowerPoint substitutes it |
| `sharp` fails to install                                  | `cd <skills folder>/showship/scripts && npm rebuild sharp`                                                                                                                       |

## Repository layout

```
bin/install.js            npx installer
skill/                    the agent skill (copied to <skills folder>/showship)
  SKILL.md                instructions the agent follows
  config.example.json
  scripts/                collect_commits.sh · collect_prs.sh · collect_tasks.js
                          build_deck.js · lint_report.js · check_deck.js
                          render_pdf.js · make_previews.js · schema.js
    tasks/                common.js · jira.js · linear.js · asana.js · clickup.js · lark.js
  references/             templates.md · report.schema.json · translation_guide.md · design_rules.md
  examples/               report.example.json
  assets/logo.svg         default logo (the Showship mark)
docs/                     preview images and example decks (regenerate: node skill/scripts/make_previews.js)
```

## Contributing

Issues and pull requests are welcome — new slide templates (read [`design_rules.md`](https://github.com/Soe-Moe/showship/blob/master/skill/references/design_rules.md) first; run `check_deck.js` on every style and refresh the `docs/` images with `make_previews.js`), collectors for other trackers (Trello, GitHub Projects, Notion, Monday), better jargon rules, more languages, and reports from Codex / Antigravity users.

## License

[MIT](https://github.com/Soe-Moe/showship/blob/master/LICENSE) © Soe Moe Oo
