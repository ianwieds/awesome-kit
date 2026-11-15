# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-14

### Added
- [ianwieds/.dotfiles#417](https://github.com/ianwieds/.dotfiles/issues/417) - The first release: the pull request check, the sweep and the sync every awesome list ran from its own copy now live here, with their tests. A list runs them through the composite action (`ianwieds/awesome-kit@v1`, command `pr-check`, `sweep` or `maintenance`) or locally through the `awesome-kit` CLI. A list's config moves to `.github/awesome.json`. Sync also writes the kit-owned `LICENSE`, `code_of_conduct.md` and issue templates, and a new `star` fragment for the pull request template. The maintenance job commits any sync change before bumping the keep-alive branch, and a list with no `maintenance` branch gets one as a new empty commit on top of `main`, never an amend of `main`'s tip.
