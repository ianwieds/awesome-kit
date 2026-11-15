const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sync } = require('../src/sync');
const { runSetup } = require('./helpers');

const KIT = path.join(__dirname, '..');
const LIST = path.join(__dirname, 'fixtures', 'list');
const REPO = 'someone/awesome-voice-agents';
const TAGLINE = 'A curated list of Voice Agents libraries, tools and guides.';
const USER = JSON.stringify({ login: 'someone', name: 'Some One', html_url: 'https://github.com/someone' });
const FRESH = {
  FAKE_GH_USER: USER,
  FAKE_GH_REPO: JSON.stringify({ description: null, has_wiki: true, has_projects: true, delete_branch_on_merge: false }),
  FAKE_GH_TOPICS: JSON.stringify({ names: ['voice'] }),
};
const SET_UP = {
  FAKE_GH_USER: USER,
  FAKE_GH_REPO: JSON.stringify({ description: TAGLINE, has_wiki: false, has_projects: false, delete_branch_on_merge: true }),
  FAKE_GH_TOPICS: JSON.stringify({ names: ['voice', 'awesome', 'awesome-list'] }),
};
const DOCS = ['README.md', 'contributing.md', '.github/pull_request_template.md'];

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

/**
 * A new git folder, with an origin unless given null.
 * @param {string|null} [origin]
 * @returns {string}
 */
function gitFolder(origin = `git@github.com:${REPO}.git`) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-setup-'));
  git(dir, 'init', '--quiet', '--initial-branch=main');
  if (origin) git(dir, 'remote', 'add', 'origin', origin);
  return dir;
}

/**
 * Every file in a folder outside .git, with its content.
 * @param {string} dir
 * @returns {Record<string, string>}
 */
function snapshot(dir) {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true })
    .filter((file) => file.split(path.sep)[0] !== '.git' && fs.statSync(path.join(dir, file)).isFile())
    .sort()
    .map((file) => [file, read(dir, file)]));
}

test('setup turns an empty git folder into a whole list and applies the shared settings', () => {
  const dir = gitFolder();
  const { status, stdout, stderr, calls } = runSetup(dir, FRESH);
  assert.equal(status, 0, stderr);
  assert.equal(stdout, [
    'scaffolded: .github/assets/hero.gif, .github/awesome.json, .github/pull_request_template.md, README.md, contributing.md',
    'workflows: maintenance.yml, pr-check.yml, sweep.yml',
    'synced: README.md, contributing.md, .github/pull_request_template.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/report.yml, .github/ISSUE_TEMPLATE/suggest.yml, LICENSE, code_of_conduct.md',
    'settings: description, has_wiki, has_projects, delete_branch_on_merge, topics',
    '',
  ].join('\n'));

  assert.deepEqual(JSON.parse(read(dir, '.github/awesome.json')), {
    topic: 'Voice Agents',
    repo: REPO,
    tagline: TAGLINE,
    scope: 'It is about Voice Agents, not just a project that happens to use it.',
    accent: 'FFA000',
    minStars: 10,
    maxInactiveMonths: 12,
    maintainer: { name: 'Some One', url: 'https://github.com/someone' },
    heroAlt: 'Animated isometric scene for Voice Agents.',
  });
  assert.match(read(dir, 'README.md'), /<h1 align="center">Awesome Voice Agents<\/h1>/);
  assert.match(read(dir, 'README.md'), /\nMaintained by \[Some One\]\(https:\/\/github.com\/someone\)\.\n/);
  for (const file of ['maintenance.yml', 'pr-check.yml', 'sweep.yml']) {
    assert.equal(read(dir, `.github/workflows/${file}`), read(KIT, `workflows/${file}`), file);
  }
  assert.ok(fs.readFileSync(path.join(dir, '.github/assets/hero.gif')).equals(fs.readFileSync(path.join(KIT, 'scaffold/.github/assets/hero.gif'))));

  assert.deepEqual(calls, [
    { args: ['api', 'user'], body: null },
    { args: ['api', `repos/${REPO}`], body: null },
    { args: ['api', `repos/${REPO}`, '--method', 'PATCH', '--input', '-'], body: JSON.stringify({ description: TAGLINE, has_wiki: false, has_projects: false, delete_branch_on_merge: true }) },
    { args: ['api', `repos/${REPO}/topics`], body: null },
    { args: ['api', `repos/${REPO}/topics`, '--method', 'PUT', '--input', '-'], body: JSON.stringify({ names: ['voice', 'awesome', 'awesome-list'] }) },
  ]);
});

