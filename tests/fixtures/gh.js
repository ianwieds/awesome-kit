/**
 * A stand-in for the gh CLI, the network boundary of the job scripts and of
 * setup. It logs every call to FAKE_GH_LOG (one JSON line: the arguments and
 * the body, from a body file or `--input -` on stdin) and answers the reads:
 *   a contents read of README.md prints the file FAKE_GH_HEAD names;
 *   a marker search (comments list, issue list) prints FAKE_GH_FOUND when set,
 *   standing in for gh's output after its --jq filter;
 *   `api user`, `api repos/<repo>` and `api repos/<repo>/topics` print
 *   FAKE_GH_USER, FAKE_GH_REPO and FAKE_GH_TOPICS; `api user` without one fails.
 */
const fs = require('node:fs');

const args = process.argv.slice(2);

/**
 * The body a call sends: `--body-file <path>`, `-F body=@<path>` or `--input -`.
 * @returns {string|null}
 */
function body() {
  const input = args.indexOf('--input');
  if (input !== -1 && args[input + 1] === '-') return fs.readFileSync(0, 'utf8');
  const field = args.find((arg) => arg.startsWith('body=@'));
  if (field) return fs.readFileSync(field.slice('body=@'.length), 'utf8');
  const flag = args.indexOf('--body-file');
  return flag === -1 ? null : fs.readFileSync(args[flag + 1], 'utf8');
}

fs.appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify({ args, body: body() })}\n`);

const api = args[0] === 'api' ? args[1] : null;
const read = api && !args.includes('--method');
const contentsRead = api && /\/contents\/README\.md\?/.test(api);
const markerSearch = (api && /\/issues\/\d+\/comments$/.test(api)) || (args[0] === 'issue' && args[1] === 'list');

if (contentsRead) process.stdout.write(fs.readFileSync(process.env.FAKE_GH_HEAD, 'utf8'));
if (markerSearch && process.env.FAKE_GH_FOUND) process.stdout.write(`${process.env.FAKE_GH_FOUND}\n`);
if (api === 'user') {
  if (!process.env.FAKE_GH_USER) {
    process.stderr.write('To get started with GitHub CLI, please run:  gh auth login\n');
    process.exit(4);
  }
  process.stdout.write(process.env.FAKE_GH_USER);
}
if (read && /^repos\/[^/]+\/[^/]+$/.test(api) && process.env.FAKE_GH_REPO) process.stdout.write(process.env.FAKE_GH_REPO);
if (read && /^repos\/[^/]+\/[^/]+\/topics$/.test(api) && process.env.FAKE_GH_TOPICS) process.stdout.write(process.env.FAKE_GH_TOPICS);
