# report.json schema and slide templates

A full working example lives in `examples/report.example.json`. The machine-readable definition of everything below is [`report.schema.json`](report.schema.json) (JSON Schema): field names, types, allowed values, item counts and character limits. `scripts/lint_report.js` validates `report.json` against it, and editors that understand JSON Schema use it for autocomplete when the file starts with `"$schema": "<path to report.schema.json>"`. If this page and the schema disagree, the schema wins.

```jsonc
{
  "date": "October 2, 2026",                  // shown on title + closing slides
  "presenter": "Maya Lin @Maya",           // title slide
  "closingPresenter": "Maya Lin",            // closing slide
  "company": "Acme Digital Co., Ltd.",   // optional (default)
  "eyebrow": "Progress report",                // optional (default)
  "period": "sprint",                          // optional: weekly | biweekly | sprint | monthly | custom (default from config)
  "sprint": 14,                                // optional: sprint number → "Sprint 14 Progress Report"
  "title": "Weekly Development\nProgress Report", // optional — overrides the period's default title
  "style": "corporate",                        // optional: showship | paper | classic | modern | corporate | vivid (default from config)
  "slides": [ /* content slides, in order; title + closing are added automatically */ ]
}
```

**Length limits** (characters; defined as `maxLength` in the schema and enforced by `scripts/lint_report.js`, see `design_rules.md`): title 62, eyebrow 48, dashboard card label 34 / headline 40 / desc 110, key update and impact 150, timeline step title 28 / tag 16 / desc 90, phase name 45, table focus 130, finding text 140, attention title 80 / text 170, tracker item 55 / focus 110.

All styles read the same JSON. `classic` renders it with its own editorial layouts (e.g. `rings` as large figures, `phase_bars` as phase lists, `timeline` vertically); `showship` has its own signature layouts (colour per project, gauges, pill tracks, milestone trail); `paper` has its own printed-report layouts (ruled lists, big figures, a single trail line for timelines; `rows` ignores `illustration`); `modern`, `corporate` and `vivid` share the card layouts. Optional `"color"` on a dashboard card or `phase_bars` slide pins a project colour (hex); `"signature": false` hides the "Shipped with Showship" mark.

Every content slide has `type`, `eyebrow` (short label, shown in sentence case) and `title` (one line).

**States** used across templates: `done` (accent colour), `progress` (light accent), `blocked` (warning colour), `next` (grey / not started). Colours depend on the style.

**Icons** are Lucide names without the `Lu` prefix, in PascalCase: `Database`, `Smartphone`, `FileText`, `Users`, `UserRound`, `Briefcase`, `RefreshCw`, `ShieldCheck`, `TrendingUp`, `Code`, `FlaskConical`, `Rocket`, `Target`, `ListChecks`, `Workflow`, `Component`, `Landmark`, `CalendarClock`, `Headset`, `LayoutDashboard`, `CircleCheckBig`, … (any name from react-icons/lu works).

---

## `dashboard` — executive summary KPI cards

Use as slide 2. 2–4 cards, one per project.

```json
{ "type": "dashboard", "eyebrow": "Executive Summary", "title": "This Week at a Glance",
  "cards": [
    { "label": "App Store Release", "metric": "100%", "state": "done", "status": "COMPLETED",
      "headline": "Developer Account Verified", "desc": "One sentence, ≤ 110 chars." }
  ],
  "keyUpdate": "Optional one-line highlight shown in a dark strip at the bottom." }
```
`metric` can be a %, a fraction ("1 / 2"), a count ("3"), or a word ("Live").

## `timeline` — milestones / blocker resolved

3–5 steps across the slide.

```json
{ "type": "timeline", "eyebrow": "...", "title": "...",
  "badge": { "text": "BLOCKER RESOLVED", "state": "done" },
  "steps": [ { "tag": "Last week", "title": "Blocked", "state": "blocked", "desc": "≤ 90 chars" } ],
  "impact": "Optional business-impact line." }
```

## `rings` — doughnut progress charts

2–3 doughnuts (set `"dark": true` on the overall one) + optional status tiles.

```json
{ "type": "rings", "eyebrow": "...", "title": "...",
  "rings": [ { "label": "Combined Progress", "sub": "8 phases", "pct": 64, "dark": true } ],
  "stats": [ { "value": 4, "label": "Phases Completed", "state": "done" } ],
  "footnote": "Progress = average completion across each track's phases." }
```

## `phase_bars` — phase-level bar charts

1–2 tracks, ~3–6 phases each. `pct` 100 = completed bar, 1–99 = in-progress bar, 0 = empty bar labelled "(Not started)". Keep phase names ≤ 45 chars.

```json
{ "type": "phase_bars", "eyebrow": "...", "title": "...",
  "tracks": [ { "title": "Core Product Track", "owner": "Leo Park @Leo",
    "phases": [ { "name": "P1 · Database Architecture & Backend", "pct": 100 } ],
    "note": "Optional one-line italic note." } ] }
```

## `workstreams` — finished item + process flow

Left: dark hero card with a big metric. Right: 3–5 chevron steps.

```json
{ "type": "workstreams", "eyebrow": "...", "title": "...",
  "hero": { "label": "Workstream 1", "title": "Data Transfer to New System", "metric": "100%", "state": "done", "desc": "≤ 160 chars" },
  "flow": { "label": "Workstream 2", "title": "Usage Tracking Rollout", "state": "progress",
    "steps": [ { "title": "Event Plan Agreed", "desc": "≤ 50 chars", "state": "done" } ],
    "next": "Optional next-step line." } }
```

