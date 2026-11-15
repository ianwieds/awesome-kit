const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { copyFiles } = require('../src/lib/copy');

test('copyFiles never copies a .DS_Store, at any depth', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-copy-src-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-copy-dst-'));
  fs.mkdirSync(path.join(source, '.github'));
  for (const file of ['.DS_Store', '.github/.DS_Store', '.github/a.md', 'b.md']) fs.writeFileSync(path.join(source, file), file);

  assert.deepEqual(copyFiles(source, target, { overwrite: true }), ['.github/a.md', 'b.md']);
  assert.deepEqual(fs.readdirSync(target, { recursive: true }).sort(), ['.github', '.github/a.md', 'b.md']);
});
