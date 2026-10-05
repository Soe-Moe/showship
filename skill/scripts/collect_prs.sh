#!/usr/bin/env bash
# Collect this week's GitHub pull requests, reviews and comments for the current repo.
#
# Usage (run inside any repo whose origin is on GitHub):
#   collect_prs.sh [SINCE] [UNTIL]
#     SINCE default: 7 days ago (YYYY-MM-DD)
#     UNTIL default: today      (YYYY-MM-DD)
#
# Requires the GitHub CLI:  brew install gh && gh auth login
# Includes every PR updated in the range (opened, merged, closed, or still open with new activity),
# its description, reviews (approve / changes requested / comment), conversation comments and
# inline code-review comments made in the range. Bot accounts are skipped.
#
# Only PRs you're involved in (individual reports): set SHOWSHIP_INVOLVES to your GitHub login —
# keeps PRs you authored, reviewed, commented on, were assigned or mentioned in.
set -uo pipefail

SINCE="${1:-}"
UNTIL="${2:-}"
[ -z "$SINCE" ] && SINCE="$(date -v-7d +%F 2>/dev/null || date -d '7 days ago' +%F)"
[ -z "$UNTIL" ] && UNTIL="$(date +%F)"
END="${UNTIL}T23:59:59Z"
MAXLEN=40000 # max characters kept from each description / comment (structure and line breaks are preserved)

echo "# Pull request digest"
echo

if ! command -v gh >/dev/null 2>&1; then
  echo "_GitHub CLI (gh) is not installed — PR data skipped. Install with: brew install gh && gh auth login_"
  exit 0
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "_GitHub CLI is not logged in — PR data skipped. Run: gh auth login_"
  exit 0
fi
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)"
if [ -z "$REPO" ]; then
  echo "_This repo has no GitHub remote that gh can access — PR data skipped._"
  exit 0
fi

# The logged-in GitHub user is the team lead. Extra lead logins/names can be passed as a
# comma-separated list in SHOWSHIP_LEAD_LOGINS (e.g. "maya-lin,Maya Lin").
LEAD="$(gh api user --jq .login 2>/dev/null || echo '')"
LEADS_JSON="$(printf '%s,%s' "$LEAD" "${SHOWSHIP_LEAD_LOGINS:-}" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' \
  | awk 'BEGIN{printf "["} {gsub(/"/,"\\\""); printf "%s\"%s\"", (NR>1?",":""), $0} END{printf "]"}')"
[ -z "$LEADS_JSON" ] && LEADS_JSON='[]'


SEARCH="updated:${SINCE}..${UNTIL}"
if [ -n "${SHOWSHIP_INVOLVES:-}" ]; then
  SEARCH="$SEARCH involves:$(echo "$SHOWSHIP_INVOLVES" | cut -d, -f1 | sed 's/^ *//;s/ *$//')"
fi

echo "- Repository: $REPO"
echo "- Lead accounts: $LEADS_JSON — comments by these users are tagged (LEAD)"
echo "- Range: $SINCE → $UNTIL"
[ -n "${SHOWSHIP_INVOLVES:-}" ] && echo "- Filtered to PRs involving: ${SHOWSHIP_INVOLVES%%,*}"
echo

# jq snippets (gh --jq has no --arg, so dates are spliced in)
IN_RANGE='(. >= "'"$SINCE"'" and . <= "'"$END"'")'
NOT_BOT='((.author.login // "") | test("bot|github-actions|codecov|sonarcloud|vercel|netlify|coderabbit"; "i") | not)'
# Full text, structure preserved, indented under its bullet
FULL='(. // "" | gsub("\r"; "") | .[0:'"$MAXLEN"'] | split("\n") | map("      " + .) | join("\n"))'
TAG='(. as $who | if ('"$LEADS_JSON"' | map(ascii_downcase) | any(. == ($who | ascii_downcase))) then " (LEAD)" else "" end)'

LIST_JSON="number,title,author,state,isDraft,createdAt,mergedAt,closedAt"
COUNT="$(gh pr list --repo "$REPO" --state all --limit 100 \
  --search "$SEARCH" --json number --jq 'length' 2>/dev/null || echo 0)"
