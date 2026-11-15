/**
 * Sync: regenerate the inside of every `<!-- awesome:<name> -->` fragment in
 * a list's docs from its `.github/awesome.json`, leaving everything else
 * alone, and write every kit-owned file under `files/` into the list. Idempotent.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, CONFIG_PATH } = require('./lib/config');
const { copyFiles } = require('./lib/copy');

const FILES = ['README.md', 'contributing.md', '.github/pull_request_template.md'];
const KIT_DIR = path.join(__dirname, '..', 'files');
const FRAGMENT = /(<!-- awesome:([a-z-]+) -->)([\s\S]*?)(<!-- \/awesome:\2 -->)/g;
const OPENER = /<!-- awesome:([a-z-]+) -->/g;

/** The guide block: contributing.md from its how-to-add heading to the license line. */
const GUIDE = [
  '## How to add an entry',
  '',
  '1. Pick the section (and subsection, where there is one) that fits best.',
  '2. Add one line in this format:',
  '',
  '   ```markdown',
  '   - [Name](https://link) - Short description.',
  '   ```',
  '',
  '3. Keep the section in alphabetical order by name (case-insensitive).',
  '4. Write the description in your own words: one short sentence, 100 characters at most, ending with a period. Say what it does, plainly. No marketing words, no star counts, no emoji, no em dashes.',
  '5. Link the original source: the repository or product page for a project, the original post for an article or talk. No tracking links or mirrors.',
  '',
  '## Pull requests',
  '',
  '- One entry per pull request.',
  '- Use a title like `Add <Name>`.',
  '- Search the list first to make sure the entry is not already here.',
  '- Removals and fixes for dead links, archived repos or wrong descriptions are welcome; say why in the pull request.',
  '',
  'Every pull request is checked automatically against the rules above. One that fails is closed with a comment that says what to fix; a fixed pull request is welcome.',
  '',
  'By contributing, you agree to release your contribution under the [CC0 1.0](LICENSE) dedication.',
];

/**
 * Escape a value for an HTML context.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The content of every fragment, built from the config. Where a block's
 * closing marker sits (own line, or end of the last line) is the list's.
 * @param {object} config - awesome.json
 * @returns {Record<string, string>}
 */
function fragments(config) {
  const { repo, accent, minStars, maxInactiveMonths } = config;
  const inactive = maxInactiveMonths > 0
    ? `not archived, not marked deprecated by its owner, and with a commit in the last ${maxInactiveMonths} months`
    : 'not archived and not marked deprecated by its owner';
  return {
    hero: `<img src=".github/assets/hero.gif" width="100%" alt="${escapeHtml(config.heroAlt)}">`,
    title: `<h1 align="center">Awesome ${escapeHtml(config.topic)}</h1>`,
    tagline: escapeHtml(config.tagline),
    badges: [
      '<p align="center">',
      '  <a href="https://awesome.re"><img src="https://awesome.re/badge.svg" alt="Awesome"></a>',
      `  <a href="contributing.md"><img src="https://img.shields.io/badge/PRs-welcome-${accent}" alt="PRs welcome"></a>`,
      `  <a href="https://github.com/${repo}/commits/main"><img src="https://img.shields.io/github/last-commit/${repo}?color=${accent}" alt="Last commit"></a>`,
      '</p>',
    ].join('\n'),
    rules: [
      'An entry must be:',
      '',
      '- **Public:** a repository or page anyone can open without signing in.',
      '- **Documented:** a README or docs page that explains what it does and how to use it.',
      `- **Maintained:** for a repository, ${inactive}.`,
      `- **Established:** a GitHub project has at least ${minStars} stars when it is submitted.`,
      '- **Working:** every link resolves.',
    ].join('\n'),
    guide: GUIDE.join('\n'),
    checklist: [
      '- [ ] One entry in this pull request.',
      `- [ ] ${config.scope}`,
      '- [ ] It is public and documented, and every link works.',
      `- [ ] A GitHub project has at least ${minStars} stars.`,
      `- [ ] Repositories: ${inactive}.`,
      '- [ ] Format is `- [Name](https://link) - Short description.`',
      '- [ ] Placed in the right section, in alphabetical order.',
      '- [ ] Description is my own words, one sentence of 100 characters at most, ending with a period.',
      '- [ ] I searched the list and it is not already here.',
      '- [ ] I starred this repo if I found it helpful.',
    ].join('\n'),
    footer: [
      '## Contributing',
      '',
      'Contributions are welcome. Read the [contribution guidelines](contributing.md) first.',
      '',
      `Maintained by [${config.maintainer.name}](${config.maintainer.url}).`,
    ].join('\n'),
  };
}

/**
 * Regenerate every fragment in one text. Throws on an unknown or unclosed fragment.
 * @param {string} text
 * @param {Record<string, string>} values - from fragments()
 * @returns {{ text: string, names: string[] }} the new text and the fragment names seen
 */
function syncText(text, values) {
  const names = [];
  const synced = text.replace(FRAGMENT, (match, open, name, inner, close) => {
    if (!(name in values)) throw new Error(`unknown fragment "${name}"`);
    names.push(name);
    const lead = inner.match(/^\s*/)[0];
    const trail = inner.length > lead.length ? inner.match(/\s*$/)[0] : '';
    return `${open}${lead}${values[name]}${trail}${close}`;
  });

  const openers = [...text.matchAll(OPENER)].length;
  if (openers !== names.length) throw new Error(`${openers - names.length} fragment(s) without a closing marker`);
  return { text: synced, names };
}

/**
 * Sync the docs under a root folder from its `.github/awesome.json`, then
 * write each kit-owned file that differs.
 * @param {string} root - the repository folder
 * @returns {string[]} the files that changed
 */
function sync(root) {
  const values = fragments(loadConfig(path.join(root, CONFIG_PATH)));
  const results = FILES.map((file) => {
    const before = fs.readFileSync(path.join(root, file), 'utf8');
    return { file, before, ...syncText(before, values) };
  });

  const seen = new Set(results.flatMap((result) => result.names));
  const missing = Object.keys(values).filter((name) => !seen.has(name));
  if (missing.length) throw new Error(`fragments missing from every file: ${missing.join(', ')}`);

  const changed = results.filter((result) => result.text !== result.before);
  changed.forEach((result) => fs.writeFileSync(path.join(root, result.file), result.text));

  const kit = copyFiles(KIT_DIR, root, { overwrite: true });
  return [...changed.map((result) => result.file), ...kit];
}

module.exports = { sync, syncText, fragments };
