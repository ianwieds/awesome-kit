const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sync } = require('../src/sync');
const { listCopy, KIT_FILES } = require('./helpers');

const DOCS = ['README.md', 'contributing.md', '.github/pull_request_template.md'];
const CONFIG = '.github/awesome.json';
const LIST = path.join(__dirname, 'fixtures', 'list');
const FRAGMENT = /(<!-- awesome:([a-z-]+) -->)[\s\S]*?(<!-- \/awesome:\2 -->)/g;

const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const editConfig = (dir, changes) => {
  const config = JSON.parse(read(dir, CONFIG));
  fs.writeFileSync(path.join(dir, CONFIG), JSON.stringify({ ...config, ...changes }));
};
const outside = (text) => text.replace(FRAGMENT, '$1$3');

test('the fixture list already matches its .github/awesome.json', () => {
  assert.deepEqual(sync(listCopy()), []);
});

test('sync writes every value from awesome.json into its fragments', () => {
  const dir = listCopy();
  editConfig(dir, {
    topic: 'Rust',
    repo: 'someone/awesome-rust',
    tagline: 'Crates & tools for Rust.',
    scope: 'It is about Rust itself.',
    accent: '123ABC',
    minStars: 25,
    maxInactiveMonths: 12,
    maintainer: { name: 'Jane Doe', url: 'https://example.com/jane' },
    heroAlt: 'A crab on a gear.',
  });
  assert.deepEqual(sync(dir), DOCS);

  const readme = read(dir, 'README.md');
  assert.match(readme, /<img src=".github\/assets\/hero.gif" width="100%" alt="A crab on a gear.">/);
  assert.match(readme, /<h1 align="center">Awesome Rust<\/h1>/);
  assert.match(readme, /Crates &amp; tools for Rust\./);
  assert.match(readme, /PRs-welcome-123ABC/);
  assert.match(readme, /github.com\/someone\/awesome-rust\/commits\/main/);
  assert.match(readme, /last-commit\/someone\/awesome-rust\?color=123ABC/);
  assert.match(readme, /\nMaintained by \[Jane Doe\]\(https:\/\/example.com\/jane\)\.\n/);

  const contributing = read(dir, 'contributing.md');
  assert.match(contributing, /\n- \*\*Established:\*\* a GitHub project has at least 25 stars when it is submitted\.\n/);
  assert.match(contributing, /\n- \*\*Maintained:\*\* for a repository, not archived, not marked deprecated by its owner, and with a commit in the last 12 months\.\n/);

  const template = read(dir, '.github/pull_request_template.md');
  assert.match(template, /\n- \[ \] It is about Rust itself\.\n/);
  assert.match(template, /\n- \[ \] A GitHub project has at least 25 stars\.\n/);
  assert.match(template, /\n- \[ \] Repositories: not archived, not marked deprecated by its owner, and with a commit in the last 12 months\.\n/);
});

test('sync leaves everything outside the fragments alone', () => {
  const dir = listCopy();
  const before = DOCS.map((file) => read(dir, file));
  editConfig(dir, { topic: 'Rust', minStars: 25, maxInactiveMonths: 12 });
  sync(dir);
  assert.deepEqual(DOCS.map((file) => outside(read(dir, file))), before.map(outside));
});

test('running sync twice equals running it once', () => {
  const dir = listCopy();
  editConfig(dir, { topic: 'Rust', accent: '123ABC', maxInactiveMonths: 6 });
  sync(dir);
  const once = DOCS.map((file) => read(dir, file));
  assert.deepEqual(sync(dir), []);
  assert.deepEqual(DOCS.map((file) => read(dir, file)), once);
});

test('maxInactiveMonths 0 words the Maintained rule and checklist line as archived or deprecated only', () => {
  const dir = listCopy();
  editConfig(dir, { maxInactiveMonths: 12 });
  sync(dir);
  editConfig(dir, { maxInactiveMonths: 0 });
  assert.deepEqual(sync(dir), ['contributing.md', '.github/pull_request_template.md']);
  assert.match(read(dir, 'contributing.md'), /\n- \*\*Maintained:\*\* for a repository, not archived and not marked deprecated by its owner\.\n/);
  assert.match(read(dir, '.github/pull_request_template.md'), /\n- \[ \] Repositories: not archived and not marked deprecated by its owner\.\n/);
});

test('an unknown, unclosed or missing fragment fails loudly and writes nothing', () => {
  const cases = [
    [(text) => `${text}<!-- awesome:mystery -->x<!-- /awesome:mystery -->\n`, /unknown fragment "mystery"/],
    [(text) => `${text}<!-- awesome:title -->no close\n`, /1 fragment\(s\) without a closing marker/],
    [(text) => text.replace(FRAGMENT, (m, open, name) => (name === 'footer' ? '' : m)), /fragments missing from every file: footer/],
  ];
  for (const [breakIt, message] of cases) {
    const dir = listCopy();
    fs.writeFileSync(path.join(dir, 'README.md'), breakIt(read(dir, 'README.md')));
    editConfig(dir, { topic: 'Rust' });
    const before = DOCS.map((file) => read(dir, file));
    assert.throws(() => sync(dir), message);
    assert.deepEqual(DOCS.map((file) => read(dir, file)), before);
  }
});

test('sync reads .github/awesome.json: a list with only a top-level awesome.json fails, naming that path', () => {
  const dir = listCopy();
  fs.renameSync(path.join(dir, CONFIG), path.join(dir, 'awesome.json'));
  assert.throws(() => sync(dir), (error) => error.message.includes(path.join(dir, '.github', 'awesome.json')));
});