if [ -z "$COUNT" ] || [ "$COUNT" = "0" ]; then
  echo "_No pull requests with activity in this range._"
  exit 0
fi

echo "## Summary"
gh pr list --repo "$REPO" --state all --limit 100 --search "$SEARCH" --json "$LIST_JSON" --jq '
  "- PRs with activity: \(length)",
  "- Opened in range: \([.[] | select(.createdAt | '"$IN_RANGE"')] | length)",
  "- Merged in range: \([.[] | select(.mergedAt != null and (.mergedAt | '"$IN_RANGE"'))] | length)",
  "- Closed without merge in range: \([.[] | select(.mergedAt == null and .closedAt != null and (.closedAt | '"$IN_RANGE"'))] | length)",
  "- Still open: \([.[] | select(.state == "OPEN")] | length) (drafts: \([.[] | select(.state == "OPEN" and .isDraft)] | length))",
  "",
  "### By author (opened / merged / still open)",
  (group_by(.author.login)[] |
    "    \(.[0].author.login): \([.[] | select(.createdAt | '"$IN_RANGE"')] | length) / \([.[] | select(.mergedAt != null and (.mergedAt | '"$IN_RANGE"'))] | length) / \([.[] | select(.state == "OPEN")] | length)")
'
echo

VIEW_JSON="number,title,author,state,isDraft,createdAt,mergedAt,closedAt,mergedBy,headRefName,baseRefName,additions,deletions,changedFiles,labels,reviewDecision,url,body,comments,reviews"

for N in $(gh pr list --repo "$REPO" --state all --limit 100 --search "$SEARCH" --json number --jq '.[].number'); do
  gh pr view "$N" --repo "$REPO" --json "$VIEW_JSON" --jq '
    "## PR #\(.number): \(.title)",
    "- Author: \(.author.login) · Status: \(if .mergedAt then "MERGED" elif .state == "OPEN" then (if .isDraft then "DRAFT" else "OPEN" end) else .state end) · Branch: \(.headRefName) → \(.baseRefName)",
    "- Created: \(.createdAt[0:10])\(if .mergedAt then " · Merged: \(.mergedAt[0:10]) by \(.mergedBy.login // "?")" elif .closedAt then " · Closed: \(.closedAt[0:10])" else "" end)",
    "- Size: +\(.additions) / -\(.deletions) in \(.changedFiles) files · Review decision: \(.reviewDecision // "none")\(if (.labels | length) > 0 then " · Labels: \(.labels | map(.name) | join(", "))" else "" end)",
    "- URL: \(.url)",
    "### Description (by \(.author.login))",
    (.body | '"$FULL"'),
    "",
    ( ( [ .reviews[] | select(.submittedAt | '"$IN_RANGE"') | select('"$NOT_BOT"')
          | {t: .submittedAt, who: .author.login, kind: ("REVIEW: " + .state), body: (.body // "")} ]
      + [ .comments[] | select(.createdAt | '"$IN_RANGE"') | select('"$NOT_BOT"')
          | {t: .createdAt, who: .author.login, kind: "COMMENT", body: (.body // "")} ]
      ) | sort_by(.t) ) as $th
    | if ($th | length) > 0 then
        "### Discussion this week (chronological)",
        ($th[] | "- \(.t[0:10]) \(.who)\(.who | '"$TAG"') [\(.kind)]\(if .body != "" then ":\n" + (.body | '"$FULL"') else "" end)")
      else empty end
  ' 2>/dev/null || echo "## PR #$N (could not load details)"

  INLINE="$(gh api "repos/$REPO/pulls/$N/comments" --paginate --jq '
    .[] | select(.created_at | '"$IN_RANGE"') | select(.user.type != "Bot")
    | "- \(.created_at[0:10]) \(.user.login)\(.user.login | '"$TAG"')\(if .in_reply_to_id then " ↳ reply" else "" end) on \(.path)\(if .line then ":\(.line)" else "" end):\n\(.body | '"$FULL"')"
  ' 2>/dev/null)"
  if [ -n "$INLINE" ]; then
    echo "### Inline code-review comments this week"
    echo "$INLINE"
  fi
  echo
done
