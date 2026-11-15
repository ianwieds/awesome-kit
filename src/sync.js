/**
 * Sync: regenerate the inside of every `<!-- awesome:<name> -->` fragment in
 * a list's docs from its `.github/awesome.json`, leaving everything else
 * alone, and write every kit-owned file under `files/` into the list. Idempotent.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, CONFIG_PATH } = require('./lib/config');

const FILES = ['README.md', 'contributing.md', '.github/pull_request_template.md'];
const KIT_DIR = path.join(__dirname, '..', 'files');
const FRAGMENT = /(<!-- awesome:([a-z-]+) -->)([\s\S]*?)(<!-- \/awesome:\2 -->)/g;
const OPENER = /<!-- awesome:([a-z-]+) -->/g;

/**
 * Escape a value for an HTML context.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The content of every fragment, built from the config.
 * @param {object} config - awesome.json
 * @returns {Record<string, string>}
 */
function fragments(config) {
  const { repo, accent, minStars, maxInactiveMonths } = config;
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
    maintainer: `Maintained by [${config.maintainer.name}](${config.maintainer.url}).`,
    stars: `at least ${minStars} stars`,
    inactive: maxInactiveMonths > 0
      ? `not archived, not marked deprecated by its owner, and with a commit in the last ${maxInactiveMonths} months`
      : 'not archived and not marked deprecated by its owner',
    scope: config.scope,
    star: 'I starred this repo if I found it helpful.',
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
 * The kit-owned files a list's copy differs from, missing ones included.
 * @param {string} root - the repository folder
 * @returns {string[]} paths relative to the kit's files/ folder, sorted
 */
function staleKitFiles(root) {
  return fs.readdirSync(KIT_DIR, { recursive: true })
    .filter((file) => fs.statSync(path.join(KIT_DIR, file)).isFile())
    .filter((file) => {
      const target = path.join(root, file);
      return !fs.existsSync(target) || !fs.readFileSync(target).equals(fs.readFileSync(path.join(KIT_DIR, file)));
    })
    .sort();
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

  const kit = staleKitFiles(root);
  kit.forEach((file) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(KIT_DIR, file), path.join(root, file));
  });
  return [...changed.map((result) => result.file), ...kit];
}

module.exports = { sync, syncText, fragments };