test('the scaffolded docs, synced with the fixture list\'s config, are the fixture list\'s docs', () => {
  const dir = gitFolder();
  assert.equal(runSetup(dir, FRESH).status, 0);
  fs.copyFileSync(path.join(LIST, '.github/awesome.json'), path.join(dir, '.github/awesome.json'));
  sync(dir);
  for (const file of DOCS) assert.equal(read(dir, file), read(LIST, file), file);
});

test('a second run writes nothing, changes no setting and prints already set up', () => {
  const dir = gitFolder();
  assert.equal(runSetup(dir, FRESH).status, 0);
  const before = snapshot(dir);

  const { status, stdout, stderr, calls } = runSetup(dir, SET_UP);
  assert.equal(status, 0, stderr);
  assert.equal(stdout, 'already set up\n');
  assert.deepEqual(snapshot(dir), before);
  assert.deepEqual(calls.filter(({ args }) => args.includes('--method')), []);
});

test('setup never overwrites an existing list-owned file, and sets the description from its config', () => {
  const dir = gitFolder();
  for (const file of [...DOCS, '.github/awesome.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), `${read(LIST, file)}${file.endsWith('.md') ? '\nA line of the list\'s own.\n' : ''}`);
  }
  const before = Object.fromEntries([...DOCS, '.github/awesome.json'].map((file) => [file, read(dir, file)]));

  const { status, stdout, stderr, calls } = runSetup(dir, FRESH);
  assert.equal(status, 0, stderr);
  assert.match(stdout, /^scaffolded: \.github\/assets\/hero\.gif\n/);
  for (const [file, text] of Object.entries(before)) assert.equal(read(dir, file), text, file);
  const patch = calls.find(({ args }) => args.includes('PATCH'));
  assert.equal(JSON.parse(patch.body).description, 'A curated list of Your Topic libraries, tools and guides.');
});

test('setup rewrites a changed or missing workflow file', () => {
  const dir = gitFolder();
  assert.equal(runSetup(dir, FRESH).status, 0);
  fs.appendFileSync(path.join(dir, '.github/workflows/sweep.yml'), '# a local edit\n');
  fs.rmSync(path.join(dir, '.github/workflows/pr-check.yml'));

  const { status, stdout, stderr } = runSetup(dir, SET_UP);
  assert.equal(status, 0, stderr);
  assert.equal(stdout, 'workflows: pr-check.yml, sweep.yml\n');
  for (const file of ['pr-check.yml', 'sweep.yml']) assert.equal(read(dir, `.github/workflows/${file}`), read(KIT, `workflows/${file}`), file);
});

test('no origin, a non-GitHub origin or no gh login fails loudly and writes nothing', () => {
  const cases = [
    [null, FRESH, /no "origin" remote/],
    ['https://gitlab.com/someone/awesome-voice-agents.git', FRESH, /origin is not a GitHub repository: https:\/\/gitlab\.com/],
    ['https://notgithub.com/someone/awesome-voice-agents.git', FRESH, /origin is not a GitHub repository: https:\/\/notgithub\.com/],
    [`https://github.com/${REPO}`, { ...FRESH, FAKE_GH_USER: '' }, /gh api user failed: To get started with GitHub CLI/],
  ];
  for (const [origin, env, message] of cases) {
    const dir = gitFolder(origin);
    const { status, stderr, calls } = runSetup(dir, env);
    assert.notEqual(status, 0, String(origin));
    assert.match(stderr, message);
    assert.deepEqual(snapshot(dir), {});
    assert.deepEqual(calls.filter(({ args }) => args.includes('--method')), []);
  }
});

test('the repo comes from any GitHub origin form, and the topic from its name', () => {
  for (const origin of [`git@github.com:${REPO}.git`, `https://github.com/${REPO}.git`, `https://github.com/${REPO}`, `ssh://git@github.com/${REPO}.git`]) {
    const dir = gitFolder(origin);
    assert.equal(runSetup(dir, FRESH).status, 0, origin);
    const config = JSON.parse(read(dir, '.github/awesome.json'));
    assert.deepEqual([config.repo, config.topic], [REPO, 'Voice Agents'], origin);
  }
  const dir = gitFolder('git@github.com:someone/awesome-ai-devtools.git');
  const nameless = JSON.stringify({ login: 'someone', name: null, html_url: 'https://github.com/someone' });
  assert.equal(runSetup(dir, { ...FRESH, FAKE_GH_USER: nameless }).status, 0);
  const config = JSON.parse(read(dir, '.github/awesome.json'));
  assert.deepEqual([config.topic, config.maintainer.name], ['Ai Devtools', 'someone']);
});
