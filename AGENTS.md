# awesome-kit: Architecture Overview

The shared engine every awesome list calls. A list holds its docs, its `.github/awesome.json` and three workflow files the kit writes; everything that runs lives here, once, and a list names the version it runs by tag (`ianwieds/awesome-kit@v2`). `README.md` is the human guide to the same system.

## Layout

```
action.yml          the composite action: input `command` (pr-check | sweep | maintenance)
bin/awesome.js      the CLI: setup [dir] | sync [dir] | sweep [dir] | check <base.md> <head.md> [config]
jobs/<command>.sh   the shell each action command runs on GitHub (gh calls, comments, issues, commits)
jobs/lib/verdict.sh read_verdict, the one parser of a report's `verdict:` line, sourced by the jobs
src/setup.js        a list's first and repeat setup: scaffold, workflows, sync, repo settings
src/sync.js         marker fragments and blocks from the config, plus the kit-owned files
src/check-pr.js     the pull request verdict and report
src/sweep.js        the whole-list re-check and report
src/lib/            config (load + validate, CONFIG_PATH), copy (kit folder into a list), gh (setup's GitHub API calls), github (repo lookup), links (reachability), node-version (the CLI's floor, from engines), readme (parse + diff), rules (entry format)
files/              kit-owned whole files sync writes into a list
scaffold/           list-owned boilerplate setup writes once when missing (README, contributing, PR template, hero.gif)
workflows/          the three caller workflows setup writes into a list's .github/workflows/
tests/              node:test suites; tests/fixtures/list/ is a whole list the sync and CLI tests copy
```

Node 22 or later, CommonJS, no dependencies.

## Entry points

- **The action** (`action.yml`) is what a list's workflow runs. It refuses any command without a `jobs/<command>.sh` (a test holds the two lists equal), checks out the list (the token kept only for `maintenance`, which pushes), sets up Node, and runs `jobs/<command>.sh` with the event values passed through `env:`, never inlined into a script. The job scripts call the CLI by `$GITHUB_ACTION_PATH`, so they run the kit at the list's tag.
- **The CLI** (`bin/awesome.js`) is the one command surface, for the jobs and for local use (`npx github:ianwieds/awesome-kit <command>`). The `src/` modules export functions only; none runs on its own.
- **Setup** (`awesome-kit setup [dir]`, `src/setup.js`) runs only locally, as the list owner's own `gh` login, never in a job. It reads the repository from `git remote get-url origin` and the maintainer from `gh api user`, both before any write; then scaffolds the missing list-owned files from `scaffold/` (plus `.github/awesome.json`, built in code from defaults), writes `workflows/` into `.github/workflows/`, runs sync, and applies the shared repo settings through `gh api` (`src/lib/gh.js`, the one module that calls gh from Node).

## Rules

- **`files/` is kit-owned.** Every file under it is written whole, at the same relative path, into each list by sync whenever the list's copy differs. Adding a file there adds it to every list; a list's edit to one is undone at the next sync. A workflow file never goes there: GitHub refuses a workflow change pushed with the workflow token.
- **`workflows/` is kit-owned, written by setup only.** Setup rewrites each list workflow that differs; sync never touches one.
- **`scaffold/` is written once.** Setup copies a file from it only when the list has none. Every marker in it holds a placeholder line that the sync setup runs right after replaces, so no fragment text lives there.
- **Markers are kit-written.** The text inside `<!-- awesome:<name> -->` fragments comes from `fragments()` in `src/sync.js`, the one home of every block's wording (`rules`, `guide`, `checklist`, `footer`) as well as the short fragments; every fragment must appear in at least one of the list's three docs, or sync fails. A multi-line block opens on its own line. The `rules` and `checklist` blocks close at the end of their last line, so a list's own bullets right after them stay in the same Markdown list; `guide`, `footer` and `badges` close on their own line. Sync keeps whichever form a list has.
- **The network is the only stub.** Tests inject `fetch` (`tests/helpers.js`'s `routeFetch`), and the job and setup tests put a fake `gh` (`tests/fixtures/gh.js`) first on PATH; everything else runs real, git included.
- **Releases**: tests green, then a `v2.x.y` tag and the moving `v2` tag forced onto it. Lists follow `v2`, so a merged change reaches them only when `v2` moves. A breaking change is the next major tag.
- **Work items** for the kit and every awesome list are GitHub issues in this repo (`ianwieds/awesome-kit`), never in another repo.
