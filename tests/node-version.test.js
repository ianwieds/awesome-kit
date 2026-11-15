const test = require('node:test');
const assert = require('node:assert/strict');
const { nodeVersionProblem } = require('../src/lib/node-version');

test('a Node major under 22 is named as the problem; 22 and later are fine', () => {
  assert.equal(nodeVersionProblem('20.11.1'), 'awesome-kit needs Node 22 or later (this is 20.11.1)');
  assert.equal(nodeVersionProblem('21.7.3'), 'awesome-kit needs Node 22 or later (this is 21.7.3)');
  assert.equal(nodeVersionProblem('22.0.0'), null);
  assert.equal(nodeVersionProblem('24.22.2'), null);
});
