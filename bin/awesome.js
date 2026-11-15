#!/usr/bin/env node
/**
 * The awesome-kit CLI, one entry for every command a list runs:
 *   sync [dir]                         write the markers and kit-owned files
 *   sweep [dir]                        print the sweep report
 *   check <base.md> <head.md> [config] print the PR report (exit 0 pass, 1 fail)
 * Anything else prints the usage line on stderr and exits 2; Node under 22 exits 1.
 */
const fs = require('node:fs');
const path = require('node:path');
const { sync } = require('../src/sync');
const { sweep } = require('../src/sweep');
const { checkPr } = require('../src/check-pr');
const { loadConfig, CONFIG_PATH } = require('../src/lib/config');
const { nodeVersionProblem } = require('../src/lib/node-version');

const USAGE = 'usage: awesome-kit sync [dir] | sweep [dir] | check <base.md> <head.md> [config]';

/** Each command: its argument count bounds and its run, resolving to the exit code. */
const COMMANDS = {
  sync: {
    min: 0,
    max: 1,
    run: async ([dir = '.']) => {
      const changed = sync(path.resolve(dir));
      console.log(changed.length ? `synced: ${changed.join(', ')}` : 'already in sync');
      return 0;
    },
  },
  sweep: {
    min: 0,
    max: 1,
    run: async ([dir = '.']) => {
      const { report } = await sweep({
        readme: fs.readFileSync(path.join(dir, 'README.md'), 'utf8'),
        config: loadConfig(path.join(dir, CONFIG_PATH)),
      });
      process.stdout.write(report);
      return 0;
    },
  },
  check: {
    min: 2,
    max: 3,
    run: async ([basePath, headPath, configPath = CONFIG_PATH]) => {
      const { pass, report } = await checkPr({
        base: fs.readFileSync(basePath, 'utf8'),
        head: fs.readFileSync(headPath, 'utf8'),
        config: loadConfig(configPath),
      });
      process.stdout.write(report);
      return pass ? 0 : 1;
    },
  },
};

/**
 * Run one command line.
 * @param {string[]} argv - the command and its arguments
 * @returns {Promise<number>} the exit code
 */
async function main([name, ...args]) {
  const problem = nodeVersionProblem(process.versions.node);
  if (problem) {
    console.error(problem);
    return 1;
  }
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null;
  if (!command || args.length < command.min || args.length > command.max) {
    console.error(USAGE);
    return 2;
  }
  return command.run(args);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
