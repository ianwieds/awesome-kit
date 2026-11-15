/**
 * A stand-in for the gh CLI, the network boundary of the job scripts. It logs
 * every call to FAKE_GH_LOG (one JSON line: the arguments and the body file's
 * text) and answers the reads a job makes:
 *   a contents read of README.md prints the file FAKE_GH_HEAD names;
 *   a marker search (comments list, issue list) prints FAKE_GH_FOUND when set,
 *   standing in for gh's output after its --jq filter.
 */
const fs = require('node:fs');

const args = process.argv.slice(2);

/**
 * The file a call sends as its body: `--body-file <path>` or `-F body=@<path>`.
 * @returns {string|null}
 */
function bodyPath() {
  const field = args.find((arg) => arg.startsWith('body=@'));
  if (field) return field.slice('body=@'.length);
  const flag = args.indexOf('--body-file');
  return flag === -1 ? null : args[flag + 1];
}

const file = bodyPath();
fs.appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify({ args, body: file ? fs.readFileSync(file, 'utf8') : null })}\n`);

const contentsRead = args[0] === 'api' && /\/contents\/README\.md\?/.test(args[1]);
const markerSearch = (args[0] === 'api' && /\/issues\/\d+\/comments$/.test(args[1])) || (args[0] === 'issue' && args[1] === 'list');

if (contentsRead) process.stdout.write(fs.readFileSync(process.env.FAKE_GH_HEAD, 'utf8'));
if (markerSearch && process.env.FAKE_GH_FOUND) process.stdout.write(`${process.env.FAKE_GH_FOUND}\n`);
