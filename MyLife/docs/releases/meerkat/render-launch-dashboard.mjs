#!/usr/bin/env node
// Renders the Meerkat production launch dashboard from the activation runbook
// and the ACTIVE release evidence ledger (the one without supersededBy).
// Usage: node docs/releases/meerkat/render-launch-dashboard.mjs
// Output: docs/releases/meerkat/launch-dashboard.html (self-contained).
// Checkbox state persists in the browser via localStorage, keyed by release id,
// so re-rendering never loses working state for the same candidate.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RELEASES_DIR = path.join(ROOT, 'docs/releases/meerkat');
const RUNBOOK = path.join(ROOT, 'docs/guides/meerkat-production-activation-runbook-2026-07-15.md');

// ---------- data ----------

function parseRunbook() {
  const md = fs.readFileSync(RUNBOOK, 'utf8');
  const steps = [];
  const stepRe = /^## Step (\d+): (.+)$/gm;
  const matches = [...md.matchAll(stepRe)];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.indexOf('## Automatic stop conditions');
    const body = md.slice(start, end);
    const ownerMatch = body.match(/^Owners?: (.+)$/m);
    const checklist = [...body.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1]);
    const evidenceMatch = body.match(/Evidence:\n\n([^]*?)\n\nExit gate:/);
    const evidence = evidenceMatch
      ? [...evidenceMatch[1].matchAll(/^- (.+)$/gm)].map((m) => m[1])
      : [];
    const exitMatch = body.match(/Exit gate:\n\n([^]*?)(?:\n\n|$)/);
    steps.push({
      n: Number(matches[i][1]),
      title: matches[i][2],
      owners: ownerMatch ? ownerMatch[1] : '',
      checklist,
      evidence,
      exitGate: exitMatch ? exitMatch[1].replace(/^- /gm, '').trim() : '',
    });
  }
  const stopStart = md.indexOf('## Automatic stop conditions');
  const stopConditions = [...md.slice(stopStart).matchAll(/^- (.+)$/gm)].map((m) => m[1]);
  return { steps, stopConditions };
}

function loadActiveLedger() {
  const dirs = fs.readdirSync(RELEASES_DIR).filter((d) => {
    try { return fs.statSync(path.join(RELEASES_DIR, d, 'evidence.json')).isFile(); } catch { return false; }
  });
  const ledgers = dirs.map((d) => JSON.parse(fs.readFileSync(path.join(RELEASES_DIR, d, 'evidence.json'), 'utf8')));
  const active = ledgers.find((l) => !l.supersededBy);
  return { active, count: ledgers.length };
}

