# Translating GitHub activity into business language

Business readers want to know **what capability now exists, for whom, and why it matters**. They do not want table names, file paths or framework jargon.

## Principles

1. **Group, don't list.** Ten commits on the booking form become one item: "Appointment booking form completed".
2. **Outcome over activity.** "Patients can now book an appointment" beats "added POST /appointments endpoint".
3. **Name the module the business knows** (Patient App, Booking, Reminders, Reports), not the code module.
4. **State the status honestly.** Commits show work happened, not that it is finished. Mark a feature *Completed* only if the commits clearly finish it (tests, final wiring, release/merge to main) or the lead confirms it. Otherwise say *In progress*.
5. **Write for the least technical person in the room.** Business, PMs and the CTO sit in the same meeting. Use plain words; put a technical term in brackets only when it adds something for the CTO: "image processing (resize & compress)", "connection to the SMS provider".
6. **Fixes are about the user's experience**: "Fixed profile photo uploads failing for customers", not "fix null check in uploader".
7. **No numbers you can't back up.** Commit counts and lines changed are not progress percentages; don't present them as such.

## Common translations

| Commit pattern | Business wording |
|---|---|
| migrations, models, schema, seeders | Data foundation for <module> (e.g. "Appointment data foundation") |
| controllers, routes, requests, resources, endpoints | The capability users get (e.g. "Patients can book an appointment") |
| image upload, resize, S3, media library | Image upload & processing (resize, compress) for <module> |
| admin pages, CRUD views, dashboard tables | Admin portal screens for <module> |
| approval, status transitions, workflow, state machine | <X> approval workflow (core logic) |
| payment, webhook, callback, signature | Connection to <provider> payments, including automatic payment result notifications |
| fix, hotfix, bug, crash, null | Fixed <user-visible symptom> |
| refactor, service layer, cleanup | Restructuring code so future changes are faster and safer (only if significant) |
| tests, CI, lint, docker, env | Usually omit; mention only as "quality/release readiness" if it was the main work |
| iOS/Android config, gradle, pods, env setup | Mobile build environment set up (iOS/Android) |

## Using pull requests, reviews and comments

PRs are usually the best unit for a business summary — one PR ≈ one feature or fix.

| PR signal | How to use it |
|---|---|
| PR title / description | Name the feature in business terms; descriptions often state the goal ("so that patients can…") — reuse that intent. |
| Merged this week | **Delivered.** Strongest evidence for "Completed" (for that piece of scope). |
| Open, review requested | **In review** — built, awaiting approval. |
| Draft | **In development.** |
| Closed without merge | Usually omit; mention only if it signals a change of direction. |
| Review: changes requested | Quality gate working: "Rework requested in review (reuse image pipeline); fix in progress." Don't name or blame the author. |
| Review: approved | Supports "ready to ship / merged". |
| Comments mentioning waiting, blocked, dependency, API not ready, decision needed | Candidate **blocker / dependency** — list under "Questions for the lead" to confirm before it goes on a slide. |
| Comments agreeing scope ("let's move X to next sprint") | Scope decision — useful for Next Steps. |
| Many review rounds or a PR open a long time | Possible risk — mention neutrally as "under review for N days" only if the lead agrees. |
| The lead's own reviews | Counts as review/oversight work for the lead ("Reviewed and merged 3 PRs"). |

Never copy raw code-review comments, file paths or code into the deck. Summarize the business meaning in one clause.

### Worked example: the lead's structured review

Input (abridged) — the lead's review of clinicbook-api PR #12, author `nina-dev`:

```
# Code Review: clinicbook-api PR #12 for CB-88, Phase 4: Appointment Reminders
- Scope: 9 files, +512/−20 …  task CB-88 open; subtasks CB-89–CB-93 done
## Summary
Adds a scheduled job that sends SMS and email reminders 24h and 2h before each appointment,
plus PUT /api/v1/clinics/{clinic}/reminder-settings. Phone numbers masked in logs …
… full suite 212/212 green. One reachable defect remains: if the SMS provider times out and
the job retries, the patient can receive the same reminder twice. The fix is small and tested.
## Subtask Coverage
4.1 Scheduler ✅ · 4.2 SMS ✅ · 4.3 Email ✅ · 4.4 Clinic settings ✅ · 4.5 Retry safety ⚠️
## Critical / Blocker
1. Retry sends duplicates … Fix: record a sent-marker per appointment+slot before dispatch.
## Optional Follow-up Refactoring
1. Move templates to config …  2. Batch provider calls …
## Product Decision Needed — Separate Ticket
1. Opt-out: every patient with a phone gets SMS today … should patients be able to choose
   email only?
## Verdict
NEEDS WORK: only Blocker 1, a small change contained in one job.
```

Draft output:

```markdown
### P4 · Reminders & Notifications — Nina Rao @Nina
- Plan reference: task CB-88, Phase 4: Appointment Reminders
- What it does: Patients get SMS and email reminders 24 hours and 2 hours before their
  appointment; each clinic can adjust its reminder settings.
- Status: In review — one fix needed before release
- Progress evidence: 4 of 5 parts verified by the lead's review (suggest ~80%); all 212 automated tests pass.
- Quality: Patient phone numbers are hidden in system logs; clinics can only change their own settings.
- Fix needed before release: If sending is retried, a patient can receive the same reminder twice.
  Small fix, already tested by the lead. Owner: Nina Rao @Nina.
- Decisions needed from business: Can patients turn off SMS reminders and keep email only?
  Options: allow opt-out / clinic decides per patient / keep as today.
- Deferred / follow-up: two minor technical improvements (not for the deck).
```

On slides this becomes: a phase bar at 80% with the note "4 of 5 parts verified"; a `review_insights` finding (Reliability — FIX BEFORE RELEASE); a Blockers item ("Reminders release waiting on one fix"); a Decisions Needed item (the SMS opt-out question); and a Next Week row ("Apply the duplicate-reminder fix and release reminders").

## Plain-language glossary

| Technical | Say instead |
|---|---|
| API / endpoint | describe the capability ("clinics can change their reminder settings"); "system connection" |
| database schema / migration / models | "data foundation", "data structure", "database setup" |
| PR merged | "approved and integrated", "delivered" |
| PR open / in review | "built, in final review" |
| 500 error / exception | "an error page instead of a clear message" |
| 422 / validation | "a clear error message telling the user what to fix" |
| duplicate job / retry | "the same message could be sent twice" |
| N+1 / slow query | "a database performance issue" |
| test suite green (212/212) | "all 212 automated tests pass" |
| authorization / policy / ownership | "permission rules", "clinics can only change their own settings" |
| refactor | "restructuring code to make future changes faster" |
| UAT | "final acceptance testing (UAT)" |
| callback URL / webhook | "automatic payment result notifications" |
| JSON | "structured data" |
| deploy / production | "release", "live" |
| staging | "test environment" |
| tech debt / optional refactoring | usually omit; "minor improvements planned" |

## Example: commits only (no PR yet)

Commits (Leo, clinicbook-api repo):

```
feat: add appointments migration and model
feat: AvailabilityController index/show
feat: validation for booking request
fix: timezone offset on slot times
feat: booking calendar week view (wip)
```

Draft output:

```markdown
## Leo Park @Leo
- **Doctor Availability** — Patients can see each doctor's open time slots; bookings are validated and stored. _Evidence: a1b2c3d, d4e5f6a, 9f8e7d6_
- **Booking Calendar** — Work started on the weekly calendar view for patients. _Evidence: 1a2b3c4 (wip)_

## Suggested status
- Doctor Availability: Completed (lead to confirm)
- Booking Calendar: In progress — % needed
```
