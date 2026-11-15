# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- [#7](../../issues/7) Thanks [@ianwieds]! - Before any write, setup checks the folder is the top of its git repository, and that an existing `.github/awesome.json` loads and names the origin's repository.
- [#7](../../issues/7) Thanks [@ianwieds]! - A retired v1 marker fails sync naming the block that replaces it, instead of `unknown fragment`, and an `awesome.json` that is not JSON fails naming the file.
- [#7](../../issues/7) Thanks [@ianwieds]! - Setup's `workflows:` line lists repo-relative paths, a doubled hyphen in a repository name no longer doubles a space in the default topic, and no `.DS_Store` is copied into a list.

## [2.0.0] - 2026-11-15

### Added
- [#2](../../issues/2) [`70c7280`](../../commit/70c7280) Thanks [@ianwieds]! - `awesome-kit setup [dir]` scaffolds a list's missing files (README, contributing, pull request template, hero image, `.github/awesome.json` with defaults), writes the three workflows, runs sync, and sets the repository description, topics, wiki, projects and branch deletion through `gh`. It never overwrites a list-owned file.
- [#2](../../issues/2) [`70c7280`](../../commit/70c7280) Thanks [@ianwieds]! - Kit-written blocks for the shared prose: `rules` and `guide` in `contributing.md`, `checklist` in the pull request template, and `footer` (the Contributing section and the maintainer line) in the README.

### Changed
- [#2](../../issues/2) [`70c7280`](../../commit/70c7280) Thanks [@ianwieds]! - The three workflow files are kit-owned: setup rewrites any that differ from the kit's `workflows/` folder. Sync still never writes one.
- [#2](../../issues/2) [`70c7280`](../../commit/70c7280) Thanks [@ianwieds]! - The `stars`, `inactive`, `scope`, `star` and `maintainer` markers are retired; their text is part of the new blocks. A list still holding one fails sync until it moves to the blocks.
- [#2](../../issues/2) [`70c7280`](../../commit/70c7280) Thanks [@ianwieds]! - Breaking: lists follow the new `v2` tag. A list moves by switching to the new blocks and running setup, which points its workflows at `@v2`; lists on `v1` keep working until then.

## [1.0.0] - 2026-11-14

### Added
- [ianwieds/.dotfiles#417](https://github.com/ianwieds/.dotfiles/issues/417) - The first release: the pull request check, the sweep and the sync every awesome list ran from its own copy now live here, with their tests. A list runs them through the composite action (`ianwieds/awesome-kit@v1`, command `pr-check`, `sweep` or `maintenance`) or locally through the `awesome-kit` CLI. A list's config moves to `.github/awesome.json`. Sync also writes the kit-owned `LICENSE`, `code_of_conduct.md` and issue templates, and a new `star` fragment for the pull request template. The maintenance job commits any sync change before bumping the keep-alive branch, and a list with no `maintenance` branch gets one as a new empty commit on top of `main`, never an amend of `main`'s tip.

---

## Contributors

- [@ianwieds]

[@ianwieds]: https://github.com/ianwieds
