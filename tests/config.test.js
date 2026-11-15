const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../src/lib/config');

const LIST_CONFIG = path.join(__dirname, 'fixtures', 'list', '.github', 'awesome.json');
const write = (config) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'awesome-config-')), 'awesome.json');
  fs.writeFileSync(file, JSON.stringify(config));
  return file;
};
const real = () => JSON.parse(fs.readFileSync(LIST_CONFIG, 'utf8'));

test('the fixture list\'s .github/awesome.json loads', () => {
  assert.equal(typeof loadConfig(LIST_CONFIG).minStars, 'number');
});

test('a mistyped or missing value fails loudly, naming every problem', () => {
  const config = { ...real(), minStars: '10', accent: '#FFA000' };
  delete config.scope;
  assert.throws(() => loadConfig(write(config)), (error) => {
    assert.match(error.message, /scope must be a non-empty string/);
    assert.match(error.message, /minStars must be a whole number/);
    assert.match(error.message, /accent must be a six-digit hex color/);
    return true;
  });
});

test('repo must be owner/name', () => {
  assert.throws(() => loadConfig(write({ ...real(), repo: 'awesome-template' })), /repo must be "owner\/name"/);
});
