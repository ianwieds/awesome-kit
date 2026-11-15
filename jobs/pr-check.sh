#!/usr/bin/env bash
# PR check, run on pull_request_target with the list's token, so a fork's pull
# request can be commented on and closed. Only the base branch is checked out;
# the head README is read as data through the contents API, never executed.
set -euo pipefail
# shellcheck source=lib/verdict.sh
source "$GITHUB_ACTION_PATH/jobs/lib/verdict.sh"

gh api "repos/$HEAD_REPO/contents/README.md?ref=$HEAD_SHA" \
  -H "Accept: application/vnd.github.raw" > "$RUNNER_TEMP/head.md"

node "$GITHUB_ACTION_PATH/bin/awesome.js" check README.md "$RUNNER_TEMP/head.md" > "$RUNNER_TEMP/report.md" || true
verdict=$(read_verdict "$RUNNER_TEMP/report.md" "awesome-kit check")

# One sticky comment: the first comment that starts with the marker is edited in place.
marker='<!-- awesome:pr-check -->'
{ echo "$marker"; cat "$RUNNER_TEMP/report.md"; } > "$RUNNER_TEMP/comment.md"
id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
  --jq ".[] | select(.body | startswith(\"$marker\")) | .id" | sed -n 1p)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -F "body=@$RUNNER_TEMP/comment.md" > /dev/null
else
  gh pr comment "$PR" -R "$GITHUB_REPOSITORY" --body-file "$RUNNER_TEMP/comment.md"
fi

if [ "$verdict" = fail ]; then
  gh pr close "$PR" -R "$GITHUB_REPOSITORY"
fi