test('sync writes each block whole, keeping where its closing marker sits', () => {
  const dir = listCopy();
  const blocks = [['README.md', 'footer', '\n'], ['contributing.md', 'rules', ''], ['contributing.md', 'guide', '\n'], ['.github/pull_request_template.md', 'checklist', '']];
  for (const [file, name, trail] of blocks) {
    const marker = new RegExp(`(<!-- awesome:${name} -->)[\\s\\S]*?(<!-- /awesome:${name} -->)`);
    fs.writeFileSync(path.join(dir, file), read(dir, file).replace(marker, `$1\nA placeholder.${trail}$2`));
  }
  assert.deepEqual(sync(dir), DOCS);
  for (const file of DOCS) assert.equal(read(dir, file), read(LIST, file), file);
});

test('an edit inside a block is undone, and a second sync changes nothing', () => {
  const dir = listCopy();
  const edits = [
    ['contributing.md', 'One entry per pull request.', 'Two entries per pull request.'],
    ['contributing.md', '- **Working:** every link resolves.', '- **Working:** most links resolve.'],
    ['.github/pull_request_template.md', '- [ ] I starred this repo if I found it helpful.', '- [ ] A local line.\n- [ ] I starred this repo.'],
    ['README.md', 'Contributions are welcome.', 'Contributions are closed.'],
  ];
  for (const [file, from, to] of edits) fs.writeFileSync(path.join(dir, file), read(dir, file).replace(from, to));
  assert.deepEqual(sync(dir), DOCS);
  for (const file of DOCS) assert.equal(read(dir, file), read(LIST, file), file);
  assert.deepEqual(sync(dir), []);
});

test('a list\'s own lines beside a block survive sync', () => {
  const dir = listCopy();
  const own = [
    ['contributing.md', '<!-- /awesome:rules -->\n', '<!-- /awesome:rules -->\n- **Current:** it works with the latest release.\n'],
    ['contributing.md', 'Replace this paragraph with the list\'s scope', 'This list covers rockets'],
    ['.github/pull_request_template.md', '<!-- /awesome:checklist -->\n', '<!-- /awesome:checklist -->\n- [ ] It works with the latest release.\n'],
    ['README.md', '<!-- /awesome:footer -->\n', '<!-- /awesome:footer -->\n\nA closing line of the list\'s own.\n'],
  ];
  for (const [file, from, to] of own) fs.writeFileSync(path.join(dir, file), read(dir, file).replace(from, to));
  editConfig(dir, { minStars: 25 });
  assert.deepEqual(sync(dir), ['contributing.md', '.github/pull_request_template.md']);

  const contributing = read(dir, 'contributing.md');
  assert.match(contributing, /at least 25 stars when it is submitted\.\n- \*\*Working:\*\* every link resolves\.<!-- \/awesome:rules -->\n- \*\*Current:\*\* it works with the latest release\.\n/);
  assert.match(contributing, /\nThis list covers rockets: what it covers/);
  assert.match(read(dir, '.github/pull_request_template.md'), /I starred this repo if I found it helpful\.<!-- \/awesome:checklist -->\n- \[ \] It works with the latest release\.\n$/);
  assert.match(read(dir, 'README.md'), /<!-- \/awesome:footer -->\n\nA closing line of the list's own\.\n$/);
});

test('sync creates a missing kit-owned file and restores an edited one; a second run changes nothing', () => {
  const dir = listCopy();
  fs.rmSync(path.join(dir, '.github/ISSUE_TEMPLATE'), { recursive: true });
  fs.appendFileSync(path.join(dir, 'code_of_conduct.md'), 'A local edit.\n');
  assert.deepEqual(sync(dir), [
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/ISSUE_TEMPLATE/report.yml',
    '.github/ISSUE_TEMPLATE/suggest.yml',
    'code_of_conduct.md',
  ]);
  for (const file of ['.github/ISSUE_TEMPLATE/report.yml', 'code_of_conduct.md', 'LICENSE']) {
    assert.ok(fs.readFileSync(path.join(dir, file)).equals(fs.readFileSync(path.join(KIT_FILES, file))), file);
  }
  assert.deepEqual(sync(dir), []);
});

test('no kit-owned file is a workflow: the workflow token cannot push one', () => {
  const workflows = fs.readdirSync(KIT_FILES, { recursive: true })
    .map((file) => file.split(path.sep).join('/'))
    .filter((file) => file.startsWith('.github/workflows'));
  assert.deepEqual(workflows, []);
});

test('sync never writes a workflow file, even a missing or edited one', () => {
  const dir = listCopy();
  fs.mkdirSync(path.join(dir, '.github/workflows'));
  fs.writeFileSync(path.join(dir, '.github/workflows/sweep.yml'), 'name: A local edit\n');
  assert.deepEqual(sync(dir), []);
  assert.deepEqual(fs.readdirSync(path.join(dir, '.github/workflows')), ['sweep.yml']);
  assert.equal(read(dir, '.github/workflows/sweep.yml'), 'name: A local edit\n');
});

test('a sync that fails on a fragment writes no kit-owned file', () => {
  const dir = listCopy();
  fs.rmSync(path.join(dir, 'LICENSE'));
  fs.appendFileSync(path.join(dir, 'README.md'), '<!-- awesome:mystery -->x<!-- /awesome:mystery -->\n');
  assert.throws(() => sync(dir), /unknown fragment "mystery"/);
  assert.equal(fs.existsSync(path.join(dir, 'LICENSE')), false);
});
