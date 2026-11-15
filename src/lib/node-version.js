/**
 * The Node version check the CLI runs before any command. The floor is
 * package.json's `engines.node` (`>=<major>`), its one home.
 */
const { engines } = require('../../package.json');

const MIN_MAJOR = Number(engines.node.match(/^>=(\d+)$/)[1]);

/**
 * The problem with running on a Node version, if any.
 * @param {string} version - as `process.versions.node` gives it, e.g. `22.1.0`
 * @returns {string | null} the message to print, or null when the version is new enough
 */
function nodeVersionProblem(version) {
  const major = Number(version.split('.')[0]);
  return major < MIN_MAJOR ? `awesome-kit needs Node ${MIN_MAJOR} or later (this is ${version})` : null;
}

module.exports = { nodeVersionProblem };
