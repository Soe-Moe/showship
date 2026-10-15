---
name: showship
description: Showship — show what you shipped. Build a progress report deck (weekly, biweekly, sprint, monthly or any date range, with your company's logo and colours) from GitHub activity — for a team lead reporting the whole team to business, PMs and the CTO, or for any individual (developer, freelancer, contractor, founder) reporting their own work to a manager, tech lead or client. Sources: git commits, pull requests, code reviews and PR comments, plus tasks from Jira, Linear, Asana, ClickUp or Lark. Run it inside any repo to collect that repo's commits and PRs for the period and analyze them, then build a PowerPoint deck (plain language for business, or technical for engineers) from all collected repos plus the user's notes. Use this whenever the user mentions Showship, a weekly / biweekly / sprint / monthly report, report slides, progress report, status report for the boss/CTO/PM/business/client, "what did I do this week/sprint/month", "this week's report" (in any language), collecting the period's commits, PRs or tasks (Jira, Linear, Asana, ClickUp, Lark), or summarizing team progress from git/GitHub — even if they don't name the skill.
---

# Showship — show what you shipped (GitHub activity → business-friendly deck)

## Update check

Do this once at the start of every session in which this skill is used, before the user's task. It never blocks the task.

1. Read `<skill folder>/config.json`. If `updateCheck` is `false`, skip this whole section. If the key is missing, treat it as `true`.
2. Read the installed version from `<skill folder>/VERSION` (one line, e.g. `0.1.0-beta.10`). If the file does not exist, the install predates update checks: treat the installed version as unknown and older than any release.
3. Look up the newest release: `npm view showship dist-tags --json` (give it about 10 seconds). Take the highest version among all the tags' values, comparing dot-separated parts as numbers (so `0.1.0-beta.10` is newer than `0.1.0-beta.9`, and a release without a pre-release suffix is newer than the same number with one). If the command fails, times out, or `npm` is missing, skip silently: do not mention the check, do not retry, do not ask the user to fix anything.
4. If the newest version is higher than the installed one (or the installed one is unknown), tell the user once, in their language and in at most three lines:
   - Showship `<newest>` is available (installed: `<installed>`).
   - To update, run `npx showship@<newest> --yes`, then restart the agent (skills load when a session starts). Add `--agent codex`, `--agent antigravity` or `--project` if that is how it was installed.
   - They can ignore this and continue, nothing breaks.
   Then carry on with what they asked, using the installed version. If they ask you to run the update, run that command, then tell them to restart the agent and stop (do not continue the task in the old session on half-replaced files).
5. Say it once per session, not before every step. Do not remember that they skipped: the next session shows it again until they update or set `updateCheck` to `false` in `config.json`.
6. The lookup sends only the package name to the npm registry. Nothing from the user's repos, reports or config leaves the machine.

## Reporting period

Config `period` sets the default rhythm; the user can override it in any request ("last two weeks", "September", "Oct 1 to Oct 9", "sprint 14").

| `period`             | Default range when there is no earlier report                                                             | Deck title (default)                 | "Next …" slide     |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------ |
| `weekly` _(default)_ | last 7 days                                                                                               | Weekly Development Progress Report   | Next Week's Plan   |
| `biweekly`           | last 14 days                                                                                              | Biweekly Development Progress Report | Next Two Weeks     |
| `sprint`             | last `sprintDays` days (default 14); ask the sprint number once and pass it as `report.json` → `"sprint"` | Sprint N Progress Report             | Next Sprint's Plan |
| `monthly`            | the current calendar month to date — or the previous month if the report is made in its first 5 days      | Monthly Development Progress Report  | Next Month's Plan  |
| `custom`             | ask the user for the dates                                                                                | Development Progress Report          | Next Steps         |

When an earlier report exists, the range starts the day after the newest report folder's date. Wording on slides and in drafts follows the period ("this sprint", "this month", "next week"). Below, "period" means whichever of these applies.

## Who this is for — role and audience

Two settings in config decide whose work is reported and how technical the deck may be. Ask on first setup if they aren't set.

**`role`**

- `lead` _(default)_ — a team lead reporting **the whole team**: everyone's commits, PRs and tasks; owners per track; the lead's code reviews (`leadLogins`, tagged `(LEAD)`) are the most authoritative source.
- `member` — an individual reporting **their own work** (developer, designer-developer, freelancer/contractor to a client, solo founder to investors). Collect only the user's own commits, PRs they're involved in, and their own tasks. Reviews they _received_ explain status and fixes; reviews they _gave_ count as their contribution. Present in the first person plural or neutral voice ("Delivered…", "In progress…"), never as a ranking against others.

**`audience`**

- `business` _(default)_ — business people, PMs, management, clients. Write for the least technical person in the room; technical terms only in brackets when they add something.
- `engineering` — a tech lead, engineering manager or engineering team. Technical terms (API, schema, refactor, PR, test coverage) are fine and expected, but every item still states the outcome. Code, file paths and raw comments still never go on slides.

Whatever the role, the deck answers the same questions — adapt the wording:

1. **What was worked on?** (projects and features)
2. **What was delivered / reached?** (done, released, approved, merged)
3. **How far along is it?** (percent, phases)
4. **Who is doing what?** (owners — for `member`, just the user, or omit)
5. **What is blocked, and what is needed from the audience?** (blockers, risks, decisions, help needed)
6. **What happens next period?** (next week / sprint / month)

You may add, restructure and polish to make the presentation stronger — but never invent facts, numbers, owners or dates.

**Language:** reply in whatever language the user writes in. Write **all slide content in the deck language** — config `deckLanguage`, default English — and the drafts (`<repo>.md`), `notes.md` and `report.json` too, since they feed the deck. Translate anything the user tells you into clear business language in the deck language.

## Two modes

The set of repos changes from period to period, so work is split per repo:

1. **collect** — run inside one repo. Reads the period's commits and pull requests (descriptions, reviews, replies, comments) and writes an analyzed, business-language draft for that repo into the report folder. Repeat in each repo that had work in the period.
2. **build** — run anywhere. Merges every draft plus the user's notes, asks for anything missing, checks the language, and produces the deck.

If the user just says "make this week's report" (or this sprint's / month's) inside a repo, do **collect** for that repo, then ask whether other repos should be collected before building.

## Setup (first run only)

- Dependencies: `cd <skill>/scripts && npm install`. Check for `node_modules` before installing.
- GitHub CLI: check `gh auth status`. If missing or logged out, tell the user to run `brew install gh` and `gh auth login` (the user logs in with their own account; that is enough to read the team's PRs). Until then, collect commits only and note that PR data was skipped.
- Config: `<skill>/config.json`. If it is missing, or exists but lacks `presenter` / `reportsDir` (the installer may have written only the `tasks` section), merge in `<skill>/config.example.json` without losing existing keys, ask where reports should be stored, and confirm the values. Fields:
  - `reportsDir` — where report folders live (any path, `~` allowed; default `~/Showship`). `<reports>` below means this path, expanded.
  - `period` — `weekly`, `biweekly`, `sprint`, `monthly` or `custom`; `sprintDays` — sprint length in days (default 14). See **Reporting period**. Ask on first setup if it isn't set.
  - `presenter` (title slide), `closingPresenter` (closing slide), `company`
  - `logo` — path to the company logo (SVG, PNG or JPG, `~` allowed; borders are trimmed automatically; `false` for none). Default: the Showship mark in `assets/logo.svg` (used until the user sets their own logo). SVG logos are rendered at high resolution, so prefer SVG when the user has one.
  - `style` — the deck design: `showship` (signature: one colour per project across all slides, gauges, pill-track phases, ship-trail ribbons; `"signature": false` hides the footer mark), `paper` (printed annual report: paper and ink, one colour per project, coral red only for risks; `rows` illustrations are not drawn, so prefer a screenshot or plain rows), `ember` (dark graphite slides, one amber accent, flat panels, big serif figures, coral red only for risks; its own layouts; `rows` illustrations are not drawn; set it for rooms where the projector is the brightest thing; `theme.dark` recolours the whole deck, so pick a dark colour), `summit` (executive brief for a lead reporting to the CEO or boss: ink and white, one teal accent, a scoreboard dashboard with the key update as a bottom line, decisions before blockers, "page of total" on every slide, brick red only for risks; own layouts for `dashboard`, `attention` and `table`, the shared card layouts for the rest; set it when the report goes up to the boss rather than across to the team), `classic` (black & white editorial with its own layouts — lede column, large serif figures, numbered lists, vertical timeline, no boxes), `modern` (dark bookends, lime accent, serif headings), `corporate` (white, navy & blue, sans-serif, page numbers), or `vivid` (teal header bands, orange accent, rounded cards). The user chooses it — in the installer, in config, or per report via `report.json` → `"style"`. All slide types work in every style. Ask on first setup if it isn't set.
  - `theme` — optional colours (hex) that override the style's palette: `dark`, `accent`, `accentLight`, `warning`.
  - `deckLanguage` — language of the slides (default `English`).
  - `role` — `lead` (whole team) or `member` (own work only); `audience` — `business` or `engineering`. See **Who this is for**.
  - `leadLogins` — the user's own git author names and GitHub logins (e.g. `"maya-lin"`, `"Maya Lin"`, `"maya@acme.io"`). In `lead` mode their comments are tagged `(LEAD)` as the reviewer; in `member` mode they also select which commits, PRs and tasks are the user's.
  - `team` — maps **both** git author names **and** GitHub logins to display names (e.g. `"nina-dev": "Nina Rao @Nina"`). When you meet an unmapped name, ask once and add it.
  - `projects` — maps local repo folder names to project/service names (e.g. `"clinicbook-api": "Booking Service - ClinicBook"`). On slides, group by product and track (e.g. "ClinicBook · Clinic Dashboard"), not by repo.
  - `tasks` — the team's project/task management tool (see **Task tracker**): `provider` is `none`, `lark`, `jira`, `linear`, `asana`, `clickup` or `mcp` (any other tool reached through an MCP server, see **Custom tool via MCP**), plus that tool's settings (e.g. `tasks.jira.baseUrl`, `tasks.jira.projects`). The user chooses it — in the installer or by editing config. If `tasks` is absent but `larkUsers` exists, Lark is assumed.
  - `taskUsers` — maps tracker user ids, emails or names → display names (`larkUsers` and `team` are also consulted). Unknown people fall back to their name in the tool; when that happens, ask whether to add them.
  - `exclude.people` — people left out of the report entirely: tracker ids/names/emails, git author names or GitHub logins. Apply it everywhere — tasks, commits, PRs, activity counts and slides.
- Task tracker credentials come only from environment variables — `JIRA_EMAIL` + `JIRA_API_TOKEN`, `LINEAR_API_KEY`, `ASANA_TOKEN`, `CLICKUP_TOKEN`; Lark uses `lark-cli` signed in as the user; `mcp` uses the MCP server's own connection. Never write tokens into config.json or any report file. If collection fails for setup reasons, tell the user what to set and continue without task data.

## Report folder

`<reports>/<YYYY-MM-DD>/`, named for the report date (today by default). `<dir>` below means this folder:

- `<repo>.md` — analyzed draft per repo
- `raw/<repo>-commits.md`, `raw/<repo>-prs.md` — raw collector output
- `tasks.md`, `tasks.json` — the period's task digest from the configured tracker (one per report; older folders may have `lark-tasks.md`)
- `notes.md` — the user's own additions (create it when they give extra info)
- `report.json` — the deck spec
- `<Period>_Progress_Report_<YYYY-MM-DD>.pptx` — the output, e.g. `Weekly_Progress_Report_2026-10-09.pptx`, `Sprint_14_Progress_Report_2026-10-09.pptx`, `Monthly_Progress_Report_2026-09-30.pptx`

## Mode 1: collect

1. Confirm you are in a git repo. Range as `YYYY-MM-DD`: from the day after the previous report date (newest folder in `<reports>/`), else the default range for `period` (see **Reporting period**); until today. A range the user names always wins.
2. Run both collectors and save the output, then read both files fully (in chunks — lead reviews are long):
   - `mkdir -p <dir>/raw && bash <skill>/scripts/collect_commits.sh <since> <until> > <dir>/raw/<repo>-commits.md`
   - `SHOWSHIP_LEAD_LOGINS="<leadLogins, comma-separated>" bash <skill>/scripts/collect_prs.sh <since> <until> > <dir>/raw/<repo>-prs.md`
     In **`member`** mode, restrict both to the user: prefix the commit collector with `SHOWSHIP_AUTHORS="<the user's git names/emails from leadLogins>"` and the PR collector with `SHOWSHIP_INVOLVES="<the user's GitHub login>"` (PRs they authored, reviewed, commented on or were assigned).
     The PR digest contains each PR's status, branch, size, full description and the period's discussion in chronological order, with the user's (lead's) comments tagged **(LEAD)**.
3. Map names with config. Map the repo to a project (config, else ask once).
4. Analyze — see **Reading the lead's reviews** and `references/translation_guide.md`. PRs are the backbone (one PR ≈ one feature or phase); commits fill in work that has no PR yet.
5. Write `<dir>/<repo>.md`:

```markdown
# <Project name> (<repo>)

Range: <since> → <until> · <N> commits · <M> PRs with activity

## Features this period

### <Phase / feature in plain words> — <Owner display name>

- Plan reference: <tracker task id/key, phase name as in the plan>
- What it does for users/business: <one or two plain sentences>
- Status: Delivered | Approved, ready to release | In review — fix needed | In development
- Progress evidence: <e.g. "4 of 5 subtasks verified by lead review"; lead's verdict>
- Quality: <verified strengths, in plain words; automated tests result>
- Fix needed before release: <plain description of the effect, size of fix, owner> (or "none")
- Decisions needed from business: <question + context + options> (or "none")
- Deferred / follow-up: <out-of-scope items, tech debt — usually not for the deck>

## Activity (for charts)

| Person | Commits | PRs opened | PRs merged | Reviews given |

## Suggested status & percent

- <feature>: <status>, suggested <x>% because <evidence> — lead to confirm

## Questions for the lead

- <percent to confirm, blockers outside GitHub, anything unclear>
```

6. Show the user a short summary (in their language) of what you found and the questions. Do not build yet unless asked.

## Task tracker (once per report)

The team's project/task management tool holds the plan: projects, phases (tasks/issues/epics) and their subtasks, with assignees, due dates and completion dates. The tool is whatever the user configured in `tasks.provider`: Jira, Linear, Asana, ClickUp, Lark, a custom tool through MCP, or `none`. Collect it once per report; it covers the configured lists/projects/teams, not one repo:

```
node <skill>/scripts/collect_tasks.js <since> <until> --json <dir>/tasks.json > <dir>/tasks.md
```

Run it during the first **collect** of the period if `<dir>/tasks.md` doesn't exist yet, or at the start of **build**. Exit code 2 means "not configured" (provider `none`, missing token or settings) — the digest explains what to set; tell the user once and carry on with GitHub data only. To switch tools, change `tasks.provider` (or pass `--provider <tool>`). In **`member`** mode add `--people "<the user's display name>"` so only their own tasks are kept.

Every tool produces the same digest: tasks grouped by assignee (mapped through `taskUsers`, excluded people removed), completed-in-range and open tasks, nested subtasks with counts, and `OVERDUE` flags. How each tool maps:

| Tool         | "Task"                                                   | Subtasks                                               | Done =                                                                |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Lark         | task in a tasklist                                       | subtasks (nested)                                      | completed                                                             |
| Jira         | issue (epic / story / task)                              | child issues & sub-tasks in the result set             | status category Done                                                  |
| Linear       | issue                                                    | sub-issues                                             | completed (canceled is skipped)                                       |
| Asana        | task in a project                                        | subtasks (nested)                                      | completed                                                             |
| ClickUp      | task in a list                                           | subtasks (nested; earlier-closed ones kept for counts) | status type done / closed                                             |
| MCP (custom) | whatever the tool calls a task (page, item, card, issue) | nested `subtasks` you include                          | what `tasks.mcp.instructions` says, else the tool's done/closed state |

### Custom tool via MCP (`provider: "mcp"`)

For tools without a built-in collector (Notion, Monday, GitHub Projects, Trello, Jira Server, an in-house tracker), the script can't reach the tool, but you can through the user's MCP server. Config `tasks.mcp`: `name` (shown in the report), `server` (the MCP server to use), optional `lists` (boards / databases / projects to read) and `instructions` (how to read status, assignee and dates in that tool).

1. Check that the MCP server named in `tasks.mcp.server` is connected (its tools are available to you). If it isn't, tell the user once how to connect it and carry on with GitHub data only.
2. Use that server's tools **read-only**: never create, edit, move or comment on anything in the tool. Fetch every open task plus every task completed in `<since>…<until>` from `tasks.mcp.lists` (or all lists the user named), with assignee, status, completion date, start / due dates, URL and subtasks. Follow `tasks.mcp.instructions`. Page through results; don't stop at the first page.
3. Save them, exactly as the tool reports them (never invent or guess a task, person, date or status), to `<dir>/tasks.mcp.json`: an array of `{ "project", "key", "title", "url", "status": "done"|"open", "completed_at", "start", "due", "assignees": ["Name" or {name, email, id}], "subtasks": [{ "title", "done", "completed_at", "subtasks": [] }] }`. Dates as ISO strings. Leave a field out when the tool doesn't have it.
4. Run the collector on it, then use `tasks.md` like any other tracker's digest:

```
node <skill>/scripts/collect_tasks.js <since> <until> --provider mcp --input <dir>/tasks.mcp.json --json <dir>/tasks.json > <dir>/tasks.md
```

Map the tool's people to display names in `taskUsers` like any other tracker.

How to use it:

- **Who is doing what** and **what is planned** come from the tracker: each developer's tasks, phases and open work.
- **Progress evidence:** subtask counts (e.g. `[subtasks 4/5]`) give a phase's completion. Work items are the subtask leaves; a task without subtasks counts as one. "Done" counts leaves completed in the range. Use leaf counts unless the lead asks otherwise for a given report (record that in `notes.md`).
- **Cross-check with GitHub:** "done" in the tracker means the developer finished the work items; the PR review decides whether it is ready to release. A phase whose subtasks are all done but whose PR is still in review is **In review**, not Completed. Keep it open on the tracker slide until merged.
- **Match tasks to PRs** by the task id/key in the lead's review title or PR title/branch (e.g. `CB-88`, `CLINIC-42`, `ENG-12`, ClickUp custom ids) or by phase name.
- Overdue tasks (`OVERDUE`) and tasks with no assignee are candidates for the Blockers & Risks list — confirm with the lead.
- The lead's own tasks are reported like any developer's (owner = the lead's display name from `team`).

## Reading the lead's reviews

_(In `member` mode the same structure applies to reviews the user **received** from their lead — use them for status, fixes needed and decisions — and to reviews the user **gave**, which count as their contribution.)_

The lead's review comments are structured, verified write-ups and the most authoritative source in the digest. A typical review contains these sections — map each one:

| Review section                                                                                       | Use it for                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title line: repo, PR number, **task id/key**, **phase name** (e.g. "Phase 4: Appointment Reminders") | Which project, track and phase this is. Keep the task id in the draft as a reference, not on slides.                                                                                                                                                                |
| Header facts: author, branch, scope (files/lines), task/subtask status in the tracker, review date   | Owner (map the GitHub author via config), size of the change.                                                                                                                                                                                                       |
| **Summary**                                                                                          | What the feature does → rewrite as user/business value.                                                                                                                                                                                                             |
| **Verification** (test suite result, probe tables)                                                   | Quality evidence: "all 212 automated tests pass", "permissions verified". Drop the technical cases.                                                                                                                                                                 |
| **Subtask Coverage** table (✅ / ⚠️ / ❌ per subtask)                                                | **Progress evidence.** Count verified subtasks: 4 of 5 ✅ → suggest ~80% and "4 of 5 parts verified". Confirm the percent with the lead.                                                                                                                            |
| **Critical / Blocker**                                                                               | "Fix needed before release": describe the **effect on users** and the **size** of the fix ("a damaged image upload shows an error instead of a clear message; small fix, already tested"). Goes on the Blockers side of the `attention` slide if it delays release. |
| **Optional Follow-up Refactoring**                                                                   | Usually omit from the deck. At most "minor improvements planned".                                                                                                                                                                                                   |
| **Product/Policy Decision Needed**                                                                   | **Decisions Needed** on the `attention` slide: the business question, why it matters, the options. This is high value for the meeting.                                                                                                                              |
| Items the PR leaves open on purpose / already decided                                                | Omit unless they change scope.                                                                                                                                                                                                                                      |
| **Verdict** (APPROVED / NEEDS WORK / …)                                                              | Status: APPROVED → "Approved, ready to release" (or Delivered if merged); NEEDS WORK → "In review — fix needed".                                                                                                                                                    |

Developers' PR descriptions and replies tell you what was built and what has been fixed since the review — a blocker answered with "fixed" plus new commits is **resolved, pending re-review**.

Never put code, file paths, HTTP status codes, class names, test case tables or raw comments on a slide. Never attribute problems to a person ("rework requested on the image upload handling", not "Nina's code failed"). Positive callouts may name people.

## Mode 2: build

1. Read every `<dir>/*.md` (including `tasks.md`; run the task collector first if it's missing and a tracker is configured) and `notes.md`, plus what the user tells you in chat. Earlier reports' `notes.md` may hold standing instructions (exclusions, environments, how to count) — check the newest earlier folder too.
2. **Fill gaps in one consolidated question** (in the user's language): percentages to confirm, non-code work (paperwork, approvals, meetings), blockers outside GitHub, **what is planned for the next period**, anything uncertain. Never invent numbers, dates, owners or blockers; if unknown, state the status in words.
3. **State the purpose in one or two sentences before planning**, in `notes.md` or at the top of your plan: what this report is for, who reads it, and what they should know or do afterwards ("Show the CTO that Reminders is one fix from release, and get a decision on SMS opt-out"). Every slide has to serve that sentence; a slide that does not is cut or moved to a `task_detail` slide. If the purpose is unclear, add it to the consolidated question. Unclear purpose is the most common reason a report fails: too many issues pile up and the reader gets an indecisive deck.
4. **Think about the room.** For each group in the audience (business, PMs, the CTO, a client), guess the first question or objection they will have, and make sure a slide answers it: cost of a delay, who decides, what happens if nothing changes. Do not invent the answer; if it is not in the data, ask.
5. Plan the deck (below) and write `<dir>/report.json` per `references/templates.md` and `references/report.schema.json`. `date` like `October 9, 2026`; presenter values from config. Write the `dashboard` (the summary) last, once every other slide is settled, so it states what the deck actually says. It may be all some readers see.
6. **Structure, language and length check:** `node <skill>/scripts/lint_report.js <dir>/report.json --audience <business|engineering>`. It validates `report.json` against `references/report.schema.json` (wrong or missing fields, bad values, text longer than its slot) as well as checking the language: jargon, wordy phrases, passive sentences with no actor, long sentences and unexplained abbreviations. Rewrite every FIX item (for `engineering`, only code and file names are flagged); for CHECK items keep the term only if it is explained in the same sentence or is an official plan name. Re-run until there are no FIX items.
7. Build: `node <skill>/scripts/build_deck.js <dir>/report.json <dir>/<Period>_Progress_Report_<YYYY-MM-DD>.pptx`. Set `"period"` in `report.json` when it differs from config (and `"sprint"` for sprint reports) so the title matches.
8. Verify (mandatory, see `references/design_rules.md`): run `node <skill>/scripts/check_deck.js <deck>.pptx --png`. It renders the deck with LibreOffice and flags text near the slide edge or colliding. A rebuild deletes the old `<deck>-qa/` folder, so a missing folder means the deck has not been checked yet. Then open every PNG in `<deck>-qa/` and look at it for overflow, hollow cards, faded text and wrong numbers. Fix `report.json` (shorten text first) or the template, rebuild, and repeat until the script is clean and every slide looks right. If LibreOffice is missing, say the deck was not rendered and check text against the character limits instead. Re-check every number against the drafts and the user's answers.
9. **Final review, read as the audience** (once the deck renders cleanly; see `references/translation_guide.md`, "Final review checklist"). Reread every slide for ambiguity, sentences that hide who did what, claims you could not say to the reader's face, and a summary that no longer matches the slides. Fix `report.json` and rebuild. You wrote the deck, so you will miss your own slips: offer to share the deck with the lead (or another person who has not seen the drafts) for a proofread before it goes to the wider audience, and say so in step 10.
10. Tell the user (in their language) where the file is, one line per slide, and what you inferred.

## Deck design

**Narrative for `role: lead` (follows the six questions):**

1. Title (automatic)
2. `dashboard` — one card per project: headline metric, status (COMPLETED / ON TRACK / AT RISK / BLOCKED), one plain sentence; key-update strip for the single most important message (often a decision needed).
3. Per project, 1–2 slides — progress with owners (`rings` + `phase_bars` for phased work; `timeline` for something that moved through stages or a resolved blocker; `workstreams`; `rows` with an illustration or screenshot for descriptive work; `gallery` for UI screenshots). **Then a `task_detail` slide for the tasks the audience will ask about later** (see "Task detail, not just the overview" below).
4. `review_insights` (optional) — what review verified and caught before release, in plain words.
5. `attention` — Blockers & Risks + Decisions Needed. Include it whenever there is any blocker or decision; if none, a dashboard key-update line saying so is enough.
6. `tracker` — Developer Task Track: one card per person with done/open task counts from the tracker, progress %, current focus and their task list (tracker + review status). Follow it with `task_detail` slides for each person's main tasks when the list alone would not jog the audience's memory. `activity` (optional) — team throughput from GitHub; never a ranking.
7. `table` — next period's plan (Next Week's / Next Sprint's / Next Month's Plan): owner, next focus, current status.
8. Closing (automatic)

**Narrative for `role: member`** (shorter — typically 5–8 slides):

1. Title (automatic; presenter = the user; title follows the period, e.g. "Weekly Progress Report", "Sprint 14 Progress Report")
2. `dashboard` — one card per project or workstream the user touched: metric, status, one sentence; key-update strip for the most important point (often "help needed").
3. One slide per significant piece of work — `timeline`, `workstreams`, `phase_bars` (if they own phases) or `rows` with a screenshot/illustration — and a `task_detail` slide for the tasks behind it.
4. `review_insights` (optional) — reviews received and given: what was approved, what was fixed.
5. `attention` — blockers, and decisions or help needed from the manager/client.
6. `table` — next period's plan (owner column may simply be the user).
7. Closing (automatic)

Skip `tracker` and `activity` in `member` mode unless the user asks — they are team views.

**Task detail, not just the overview.** Counts, percentages and one-line items are not enough to remember a task a week later. For every task or phase that moved this period, was blocked, or that someone will ask about, write it out in business language with `task_detail` (1 to 3 tasks per slide, 2 when each task has full detail):
- `summary`: what the task is for, what the users or the business get from it, and what happened this period, in two or three plain sentences. Not a restatement of the title.
- `points`: its subtasks or concrete steps from `tasks.md`, the drafts and the lead's reviews, each in plain words with its own state (done, in progress, not started, blocked). Keep the plan's own order. Include what is left, not only what is done.
- Include owner, status word and, when known, the reason for a delay or a decision it waits on. Never invent details: if the tracker or drafts do not say, leave it out or ask.
- Do not drop detail to make it fit. Split the task list across more slides (each project may need two or three), group related subtasks into one point, or move a long task to its own slide with one task (which gives its steps the whole width).
- **Plan the `task_detail` slides per repo.** Each collected repo's draft (`<dir>/<repo>.md`) and its tracker tasks belong to one project, so count that project's tasks that matter and decide how many slides it needs:
  - 1 to 3 tasks: one `task_detail` slide for that project.
  - 4 or more: split into several slides of 2 or 3 tasks each, in the plan's order (or by track or owner), with the same `project` and an eyebrow that says which part ("ClinicBook · Patient App, part 2 of 3"). Do not squeeze them into one slide.
  - A repo with a single, large task (many subtasks): give it its own slide with one task, so the steps get the full width.
  - Repos with only one small task each: do not give each its own slide. Group the small tasks of the same product into one slide (the `project` is then the product), and say which repo or area each belongs to in its title.
  - Keep one project's slides together, in the order of the dashboard, and never put two projects' tasks in the same column set unless they are small tasks of the same product.
- Keep `dashboard`, `rings` and `tracker` as the overview and `task_detail` as the evidence behind them. In `lead` mode a team of several people usually needs a `task_detail` slide or two per project.

**Screenshots and photos (only when the user asks for them).** If the prompt or `notes.md` asks for screenshots or photos on the slides, add them; otherwise add none, and never mock up a screen or invent a picture.
- **Files the user provides** (screenshots, phone photos, whiteboard photos, exported designs): copy them into `<dir>/images/` (leave the originals where they are) and refer to them relatively, for example `images/booking.png`. PNG, JPG, GIF, WebP and SVG work. HEIC and other phone formats must be converted to JPG first (on a Mac: `sips -s format jpeg in.heic --out out.jpg`). If the user gives a web address, download it into `images/` first (tell them you did) and use the file path, never the address.
- **Screenshots to capture from a project repo** (when asked, for example "screenshot the booking screen"): find how the app runs from its README or `package.json` scripts, tell the user what you are about to start, and ask before starting servers, installing packages or using anything that needs credentials. Capture with the browser tool you have (a Playwright or browser MCP, or `npx playwright screenshot --viewport-size=390,844 <url> images/<name>.png`): 390 x 844 for a phone screen, 1440 x 900 for a web page. Save PNGs in `<dir>/images/`. If the app cannot be run here, say so and ask the user for screenshots instead of guessing.
- **Privacy first.** Look at every image before using it. Do not use a picture that shows real customer data, personal details, tokens, internal addresses or credentials. Ask for a test account or a cropped image instead, and tell the user when you left an image out.
- **Where an image goes.** A picture of one task: `task_detail` `tasks[].image` plus a short `caption` (one task on the slide shows it large, two or three show a thumbnail). A screenshot that explains a piece of work: `rows` `image`. A flow of screens: `gallery` (2 to 7 images, different shapes are fine). One image per point it proves; skip pictures that add nothing.
- The builder rotates phone photos upright, converts the format and shrinks oversized files. Run `lint_report.js` (it fails on a missing file or an unsupported type), build, then look at every slide with an image: it must be legible and not cut off.

**Adapting the layout.** The templates are a starting point. If the data does not fit a template well (a long list, a task with many steps, a number that needs its own space), choose a better-fitting template, split the slide, or adjust the layout in `scripts/build_deck.js` for this deck (spacing, column widths, type size above the minimums in `design_rules.md`, an added rule or figure) so it looks designed, not squeezed. Never shrink text below the minimums or cut content to make a slide fit. Verify as in step 6 and look at every slide.

**Rules:** (visual rules for templates and decks: `references/design_rules.md`)

- Never use the same content template on consecutive slides. Use charts wherever there are real numbers.
- Titles: one line, "Project: Outcome" ("App Store: Developer Account Verified").
- **Every number has a source.** A metric, count or percentage on a slide must come from the drafts, `tasks.md` or the user's answers, and the slide says how it was counted (in the card text or a footnote, for example "6 releases, beta.10 to beta.16"). Count it yourself from the drafts and write the result; do not round up, estimate or reuse a number you cannot trace. If a count is uncertain, ask in the consolidated question.
- **Never invent the plan.** The "next period" `table` and any "looking ahead" text come only from the user's notes or answers, the tracker's open tasks, open or in-review PRs, and work the drafts mark as in progress or deferred. If none of these exist, ask what is planned. If the user gives no answer, leave the plan slide out rather than writing plausible tasks. Do not propose work that already exists (check the drafts first).
- **Status words must agree with the data.** A card at 100% is Completed, not On track. A plan row is future or ongoing work (Planned, Not started, In progress), never Completed or Live. `state` and the status word describe the same thing.
- **Cover every repo you collected.** Each repo draft appears on at least one slide (a dashboard card, and a `task_detail` or `rows` slide for its main work). If you leave something out, say so in your summary to the user; never drop a repo silently.
- Every item answers "so what" — what users or the business can now do, or what it unblocks.
- Phase names: use the plan's phase numbering, but phrase the name plainly ("P1 · Appointment Data Foundation" instead of "Database Schema & Eloquent Models"); keep the official name only if the lead wants it.
- Progress for a track = average of its phase percentages; say so in a footnote.
- Names: use the display names from config `team` / `taskUsers` / `larkUsers` exactly, everywhere, including drafts (e.g. `Nina Rao @Nina`). Never show excluded people. Title slide presenter = `presenter`; closing slide = `closingPresenter`.
- Scope wording precisely: if only part of a product is being built (e.g. only the Patient App and Clinic Dashboard of ClinicBook), say so.
- In the `showship` and `paper` styles, a project keeps one colour on every slide. The colour is matched by the product name, so start every label, eyebrow and table row for a project with the same name (e.g. "ClinicBook · Patient App", "ClinicBook: Status of Each Phase").
- Status words the business understands: Completed, Released, Approved — ready to release, In review, In progress, Not started, Blocked, At risk.

## Only on request

These extras come from report-writing practice, but they are not part of the default workflow. Do none of them unless the user asks for them (in the prompt, in `notes.md` or in answer to your question). Do not offer them unprompted either, and do not mention them in the final summary.

- **Appendix.** Supporting detail that would crowd the main slides, placed after the plan slide and before the closing slide. Build it from the existing templates (`task_detail`, `table` or `rows`) with "Appendix" at the start of each eyebrow. Use only material already in the drafts, `tasks.md` or the user's notes.
- **References / sources.** A closing list of where the numbers came from (PRs, tracker tasks, documents the user names), as a `table` slide or a line in a footnote. List only sources you actually used, with the identifiers the drafts hold.
- **Mind map.** A planning aid for sorting a large or messy period before building. Write the period's work as a text outline or Mermaid mind map in `<dir>/mindmap.md`, grouped by project, track and theme, with gaps and overlaps marked. It is a working file for the user, never a slide.
- **Stuck or overwhelmed.** If the user says they are stuck, overwhelmed or putting the report off, break the job into small steps (collect one repo, answer the questions, build a first draft), name the very first step, and take it with them. Do this only when they say so.

## Editing an existing report

Edit `<dir>/report.json`, re-run the language check, rebuild. The JSON is the source of truth.