## `rows` — icon rows with optional visual

2–4 rows. Without a visual the rows use the full width. Add **either** `image` (path to a screenshot, relative to report.json) **or** `illustration` (generated hub-and-spoke graphic: a center icon + 2–4 node icons).

`desc` is a string, or an array for sub-bullets: strings are plain lines, `{ "label", "text" }` objects become **Label:** text.

```json
{ "type": "rows", "eyebrow": "...", "title": "...",
  "illustration": { "center": "Briefcase", "nodes": ["Smartphone", "RefreshCw"] },
  "rows": [
    { "icon": "Briefcase", "header": "Project Takeover", "desc": "..." },
    { "icon": "Users", "header": "Delegation", "desc": [
      "Modules assigned to developers:",
      { "label": "Core Product", "text": "Leo Park @Leo" } ] },
    { "icon": "TrendingUp", "header": "Business Impact", "desc": "..." }
  ] }
```

## `gallery` — screenshot strip

2–7 screenshots of the same aspect ratio, with step labels.

```json
{ "type": "gallery", "eyebrow": "...", "title": "...",
  "images": ["shots/1.png", "shots/2.png"], "labels": ["Search", "Result"] }
```

## `activity` — team delivery activity (from GitHub)

Clustered column chart per person (2–6 people, 2–4 series) + up to 4 KPI tiles on the right (the first tile is highlighted). Use counts from the collected drafts only.

```json
{ "type": "activity", "eyebrow": "Engineering Activity · GitHub", "title": "Team Delivery Activity This Week",
  "series": ["Commits", "PRs Opened", "PRs Merged", "Reviews Given"],
  "people": [ { "name": "Leo Park @Leo", "values": [18, 1, 2, 0] } ],
  "kpis": [ { "value": "3", "label": "PRs merged to develop" }, { "value": "2", "label": "PRs in review" } ],
  "note": "Source: GitHub commits, pull requests and reviews, Sep 26 – Oct 2." }
```

## `review_insights` — code-review outcomes

Left: dark column with 2–4 stats. Right: 3–5 findings, each with a quality-area tag, one business-language sentence and a status pill (`done` → RESOLVED, `progress` → IN PROGRESS, `blocked` → OPEN RISK, `next` → PLANNED; override with `status`). Use for issues caught in review, decisions and open risks — never raw code comments or names attached to problems.

```json
{ "type": "review_insights", "eyebrow": "Quality & Code Review · ClinicBook",
  "title": "Code Review: Quality Gates Held Before Release",
  "stats": [ { "value": "4", "label": "PRs reviewed by the lead" }, { "value": "2", "label": "Rework requests, both resolved" } ],
  "findings": [
    { "area": "Performance", "text": "A database query inefficiency was caught in review and fixed before merge.", "state": "done" },
    { "area": "Scope Decision", "text": "Clinic logo upload moved to Phase 3 (Reports & Exports).", "state": "next" }
  ],
  "note": "Source: GitHub PR reviews and comments, Sep 26 – Oct 2." }
```

## `attention` — blockers & decisions needed

Two columns: Blockers & Risks (amber) and Decisions Needed (dark). 0–4 items each; an empty column shows a "none this week" line. Cards size to content. `meta` is a small italic line for owner / expected date / options.

```json
{ "type": "attention", "eyebrow": "Needs Attention", "title": "Blockers & Decisions Needed",
  "blockers": [ { "title": "Reminders release waiting on one fix",
    "text": "Duplicate reminders must be prevented before release. Fix is small and already tested.",
    "meta": "Owner: Nina Rao @Nina · Expected: next week" } ],
  "decisions": [ { "title": "Can patients turn off SMS reminders and keep email only?",
    "text": "Today every patient with a phone number receives SMS reminders.",
    "meta": "Options: allow opt-out · clinic decides per patient · keep as today" } ] }
```

## `tracker` — developer task track (from the task tracker + reviews)

One card per person (2–4). `done` / `open` = task counts for the week from the tracker (Jira, Linear, Asana, ClickUp, Lark); `pct` = progress confirmed by the lead; `items` = their tasks/phases with state (`done` accent dot, `progress` light accent, `next` grey). Keep items ≤ 6 per card and ≤ 55 chars; add "(3/5)" subtask counts and "in PR review" where useful.

```json
{ "type": "tracker", "eyebrow": "Team · Task Tracker", "title": "Developer Task Track",
  "devs": [
    { "name": "Nina Rao @Nina", "project": "ClinicBook · Clinic Dashboard", "done": 2, "open": 2, "pct": 80, "state": "progress",
      "focus": "Onboarding and Doctor Schedules closed; Reminders in review.",
      "items": [
        { "text": "Phase 2 · Doctor Schedules (5/5)", "state": "done" },
        { "text": "Phase 4 · Reminders & Notifications, in review (5/5)", "state": "progress" },
        { "text": "Phase 3 · Reports & Exports (0/3)", "state": "next" } ] }
  ],
  "footnote": "Done/Open = Jira issues, Sep 26 – Oct 2; work in review stays open until merged. Progress % confirmed by the lead." }
```

## `table` — next steps / owners

Usually the last content slide. 3–6 rows.

```json
{ "type": "table", "eyebrow": "Looking Ahead", "title": "Next Steps & Focus Areas",
  "rows": [ { "project": "ClinicBook · Patient App", "owner": "Leo Park @Leo",
    "focus": "≤ 130 chars", "current": "P3 · 40%", "state": "progress" } ] }
```
