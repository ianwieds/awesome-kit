/**
 * Setup: make a git folder whose origin is a list's GitHub repository a whole
 * list. Scaffold each missing list-owned file, write the kit's workflows, run
 * sync, then apply the shared repository settings through gh. Idempotent; it
 * commits and pushes nothing.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sync } = require('./sync');
const { loadConfig, CONFIG_PATH } = require('./lib/config');
const { copyFiles } = require('./lib/copy');
const { ghApi } = require('./lib/gh');

const SCAFFOLD_DIR = path.join(__dirname, '..', 'scaffold');
const WORKFLOW_DIR = path.join(__dirname, '..', 'workflows');
const WORKFLOWS_PATH = '.github/workflows';
const ORIGIN = /(?:^|[@/])github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/;
const TOPICS = ['awesome', 'awesome-list'];

/**
 * The GitHub repository the origin remote points at, for a folder at the top
 * of its git repository.
 * @param {string} root
 * @returns {{ owner: string, name: string }}
 */
function originRepo(root) {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  if (top.error) throw new Error(`cannot run git in ${root}: ${top.error.message}`);
  if (top.status !== 0) throw new Error(`${root} is not a git repository: run setup in the list's own repository folder`);
  if (fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(root)) {
    throw new Error(`${root} is not the top of a git repository: run setup in the list's own repository folder`);
  }
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`no "origin" remote in ${root}: setup needs the list's GitHub repository as origin`);
  const url = result.stdout.trim();
  const match = url.match(ORIGIN);
  if (!match) throw new Error(`origin is not a GitHub repository: ${url}`);
  return { owner: match[1], name: match[2] };
}

/**
 * A new list's config: the topic from the repository name, the maintainer
 * from the signed-in GitHub user.
 * @param {{ owner: string, name: string }} repo
 * @param {{ login: string, name: string|null, html_url: string }} user - `gh api user`
 * @returns {object} awesome.json
 */
function defaultConfig(repo, user) {
  const topic = repo.name.replace(/^awesome-/, '').split('-').filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
  return {
    topic,
    repo: `${repo.owner}/${repo.name}`,
    tagline: `A curated list of ${topic} libraries, tools and guides.`,
    scope: `It is about ${topic}, not just a project that happens to use it.`,
    accent: 'FFA000',
    minStars: 10,
    maxInactiveMonths: 12,
    maintainer: { name: user.name || user.login, url: user.html_url },
    heroAlt: `Animated isometric scene for ${topic}.`,
  };
}

/**
 * Write each missing list-owned file: the config, then the boilerplate.
 * @param {string} root
 * @param {object} config - written only when the list has none
 * @returns {string[]} the files written, sorted
 */
function scaffold(root, config) {
  const written = copyFiles(SCAFFOLD_DIR, root, { overwrite: false });
  const configFile = path.join(root, CONFIG_PATH);
  if (fs.existsSync(configFile)) return written;
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  return [...written, CONFIG_PATH].sort();
}

/**
 * Apply the shared repository settings, each only when it differs.
 * @param {string} repo - owner/name
 * @param {string} tagline - the repository description
 * @returns {string[]} the settings changed
 */
function applySettings(repo, tagline) {
  const want = { description: tagline, has_wiki: false, has_projects: false, delete_branch_on_merge: true };
  const current = ghApi(`repos/${repo}`);
  const changed = Object.keys(want).filter((key) => current[key] !== want[key]);
  if (changed.length) ghApi(`repos/${repo}`, { method: 'PATCH', body: want });

  const { names } = ghApi(`repos/${repo}/topics`);
  const topics = [...new Set([...names, ...TOPICS])];
  if (topics.length === names.length) return changed;
  ghApi(`repos/${repo}/topics`, { method: 'PUT', body: { names: topics } });
  return [...changed, 'topics'];
}

/**
 * Check an existing config before any write: it must load, and name the
 * origin's repository.
 * @param {string} root
 * @param {string} repo - owner/name, from origin
 */
function checkExistingConfig(root, repo) {
  const file = path.join(root, CONFIG_PATH);
  if (!fs.existsSync(file)) return;
  const named = loadConfig(file).repo;
  if (named.toLowerCase() !== repo.toLowerCase()) throw new Error(`${CONFIG_PATH} names ${named}, but origin is ${repo}`);
}

/**
 * Set up the list in a folder. The origin, an existing config and the gh
 * login are checked before anything is written.
 * @param {string} root - the list's git folder
 * @returns {string[]} one line per step that changed something, empty when none did
 */
function setup(root) {
  const repo = originRepo(root);
  const slug = `${repo.owner}/${repo.name}`;
  checkExistingConfig(root, slug);
  const user = ghApi('user');

  const steps = [
    ['scaffolded', scaffold(root, defaultConfig(repo, user))],
    ['workflows', copyFiles(WORKFLOW_DIR, path.join(root, WORKFLOWS_PATH), { overwrite: true }).map((file) => `${WORKFLOWS_PATH}/${file}`)],
    ['synced', sync(root)],
    ['settings', applySettings(slug, loadConfig(path.join(root, CONFIG_PATH)).tagline)],
  ];
  return steps.filter(([, done]) => done.length).map(([label, done]) => `${label}: ${done.join(', ')}`);
}

module.exports = { setup };
