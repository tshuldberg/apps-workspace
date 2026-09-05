/**
 * The static operator moderation console page (Plan 39 P12, report buildout W-2).
 * Self-contained single document: inline CSS + JS, zero external assets, served
 * by operator-console-http.ts at GET /. All data comes from the authenticated
 * /api routes; the page renders ONLY what the API really returned (NC-P4/NC-P6):
 * locked, unconfigured, unreachable, and empty states are explicit, and no count
 * or success is ever fabricated client-side.
 *
 * This is an OPERATOR surface, not an end-user app surface: its strings are
 * intentionally NOT in the meerkat parity locks (those cover the two consumer
 * apps). Pricing never appears here (NC-P5).
 */

export const OPERATOR_CONSOLE_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Meerkat operator console</title>
<style>
  :root{
    --bg:#131318; --panel:#1B1B20; --panel2:#1F1F25; --elevated:#2A292F;
    --text:#E4E1E9; --text2:#A9A2AE; --border:rgba(255,255,255,0.08);
    --accent:#FFB877; --danger:#FFB4AB; --danger-bg:#93000A; --ok:#30D158; --warn:#EFC65A;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh}
  .top{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--panel)}
  .top b{font-size:15px}
  .top .sub{color:var(--text2);font-size:12px}
  .top .who{margin-left:auto;color:var(--text2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46ch}
  .layout{display:grid;grid-template-columns:210px 1fr 260px;gap:0;min-height:calc(100vh - 45px)}
  @media (max-width:900px){.layout{grid-template-columns:1fr}.rail,.side{border:none}}
  .side{border-right:1px solid var(--border);background:var(--panel);padding:12px 8px}
  .sitem{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;color:var(--text2);font-size:13px}
  .sitem:hover{background:var(--panel2);color:var(--text)}
  .sitem.active{background:var(--elevated);color:var(--text);font-weight:600}
  .count{margin-left:auto;font-size:11px;padding:1px 7px;border-radius:9px;background:var(--danger-bg);color:#fff;min-width:20px;text-align:center}
  .count.zero{background:var(--panel2);color:var(--text2)}
  .main{padding:16px;overflow-x:auto}
  .rail{border-left:1px solid var(--border);background:var(--panel);padding:14px}
  .railtitle{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);margin:12px 0 6px}
  .railtitle:first-child{margin-top:0}
  .railbody{font-size:12.5px;color:var(--text2)}
  .notice{margin-top:12px;padding:9px 11px;border-radius:8px;background:rgba(147,0,10,.25);border:1px solid rgba(255,180,171,.25);color:var(--danger);font-size:12px}
  h2{font-size:16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .chip{font-size:11.5px;padding:3px 10px;border-radius:12px;background:var(--panel2);border:1px solid var(--border);color:var(--text2);cursor:pointer}
  .chip.active{background:var(--accent);color:#1a1208;border-color:transparent}
  .card{background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px}
  .chead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .cname{font-weight:600}
  .cmeta{color:var(--text2);font-size:12px}
  .pill{font-size:10px;padding:2px 8px;border-radius:9px;text-transform:uppercase;letter-spacing:.04em}
  .pill.err{background:var(--danger-bg);color:#fff}
  .pill.warn{background:rgba(239,198,90,.16);color:var(--warn)}
  .pill.ok{background:rgba(48,209,88,.15);color:var(--ok)}
  .pill.dim{background:var(--panel);color:var(--text2)}
  .cbody{margin:8px 0;font-size:13.5px;white-space:pre-wrap;word-break:break-word}
  .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  button{font:inherit;font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--elevated);color:var(--text);cursor:pointer}
  button:hover{filter:brightness(1.15)}
  button.danger{background:var(--danger-bg);border-color:transparent;color:#fff}
  button.primary{background:var(--accent);border-color:transparent;color:#1a1208;font-weight:600}
  button:disabled{opacity:.5;cursor:not-allowed}
  .state{padding:40px 16px;text-align:center;color:var(--text2)}
  .state b{display:block;color:var(--text);margin-bottom:6px;font-size:15px}
  input,select,textarea{font:inherit;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 10px}
  .lockbox{max-width:420px;margin:80px auto;background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:12px}
  .toast{position:fixed;bottom:16px;right:16px;max-width:380px;background:var(--elevated);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;display:none;z-index:9}
  .toast.err{border-color:rgba(255,180,171,.5);color:var(--danger)}
  .toast.ok{border-color:rgba(48,209,88,.4)}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top;word-break:break-word}
  th{color:var(--text2);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--text2)}
  .row2{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
</style>
</head>
<body>
<div class="top">
  <b>Meerkat operator console</b>
  <span class="sub">first-party trust &amp; safety &middot; audit-logged</span>
  <span class="who" id="who"></span>
</div>
<div id="app"></div>
<div class="toast" id="toast"></div>
<script>
(function () {
  'use strict';
  var LANES = [
    { id: 'alerts', label: '\u{1F6A8} Safety alerts', countKey: 'alerts' },
    { id: 'queue', label: '\\u{1F6E1}\\uFE0F Report queue', countKey: 'open' },
    { id: 'csam', label: '\\u26A0\\uFE0F CSAM lane', countKey: 'openPriorityCsam' },
    { id: 'dmca', label: '\\u00A9\\uFE0F DMCA lane' },
    { id: 'personas', label: '\\u{1F464} Personas' },
    { id: 'publications', label: '\\u{1F4F0} Publications' },
    { id: 'audit', label: '\\u{1F4CB} Audit log' }
  ];
  var REASONS = ['spam', 'harassment', 'illegal', 'csam', 'violence', 'other'];
  var state = { lane: 'alerts', reason: null, stats: null, alerts: [], secretOk: false, unconfigured: false, unreachable: false };
  var app = document.getElementById('app');

  function secret() { return sessionStorage.getItem('mkOperatorSecret') || ''; }

  function api(path, options) {
    options = options || {};
    return fetch('/api' + path, {
      method: options.method || 'GET',
      headers: Object.assign(
        { Authorization: 'Bearer ' + secret() },
        options.body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (json) {
        return { status: res.status, json: json };
      });
    }, function () {
      return { status: 0, json: null };
    });
  }

  function toast(message, kind) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast ' + (kind || '');
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 5000);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderLock(message) {
    app.innerHTML =
      '<div class="lockbox">' +
      '<b>Operator access</b>' +
      '<div class="railbody">' + esc(message || 'This console requires the operator secret. Every action is authenticated and audit-logged.') + '</div>' +
      '<input id="secretInput" type="password" placeholder="Operator secret" autocomplete="off">' +
      '<button class="primary" id="unlockBtn">Unlock console</button>' +
      '</div>';
    document.getElementById('unlockBtn').onclick = function () {
      sessionStorage.setItem('mkOperatorSecret', document.getElementById('secretInput').value);
      boot();
    };
    document.getElementById('secretInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('unlockBtn').click();
    });
  }

  function renderFatal(title, body) {
    app.innerHTML = '<div class="state"><b>' + esc(title) + '</b>' + esc(body) + '</div>';
  }

  function laneCount(lane) {
    if (!state.stats || !lane.countKey) return null;
    if (lane.countKey === 'open') return state.stats.open;
    if (lane.countKey === 'openPriorityCsam') return state.stats.openByReason ? state.stats.openByReason.csam : 0;
    if (lane.countKey === 'alerts') return state.alerts.length;
    return null;
  }

  function shell(mainHtml, railHtml) {
    var side = LANES.map(function (lane) {
      var count = laneCount(lane);
      var badge = count === null ? '' :
        '<span class="count' + (count === 0 ? ' zero' : '') + '">' + count + '</span>';
      return '<div class="sitem' + (state.lane === lane.id ? ' active' : '') + '" data-lane="' + lane.id + '">' + lane.label + badge + '</div>';
    }).join('');
    app.innerHTML =
      '<div class="layout">' +
      '<div class="side">' + side + '</div>' +
      '<div class="main" id="main">' + mainHtml + '</div>' +
      '<div class="rail" id="rail">' + railHtml + '</div>' +
      '</div>';
    Array.prototype.forEach.call(app.querySelectorAll('.sitem'), function (el) {
      el.onclick = function () { state.lane = el.getAttribute('data-lane'); state.reason = null; refresh(); };
    });
  }

  function defaultRail() {
    return '<div class="railtitle">Action detail</div>' +
      '<div class="railbody"><b>Remove post</b> signs a tombstone the node honors immediately; the post is gone on the next page fetch and can never resurrect.<br><br>' +
      '<b>Suspend persona</b> revokes all sessions and denies /submit. Audit-logged, reversible.<br><br>' +
      '<b>Kill publication</b> is the full Plan 19 takedown: a signed kill drops it from every public route, durably, plus a posting freeze.</div>' +
      '<div class="railtitle">SLA</div>' +
      '<div class="railbody">CSAM lane: fast-track review<br>Violence: 4h &middot; Spam/other: 24h</div>' +
      '<div class="notice">Every console action emits a signed audit event. No silent moderation.</div>';
  }

  function reasonPrompt(label) {
    var value = window.prompt(label + '\\nReason (recorded in the audit log):');
    if (value === null) return null;
    return value.trim() || 'unspecified';
  }

  function actionResult(r, successMessage) {
    if (r.status === 200 && r.json && r.json.ok === true) {
      toast(successMessage, 'ok');
      refresh();
      return;
    }
    var reason = (r.json && r.json.reason) || (r.status === 0 ? 'console API unreachable' : 'status ' + r.status);
    toast('Not done: ' + reason, 'err');
    refresh();
  }

  function reportCard(row) {
    var who = row.post ? '<code>' + esc(row.post.personaPubkey.slice(0, 12)) + '\\u2026</code>' : '<span class="cmeta">target not stored on this node</span>';
    var statusPill = row.status === 'open' ? '' : '<span class="pill dim">' + esc(row.status) + '</span>';
    var body = row.post ? '<div class="cbody">' + esc(row.post.body) + '</div>' :
      '<div class="cbody cmeta">Reported ' + esc(row.targetKind) + ' <code>' + esc(row.targetId) + '</code></div>';
    var acts = '<div class="acts">';
    if (row.post) {
      acts += '<button class="danger" data-act="remove" data-pub="' + esc(row.publicationId) + '" data-post="' + esc(row.targetId) + '">Remove post</button>';
      acts += '<button class="danger" data-act="suspend" data-persona="' + esc(row.post.personaPubkey) + '">Suspend persona</button>';
      acts += '<button data-act="history" data-persona="' + esc(row.post.personaPubkey) + '">View history</button>';
    }
    if (row.status === 'open') {
      acts += '<button data-act="dismiss" data-key="' + esc(row.reportKey) + '">Dismiss reports</button>';
      acts += '<button data-act="review" data-key="' + esc(row.reportKey) + '">Mark reviewed</button>';
    }
    acts += '</div>';
    return '<div class="card">' +
      '<div class="chead"><span class="cname">' + esc(row.publicationTitle || row.publicationId) + '</span>' +
      '<span class="cmeta">' + esc(row.targetKind) + ' &middot; reported ' + esc(row.reportedAt) + ' &middot; by ' + who + '</span>' +
      '<span class="pill ' + (row.priority ? 'err' : 'warn') + '" style="margin-left:auto">' + esc(row.reason) + '</span>' + statusPill + '</div>' +
      body + acts + '</div>';
  }

  function bindReportActions(container) {
    Array.prototype.forEach.call(container.querySelectorAll('button[data-act]'), function (btn) {
      btn.onclick = function () {
        var act = btn.getAttribute('data-act');
        if (act === 'remove') {
          var reason = reasonPrompt('Remove this post (signed tombstone).');
          if (reason === null) return;
          api('/actions/tombstone', { method: 'POST', body: { publicationId: btn.getAttribute('data-pub'), postId: btn.getAttribute('data-post'), reason: reason } })
            .then(function (r) { actionResult(r, 'Post tombstoned. It is gone from the public page.'); });
        } else if (act === 'suspend') {
          var sreason = reasonPrompt('Suspend this persona (revokes sessions, denies /submit).');
          if (sreason === null) return;
          api('/actions/suspend', { method: 'POST', body: { personaPubkey: btn.getAttribute('data-persona'), reason: sreason } })
            .then(function (r) { actionResult(r, 'Persona suspended. Sessions revoked; submits denied.'); });
        } else if (act === 'dismiss' || act === 'review') {
          api('/reports/review', { method: 'POST', body: { reportKey: btn.getAttribute('data-key'), status: act === 'dismiss' ? 'dismissed' : 'reviewed' } })
            .then(function (r) { actionResult(r, act === 'dismiss' ? 'Reports dismissed.' : 'Marked reviewed.'); });
        } else if (act === 'history') {
          state.lane = 'personas';
          state.personaQuery = btn.getAttribute('data-persona');
          refresh();
        }
      };
    });
  }

  function renderQueue(priorityOnly) {
    var query = '/reports?limit=100' + (priorityOnly ? '&reason=csam' : (state.reason ? '&reason=' + state.reason : '')) + '&status=open';
    api(query).then(function (r) {
      if (!guard(r)) return;
      var rows = (r.json && r.json.reports) || [];
      var chips = priorityOnly ? '' : REASONS.map(function (reason) {
        var n = state.stats && state.stats.openByReason ? state.stats.openByReason[reason] : 0;
        return '<span class="chip' + (state.reason === reason ? ' active' : '') + '" data-reason="' + reason + '">' +
          reason.charAt(0).toUpperCase() + reason.slice(1) + ' ' + n + '</span>';
      }).join('');
      var title = priorityOnly ? 'CSAM lane' : 'Report queue';
      var body = rows.length === 0 ?
        '<div class="state"><b>No open reports' + (priorityOnly ? ' in the CSAM lane' : (state.reason ? ' for this reason' : '')) + '</b>The queue is clear. Counts here are real store counts.</div>' :
        rows.map(reportCard).join('');
      var rail = defaultRail();
      if (priorityOnly) {
        rail = '<div class="railtitle">CSAM lane</div>' +
          '<div class="railbody">Reports with reason <b>csam</b>, retained preferentially by the intake cap. Reviewing or taking down a csam item files an evidence-reference record into the durable <b>NCMEC report queue</b> (real, this node). Filing to NCMEC itself is founder-ops: export the queue for manual filing until the vendor lands.</div>' +
          '<div id="ncmecBox" class="notice">NCMEC queue: loading\\u2026</div>' + rail;
      }
      shell('<h2>' + title + '</h2><div class="row2" style="margin-bottom:12px">' + chips + '</div>' + body, rail);
      Array.prototype.forEach.call(document.querySelectorAll('.chip[data-reason]'), function (chip) {
        chip.onclick = function () {
          var reason = chip.getAttribute('data-reason');
          state.reason = state.reason === reason ? null : reason;
          refresh();
        };
      });
      bindReportActions(document.getElementById('main'));
      if (priorityOnly) {
        api('/ncmec').then(function (nr) {
          var box = document.getElementById('ncmecBox');
          if (!box) return;
          if (nr.status !== 200 || !nr.json || nr.json.ok !== true) { box.textContent = 'NCMEC queue: unavailable'; return; }
          if (!nr.json.wired || !nr.json.counts) { box.textContent = 'NCMEC queue: not wired on this node.'; return; }
          var c = nr.json.counts;
          box.innerHTML = 'NCMEC queue \\u00B7 queued <b>' + c.queued + '</b> \\u00B7 exported ' + c.exported + ' \\u00B7 filed ' + c.filed +
            ' <button id="ncmecExport" style="margin-left:8px">Export queued (NDJSON)</button>';
          var eb = document.getElementById('ncmecExport');
          if (eb) eb.onclick = function () {
            api('/ncmec/export', { method: 'POST', body: {} }).then(function (er) {
              if (er.status !== 200 || !er.json || !er.json.ok) { toast('NCMEC export failed: ' + ((er.json && er.json.reason) || er.status), 'err'); return; }
              // DELIVER the filing payload: the server marked these records exported, so the
              // operator MUST receive the NDJSON now (else queued evidence silently leaves the
              // queue undelivered). Trigger a download of the exact payload.
              if (er.json.count > 0 && typeof er.json.ndjson === 'string') {
                var blob = new Blob([er.json.ndjson], { type: 'application/x-ndjson' });
                var href = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = href;
                a.download = 'ncmec-queue-export-' + new Date().toISOString().replace(/[:.]/g, '-') + '.ndjson';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(href); }, 2000);
                toast('Downloaded ' + er.json.count + ' NCMEC record(s) for manual filing; marked exported.', 'ok');
              } else {
                toast('No queued NCMEC records to export.', '');
              }
              refresh();
            });
          };
        });
      }
    });
  }

  function renderDmca() {
    api('/dmca?limit=100').then(function (r) {
      if (!guard(r)) return;
      var wired = r.json && r.json.wired;
      var claims = (r.json && r.json.claims) || [];
      var rail = '<div class="railtitle">DMCA lane</div>' +
        '<div class="railbody">Public takedown notices (17 U.S.C. 512). A notice is <b>received</b> until you act. Takedown tombstones the claimed posts this node stores; URLs and unknown ids are surfaced for manual handling. Counter-notices and rejections are recorded. The designated-agent registration is founder-ops.</div>' +
        '<div class="notice">Every DMCA action emits a signed audit event.</div>';
      if (!wired) {
        shell('<h2>DMCA lane</h2><div class="state"><b>DMCA intake not wired</b>Set up the DMCA intake store on this node to receive notices.</div>', rail);
        return;
      }
      var body = claims.length === 0 ?
        '<div class="state"><b>No DMCA notices</b>Received notices will appear here.</div>' :
        '<table><tr><th>Received</th><th>Status</th><th>Work</th><th>Claimed</th><th>Claimant</th><th>Actions</th></tr>' +
        claims.map(function (c) {
          var claimed = (c.claimedPostIds || []).length + ' post(s), ' + (c.claimedUrls || []).length + ' url(s)';
          var acts = c.status === 'received' ?
            '<button data-dmca-takedown="' + esc(c.id) + '">Takedown</button> ' +
            '<button data-dmca-counter="' + esc(c.id) + '">Counter-notice</button> ' +
            '<button data-dmca-reject="' + esc(c.id) + '">Reject</button>' : esc(c.status);
          return '<tr><td>' + esc(c.receivedAt) + '</td><td><span class="pill">' + esc(c.status) + '</span></td>' +
            '<td>' + esc(String(c.workDescription || '').slice(0, 80)) + '</td><td>' + esc(claimed) + '</td>' +
            '<td>' + esc(c.claimant && c.claimant.name) + '</td><td>' + acts + '</td></tr>';
        }).join('') + '</table>';
      shell('<h2>DMCA lane</h2>' + body, rail);
      Array.prototype.forEach.call(document.querySelectorAll('[data-dmca-takedown]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-dmca-takedown');
          var reason = reasonPrompt('Record a DMCA takedown for this claim (tombstones claimed posts).');
          if (reason === null) return;
          api('/dmca/takedown', { method: 'POST', body: { claimId: id, reason: reason } }).then(function (r2) {
            if (r2.status === 200 && r2.json && r2.json.ok) { toast('Takedown: ' + r2.json.tombstonedPostIds.length + ' tombstoned, ' + r2.json.unresolved.length + ' unresolved.', 'ok'); refresh(); }
            else toast('Takedown failed: ' + ((r2.json && r2.json.reason) || r2.status), 'err');
          });
        };
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-dmca-counter]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-dmca-counter');
          var statement = window.prompt('Counter-notice statement (17 U.S.C. 512(g)):');
          if (statement === null || !statement.trim()) return;
          var signature = window.prompt('Counter-notice signature (typed legal name):');
          if (signature === null || !signature.trim()) return;
          api('/dmca/counter-notice', { method: 'POST', body: { claimId: id, statement: statement, signature: signature } }).then(function (r2) {
            if (r2.status === 200 && r2.json && r2.json.ok) { toast('Counter-notice recorded.', 'ok'); refresh(); }
            else toast('Counter-notice failed: ' + ((r2.json && r2.json.reason) || r2.status), 'err');
          });
        };
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-dmca-reject]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-dmca-reject');
          var reason = reasonPrompt('Reject this DMCA notice (defective/abusive).');
          if (reason === null) return;
          api('/dmca/reject', { method: 'POST', body: { claimId: id, reason: reason } }).then(function (r2) {
            if (r2.status === 200 && r2.json && r2.json.ok) { toast('Claim rejected.', 'ok'); refresh(); }
            else toast('Reject failed: ' + ((r2.json && r2.json.reason) || r2.status), 'err');
          });
        };
      });
    });
  }

  function renderPersonas() {
    var queryValue = state.personaQuery || '';
    var form = '<h2>Personas</h2>' +
      '<div class="row2" style="margin-bottom:14px">' +
      '<input id="personaInput" style="min-width:320px" placeholder="@alias or persona pubkey (64 hex)" value="' + esc(queryValue) + '">' +
      '<button class="primary" id="personaLookup">Look up</button></div>' +
      '<div id="personaResult"></div>';
    shell(form, defaultRail());
    var run = function () {
      var raw = document.getElementById('personaInput').value.trim();
      if (!raw) return;
      state.personaQuery = raw;
      var target = /^[0-9a-f]{64}$/i.test(raw) ? { personaPubkey: raw } : { alias: raw.replace(/^@/, '') };
      var container = document.getElementById('personaResult');
      container.innerHTML = '<div class="state">Looking up\\u2026</div>';
      api('/personas/status', { method: 'POST', body: target }).then(function (statusRes) {
        if (statusRes.status !== 200 || !statusRes.json || statusRes.json.ok !== true) {
          var reason = (statusRes.json && statusRes.json.reason) || 'status ' + statusRes.status;
          container.innerHTML = '<div class="state"><b>Lookup failed</b>' + esc(reason) + '</div>';
          return Promise.resolve(null);
        }
        var s = statusRes.json.status;
        // Posts are filtered by the RESOLVED persona key, never unfiltered: an
        // alias lookup must not misattribute other personas' posts.
        return api('/posts?limit=50&personaPubkey=' + s.personaPubkey).then(function (postsRes) {
          return { statusRes: statusRes, postsRes: postsRes };
        });
      }).then(function (results) {
        if (!results) return;
        var statusRes = results.statusRes;
        var s = statusRes.json.status;
        var pill = s.suspended ? '<span class="pill err">suspended</span>' : (s.registered ? '<span class="pill ok">active</span>' : '<span class="pill dim">unregistered</span>');
        var actionBtn = s.suspended ?
          '<button data-pact="unsuspend">Unsuspend persona</button>' :
          '<button class="danger" data-pact="suspend">Suspend persona</button>';
        var postsHtml = '';
        var postsRes = results.postsRes;
        if (postsRes.status === 200 && postsRes.json && Array.isArray(postsRes.json.posts)) {
          postsHtml = postsRes.json.posts.length === 0 ? '<div class="cmeta" style="margin-top:10px">No stored posts on this node.</div>' :
            '<div class="railtitle" style="margin-top:14px">Stored posts (' + postsRes.json.total + ')</div>' +
            postsRes.json.posts.map(function (p) {
              return '<div class="card"><div class="cmeta">' + esc(p.post.createdAt) + ' &middot; ' + esc(p.publicationId) + '</div>' +
                '<div class="cbody">' + esc(p.post.body) + '</div>' +
                '<div class="acts"><button class="danger" data-act="remove" data-pub="' + esc(p.publicationId) + '" data-post="' + esc(p.post.postId) + '">Remove post</button></div></div>';
            }).join('');
        }
        container.innerHTML =
          '<div class="card"><div class="chead"><span class="cname">' + esc(s.alias ? '@' + s.alias : '(no alias)') + '</span>' + pill + '</div>' +
          '<div class="cmeta" style="margin:6px 0"><code>' + esc(s.personaPubkey) + '</code> &middot; stored posts: ' + statusRes.json.posts + '</div>' +
          '<div class="acts">' + actionBtn + '</div></div>' + postsHtml;
        bindReportActions(container);
        Array.prototype.forEach.call(container.querySelectorAll('button[data-pact]'), function (btn) {
          btn.onclick = function () {
            var pact = btn.getAttribute('data-pact');
            var reason = reasonPrompt((pact === 'suspend' ? 'Suspend' : 'Unsuspend') + ' ' + (s.alias ? '@' + s.alias : s.personaPubkey.slice(0, 12)) + '.');
            if (reason === null) return;
            api('/actions/' + pact, { method: 'POST', body: { personaPubkey: s.personaPubkey, reason: reason } })
              .then(function (r) { actionResult(r, pact === 'suspend' ? 'Persona suspended. Sessions revoked; submits denied.' : 'Suspension lifted.'); });
          };
        });
      });
    };
    document.getElementById('personaLookup').onclick = run;
    document.getElementById('personaInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    if (queryValue) run();
  }

  function renderPublications() {
    api('/publications').then(function (r) {
      if (!guard(r)) return;
      var rows = (r.json && r.json.publications) || [];
      var body = rows.length === 0 ?
        '<div class="state"><b>No publications registered</b>This node is not serving any public publications.</div>' :
        '<table><tr><th>Publication</th><th>Status</th><th>Policy</th><th>Posts</th><th>Open reports</th><th>Actions</th></tr>' +
        rows.map(function (p) {
          var statusPill = p.status === 'active' ? '<span class="pill ok">active</span>' : '<span class="pill err">' + esc(p.status) + '</span>';
          var frozenPill = p.frozen ? ' <span class="pill err">frozen</span>' : '';
          return '<tr><td><b>' + esc(p.title) + '</b><br><code>' + esc(p.publicationId) + '</code></td>' +
            '<td>' + statusPill + frozenPill + '</td>' +
            '<td>' + esc(p.postPolicy) + '</td>' +
            '<td>' + p.posts + ' (' + p.tombstones + ' removed)</td>' +
            '<td>' + p.openReports + '</td>' +
            '<td><div class="acts">' +
            '<button data-fact="' + (p.frozen ? 'unfreeze' : 'freeze') + '" data-pub="' + esc(p.publicationId) + '">' + (p.frozen ? 'Unfreeze posting' : 'Freeze posting') + '</button>' +
            '<button class="danger" data-fact="kill" data-pub="' + esc(p.publicationId) + '">Kill publication</button>' +
            '</div></td></tr>';
        }).join('') + '</table>';
      shell('<h2>Publications</h2>' + body, defaultRail());
      Array.prototype.forEach.call(document.querySelectorAll('button[data-fact]'), function (btn) {
        btn.onclick = function () {
          var fact = btn.getAttribute('data-fact');
          var pub = btn.getAttribute('data-pub');
          if (fact === 'kill') {
            var reason = reasonPrompt('KILL this publication. Full takedown: dropped from every public route, durable across restarts.');
            if (reason === null) return;
            api('/actions/kill', { method: 'POST', body: { publicationId: pub, reason: reason } })
              .then(function (r) { actionResult(r, 'Publication killed. All public routes now 404 it.'); });
          } else {
            var frozen = fact === 'freeze';
            var freason = reasonPrompt((frozen ? 'Freeze' : 'Unfreeze') + ' posting on this publication.');
            if (freason === null) return;
            api('/actions/freeze', { method: 'POST', body: { publicationId: pub, frozen: frozen, reason: freason } })
              .then(function (r) { actionResult(r, frozen ? 'Posting frozen: effective view_only on every submit.' : 'Posting unfrozen.'); });
          }
        };
      });
    });
  }

  function renderAudit(beforeSeq) {
    api('/audit?limit=50' + (beforeSeq ? '&before=' + beforeSeq : '')).then(function (r) {
      if (!guard(r)) return;
      var rows = (r.json && r.json.rows) || [];
      var total = (r.json && r.json.total) || 0;
      var body = rows.length === 0 ?
        '<div class="state"><b>No audit rows' + (beforeSeq ? ' on this page' : ' yet') + '</b>Every operator action will appear here, append-only.</div>' :
        '<table><tr><th>#</th><th>At</th><th>Action</th><th>Target</th><th>Reason</th><th>Outcome</th></tr>' +
        rows.map(function (row) {
          var target = Object.keys(row.target || {}).map(function (k) {
            return k + '=' + String(row.target[k]);
          }).join(' ');
          var outcome = row.outcome === 'ok' ? '<span class="pill ok">ok</span>' : '<span class="pill err">' + esc(row.outcome) + '</span>';
          return '<tr><td>' + row.seq + '</td><td>' + esc(row.at) + '</td><td>' + esc(row.action) + '</td>' +
            '<td><code>' + esc(target) + '</code></td><td>' + esc(row.reason || '') + '</td><td>' + outcome + '</td></tr>';
        }).join('') + '</table>';
      var older = rows.length > 0 ?
        '<div class="acts" style="margin-top:12px"><button id="olderBtn">Older rows</button><span class="cmeta" style="align-self:center">' + total + ' rows total</span></div>' : '';
      shell('<h2>Audit log</h2>' + body + older,
        '<div class="railtitle">Audit log</div><div class="railbody">Append-only ledger of every operator action with its REAL outcome, including refusals. No route can edit or delete a row.</div>' +
        '<div class="notice">Every console action emits a signed audit event. No silent moderation.</div>');
      var olderBtn = document.getElementById('olderBtn');
      if (olderBtn) {
        olderBtn.onclick = function () { renderAudit(rows[rows.length - 1].seq); };
      }
    });
  }

  function renderAlerts() {
    var labels = {
      ncmec_escalations_present: 'NCMEC filing escalations',
      ncmec_filing_backlog: 'NCMEC filing backlog',
      ncmec_queue_stalled: 'NCMEC queue stalled',
      dmca_unresolved_past_deadline: 'DMCA items past deadline',
      dmca_counter_notice_window_open: 'DMCA counter-notice windows open',
      scanner_backlog: 'Archive scanner backlog',
      seeder_drift: 'Archive seeder drift'
    };
    var body = state.alerts.length === 0
      ? '<div class="state"><b>No active safety alerts</b>The current identity-free queue measurements are below their alert thresholds.</div>'
      : state.alerts.map(function (alert) {
          return '<div class="card"><div class="chead"><span class="cname">' + esc(labels[alert.kind] || alert.kind) + '</span>' +
            '<span class="pill ' + (alert.severity === 'critical' ? 'err' : 'warn') + '" style="margin-left:auto">' + esc(alert.severity) + '</span></div>' +
            '<div class="cbody">Measured ' + esc(alert.measured) + ' ' + esc(alert.unit) + '; alert threshold ' + esc(alert.threshold) + '.</div></div>';
        }).join('');
    shell('<h2>Safety alerts</h2>' + body,
      '<div class="railtitle">Privacy boundary</div><div class="railbody">This lane contains fixed alert kinds, severity, counts, and thresholds only. It never includes a persona, publication, claimant, report, or evidence identifier.</div>' +
      '<div class="notice">Critical alerts require operator investigation in the corresponding queue. This screen never marks work complete automatically.</div>');
  }

  function guard(r) {
    if (r.status === 401) { renderLock('That secret was not accepted. Enter the operator secret configured on the node.'); return false; }
    if (r.status === 503 && r.json && r.json.reason === 'console_not_configured') {
      renderFatal('Console not configured',
        'Set MEERKAT_OPERATOR_CONSOLE_SECRET and MEERKAT_OPERATOR_AUTHORITY_SEED on the community node and restart. Nothing is shown and no action is possible until the operator identity is configured.');
      return false;
    }
    if (r.status === 0) {
      renderFatal('Console API unreachable', 'Nothing is shown because nothing could be loaded. Check the node process and reload.');
      return false;
    }
    return true;
  }

  function refresh() {
    api('/status').then(function (r) {
      if (!guard(r)) return;
      if (r.status !== 200 || !r.json || r.json.ok !== true) {
        renderFatal('Console error', 'Unexpected status ' + r.status + '. Nothing is shown because the status could not be loaded.');
        return;
      }
      state.stats = r.json.queue;
      state.alerts = Array.isArray(r.json.alerts) ? r.json.alerts : [];
      document.getElementById('who').textContent =
        'operator ' + r.json.operator.slice(0, 12) + '\\u2026 \\u00B7 persona admin: ' + r.json.personaAdmin + ' \\u00B7 audit rows: ' + r.json.auditRows;
      if (state.lane === 'alerts') renderAlerts();
      else if (state.lane === 'queue') renderQueue(false);
      else if (state.lane === 'csam') renderQueue(true);
      else if (state.lane === 'dmca') renderDmca();
      else if (state.lane === 'personas') renderPersonas();
      else if (state.lane === 'publications') renderPublications();
      else renderAudit();
    });
  }

  function boot() {
    if (!secret()) { renderLock(); return; }
    refresh();
  }

  boot();
})();
</script>
</body>
</html>
`;