// What the founder personally does per step, in order. Everything not listed
// here is either already recorded in the ledger or driven by Claude with
// founder credentials.
const FOUNDER_ACTIONS = {
  1: [
    'Nothing right now. The full-matrix release-verify workflow is the gate; Claude root-causes and re-cuts candidates until both runs are green, then flips this step to PASS.',
    'If you want to retire exception rc-exc-1 later: upgrade the repo to GitHub Pro ($4/mo) and say so; branch protection gets configured in minutes.',
  ],
  2: [
    'ENGAGE AN ATTORNEY. This is the single action blocking Step 3 and it has the longest lead time in steps 1-6. Look for a startup/product counsel comfortable with UGC platforms, DMCA, COPPA-adjacent messaging, and data privacy. A few billable hours covers the Step 3 approvals.',
    'When engaged, give their name to Claude to record as the legal + privacy lane owner in the ledger.',
  ],
  3: [
    'With counsel: approve Terms of Use, Privacy Policy (+ retention disclosures), Community Standards / UGC moderation rules, and the account deletion, appeal, safety support, law-enforcement, and contact procedures.',
    'Register the DMCA designated agent at dmca.copyright.gov ($6 fee, ~15 min once you have the legal entity details). Save the registration number.',
    'Resolve encryption export classification with counsel (standard E2E crypto usually self-classifies under EAR 740.17(b)(1) with an annual self-classification report email; counsel confirms).',
    'Decide the production domains (e.g. meerkat.app, api/relay/community subdomains) and buy them if not owned.',
    'Publish every policy at an HTTPS URL on those domains, then verify each from a logged-out browser and a phone.',
    'Send the exact DMCA agent values to Claude to set the MEERKAT_DMCA_AGENT_* production config.',
  ],
  4: [
    'Create the production accounts, each with a fresh work identity, hardware-key MFA where supported, and recovery codes in your offline store: cloud/host provider, DNS registrar, container registry, managed PostgreSQL 17, S3-compatible object storage, KMS/secret manager, monitoring + alerting, Apple Developer ($99/yr), Google Play ($25 one-time), Stripe, RevenueCat, Google Cloud console (Drive OAuth), Dropbox/Microsoft/Box developer consoles, LiveKit Cloud, and your support inbox.',
    'Buy two hardware security keys (primary + backup) if you do not have them.',
    'Write down the break-glass procedure (where recovery codes live, how a locked-out founder gets back in) and store it offline.',
    'Claude then records the redacted account inventory, role matrix, and MFA status in the ledger.',
  ],
  5: [
    'Pick the infrastructure provider and region (decision: managed Postgres 17 with WAL/PITR, e.g. Fly Postgres/Neon/RDS, and R2/S3/B2 for objects). Tell Claude the choice.',
    'Claude scripts the provisioning against the existing runbooks (postgres cutover runbook, compose.production.yml); you execute with the credentials and paste resource ids back.',
    'Approve the retention and deletion schedules counsel signed in Step 3 before they are configured.',
  ],
  6: [
    'Register the four OAuth clients (Google Drive, Dropbox, OneDrive, Box) with the exact production redirect URIs Claude gives you; paste client ids back (secrets go straight into the secret manager, never into chat or the repo).',
    'In Apple Developer: create the iCloud container + entitlements and an APNs key. In Firebase: the FCM service account. Claude generates VAPID keys into the secret manager.',
    'Create the LiveKit production project and TURN config.',
    'Create Stripe + RevenueCat + App Store + Play products with the founder-locked pricing: app $4.99 one-time, hosted $4.99/mo with storage included.',
  ],
  7: [
    'Hands-off for you beyond credentials: Claude builds images from the release SHA, records digests, renders compose.production.yml, deploys, and captures readiness + operator-network denial proofs into the ledger.',
  ],
  8: [
    'Approve the maintenance window. Claude runs the staged-restore rehearsal first, then the production migrations and role grants, and records the positive/negative permission proofs.',
  ],
  9: [
    'Contract the abuse-hash source and complete NCMEC CyberTipline onboarding (report.cybertip.org registration as an ESP; this can take days-to-weeks, START EARLY, it can run in parallel from Step 3 onward).',
    'Decide moderation coverage honestly: as a solo operator, define your response windows and on-call reality; Claude encodes them as the alert thresholds.',
    'Run the synthetic drills with Claude (lawful fixtures only) and sign the incident-owner line.',
  ],
  10: [
    'On your own devices with real payment instruments: buy the app unlock and hosted storage on each rail, test restore-after-reinstall, then refund/cancel/dispute paths. Claude prepares the exact click-by-click scripts and records evidence.',
    'Run the full account deletion at the end and approve the zero-inventory proof as privacy owner.',
  ],
  11: [
    'Physical device time: you need at least one iPhone and one Android phone with signed builds. Claude drives the per-destination matrix (17 rows) as a guided checklist; budget a focused day.',
  ],
  12: [
    'Two physical phones again for calls/rooms/push/mesh: iOS-iOS, Android-Android, iOS-Android calls, background/locked/terminated wake, LAN/BLE-wakeup/relay transport ladder. The device matrix guide (meerkat-native-transport-device-matrix.md) is the script.',
  ],
  13: [
    'Approve the RPO/RTO targets, then execute the restore, PITR, failover, regional-loss, and rotation drills with Claude against the isolated environment. Sign the drill verdicts.',
  ],
  14: [
    'Mostly Claude: CI builds SBOMs, scans, signs artifacts with the pinned identity, verifies provenance. You approve the blocking-policy results.',
  ],
  15: [
    'Approve the latency/error/saturation budgets, then Claude runs browser, 10x load, 48h soak, canary, and the rollback rehearsal on the production-shaped deploy. The 48h soak is wall-clock time; schedule it.',
  ],
  16: [
    'In App Store Connect and Play Console: complete App Privacy / Data Safety from the observed-behavior worksheets Claude prepares, enter the Step 3 URLs, upload screenshots/metadata from the signed candidates, create the review accounts, and submit. Expect review questions about E2E messaging + UGC; Claude drafts responses.',
  ],
  17: [
    'Claude assembles the final ledger, re-renders this dashboard, and reruns the production-readiness and adversarial audits against the immutable manifest. You review the summary and clear or sign any remaining exception.',
  ],
  18: [
    'The GO call is yours. Hold the review against the ledger, confirm you are on duty for the launch window with rollback ready, sign GO, and Claude activates in the approved sequence while you both watch the dashboards.',
  ],
};

