#!/usr/bin/env bash
# Maintenance: sync the list from this kit version and commit any change to the
# branch the run is on, then replace the one empty commit on the `maintenance`
# branch so the repository stays active and GitHub never pauses the sweep.
set -euo pipefail

git config user.name "GitHub Actions"
git config user.email "actions@github.com"

node "$GITHUB_ACTION_PATH/bin/awesome.js" sync
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "chore: sync from awesome-kit"
  git push origin "HEAD:$GITHUB_REF_NAME"
fi

# A new list has no maintenance branch: start it with a new empty commit, since
# amending main's tip could repeat a workflow change the token may not push.
if git checkout maintenance 2>/dev/null; then
  git commit --allow-empty --amend -m "Maintenance"
else
  git checkout -b maintenance
  git commit --allow-empty -m "Maintenance"
fi
git push --force origin maintenance
