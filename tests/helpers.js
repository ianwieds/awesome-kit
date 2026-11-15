/**
 * Test helpers: a fetch that answers from a route table and a fake `gh` (the
 * network boundary, the only stubs), a GitHub API repository body, a temp
 * copy of the fixture list, and runners for the jobs/*.sh scripts and setup.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const KIT = path.join(__dirname, '..');
const LIST = path.join(__dirname, 'fixtures', 'list');
const KIT_FILES = path.join(KIT, 'files');
const FAKE_GH = path.join(__dirname, 'fixtures', 'gh.js');

/**
 * Build a fetch that answers each URL from its route and records every call.
 * A route is `{ status, json }` or an Error to throw; an unknown URL throws.
 * @param {Record<string, object>} routes
 * @returns {{ fetch: Function, calls: Array<{ url: string, init: object }> }}
 */
function routeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (!(url in routes)) throw new Error(`unexpected fetch: ${url}`);
    const route = routes[url];
    if (route instanceof Error) throw route;
    const body = route.json ? JSON.stringify(route.json) : null;
    return new Response(body, { status: route.status || 200 });
  };
  return { fetch, calls };
}

/**
 * A `GET /repos/{owner}/{name}` answer.
 * @param {{ stars?: number, archived?: boolean, pushedAt?: string }} [fields]
 * @returns {{ status: number, json: object }}
 */
function repoAnswer({ stars = 500, archived = false, pushedAt = new Date().toISOString() } = {}) {
  return { status: 200, json: { stargazers_count: stars, archived, pushed_at: pushedAt } };
}

/**
 * The API URL of a repository.
 * @param {string} slug - owner/name
 * @returns {string}
 */
function api(slug) {
  return `https://api.github.com/repos/${slug}`;
}

/**
 * Copy the fixture list into a new temp folder, with the kit-owned files a
 * synced list already holds.
 * @returns {string} the folder
 */
function listCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-list-'));
  fs.cpSync(LIST, dir, { recursive: true });
  fs.cpSync(KIT_FILES, dir, { recursive: true });
  return dir;
}

/**
 * Run a command with a fake `gh` first on PATH and nothing from this
 * process's environment but PATH and HOME.
 * @param {string[]} command - the program and its arguments
 * @param {string} cwd - the folder it runs in
 * @param {(temp: string) => Record<string, string>} env - extra variables, given the run's temp folder
 * @returns {{ status: number, stdout: string, stderr: string, calls: Array<{ args: string[], body: string|null }> }}
 */
function runWithGh([program, ...args], cwd, env) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-gh-'));
  const bin = path.join(temp, 'bin');
  const log = path.join(temp, 'gh.log');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${FAKE_GH}" "$@"\n`, { mode: 0o755 });

  const result = spawnSync(program, args, {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`,
      HOME: process.env.HOME,
      FAKE_GH_LOG: log,
      ...env(temp),
    },
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : [];
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls };
}

/**
 * Run one jobs/<name>.sh as the action does, through runWithGh.
 * @param {string} name - the job, e.g. `pr-check`
 * @param {string} cwd - the list folder the job runs in
 * @param {Record<string, string>} [env] - extra variables, e.g. `FAKE_GH_HEAD`
 * @returns {ReturnType<typeof runWithGh>}
 */
function runJob(name, cwd, env = {}) {
  return runWithGh(['bash', path.join(KIT, 'jobs', `${name}.sh`)], cwd, (temp) => ({
    RUNNER_TEMP: temp,
    GITHUB_ACTION_PATH: KIT,
    GITHUB_REPOSITORY: 'someone/awesome-fixture',
    ...env,
  }));
}

/**
 * Run the CLI's setup command in a folder, through runWithGh.
 * @param {string} dir - the list folder
 * @param {Record<string, string>} [env] - the fake gh's answers, e.g. `FAKE_GH_USER`
 * @returns {ReturnType<typeof runWithGh>}
 */
function runSetup(dir, env = {}) {
  return runWithGh([process.execPath, path.join(KIT, 'bin', 'awesome.js'), 'setup', dir], dir, () => env);
}

module.exports = { routeFetch, repoAnswer, api, listCopy, runJob, runSetup, KIT_FILES };
