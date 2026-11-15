const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { listCopy, runJob } = require('./helpers');

const REPO = 'someone/awesome-fixture';
const PR_MARKER = '<!-- awesome:pr-check -->';
const SWEEP_MARKER = '<!-- awesome:sweep -->';

// The gh calls that change something on GitHub: every call but the reads.
const writes = (calls) => calls.filter(({ args }) => !(args[0] === 'api' && args[1].startsWith('repos/')) && !(args[0] === 'issue' && args[1] === 'list'));

/**
 * Run the PR check on the fixture list against a head README.
 * @param {(readme: string) => string} [edit] - turns the base README into the head
 * @param {{ found?: string, prepare?: (dir: string) => void }} [options] - found: an existing marker comment's id
 */
function prCheck(edit = (readme) => readme, { found, prepare = () => {} } = {}) {
  const dir = listCopy();
  prepare(dir);
  const head = path.join(dir, 'head-readme.md');
  fs.writeFileSync(head, edit(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')));
  const env = { PR: '7', HEAD_REPO: 'fork/awesome-fixture', HEAD_SHA: 'abc123', FAKE_GH_HEAD: head };
  if (found) env.FAKE_GH_FOUND = found;
  return runJob('pr-check', dir, env);
}

const failingHead = (readme) => readme.replace('## Tools', '- Koa without a link\n\n## Tools');

test('pr-check reads the head README as data at the head commit', () => {
  const { status, stderr, calls } = prCheck();
  assert.equal(status, 0, stderr);
  assert.deepEqual(calls[0].args, ['api', 'repos/fork/awesome-fixture/contents/README.md?ref=abc123', '-H', 'Accept: application/vnd.github.raw']);
});

test('a passing head gets one new marker comment and stays open', () => {
  const { status, stderr, calls } = prCheck();
  assert.equal(status, 0, stderr);
  const [comment, ...rest] = writes(calls);
  assert.deepEqual(comment.args.slice(0, 5), ['pr', 'comment', '7', '-R', REPO]);
  assert.ok(comment.body.startsWith(`${PR_MARKER}\n## Pull request check`), comment.body);
  assert.match(comment.body, /verdict: pass\n$/);
  assert.deepEqual(rest, []);
});

test('a failing head gets the marker comment and is closed', () => {
  const { status, stderr, calls } = prCheck(failingHead);
  assert.equal(status, 0, stderr);
  const [comment, close, ...rest] = writes(calls);
  assert.deepEqual(comment.args.slice(0, 3), ['pr', 'comment', '7']);
  assert.ok(comment.body.startsWith(PR_MARKER), comment.body);
  assert.match(comment.body, /verdict: fail\n$/);
  assert.deepEqual(close.args, ['pr', 'close', '7', '-R', REPO]);
  assert.deepEqual(rest, []);
});

test('an existing marker comment is edited in place instead of a new one posted', () => {
  const { status, stderr, calls } = prCheck(undefined, { found: '99' });
  assert.equal(status, 0, stderr);
  const [patch, ...rest] = writes(calls);
  assert.deepEqual(patch.args.slice(0, 4), ['api', '-X', 'PATCH', `repos/${REPO}/issues/comments/99`]);
  assert.ok(patch.body.startsWith(PR_MARKER), patch.body);
  assert.deepEqual(rest, []);
});

test('a check that ends without a verdict fails the job, shows why, and posts nothing', () => {
  const { status, stderr, calls } = prCheck(undefined, { prepare: (dir) => fs.rmSync(path.join(dir, '.github', 'awesome.json')) });
  assert.equal(status, 1);
  assert.match(stderr, /awesome-kit check ended without a verdict/);
  assert.deepEqual(writes(calls), []);
});

/**
 * Run the sweep on a list whose one entry has no link, a finding needing no network.
 * @param {string} [found] - an open Entries to review issue's number
 */
function sweepJob(found) {
  const dir = listCopy();
  fs.writeFileSync(path.join(dir, 'README.md'), '## Libraries\n\n- Koa without a link\n');
  return runJob('sweep', dir, found ? { FAKE_GH_FOUND: found } : {});
}

test('a sweep with findings opens the Entries to review issue with the marker', () => {
  const { status, stderr, calls } = sweepJob();
  assert.equal(status, 0, stderr);
  const [create, ...rest] = writes(calls);
  assert.deepEqual(create.args.slice(0, 5), ['issue', 'create', '-R', REPO, '--title']);
  assert.equal(create.args[5], 'Entries to review');
  assert.ok(create.body.startsWith(`${SWEEP_MARKER}\nThe sweep checked 1 entries. 1 need a look:`), create.body);
  assert.match(create.body, /Koa without a link/);
  assert.doesNotMatch(create.body, /verdict:/);
  assert.deepEqual(rest, []);
});

test('a sweep with findings edits the open Entries to review issue instead', () => {
  const { status, stderr, calls } = sweepJob('12');
  assert.equal(status, 0, stderr);
  const [edit, ...rest] = writes(calls);
  assert.deepEqual(edit.args.slice(0, 4), ['issue', 'edit', '12', '-R']);
  assert.ok(edit.body.startsWith(SWEEP_MARKER), edit.body);
  assert.deepEqual(rest, []);
});
