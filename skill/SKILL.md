---
name: showship
description: Showship — show what you shipped. Build a progress report deck (weekly, biweekly, sprint, monthly or any date range, with your company's logo and colours) from GitHub activity — for a team lead reporting the whole team to business, PMs and the CTO, or for any individual (developer, freelancer, contractor, founder) reporting their own work to a manager, tech lead or client. Sources: git commits, pull requests, code reviews and PR comments, plus tasks from Jira, Linear, Asana, ClickUp or Lark. Run it inside any repo to collect that repo's commits and PRs for the period and analyze them, then build a PowerPoint deck (plain language for business, or technical for engineers) from all collected repos plus the user's notes. Use this whenever the user mentions Showship, a weekly / biweekly / sprint / monthly report, report slides, progress report, status report for the boss/CTO/PM/business/client, "what did I do this week/sprint/month", "this week's report" (in any language), collecting the period's commits, PRs or tasks (Jira, Linear, Asana, ClickUp, Lark), or summarizing team progress from git/GitHub — even if they don't name the skill.
---

# Showship — show what you shipped (GitHub activity → business-friendly deck)

## Reporting period

Config `period` sets the default rhythm; the user can override it in any request ("last two weeks", "September", "Oct 1 to Oct 9", "sprint 14").

| `period` | Default range when there is no earlier report | Deck title (default) | "Next …" slide |
|---|---|---|---|
| `weekly` *(default)* | last 7 days | Weekly Development Progress Report | Next Week's Plan |
| `biweekly` | last 14 days | Biweekly Development Progress Report | Next Two Weeks |
| `sprint` | last `sprintDays` days (default 14); ask the sprint number once and pass it as `report.json` → `"sprint"` | Sprint N Progress Report | Next Sprint's Plan |
| `monthly` | the current calendar month to date — or the previous month if the report is made in its first 5 days | Monthly Development Progress Report | Next Month's Plan |
| `custom` | ask the user for the dates | Development Progress Report | Next Steps |

When an earlier report exists, the range starts the day after the newest report folder's date. Wording on slides and in drafts follows the period ("this sprint", "this month", "next week"). Below, "period" means whichever of these applies.

## Who this is for — role and audience

Two settings in config decide whose work is reported and how technical the deck may be. Ask on first setup if they aren't set.

**`role`**
- `lead` *(default)* — a team lead reporting **the whole team**: everyone's commits, PRs and tasks; owners per track; the lead's code reviews (`leadLogins`, tagged `(LEAD)`) are the most authoritative source.
- `member` — an individual reporting **their own work** (developer, designer-developer, freelancer/contractor to a client, solo founder to investors). Collect only the user's own commits, PRs they're involved in, and their own tasks. Reviews they *received* explain status and fixes; reviews they *gave* count as their contribution. Present in the first person plural or neutral voice ("Delivered…", "In progress…"), never as a ranking against others.

**`audience`**
- `business` *(default)* — business people, PMs, management, clients. Write for the least technical person in the room; technical terms only in brackets when they add something.
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
  - `logo` — path to the company logo (PNG/JPG, `~` allowed; borders are trimmed automatically; `false` for none). Default: the placeholder in `assets/`.
  - `style` — the deck design: `classic` (dark bookends, lime accent, serif headings), `corporate` (white, navy & blue, sans-serif, page numbers), or `vivid` (teal header bands, orange accent, rounded cards). The user chooses it — in the installer, in config, or per report via `report.json` → `"style"`. All slide types work in every style. Ask on first setup if it isn't set.
  - `theme` — optional colours (hex) that override the style's palette: `dark`, `accent`, `accentLight`, `warning`.
  - `deckLanguage` — language of the slides (default `English`).
  - `role` — `lead` (whole team) or `member` (own work only); `audience` — `business` or `engineering`. See **Who this is for**.
  - `leadLogins` — the user's own git author names and GitHub logins (e.g. `"maya-lin"`, `"Maya Lin"`, `"maya@acme.io"`). In `lead` mode their comments are tagged `(LEAD)` as the reviewer; in `member` mode they also select which commits, PRs and tasks are the user's.
  - `team` — maps **both** git author names **and** GitHub logins to display names (e.g. `"nina-dev": "Nina Rao @Nina"`). When you meet an unmapped name, ask once and add it.
  - `projects` — maps local repo folder names to project/service names (e.g. `"clinicbook-api": "Booking Service - ClinicBook"`). On slides, group by product and track (e.g. "ClinicBook · Clinic Dashboard"), not by repo.
  - `tasks` — the team's project/task management tool (see **Task tracker**): `provider` is `none`, `lark`, `jira`, `linear`, `asana` or `clickup`, plus that tool's settings (e.g. `tasks.jira.baseUrl`, `tasks.jira.projects`). The user chooses it — in the installer or by editing config. If `tasks` is absent but `larkUsers` exists, Lark is assumed.
  - `taskUsers` — maps tracker user ids, emails or names → display names (`larkUsers` and `team` are also consulted). Unknown people fall back to their name in the tool; when that happens, ask whether to add them.
  - `exclude.people` — people left out of the report entirely: tracker ids/names/emails, git author names or GitHub logins. Apply it everywhere — tasks, commits, PRs, activity counts and slides.
- Task tracker credentials come only from environment variables — `JIRA_EMAIL` + `JIRA_API_TOKEN`, `LINEAR_API_KEY`, `ASANA_TOKEN`, `CLICKUP_TOKEN`; Lark uses `lark-cli` signed in as the user. Never write tokens into config.json or any report file. If collection fails for setup reasons, tell the user what to set and continue without task data.

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

The team's project/task management tool holds the plan: projects, phases (tasks/issues/epics) and their subtasks, with assignees, due dates and completion dates. The tool is whatever the user configured in `tasks.provider` — Jira, Linear, Asana, ClickUp or Lark (or `none`). Collect it once per report; it covers the configured lists/projects/teams, not one repo:

```
node <skill>/scripts/collect_tasks.js <since> <until> --json <dir>/tasks.json > <dir>/tasks.md
```

Run it during the first **collect** of the period if `<dir>/tasks.md` doesn't exist yet, or at the start of **build**. Exit code 2 means "not configured" (provider `none`, missing token or settings) — the digest explains what to set; tell the user once and carry on with GitHub data only. To switch tools, change `tasks.provider` (or pass `--provider <tool>`). In **`member`** mode add `--people "<the user's display name>"` so only their own tasks are kept.

Every tool produces the same digest: tasks grouped by assignee (mapped through `taskUsers`, excluded people removed), completed-in-range and open tasks, nested subtasks with counts, and `OVERDUE` flags. How each tool maps:

| Tool | "Task" | Subtasks | Done = |
|---|---|---|---|
| Lark | task in a tasklist | subtasks (nested) | completed |
| Jira | issue (epic / story / task) | child issues & sub-tasks in the result set | status category Done |
| Linear | issue | sub-issues | completed (canceled is skipped) |
| Asana | task in a project | subtasks (nested) | completed |
| ClickUp | task in a list | subtasks (nested; earlier-closed ones kept for counts) | status type done / closed |

How to use it:

- **Who is doing what** and **what is planned** come from the tracker: each developer's tasks, phases and open work.
- **Progress evidence:** subtask counts (e.g. `[subtasks 4/5]`) give a phase's completion. Work items are the subtask leaves; a task without subtasks counts as one. "Done" counts leaves completed in the range. Use leaf counts unless the lead asks otherwise for a given report (record that in `notes.md`).
- **Cross-check with GitHub:** "done" in the tracker means the developer finished the work items; the PR review decides whether it is ready to release. A phase whose subtasks are all done but whose PR is still in review is **In review**, not Completed. Keep it open on the tracker slide until merged.
- **Match tasks to PRs** by the task id/key in the lead's review title or PR title/branch (e.g. `CB-88`, `CLINIC-42`, `ENG-12`, ClickUp custom ids) or by phase name.
- Overdue tasks (`OVERDUE`) and tasks with no assignee are candidates for the Blockers & Risks list — confirm with the lead.
- The lead's own tasks are reported like any developer's (owner = the lead's display name from `team`).

## Reading the lead's reviews

*(In `member` mode the same structure applies to reviews the user **received** from their lead — use them for status, fixes needed and decisions — and to reviews the user **gave**, which count as their contribution.)*

The lead's review comments are structured, verified write-ups and the most authoritative source in the digest. A typical review contains these sections — map each one:

| Review section | Use it for |
|---|---|
| Title line: repo, PR number, **task id/key**, **phase name** (e.g. "Phase 4: Appointment Reminders") | Which project, track and phase this is. Keep the task id in the draft as a reference, not on slides. |
| Header facts: author, branch, scope (files/lines), task/subtask status in the tracker, review date | Owner (map the GitHub author via config), size of the change. |
| **Summary** | What the feature does → rewrite as user/business value. |
| **Verification** (test suite result, probe tables) | Quality evidence: "all 212 automated tests pass", "permissions verified". Drop the technical cases. |
| **Subtask Coverage** table (✅ / ⚠️ / ❌ per subtask) | **Progress evidence.** Count verified subtasks: 4 of 5 ✅ → suggest ~80% and "4 of 5 parts verified". Confirm the percent with the lead. |
| **Critical / Blocker** | "Fix needed before release": describe the **effect on users** and the **size** of the fix ("a damaged image upload shows an error instead of a clear message; small fix, already tested"). Goes on the Blockers side of the `attention` slide if it delays release. |
| **Optional Follow-up Refactoring** | Usually omit from the deck. At most "minor improvements planned". |
| **Product/Policy Decision Needed** | **Decisions Needed** on the `attention` slide: the business question, why it matters, the options. This is high value for the meeting. |
| Items the PR leaves open on purpose / already decided | Omit unless they change scope. |
| **Verdict** (APPROVED / NEEDS WORK / …) | Status: APPROVED → "Approved, ready to release" (or Delivered if merged); NEEDS WORK → "In review — fix needed". |

Developers' PR descriptions and replies tell you what was built and what has been fixed since the review — a blocker answered with "fixed" plus new commits is **resolved, pending re-review**.

Never put code, file paths, HTTP status codes, class names, test case tables or raw comments on a slide. Never attribute problems to a person ("rework requested on the image upload handling", not "Nina's code failed"). Positive callouts may name people.

## Mode 2: build

1. Read every `<dir>/*.md` (including `tasks.md`; run the task collector first if it's missing and a tracker is configured) and `notes.md`, plus what the user tells you in chat. Earlier reports' `notes.md` may hold standing instructions (exclusions, environments, how to count) — check the newest earlier folder too.
2. **Fill gaps in one consolidated question** (in the user's language): percentages to confirm, non-code work (paperwork, approvals, meetings), blockers outside GitHub, anything uncertain. Never invent numbers, dates, owners or blockers; if unknown, state the status in words.
3. Plan the deck (below) and write `<dir>/report.json` per `references/templates.md`. `date` like `October 9, 2026`; presenter values from config.
4. **Language check:** `node <skill>/scripts/lint_report.js <dir>/report.json --audience <business|engineering>`. Rewrite every FIX item (for `engineering`, only code and file names are flagged); for CHECK items keep the term only if it is explained in the same sentence or is an official plan name. Re-run until there are no FIX items.
5. Build: `node <skill>/scripts/build_deck.js <dir>/report.json <dir>/<Period>_Progress_Report_<YYYY-MM-DD>.pptx`. Set `"period"` in `report.json` when it differs from config (and `"sprint"` for sprint reports) so the title matches.
6. Verify: if LibreOffice is available, render to images and check every slide for overflow, overlaps and wrong numbers; fix and rebuild. Re-check every number against the drafts and the user's answers.
7. Tell the user (in their language) where the file is, one line per slide, and what you inferred.

## Deck design

**Narrative for `role: lead` (follows the six questions):**

1. Title (automatic)
2. `dashboard` — one card per project: headline metric, status (COMPLETED / ON TRACK / AT RISK / BLOCKED), one plain sentence; key-update strip for the single most important message (often a decision needed).
3. Per project, 1–2 slides — progress with owners (`rings` + `phase_bars` for phased work; `timeline` for something that moved through stages or a resolved blocker; `workstreams`; `rows` with an illustration or screenshot for descriptive work; `gallery` for UI screenshots).
4. `review_insights` (optional) — what review verified and caught before release, in plain words.
5. `attention` — Blockers & Risks + Decisions Needed. Include it whenever there is any blocker or decision; if none, a dashboard key-update line saying so is enough.
6. `tracker` — Developer Task Track: one card per person with done/open task counts from the tracker, progress %, current focus and their task list (tracker + review status). `activity` (optional) — team throughput from GitHub; never a ranking.
7. `table` — next period's plan (Next Week's / Next Sprint's / Next Month's Plan): owner, next focus, current status.
8. Closing (automatic)

**Narrative for `role: member`** (shorter — typically 5–8 slides):

1. Title (automatic; presenter = the user; title follows the period, e.g. "Weekly Progress Report", "Sprint 14 Progress Report")
2. `dashboard` — one card per project or workstream the user touched: metric, status, one sentence; key-update strip for the most important point (often "help needed").
3. One slide per significant piece of work — `timeline`, `workstreams`, `phase_bars` (if they own phases) or `rows` with a screenshot/illustration.
4. `review_insights` (optional) — reviews received and given: what was approved, what was fixed.
5. `attention` — blockers, and decisions or help needed from the manager/client.
6. `table` — next period's plan (owner column may simply be the user).
7. Closing (automatic)

Skip `tracker` and `activity` in `member` mode unless the user asks — they are team views.

**Rules:**

- Never use the same content template on consecutive slides. Use charts wherever there are real numbers.
- Titles: one line, "Project: Outcome" ("App Store: Developer Account Verified").
- Every item answers "so what" — what users or the business can now do, or what it unblocks.
- Phase names: use the plan's phase numbering, but phrase the name plainly ("P1 · Appointment Data Foundation" instead of "Database Schema & Eloquent Models"); keep the official name only if the lead wants it.
- Progress for a track = average of its phase percentages; say so in a footnote.
- Names: use the display names from config `team` / `taskUsers` / `larkUsers` exactly, everywhere, including drafts (e.g. `Nina Rao @Nina`). Never show excluded people. Title slide presenter = `presenter`; closing slide = `closingPresenter`.
- Scope wording precisely: if only part of a product is being built (e.g. only the Patient App and Clinic Dashboard of ClinicBook), say so.
- Status words the business understands: Completed, Released, Approved — ready to release, In review, In progress, Not started, Blocked, At risk.

## Editing an existing report

Edit `<dir>/report.json`, re-run the language check, rebuild. The JSON is the source of truth.
