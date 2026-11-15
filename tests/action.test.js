const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/**
 * The commands action.yml accepts: the patterns of its `case "$COMMAND" in` guard.
 * @returns {string[]}
 */
function acceptedCommands() {
  const action = fs.readFileSync(path.join(ROOT, 'action.yml'), 'utf8');
  const match = action.match(/case "\$COMMAND" in\s*\n\s*([a-z| -]+)\)/);
  assert.ok(match, 'action.yml has no case "$COMMAND" in guard');
  return match[1].split('|').map((command) => command.trim()).sort();
}

test('action.yml accepts exactly the commands that have a jobs/<command>.sh', () => {
  const jobs = fs.readdirSync(path.join(ROOT, 'jobs')).filter((file) => file.endsWith('.sh')).map((file) => file.slice(0, -3)).sort();
  assert.deepEqual(acceptedCommands(), ['maintenance', 'pr-check', 'sweep']);
  assert.deepEqual(jobs, acceptedCommands());
});
