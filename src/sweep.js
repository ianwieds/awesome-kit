/**
 * The sweep: re-check every entry on the list (repository state and link
 * reachability; the star bar does not apply to entries already listed) and
 * build the findings as markdown whose last line is the verdict.
 * Run from the CLI as `awesome-kit sweep`.
 */
const { parseReadme } = require('./lib/readme');
const { remoteChecks } = require('./check-pr');

/**
 * Check every entry of a README.
 * @param {{ readme: string, config: object, fetch?: Function }} input
 * @returns {Promise<{ findings: object[], report: string }>}
 */
async function sweep({ readme, config, fetch }) {
  const { entries } = parseReadme(readme);
  const findings = [];

  for (const entry of entries) {
    const checks = entry.url
      ? await remoteChecks(entry.url, config, { fetch, stars: false })
      : [{ ok: false, text: 'entry has a link' }];
    const failed = checks.filter((check) => !check.ok);
    if (failed.length) findings.push({ entry, failed });
  }

  return { findings, report: renderReport(entries.length, findings) };
}

/**
 * The markdown findings; the last line is `verdict: pass` or `verdict: fail`.
 * @param {number} total - entries checked
 * @param {object[]} findings
 * @returns {string}
 */
function renderReport(total, findings) {
  if (!findings.length) return `The sweep checked ${total} entries and found nothing to review.\n\nverdict: pass\n`;

  const out = [`The sweep checked ${total} entries. ${findings.length} need a look:`, ''];
  for (const { entry, failed } of findings) {
    const label = entry.name ? `[${entry.name}](${entry.url})` : `\`${entry.line.trim()}\``;
    out.push(`- ${label} in ${entry.section}. Failed: ${failed.map((check) => check.text).join('; ')}.`);
  }
  out.push('', 'Fix or remove each entry; the next sweep closes this issue when it finds nothing.', '', 'verdict: fail');
  return `${out.join('\n')}\n`;
}

module.exports = { sweep };
