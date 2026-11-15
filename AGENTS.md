# awesome-kit: Architecture Overview

The shared engine every awesome list calls. A list holds its docs, its `.github/awesome.json` and three workflow files; everything that runs lives here, once, and a list names the version it runs by tag (`ianwieds/awesome-kit@v1`). `README.md` is the human guide to the same system.

## Layout

```
action.yml          the composite action: input `command` (pr-check | sweep | maintenance)
bin/awesome.js      the CLI: sync [dir] | sweep [dir] | check <base.md> <head.md> [config]
jobs/<command>.sh   the shell each action command runs on GitHub (gh calls, comments, issues, commits)
jobs/lib/verdict.sh read_verdict, the one parser of a report's `verdict:` line, sourced by the jobs
src/sync.js         marker fragments from the config, plus the kit-owned files
src/check-pr.js     the pull request verdict and report
src/sweep.js        the whole-list re-check and report
src/lib/            config (load + validate, CONFIG_PATH), github (repo lookup), links (reachability), node-version (the CLI's floor, from engines), readme (parse + diff), rules (entry format)
files/              kit-owned whole files sync writes into a list
tests/              node:test suites; tests/fixtures/list/ is a whole list the sync and CLI tests copy
```

Node 22 or later, CommonJS, no dependencies.

## Two entry points

- **The action** (`action.yml`) is what a list's workflow runs. It refuses any command without a `jobs/<command>.sh` (a test holds the two lists equal), checks out the list (the token kept only for `maintenance`, which pushes), sets up Node, and runs `jobs/<command>.sh` with the event values passed through `env:`, never inlined into a script. The job scripts call the CLI by `$GITHUB_ACTION_PATH`, so they run the kit at the list's tag.
- **The CLI** (`bin/awesome.js`) is the one command surface, for the jobs and for local use (`npx github:ianwieds/awesome-kit <command>`). The `src/` modules export functions only; none runs on its own.

## Rules

- **`files/` is kit-owned.** Every file under it is written whole, at the same relative path, into each list by sync whenever the list's copy differs. Adding a file there adds it to every list; a list's edit to one is undone at the next sync. A workflow file never goes there: GitHub refuses a workflow change pushed with the workflow token.
- **Markers are kit-written.** The text inside `<!-- awesome:<name> -->` fragments comes from `fragments()` in `src/sync.js`; every fragment must appear in at least one of the list's three docs, or sync fails.
- **The network is the only stub.** Tests inject `fetch` (`tests/helpers.js`'s `routeFetch`), and the job tests put a fake `gh` (`tests/fixtures/gh.js`) first on PATH; everything else runs real, git included.
- **Releases**: tests green, then a `v1.x.y` tag and the moving `v1` tag forced onto it. Lists follow `v1`, so a merged change reaches them only when `v1` moves. A breaking change is `v2`.
