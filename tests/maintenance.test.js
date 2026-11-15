const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { listCopy, runJob } = require('./helpers');

// The machine's git config stays out: the job sets the only identity it commits with.
const NO_MACHINE_GIT = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const GIT_ENV = { PATH: process.env.PATH, HOME: process.env.HOME, ...NO_MACHINE_GIT };

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();

/**
 * A bare remote seeded with one commit of the fixture list on main.
 * @param {(dir: string) => void} [prepare] - changes the list before the seed commit
 * @returns {string} the remote's folder
 */
function seededRemote(prepare = () => {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-remote-'));
  const remote = path.join(tmp, 'remote.git');
  git(tmp, 'init', '--bare', '--initial-branch=main', remote);

  const seed = listCopy();
  prepare(seed);
  git(seed, 'init', '--initial-branch=main');
  git(seed, 'config', 'user.name', 'Seed');
  git(seed, 'config', 'user.email', 'seed@example.com');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-m', 'seed');
  git(seed, 'push', remote, 'main');
  return remote;
}

/**
 * Clone the remote fresh, as the action's checkout does, and run the job in it.
 * @param {string} remote
 */
function runMaintenance(remote) {
  const work = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-work-')), 'list');
  git(os.tmpdir(), 'clone', remote, work);
  const result = runJob('maintenance', work, { ...NO_MACHINE_GIT, GITHUB_REF_NAME: 'main' });
  assert.equal(result.status, 0, result.stderr);
}

const subjects = (remote, ref) => git(remote, 'log', ref, '--format=%s').split('\n');
const rev = (remote, ref) => git(remote, 'rev-parse', ref);

test('a list with sync drift gets one sync commit on the remote main', () => {
  const remote = seededRemote((dir) => fs.rmSync(path.join(dir, 'LICENSE')));
  runMaintenance(remote);
  assert.deepEqual(subjects(remote, 'main'), ['chore: sync from awesome-kit', 'seed']);
  assert.equal(git(remote, 'show', 'main:LICENSE').split('\n')[0], 'Creative Commons Legal Code');
  assert.equal(rev(remote, 'maintenance^'), rev(remote, 'main'));
});

test('with no maintenance branch, the branch starts as one empty Maintenance commit on main\'s tip', () => {
  const remote = seededRemote();
  const main = rev(remote, 'main');
  runMaintenance(remote);
  assert.equal(rev(remote, 'main'), main);
  assert.deepEqual(subjects(remote, 'maintenance'), ['Maintenance', 'seed']);
  assert.equal(rev(remote, 'maintenance^'), main);
  assert.equal(rev(remote, 'maintenance^{tree}'), rev(remote, 'main^{tree}'));
});

test('a second run leaves main alone and keeps the branch one Maintenance commit above main', () => {
  const remote = seededRemote();
  const main = rev(remote, 'main');
  runMaintenance(remote);
  runMaintenance(remote);
  assert.equal(rev(remote, 'main'), main);
  assert.deepEqual(subjects(remote, 'maintenance'), ['Maintenance', 'seed']);
  assert.equal(rev(remote, 'maintenance^'), main);
});
