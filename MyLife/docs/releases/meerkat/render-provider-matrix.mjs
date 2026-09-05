#!/usr/bin/env node
// Renders the Step 11 Plan 41 provider-matrix tracker bound to the ACTIVE
// release ledger. Usage: node docs/releases/meerkat/render-provider-matrix.mjs
// Output: docs/releases/meerkat/provider-matrix.html (self-contained).
// Cell state persists in the browser (localStorage, keyed by release id).
// "Export evidence JSON" downloads a file to store under
// docs/releases/meerkat/<release-id>/providers/.

import fs from 'node:fs';
import path from 'node:path';

const RELEASES_DIR = path.dirname(new URL(import.meta.url).pathname);

function loadActiveLedger() {
  const dirs = fs.readdirSync(RELEASES_DIR).filter((d) => {
    try { return fs.statSync(path.join(RELEASES_DIR, d, 'evidence.json')).isFile(); } catch { return false; }
  });
  const ledgers = dirs.map((d) => JSON.parse(fs.readFileSync(path.join(RELEASES_DIR, d, 'evidence.json'), 'utf8')));
  const actives = ledgers.filter((l) => !l.supersededBy);
  if (actives.length === 0) throw new Error('no active (non-superseded) ledger found');
  if (actives.length > 1) {
    // Mid-promotion (new rc directory created before the old ledger gained
    // supersededBy) must never silently bind evidence to the wrong candidate.
    throw new Error(`multiple active ledgers: ${actives.map((l) => l.releaseId).join(', ')} -- set supersededBy first`);
  }
  const active = actives[0];
  // releaseId flows into generated JS string literals and HTML; keep it to the
  // known shape so a malformed ledger can never script-inject the tracker.
  if (!/^[A-Za-z0-9.-]+$/u.test(String(active.releaseId ?? ''))) {
    throw new Error(`releaseId has an unexpected shape: ${JSON.stringify(active.releaseId)}`);
  }
  return active;
}

const OPS = ['authorize', 'write', 'read-back', 'list', 'quota', 'resume', 'revoke', 'rotation', 'backup', 'restore', 'move', 'delete', 'reconnect'];

const DESTINATIONS = [
  { id: 'local-ios', name: 'Local destination (iOS)', note: 'Signed build, not Expo Go' },
  { id: 'local-android', name: 'Local destination (Android)', note: 'Signed build' },
  { id: 'browser-granted', name: 'Browser local (persistence granted)', note: '' },
  { id: 'browser-denied', name: 'Browser local (persistence denied)', note: 'Honest degraded state, not simulated success' },
  { id: 'icloud', name: 'iCloud Drive (signed iOS)', note: 'First native module proof point' },
  { id: 'ios-files', name: 'iOS Files provider', note: '' },
  { id: 'android-saf', name: 'Android Storage Access Framework', note: '' },
  { id: 'gdrive', name: 'Google Drive', note: 'Through the deployed broker' },
  { id: 'dropbox', name: 'Dropbox', note: 'Through the deployed broker' },
  { id: 'onedrive', name: 'OneDrive', note: 'Through the deployed broker' },
  { id: 'box', name: 'Box', note: 'Through the deployed broker' },
  { id: 'webdav', name: 'WebDAV over trusted HTTPS', note: '' },
  { id: 's3', name: 'S3-compatible (versioned bucket)', note: '' },
  { id: 'hosted', name: 'Meerkat hosted storage', note: '' },
  { id: 'connected-server', name: 'Signed connected server', note: '' },
];