// Ledger-verified completion state per runbook checklist item, in runbook
// order. 'done' = evidence recorded in the active ledger; 'exception' =
// covered by a founder-signed exception in the ledger; absent/open = still
// interactive. Update this map when ledger evidence lands, then re-render.
const ITEM_STATE = {
  1: ['done', 'done', 'exception', 'exception', 'exception', 'done', 'done', 'done'],
  2: ['done', 'exception', 'done', 'done', 'done'],
};

// ---------- render ----------

// Click-by-click founder execution guide (md canonical, html twin beside it).
const GUIDE_HREF = '../../guides/meerkat-launch-execution-guide-2026-07-21.html';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function statusMeta(status) {
  return {
    PASS: { color: '#30D158', label: 'PASS' },
    IN_PROGRESS: { color: '#FFB877', label: 'IN PROGRESS' },
    FAIL: { color: '#FFB4AB', label: 'FAIL' },
    WAIVED: { color: '#8BCFF0', label: 'WAIVED' },
    OPEN: { color: '#52443A', label: 'OPEN' },
  }[status] ?? { color: '#52443A', label: status };
}

function main() {
  const { steps, stopConditions } = parseRunbook();
  const { active, count } = loadActiveLedger();
  if (!active) throw new Error('no active (non-superseded) ledger found');
  const ledgerSteps = new Map(active.steps.map((s) => [s.step, s]));

  const releaseId = active.releaseId;
  const sha = active.releaseSha;
  const shortSha = sha.slice(0, 8);
  const remoteCi = ledgerSteps.get(1)?.evidence?.remoteCi ?? {};

  const railDots = steps.map((s) => {
    const st = ledgerSteps.get(s.n)?.status ?? 'OPEN';
    const m = statusMeta(st);
    return `<a class="dot" href="#step-${s.n}" title="Step ${s.n}: ${esc(s.title)}" style="--dot:${m.color}"><span>${s.n}</span></a>`;
  }).join('');

  const stepCards = steps.map((s) => {
    const ledger = ledgerSteps.get(s.n) ?? {};
    const st = ledger.status ?? 'OPEN';
    const m = statusMeta(st);
    const actions = FOUNDER_ACTIONS[s.n] ?? [];
    const isCurrent = st === 'IN_PROGRESS';

    const states = ITEM_STATE[s.n] ?? [];
    const checklist = s.checklist.map((item, i) => {
      const state = states[i];
      if (state === 'done') {
        return `
      <label class="check verified"><input type="checkbox" checked disabled data-verified="1"><span>${esc(item)}</span><em class="tag done-tag">ledger</em></label>`;
      }
      if (state === 'exception') {
        return `
      <label class="check exception-item"><input type="checkbox" checked disabled data-verified="1"><span>${esc(item)}</span><em class="tag exc-tag">exception</em></label>`;
      }
      return `
      <label class="check"><input type="checkbox" data-key="${s.n}:${i}"><span>${esc(item)}</span></label>`;
    }).join('');

    const founderBlock = actions.length ? `
      <div class="founder">
        <div class="founder-head">Your moves</div>
        <ol>${actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>
        <div class="founder-link"><a href="${GUIDE_HREF}#step-${s.n}">Full step-by-step instructions for Step ${s.n} &rarr;</a></div>
      </div>` : '';

    const exceptions = (ledger.exceptions ?? []).map((e) => `
      <div class="exception"><strong>${esc(e.id)}</strong> · ${esc(e.subject)} — founder-signed. ${esc(e.reason)}</div>`).join('');

    const openItems = (ledger.openItems ?? []).length ? `
      <div class="open-items"><div class="mini-head">Blocking items</div><ul>${ledger.openItems.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '';

    const assessment = ledger.exitGateAssessment ? `
      <div class="assessment"><span class="mini-head">Ledger assessment</span> ${esc(ledger.exitGateAssessment)}</div>` : '';

    return `
    <section class="step ${isCurrent ? 'current' : ''} ${st === 'PASS' ? 'passed' : ''}" id="step-${s.n}" data-status="${st}">
      <header class="step-head" onclick="this.parentElement.classList.toggle('collapsed')">
        <div class="step-id" style="--dot:${m.color}">${s.n}</div>
        <div class="step-title">
          <h2>${esc(s.title)}</h2>
          <div class="step-meta">
            <span class="pill" style="background:${m.color}1f;color:${m.color};border:1px solid ${m.color}55">${m.label}</span>
            <span class="owner">${esc(s.owners)}</span>
            <span class="progress-note" data-progress="${s.n}"></span>
          </div>
        </div>
        <div class="chev">›</div>
      </header>
      <div class="step-body">
        ${founderBlock}
        ${openItems}
        <div class="cols">
          <div>
            <div class="mini-head">Runbook checklist</div>
            <div class="checklist" data-step="${s.n}">${checklist}</div>
          </div>
          <div>
            <div class="mini-head">Evidence required</div>
            <ul class="evidence">${s.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
            <div class="mini-head" style="margin-top:14px">Exit gate</div>
            <p class="gate">${esc(s.exitGate)}</p>
            ${assessment}
            ${exceptions}
          </div>
        </div>
      </div>
    </section>`;
  }).join('');

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meerkat Launch Dashboard</title>
<style>
:root{--bg:#0E0E13;--surface:#1B1B20;--elevated:#2A292F;--text:#E4E1E9;--text2:#D6C3B5;--muted:#9F8E81;
--primary:#FFB877;--container:#C9894D;--info:#8BCFF0;--danger:#FFB4AB;--danger-bg:#93000A;--success:#30D158;
--glass:rgba(255,255,255,0.03);--glass-border:rgba(255,255,255,0.10);--border:rgba(255,255,255,0.06)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font:15px/1.6 -apple-system,"SF Pro Text","Segoe UI",sans-serif;padding-bottom:80px}
a{color:var(--info);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1060px;margin:0 auto;padding:0 24px}
/* hero */
.hero{position:sticky;top:0;z-index:50;background:linear-gradient(180deg,#131318f2,#131318e6);backdrop-filter:blur(14px);border-bottom:1px solid var(--glass-border)}
.hero-inner{max-width:1060px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.hero h1{font-size:17px;font-weight:700;color:var(--primary);letter-spacing:.2px;white-space:nowrap}
.hero .sub{font-size:12px;color:var(--muted)}
.nogo{background:var(--danger-bg);color:var(--danger);padding:3px 12px;border-radius:999px;font-weight:700;font-size:12px;letter-spacing:.6px}
.go{background:#0d3d1c;color:var(--success);padding:3px 12px;border-radius:999px;font-weight:700;font-size:12px;letter-spacing:.6px}
.meter{flex:1;min-width:180px;display:flex;flex-direction:column;gap:4px}
.meter .bar{height:6px;border-radius:999px;background:var(--elevated);overflow:hidden}
.meter .fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--container),var(--primary));width:0%;transition:width .6s ease}
.meter .nums{font-size:11px;color:var(--muted);display:flex;justify-content:space-between}
/* rail */
.rail{display:flex;gap:8px;flex-wrap:wrap;padding:18px 0 6px}
.dot{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
color:var(--text);background:var(--surface);border:2px solid var(--dot);transition:transform .15s}
.dot:hover{transform:scale(1.15);text-decoration:none}
.dot span{opacity:.9}
/* release card */
.release{background:var(--glass);border:1px solid var(--glass-border);border-radius:16px;padding:18px 22px;margin:14px 0 8px;
display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.release .kv b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:2px}
.release .kv div{font-size:13px;color:var(--text2);word-break:break-word}
code{background:var(--elevated);padding:1px 7px;border-radius:6px;font-size:12.5px;font-family:"SF Mono",ui-monospace,monospace}
/* focus banner */
.focus{background:linear-gradient(135deg,#2a2118,#1f1a14);border:1px solid #ffb87740;border-radius:16px;padding:16px 22px;margin:10px 0 24px}
.focus b{color:var(--primary)}
.focus .mini-head{margin-bottom:6px}
/* steps */
.step{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin:14px 0;overflow:hidden;transition:border-color .2s}
.step.current{border-color:#ffb87766;box-shadow:0 0 0 1px #ffb87722, 0 8px 30px rgba(0,0,0,.35)}
.step.passed{opacity:.75}
.step-head{display:flex;align-items:center;gap:16px;padding:16px 20px;cursor:pointer;user-select:none}
.step-head:hover{background:var(--glass)}
.step-id{width:38px;height:38px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;
background:var(--bg);border:2px solid var(--dot);font-size:15px}
.step-title{flex:1;min-width:0}
.step-title h2{font-size:15.5px;font-weight:650}
.step-meta{display:flex;gap:10px;align-items:center;margin-top:4px;flex-wrap:wrap}
.pill{font-size:10.5px;font-weight:700;letter-spacing:.7px;padding:2px 10px;border-radius:999px}
.owner{font-size:12px;color:var(--muted)}
.progress-note{font-size:12px;color:var(--muted)}
.chev{font-size:22px;color:var(--muted);transition:transform .2s}
.step:not(.collapsed) .chev{transform:rotate(90deg)}
.step.collapsed .step-body{display:none}
.step-body{padding:4px 20px 20px 74px}
@media(max-width:720px){.step-body{padding-left:20px}}
.cols{display:grid;grid-template-columns:1.2fr 1fr;gap:24px}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
.mini-head{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:var(--muted);margin-bottom:8px;font-weight:700}
/* founder block */
.founder{background:linear-gradient(135deg,#20261e,#1a2018);border:1px solid #30d15833;border-radius:12px;padding:14px 18px;margin:6px 0 18px}
.founder-head{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:var(--success);font-weight:800;margin-bottom:8px}
.founder ol{margin-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;color:var(--text)}
.founder-link{margin-top:10px;font-size:12.5px;font-weight:600}
/* checklist */
.check{display:flex;gap:10px;align-items:flex-start;padding:6px 8px;border-radius:8px;font-size:13.5px;cursor:pointer}
.check:hover{background:var(--glass)}
.check input{margin-top:3px;accent-color:var(--container);width:15px;height:15px;flex:none;cursor:pointer}
.check input:checked+span{color:var(--muted);text-decoration:line-through}
.check.verified input{accent-color:var(--success)}
.check.exception-item input{accent-color:var(--info)}
.check.exception-item input:checked+span{text-decoration:none;color:var(--text2)}
.tag{margin-left:auto;flex:none;font-size:9.5px;font-style:normal;font-weight:800;letter-spacing:.8px;text-transform:uppercase;padding:1px 8px;border-radius:999px;align-self:center}
.done-tag{color:var(--success);background:#30d15818;border:1px solid #30d15840}
.exc-tag{color:var(--info);background:#8bcff015;border:1px solid #8bcff040}
.evidence{margin-left:16px;font-size:12.5px;color:var(--text2);display:flex;flex-direction:column;gap:4px}
.gate{font-size:12.5px;color:var(--text2);border-left:3px solid var(--container);padding-left:10px}
.assessment{font-size:12.5px;color:var(--text2);margin-top:12px;background:var(--glass);border-radius:8px;padding:8px 12px}
.assessment .mini-head{display:inline;margin-right:6px}
.exception{font-size:12px;color:var(--info);background:#8bcff012;border:1px solid #8bcff030;border-radius:8px;padding:8px 12px;margin-top:10px}
.open-items{background:#93000a22;border:1px solid #ffb4ab33;border-radius:10px;padding:10px 16px;margin-bottom:16px}
.open-items .mini-head{color:var(--danger)}
.open-items ul{margin-left:16px;font-size:13px;color:var(--danger)}
/* stop conditions */
.stops{background:var(--glass);border:1px solid var(--glass-border);border-radius:16px;padding:18px 22px;margin:26px 0}
.stops ul{margin-left:18px;font-size:13px;color:var(--text2);columns:2;column-gap:34px}
@media(max-width:820px){.stops ul{columns:1}}
.stops li{margin-bottom:5px;break-inside:avoid}
h3.sect{color:var(--text2);font-size:14px;margin:28px 0 4px;letter-spacing:.3px}
.foot{color:var(--muted);font-size:12px;margin-top:30px;border-top:1px solid var(--border);padding-top:14px}
</style></head>
<body>
<div class="hero"><div class="hero-inner">
  <h1>Meerkat · Production Launch</h1>
  <span class="${active.launchState === 'GO' ? 'go' : 'nogo'}">${esc(active.launchState)}</span>
  <div class="meter"><div class="bar"><div class="fill" id="fill"></div></div>
  <div class="nums"><span id="stepnums"></span><span id="checknums"></span></div></div>
</div></div>

<div class="wrap">
  <nav class="rail">${railDots}</nav>

  <div class="release">
    <div class="kv"><b>Release candidate</b><div>${esc(releaseId)} <span style="color:var(--muted)">(candidate ${count} of this train)</span></div></div>
    <div class="kv"><b>Immutable SHA</b><div><code>${shortSha}</code> on ${esc(active.releaseBranch)}</div></div>
    <div class="kv"><b>Verification</b><div>${esc(String(remoteCi.releaseVerifyRun ?? '').split(' ')[0] ? '' : '')}<a href="${esc(String(remoteCi.releaseVerifyRun ?? '').split(' ')[0])}">release-verify run</a> · <a href="${esc(String(remoteCi.pushCiRun ?? '').split(' ')[0])}">push CI</a></div></div>
    <div class="kv"><b>Canonical sources</b><div><a href="./${esc(releaseId)}/evidence.json">evidence.json</a> · <a href="./${esc(releaseId)}/evidence-summary.html">ledger summary</a> · <a href="../../guides/meerkat-production-activation-runbook-2026-07-15.md">runbook</a> · <a href="${GUIDE_HREF}">execution guide</a></div></div>
  </div>

  <div class="focus">
    <div class="mini-head" style="color:var(--primary)">Founder focus right now</div>
    <b>1.</b> Engage the attorney (guide Step 2.1) — the seven Step 3 documents are drafted and waiting at docs/legal/meerkat/.&ensp;
    <b>2.</b> Start NCMEC CyberTipline ESP registration now (guide Step 9.1, weeks of lead).&ensp;
    <b>3.</b> Start the Step 4 account sweep any time — it waits on nobody.&ensp;
    Every step now has click-by-click instructions: <a href="${GUIDE_HREF}">the execution guide</a>.
  </div>

  ${stepCards}

  <div class="stops">
    <div class="mini-head" style="color:var(--danger)">Automatic stop conditions — any of these returns the affected step to FAIL</div>
    <ul>${stopConditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
  </div>

  <div class="foot">
    Rendered from the runbook and <code>${esc(releaseId)}/evidence.json</code> (canonical). Re-render after ledger changes:
    <code>node docs/releases/meerkat/render-launch-dashboard.mjs</code>. Checkbox state lives in this browser (localStorage, keyed to the release id) and survives re-renders.
  </div>
</div>

<script>
(function(){
  var KEY = 'mk-dash:${releaseId}:';
  var boxes = document.querySelectorAll('.check input');
  boxes.forEach(function(b){
    if (b.dataset.verified) return; // ledger-verified: pre-checked, locked
    var k = KEY + b.dataset.key;
    b.checked = localStorage.getItem(k) === '1';
    b.addEventListener('change', function(){
      if (b.checked) localStorage.setItem(k, '1'); else localStorage.removeItem(k);
      update();
    });
  });
  var stepStatuses = Array.prototype.map.call(document.querySelectorAll('.step'), function(s){ return s.dataset.status; });
  function update(){
    var total = boxes.length, done = 0;
    boxes.forEach(function(b){ if (b.checked) done++; });
    document.querySelectorAll('.checklist').forEach(function(cl){
      var n = cl.dataset.step;
      var items = cl.querySelectorAll('input');
      var d = 0; items.forEach(function(i){ if (i.checked) d++; });
      var note = document.querySelector('[data-progress="' + n + '"]');
      if (note) note.textContent = d + '/' + items.length + ' items';
    });
    var passed = stepStatuses.filter(function(s){ return s === 'PASS'; }).length;
    document.getElementById('fill').style.width = (total ? (done/total*100) : 0) + '%';
    document.getElementById('stepnums').textContent = passed + '/18 steps passed';
    document.getElementById('checknums').textContent = done + '/' + total + ' checklist items';
  }
  // collapse passed + far-future steps by default; keep current + next open
  document.querySelectorAll('.step').forEach(function(s){
    if (s.dataset.status === 'PASS') s.classList.add('collapsed');
  });
  var firstOpen = document.querySelector('.step[data-status="OPEN"]');
  document.querySelectorAll('.step[data-status="OPEN"]').forEach(function(s){
    if (s !== firstOpen) s.classList.add('collapsed');
  });
  update();
})();
</script>
</body></html>`;

  const out = path.join(RELEASES_DIR, 'launch-dashboard.html');
  fs.writeFileSync(out, html);
  console.log('rendered', out, `(active: ${releaseId}, ${count} candidates)`);
}

main();
