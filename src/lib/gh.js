/**
 * The GitHub API through the gh CLI, as the signed-in user: setup's one door
 * to GitHub. A failed call throws, naming the call and gh's own message.
 */
const { spawnSync } = require('node:child_process');

/**
 * Call one API route through `gh api`.
 * @param {string} route - e.g. `repos/owner/name`
 * @param {{ method?: string, body?: object }} [options] - a body is sent as JSON on stdin
 * @returns {object|null} the parsed answer, null when it is empty
 */
function ghApi(route, { method, body } = {}) {
  const args = ['api', route];
  if (method) args.push('--method', method);
  if (body) args.push('--input', '-');
  const result = spawnSync('gh', args, { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8' });
  if (result.error) throw new Error(`gh ${args.join(' ')} failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

module.exports = { ghApi };