const SCENARIOS = [
  { id: 'fresh-mobile', name: 'Fresh-install restore on mobile (database + blobs + identity)' },
  { id: 'fresh-browser', name: 'Fresh-browser restore on web (database + blobs + identity)' },
  { id: 'corruption', name: 'Corruption case: damaged object detected, never silently served' },
  { id: 'wrong-key', name: 'Wrong key: restore refused honestly' },
  { id: 'torn-journal', name: 'Torn journal: recovery to consistent state' },
  { id: 'quota-exceeded', name: 'Quota exceeded: honest refusal, no partial silent write' },
  { id: 'provider-outage', name: 'Provider outage: honest error, retry succeeds after restore' },
  { id: 'lost-response', name: 'Lost response: idempotent retry, no duplicate' },
  { id: 'interrupted-move', name: 'Interrupted move: resumes or rolls back, never loses bytes' },
];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function main() {
  const active = loadActiveLedger();
  const releaseId = active.releaseId;

  const headRow = `<tr><th class="dest">Destination</th>${OPS.map((o) => `<th>${esc(o)}</th>`).join('')}<th class="dest">Row evidence (build id, account, manifest, hashes)</th></tr>`;

  const destRows = DESTINATIONS.map((d) => `
    <tr data-row="${d.id}">
      <td class="dest"><b>${esc(d.name)}</b>${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}</td>
      ${OPS.map((o) => `<td><button class="cell" data-key="${d.id}:${o}" title="${esc(d.name)} / ${esc(o)}"></button></td>`).join('')}
      <td class="dest"><textarea class="evidence" data-key="${d.id}:evidence" rows="2" placeholder="build id / test account / manifest id / byte+hash compare / cleanup"></textarea></td>
    </tr>`).join('');

  const scenarioRows = SCENARIOS.map((s) => `
    <div class="scenario">
      <button class="cell" data-key="scenario:${s.id}"></button>
      <span>${esc(s.name)}</span>
      <input class="evidence line" data-key="scenario:${s.id}:evidence" placeholder="evidence: ids, hashes, screenshots ref">
    </div>`).join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meerkat Step 11 Provider Matrix</title>
<style>
:root{--bg:#0E0E13;--surface:#1B1B20;--elevated:#2A292F;--text:#E4E1E9;--text2:#D6C3B5;--muted:#9F8E81;
--primary:#FFB877;--info:#8BCFF0;--danger:#FFB4AB;--success:#30D158;--border:rgba(255,255,255,0.08)}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,"SF Pro Text","Segoe UI",sans-serif;margin:0;padding:28px 20px 90px}
.wrap{max-width:1500px;margin:0 auto}
h1{color:var(--primary);font-size:20px}
h2{color:var(--text2);font-size:15px;margin-top:30px}
.meta{color:var(--muted);font-size:12.5px;margin:6px 0 18px}
.legend{display:flex;gap:16px;font-size:12px;color:var(--text2);margin:10px 0 16px;align-items:center;flex-wrap:wrap}
.legend .cell{pointer-events:none}
.tablewrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:1250px;background:var(--surface)}
th,td{border:1px solid var(--border);padding:6px 8px;text-align:center;font-size:12px}
th{color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-size:10px;background:#131318;position:sticky;top:0}
td.dest,th.dest{text-align:left;min-width:210px}
td .note{color:var(--muted);font-size:11px}
.cell{width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--elevated);cursor:pointer;font-size:12px;font-weight:800;color:var(--text)}
.cell[data-state="pass"]{background:#0d3d1c;border-color:#30d15866;color:var(--success)}
.cell[data-state="fail"]{background:#3d0d12;border-color:#ffb4ab66;color:var(--danger)}
.cell[data-state="na"]{background:#1f2733;border-color:#8bcff044;color:var(--info)}
.evidence{width:100%;background:#131318;border:1px solid var(--border);border-radius:8px;color:var(--text2);font:12px/1.4 "SF Mono",ui-monospace,monospace;padding:6px 8px}
.evidence.line{flex:1}
.scenario{display:flex;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin:8px 0}
.bar{position:fixed;bottom:0;left:0;right:0;background:#131318f0;border-top:1px solid var(--border);backdrop-filter:blur(10px)}
.bar-inner{max-width:1500px;margin:0 auto;padding:12px 20px;display:flex;gap:18px;align-items:center}
.bar b{color:var(--primary)}
button.action{background:var(--elevated);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer}
button.action:hover{border-color:var(--primary)}
.progress{color:var(--muted);font-size:12.5px}
</style></head><body><div class="wrap">
<h1>Meerkat Step 11: Plan 41 provider matrix</h1>
<div class="meta">Release: <b>${esc(releaseId)}</b> · Exit gate: every applicable cell passes; unsupported cells show the intended unavailable state (mark N/A with the honest reason in row evidence), never a simulated success. State saves in this browser; export JSON into <code>${esc(releaseId)}/providers/</code> when a session ends.</div>
<div class="legend">Click a cell to cycle:
  <span><button class="cell"></button> untested</span>
  <span><button class="cell" data-state="pass">P</button> pass</span>
  <span><button class="cell" data-state="fail">F</button> FAIL (stop, fix or record)</span>
  <span><button class="cell" data-state="na">–</button> N/A (honest unavailable)</span>
</div>
<div class="tablewrap"><table><thead>${headRow}</thead><tbody>${destRows}</tbody></table></div>
<h2>Restore and failure scenarios</h2>
${scenarioRows}
<div class="bar"><div class="bar-inner">
  <span class="progress" id="progress"></span>
  <button class="action" id="export">Export evidence JSON</button>
  <b id="verdict"></b>
</div></div>
</div>
<script>
(function(){
  var KEY='mk-providers:${releaseId}:';
  var STATES=['','pass','fail','na'];
  var LABEL={'':'','pass':'P','fail':'F','na':'\\u2013'};
  var cells=document.querySelectorAll('.cell[data-key]');
  var texts=document.querySelectorAll('.evidence[data-key]');
  cells.forEach(function(c){
    var s=localStorage.getItem(KEY+c.dataset.key)||'';
    set(c,s);
    c.addEventListener('click',function(){
      var next=STATES[(STATES.indexOf(c.dataset.state||'')+1)%STATES.length];
      set(c,next);
      if(next)localStorage.setItem(KEY+c.dataset.key,next);else localStorage.removeItem(KEY+c.dataset.key);
      update();
    });
  });
  texts.forEach(function(t){
    t.value=localStorage.getItem(KEY+t.dataset.key)||'';
    t.addEventListener('input',function(){
      if(t.value)localStorage.setItem(KEY+t.dataset.key,t.value);else localStorage.removeItem(KEY+t.dataset.key);
    });
  });
  function set(c,s){if(s){c.dataset.state=s;}else{delete c.dataset.state;}c.textContent=LABEL[s]||'';}
  function update(){
    var total=cells.length,done=0,fail=0,pass=0,na=0;
    cells.forEach(function(c){var s=c.dataset.state||'';if(s)done++;if(s==='fail')fail++;if(s==='pass')pass++;if(s==='na')na++;});
    document.getElementById('progress').textContent=done+'/'+total+' cells ('+pass+' pass, '+fail+' fail, '+na+' n/a)';
    var v=document.getElementById('verdict');
    if(fail>0){v.textContent='FAIL PRESENT: stop promotion';v.style.color='#FFB4AB';}
    else if(done===total){v.textContent='Matrix complete';v.style.color='#30D158';}
    else{v.textContent='';}
  }
  document.getElementById('export').addEventListener('click',function(){
    var out={releaseId:'${releaseId}',exportedAt:new Date().toISOString(),cells:{},evidence:{}};
    cells.forEach(function(c){if(c.dataset.state)out.cells[c.dataset.key]=c.dataset.state;});
    texts.forEach(function(t){if(t.value)out.evidence[t.dataset.key]=t.value;});
    var blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='provider-matrix-${releaseId}-'+new Date().toISOString().slice(0,10)+'.json';
    a.click();
  });
  update();
})();
</script>
</body></html>`;

  const out = path.join(RELEASES_DIR, 'provider-matrix.html');
  fs.writeFileSync(out, html);
  console.log('rendered', out, `(release: ${releaseId})`);
}

main();
