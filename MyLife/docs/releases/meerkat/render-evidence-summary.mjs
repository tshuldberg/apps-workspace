#!/usr/bin/env node
// Renders docs/releases/meerkat/<release-id>/evidence.json into the
// human-readable evidence-summary.html twin the activation runbook requires.
// Usage: node docs/releases/meerkat/render-evidence-summary.mjs <release-id>
import fs from 'node:fs';
import path from 'node:path';

const releaseId = process.argv[2];
if (!releaseId) { console.error('usage: render-evidence-summary.mjs <release-id>'); process.exit(1); }
const dir = path.join('docs/releases/meerkat', releaseId);
const l = JSON.parse(fs.readFileSync(path.join(dir, 'evidence.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const badge = (s) => {
  const c = { OPEN: '#52443A', IN_PROGRESS: '#C9894D', PASS: '#30D158', FAIL: '#FFB4AB', WAIVED: '#8BCFF0' }[s] || '#52443A';
  return '<span style="background:' + c + ';color:#131318;padding:2px 10px;border-radius:10px;font-weight:600;font-size:12px">' + esc(s) + '</span>';
};
const kv = (o) => '<table class=kv>' + Object.entries(o).map(([k, v]) =>
  '<tr><td class=k>' + esc(k) + '</td><td>' + (typeof v === 'object' && v !== null ? kv(v) : esc(v)) + '</td></tr>').join('') + '</table>';
let rows = '';
for (const s of l.steps) {
  rows += '<div class=step><div class=stephead><span class=num>Step ' + s.step + '</span> <strong>' + esc(s.title) + '</strong> ' + badge(s.status) + (s.owner ? ' <span class=owner>owner: ' + esc(s.owner) + '</span>' : '') + '</div>';
  if (s.evidence) rows += '<details><summary>Evidence</summary>' + kv(s.evidence) + '</details>';
  if (s.exceptions) for (const e of s.exceptions) rows += '<div class=exc><strong>' + esc(e.id) + ': ' + esc(e.subject) + '</strong> (founder-signed exception)<br>' + esc(e.reason) + '<br><em>Mitigations:</em><ul>' + e.mitigations.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul><em>Revisit:</em> ' + esc(e.revisit) + '</div>';
  if (s.openItems) rows += '<div class=open><em>Open:</em><ul>' + s.openItems.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul></div>';
  if (s.exitGateAssessment) rows += '<div class=gate><em>Exit gate:</em> ' + esc(s.exitGate) + '<br><em>Assessment:</em> ' + esc(s.exitGateAssessment) + '</div>';
  rows += '</div>';
}
const html = '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Meerkat ' + esc(l.releaseId) + ' evidence summary</title><style>' +
'body{background:#131318;color:#E4E1E9;font:15px/1.55 -apple-system,"Segoe UI",sans-serif;max-width:960px;margin:0 auto;padding:32px 20px}' +
'h1{color:#FFB877;font-size:24px}h2{color:#D6C3B5;font-size:18px;margin-top:28px}' +
'a{color:#8BCFF0}code{background:#2A292F;padding:1px 6px;border-radius:4px;font-size:13px}' +
'.card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:16px 20px;margin:14px 0}' +
'.step{border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px 16px;margin:10px 0;background:#1B1B20}' +
'.stephead .num{color:#9F8E81;margin-right:6px}.owner{color:#9F8E81;font-size:13px;margin-left:8px}' +
'.kv{border-collapse:collapse;margin:6px 0;width:100%}.kv td{border-top:1px solid rgba(255,255,255,0.06);padding:4px 8px;vertical-align:top;font-size:13px}.kv td.k{color:#D6C3B5;white-space:nowrap;width:200px}' +
'.exc{background:#2A292F;border-left:3px solid #8BCFF0;padding:8px 14px;margin:8px 0;border-radius:6px;font-size:13px}' +
'.open{color:#FFB4AB;font-size:13px}.gate{color:#9F8E81;font-size:13px;margin-top:6px}' +
'.nogo{background:#93000A;color:#FFB4AB;display:inline-block;padding:4px 14px;border-radius:10px;font-weight:700}' +
'details summary{cursor:pointer;color:#8BCFF0;font-size:13px;margin:4px 0}ul{margin:4px 0 4px 18px;padding:0}' +
'</style></head><body>' +
'<h1>Meerkat release evidence: ' + esc(l.releaseId) + '</h1>' +
'<p><span class=nogo>Launch state: ' + esc(l.launchState) + '</span>' + (l.supersededBy ? ' <span style="color:#9F8E81">superseded by ' + esc(l.supersededBy) + '</span>' : '') + '</p>' +
'<div class=card>' + kv({ releaseSha: l.releaseSha, branch: l.releaseBranch, remote: l.remote, createdAt: l.createdAt, runbook: l.runbook, supersedes: l.supersedes, immutabilityRule: l.immutabilityRule }) + '</div>' +
'<h2>Lineage</h2><div class=card>' + kv(l.lineage) + '</div>' +
'<h2>Steps (1-18)</h2>' + rows +
'<h2>Prohibited content</h2><div class=card><p>' + esc(l.prohibited) + '</p></div>' +
'<p style="color:#9F8E81;font-size:12px">Rendered from evidence.json. The JSON ledger is canonical.</p>' +
'</body></html>';
fs.writeFileSync(path.join(dir, 'evidence-summary.html'), html);
console.log('rendered', path.join(dir, 'evidence-summary.html'));
