# awesome-kit

The shared engine behind my awesome lists. Every list runs the same checks: a pull request check that judges each new entry, a weekly sweep for dead links and archived repositories, and a daily sync that keeps the generated text and the shared files current. That code lives here, once. A list calls it by version tag, so a kit release reaches every list without a commit to any of them.

## Starting a new list

With Node 22 or later and `gh` signed in to the account that owns the list:

```sh
gh repo create ianwieds/awesome-x --public --clone
cd awesome-x
npx github:ianwieds/awesome-kit setup
```

Then edit `.github/awesome.json` (the defaults below are a starting point), replace `.github/assets/hero.gif` with the list's own hero image (1200x400, same name), write the README's sections and the contributing scope paragraph, run `setup` again, and commit.

`setup [dir]` runs in a git folder whose `origin` is the list's GitHub repository, as your own `gh` login. It does four things, in order, and prints one line for each that changed something (`scaffolded: ...`, `workflows: ...`, `synced: ...`, `settings: ...`), or `already set up` when none did:

1. **Scaffolds** every missing list-owned file from the kit's `scaffold/` folder: `README.md` (with example Libraries, Tools and Guides sections), `contributing.md`, `.github/pull_request_template.md`, `.github/assets/hero.gif`, and `.github/awesome.json` with defaults. It never overwrites a file that exists.
2. **Writes the three workflow files** from the kit's `workflows/` folder into `.github/workflows/`, rewriting any that differ.
3. **Runs sync.**
4. **Applies the shared repository settings** through the GitHub API: the description set to the tagline, `awesome` and `awesome-list` added to the topics (others kept), the wiki and projects off, and branches deleted after merge. A setting already right is left alone.

The `awesome.json` defaults: `repo` from `origin`; `topic` from the repository name with `awesome-` dropped and each word capitalized (`awesome-voice-agents` gives `Voice Agents`); the tagline, scope and hero alt text built from the topic; accent `FFA000`; `minStars` 10; `maxInactiveMonths` 12; the maintainer from the signed-in GitHub user's name (or login) and profile.

A folder with no `origin`, an `origin` that is not on GitHub, or no `gh` login fails loudly before anything is written. Setup commits and pushes nothing. Run it again on an existing list to bring its workflows and settings back to the kit's.

## How a list uses it

A list holds three short workflow files, which `setup` writes from the kit's `workflows/` folder. Each one runs the kit's composite action with one `command`; GitHub fetches the kit at the tag the list names (`@v2`), so the scripts always match that version.

[`pr-check.yml`](workflows/pr-check.yml): checks every new or changed entry, posts one sticky comment, and closes the pull request when it fails. It runs on `pull_request_target` so it can comment on and close a pull request from a fork; only the base branch is checked out, and the head README is read as data, never executed.

[`sweep.yml`](workflows/sweep.yml): every Monday, and on demand, re-checks every entry for dead links and archived or inactive repositories, and keeps one open `Entries to review` issue listing what it found. The issue closes itself once a sweep finds nothing.

[`maintenance.yml`](workflows/maintenance.yml): daily, on every push to `main`, and on demand, runs sync and commits any change as `chore: sync from awesome-kit`. Then it replaces the one empty commit on the `maintenance` branch (the first run starts that branch on top of `main`), so the repository stays active and GitHub never pauses the Monday sweep after 60 quiet days.

A list needs no `package.json`, `scripts/` or `tests/`; the kit carries all of it.

## The config: `.github/awesome.json`

Every value that defines a list lives in one file:

- `topic`: the subject, as it reads after "Awesome" in the title.
- `repo`: the list's repository, as `owner/name`.
- `tagline`: the one sentence under the title, and the repository description.
- `scope`: the pull request checklist line that says what belongs.
- `accent`: the badge color, six hex digits without `#`.
- `minStars`: the stars a GitHub project needs when it is submitted.
- `maxInactiveMonths`: `0` rejects only archived or broken repositories; `12` also rejects any repository with no push in the last 12 months.
- `maintainer`: a name and profile link for the "Maintained by" line.
- `heroAlt`: the alt text for the hero image.

A missing or mistyped value fails every command loudly, naming each problem.

## Who owns which file

- **Scaffolded once, then list-owned**: `README.md`, `contributing.md`, `.github/pull_request_template.md`, `.github/assets/hero.gif` and `.github/awesome.json`. Setup writes each one only when it is missing; after that, edit them freely outside the markers.
- **Kit-written inside markers**: the text between `<!-- awesome:<name> -->` and `<!-- /awesome:<name> -->` in the three docs. Sync rewrites it from the config, so change the value in `.github/awesome.json` instead. Each fragment must appear in at least one of the three files, or sync fails:
  - the README: `hero`, `title`, `tagline` and `badges`, and the `footer` block (the `## Contributing` section and the "Maintained by" line);
  - `contributing.md`: the `rules` block (the "An entry must be:" list, with the star bar and the inactivity rule from the config) and the `guide` block (from `## How to add an entry` through the license line). The intro sentence and the `## What belongs here` scope paragraph sit outside them, and a list's own extra rule goes after the `rules` block;
  - the pull request template: the `checklist` block, every shared checklist line with the scope and the star line included. The `**Entry:**` and `**Why it belongs here:**` lines sit above it, and a list's own extra checklist lines follow it.
- **Kit-owned whole files**: `LICENSE`, `code_of_conduct.md` and the three issue templates in `.github/ISSUE_TEMPLATE/`, written by sync from the kit's `files/` folder; and the three workflow files in `.github/workflows/`, written by setup from the kit's `workflows/` folder. Each is rewritten whenever the list's copy differs, so a local edit is undone. Sync never writes a workflow file: GitHub refuses a workflow change pushed with the workflow token the Maintenance job runs with.

## Running it locally

From a list's folder, with Node 22 or later:

```sh
npx github:ianwieds/awesome-kit setup                # scaffold, write the workflows, sync, apply the repo settings
npx github:ianwieds/awesome-kit sync                 # write the markers and the kit-owned files
npx github:ianwieds/awesome-kit sweep                # re-check every entry and print the report
npx github:ianwieds/awesome-kit check base.md head.md   # judge a README change, exit 0 on pass, 1 on fail
```

`setup`, `sync` and `sweep` take an optional folder (the current one by default); `check` takes an optional config path (`.github/awesome.json` by default). Add `#v2` after the repository name to run the version the workflows use. The sweep makes one GitHub API request per repository entry; set `GITHUB_TOKEN` (for example `GITHUB_TOKEN=$(gh auth token)`) to get past the anonymous rate limit.

## Developing the kit

`npm test` runs every test with Node's own runner; there is nothing to install. The kit's CI runs the same on every push to `main` and every pull request.

## Releasing

1. Make sure `npm test` passes, on `main` and in CI.
2. Move the `[Unreleased]` notes in `CHANGELOG.md` under the new version and set `version` in `package.json`.
3. Tag the release and push the tag: `git tag v2.x.y && git push origin v2.x.y`.
4. Move `v2` to it, which is what every list follows: `git tag -f v2 v2.x.y && git push -f origin v2`.

Every list picks up the release at its next run. A breaking change gets the next major tag (`v3`), which a list opts into by running that version's `setup`, which rewrites its three workflow files.

## License

[MIT](LICENSE). The `LICENSE` the kit writes into each list is that list's own CC0 dedication.
