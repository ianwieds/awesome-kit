# awesome-kit

The shared engine behind my awesome lists. Every list runs the same checks: a pull request check that judges each new entry, a weekly sweep for dead links and archived repositories, and a daily sync that keeps the generated text and the shared files current. That code lives here, once. A list calls it by version tag, so a kit release reaches every list without a commit to any of them.

## How a list uses it

A list holds three short workflow files. Each one runs the kit's composite action with one `command`; GitHub fetches the kit at the tag the list names (`@v1`), so the scripts always match that version.

`.github/workflows/pr-check.yml`: checks every new or changed entry, posts one sticky comment, and closes the pull request when it fails. It runs on `pull_request_target` so it can comment on and close a pull request from a fork; only the base branch is checked out, and the head README is read as data, never executed.

```yaml
name: PR check

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: ianwieds/awesome-kit@v1
        with:
          command: pr-check
```

`.github/workflows/sweep.yml`: every Monday, and on demand, re-checks every entry for dead links and archived or inactive repositories, and keeps one open `Entries to review` issue listing what it found. The issue closes itself once a sweep finds nothing.

```yaml
name: Sweep

on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: ianwieds/awesome-kit@v1
        with:
          command: sweep
```

`.github/workflows/maintenance.yml`: daily, on every push to `main`, and on demand, runs sync and commits any change as `chore: sync from awesome-kit`. Then it replaces the one empty commit on the `maintenance` branch (the first run starts that branch on top of `main`), so the repository stays active and GitHub never pauses the Monday sweep after 60 quiet days.

```yaml
name: Maintenance

on:
  schedule:
    - cron: "0 1 * * *"
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: ianwieds/awesome-kit@v1
        with:
          command: maintenance
```

A list needs no `package.json`, `scripts/` or `tests/`; the kit carries all of it.

## The config: `.github/awesome.json`

Every value that defines a list lives in one file:

- `topic`: the subject, as it reads after "Awesome" in the title.
- `repo`: the list's repository, as `owner/name`.
- `tagline`: the one sentence under the title.
- `scope`: the pull request checklist line that says what belongs.
- `accent`: the badge color, six hex digits without `#`.
- `minStars`: the stars a GitHub project needs when it is submitted.
- `maxInactiveMonths`: `0` rejects only archived or broken repositories; `12` also rejects any repository with no push in the last 12 months.
- `maintainer`: a name and profile link for the "Maintained by" line.
- `heroAlt`: the alt text for the hero image.

A missing or mistyped value fails every command loudly, naming each problem.

## Who owns which file

- **List-owned**: `README.md`, `contributing.md`, `.github/pull_request_template.md`, `.github/assets/hero.gif`, `.github/awesome.json` and the three workflow files. Edit them freely. The kit never writes a workflow file: GitHub refuses a workflow change pushed with the workflow token.
- **Kit-written inside markers**: the text between `<!-- awesome:<name> -->` and `<!-- /awesome:<name> -->` in the three docs. Sync rewrites it from the config, so change the value in `.github/awesome.json` instead. The fragments are `hero`, `title`, `tagline`, `badges` and `maintainer` (the README), `stars` and `inactive` (contributing and the pull request template), `scope` and `star` (the pull request template). Each one must appear in at least one of the three files, or sync fails. The `star` line sits last in the pull request template: `- [ ] <!-- awesome:star -->I starred this repo if I found it helpful.<!-- /awesome:star -->`. Nothing checks it.
- **Kit-owned**: `LICENSE`, `code_of_conduct.md` and the three issue templates in `.github/ISSUE_TEMPLATE/`. Sync writes each one whole from the kit's `files/` folder whenever the list's copy differs, so a local edit is undone at the next sync.

## Running it locally

From a list's folder, with Node 22 or later:

```sh
npx github:ianwieds/awesome-kit sync                 # write the markers and the kit-owned files
npx github:ianwieds/awesome-kit sweep                # re-check every entry and print the report
npx github:ianwieds/awesome-kit check base.md head.md   # judge a README change, exit 0 on pass, 1 on fail
```

`sync` and `sweep` take an optional folder (the current one by default); `check` takes an optional config path (`.github/awesome.json` by default). Add `#v1` after the repository name to run the version the workflows use. The sweep makes one GitHub API request per repository entry; set `GITHUB_TOKEN` (for example `GITHUB_TOKEN=$(gh auth token)`) to get past the anonymous rate limit.

## Developing the kit

`npm test` runs every test with Node's own runner; there is nothing to install. The kit's CI runs the same on every push to `main` and every pull request.

## Releasing

1. Make sure `npm test` passes, on `main` and in CI.
2. Move the `[Unreleased]` notes in `CHANGELOG.md` under the new version and set `version` in `package.json`.
3. Tag the release and push the tag: `git tag v1.x.y && git push origin v1.x.y`.
4. Move `v1` to it, which is what every list follows: `git tag -f v1 v1.x.y && git push -f origin v1`.

Every list picks up the release at its next run. A breaking change gets `v2`, which a list opts into by editing its three workflow files.

## License

[MIT](LICENSE). The `LICENSE` the kit writes into each list is that list's own CC0 dedication.
