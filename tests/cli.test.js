const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { listCopy } = require('./helpers');

const BIN = path.join(__dirname, '..', 'bin', 'awesome.js');
const FIXTURES = path.join(__dirname, 'fixtures');
const LIST = path.join(FIXTURES, 'list');

const cli = (args, cwd = LIST) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
const lastLine = (report) => report.trimEnd().split('\n').pop();

test('check exits 1 on fail and 0 on pass, the verdict on the last line', () => {
  const config = path.join(LIST, '.github', 'awesome.json');
  const check = (head) => cli(['check', path.join(FIXTURES, 'base.md'), path.join(FIXTURES, head), config], FIXTURES);

  const fail = check('format.md');
  assert.equal(fail.status, 1, fail.stderr);
  assert.equal(lastLine(fail.stdout), 'verdict: fail');

  const pass = check('base.md');
  assert.equal(pass.status, 0, pass.stderr);
  assert.equal(lastLine(pass.stdout), 'verdict: pass');
});

test('check with no config reads .github/awesome.json in the current folder', () => {
  const result = cli(['check', 'README.md', 'README.md']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(lastLine(result.stdout), 'verdict: pass');
});

test('an unknown command or a missing argument prints the usage line and exits 2', () => {
  for (const args of [['deploy'], [], ['check', 'README.md'], ['sync', 'a', 'b'], ['setup', 'a', 'b']]) {
    const result = cli(args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /^usage: awesome-kit setup \[dir\] \| sync \[dir\] \| /, args.join(' '));
    assert.equal(result.stdout, '');
  }
});

test('setup is a known command: in a folder with no git origin it fails on that, not on usage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-cli-'));
  const result = cli(['setup', dir], FIXTURES);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no "origin" remote/);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('sync syncs the folder it is given, then reports it already in sync', () => {
  const dir = listCopy();
  const configFile = path.join(dir, '.github', 'awesome.json');
  fs.writeFileSync(configFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(configFile, 'utf8')), topic: 'Rust' }));

  const first = cli(['sync', dir], FIXTURES);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, 'synced: README.md\n');

  const second = cli(['sync'], dir);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, 'already in sync\n');
});

test('sweep reads the README and .github/awesome.json of the folder it is given', () => {
  const dir = listCopy();
  fs.writeFileSync(path.join(dir, 'README.md'), '## Libraries\n');
  const result = cli(['sweep', dir], FIXTURES);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'The sweep checked 0 entries and found nothing to review.\n\nverdict: pass\n');
});
