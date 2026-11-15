/**
 * Copy every file under one of the kit's folders into a list folder, at the
 * same relative path: the one way sync, setup's scaffold and its workflows
 * write a kit file.
 */
const fs = require('node:fs');
const path = require('node:path');

/**
 * Copy each file under source into target that is missing there, or, with
 * overwrite, that differs there too.
 * @param {string} source - the kit folder
 * @param {string} target - the list folder
 * @param {{ overwrite: boolean }} options
 * @returns {string[]} the paths written, relative to target, sorted
 */
function copyFiles(source, target, { overwrite }) {
  const written = fs.readdirSync(source, { recursive: true })
    .filter((file) => fs.statSync(path.join(source, file)).isFile())
    .filter((file) => {
      const to = path.join(target, file);
      if (!fs.existsSync(to)) return true;
      return overwrite && !fs.readFileSync(to).equals(fs.readFileSync(path.join(source, file)));
    })
    .sort();
  written.forEach((file) => {
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    fs.copyFileSync(path.join(source, file), path.join(target, file));
  });
  return written;
}

module.exports = { copyFiles };
