#!/usr/bin/env bash
# Collect this week's commits from the current git repo as a raw digest.
#
# Usage (run inside any repo):
#   collect_commits.sh [SINCE] [UNTIL]
#     SINCE default: 7 days ago      e.g. "2026-09-26"
#     UNTIL default: now             e.g. "2026-10-02 23:59"
#
# Output (stdout): repo info, commits grouped by author with changed-file stats.
# Merge commits are skipped. All branches are included so feature-branch work counts.
#
# Only your own commits (individual reports): set SHOWSHIP_AUTHORS to a comma-separated list of
# your git author names and/or emails, e.g.  SHOWSHIP_AUTHORS="Maya Lin,maya@acme.io"
set -euo pipefail

SINCE="${1:-7 days ago}"
UNTIL="${2:-now}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: not inside a git repository" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel)"
REPO="$(basename "$ROOT")"
REMOTE="$(git config --get remote.origin.url 2>/dev/null || echo 'none')"

# Optional author filter (OR across names/emails)
AUTH_ARGS=()
if [ -n "${SHOWSHIP_AUTHORS:-}" ]; then
  IFS=',' read -r -a _AUTH <<< "$SHOWSHIP_AUTHORS"
  for a in "${_AUTH[@]}"; do
    a="$(echo "$a" | sed 's/^ *//;s/ *$//')"
    [ -n "$a" ] && AUTH_ARGS+=("--author=$a")
  done
fi

# Fetch quietly so teammates' pushed branches are visible (ignore failures, e.g. offline)
git fetch --all --quiet 2>/dev/null || true

echo "# Commit digest: $REPO"
echo "- Path: $ROOT"
echo "- Remote: $REMOTE"
echo "- Range: $SINCE → $UNTIL"
echo "- Current branch: $(git rev-parse --abbrev-ref HEAD)"
[ -n "${SHOWSHIP_AUTHORS:-}" ] && echo "- Filtered to authors: $SHOWSHIP_AUTHORS"
echo

COUNT=$(git log --all --no-merges --since="$SINCE" --until="$UNTIL" ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} --oneline | wc -l | tr -d ' ')
echo "- Total commits: $COUNT"
echo

if [ "$COUNT" = "0" ]; then
  echo "_No commits in this range._"
  exit 0
fi

echo "## Commits by author"
git log --all --no-merges --since="$SINCE" --until="$UNTIL" ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} --format='%an' | sort | uniq -c | sort -rn | sed 's/^/    /'
echo

git log --all --no-merges --since="$SINCE" --until="$UNTIL" ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} --format='%an' | sort -u | while read -r AUTHOR; do
  echo "## $AUTHOR"
  git log --all --no-merges --since="$SINCE" --until="$UNTIL" ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} --author="$AUTHOR" \
    --source --date=short --format='### %ad %h  %s   [branch: %S]%n%b' --stat=120,80
  echo
done

echo "## Branches touched in range"
git for-each-ref --sort=-committerdate --format='%(committerdate:short) %(refname:short)' refs/heads refs/remotes \
  | awk -v since="$(date -d "$SINCE" +%F 2>/dev/null || date -v-7d +%F)" '$1 >= since' | head -30
