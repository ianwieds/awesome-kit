#!/usr/bin/env bash
# Sweep: re-check every entry and keep one open "Entries to review" issue
# current, closing it once a sweep finds nothing.
set -euo pipefail
# shellcheck source=lib/verdict.sh
source "$GITHUB_ACTION_PATH/jobs/lib/verdict.sh"

node "$GITHUB_ACTION_PATH/bin/awesome.js" sweep > "$RUNNER_TEMP/sweep.md"
verdict=$(read_verdict "$RUNNER_TEMP/sweep.md" "awesome-kit sweep")

marker='<!-- awesome:sweep -->'
number=$(gh issue list -R "$GITHUB_REPOSITORY" --state open --limit 200 --json number,body \
  --jq ".[] | select(.body | contains(\"$marker\")) | .number" | sed -n 1p)
if [ "$verdict" = pass ]; then
  if [ -n "$number" ]; then
    gh issue close "$number" -R "$GITHUB_REPOSITORY" --comment "The latest sweep found nothing to review."
  fi
  exit 0
fi
{ echo "$marker"; sed '$d' "$RUNNER_TEMP/sweep.md"; } > "$RUNNER_TEMP/body.md"
if [ -n "$number" ]; then
  gh issue edit "$number" -R "$GITHUB_REPOSITORY" --body-file "$RUNNER_TEMP/body.md"
else
  gh issue create -R "$GITHUB_REPOSITORY" --title "Entries to review" --body-file "$RUNNER_TEMP/body.md"
fi
