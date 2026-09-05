// First-run wizard (Plan 20, Phase 5.1). Vanilla ES module, no deps, no crypto.
//
// Three choices -> a HostConfig, POSTed to /api/config. Step 1 picks services{},
// step 2 picks exposure, step 3 picks the security preset. On a 400 we show the
// server's validation reason verbatim (the server is the single source of truth
// for what is a valid config). On success we hand off to the dashboard.
//
// The lifecycle banner is imported from the same view-model the dashboard uses so
// the honest reachable-only-while-open string can never drift.
import { lifecycleBanner } from './ui-view-model.js';

const state = { step: 1, services: 'community', exposure: 'tunnel', security: 'private', domain: '' };
const TOTAL = 3;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Keep the wizard's banner byte-identical to the dashboard's.
$('#lifecycle-text').textContent = lifecycleBanner();

// ---- single-select option groups -------------------------------------------
function wireGroup(containerId, onPick) {
  const buttons = $$(`#${containerId} .option`);
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
      onPick(btn.dataset.value);
    });
  }
}

wireGroup('opt-services', (v) => {
  state.services = v;
});
wireGroup('opt-exposure', (v) => {
  state.exposure = v;
  $('#domain-field').classList.toggle('hidden', v !== 'domain');
});
wireGroup('opt-security', (v) => {
  state.security = v;
});
$('#domain-input').addEventListener('input', (e) => {
  state.domain = e.target.value.trim();
});

// ---- step navigation --------------------------------------------------------
function render() {
  for (const sec of $$('.step')) {
    sec.classList.toggle('hidden', Number(sec.dataset.step) !== state.step);
  }
  $$('#dots i').forEach((dot, i) => dot.classList.toggle('on', i < state.step));
  $('#back').classList.toggle('hidden', state.step === 1);
  $('#next').classList.toggle('hidden', state.step === TOTAL);
  $('#create').classList.toggle('hidden', state.step !== TOTAL);
  $('#err').classList.add('hidden');
}

$('#next').addEventListener('click', () => {
  if (state.step < TOTAL) state.step += 1;
  render();
});
$('#back').addEventListener('click', () => {
  if (state.step > 1) state.step -= 1;
  render();
});

// ---- assemble + submit ------------------------------------------------------
function assembleConfig() {
  const services =
    state.services === 'community'
      ? { relay: true, communityNode: true, seeder: true }
      : { relay: true, communityNode: false, seeder: false };
  const config = { services, exposure: state.exposure, securityPreset: state.security };
  if (state.exposure === 'domain' && state.domain) config.domain = state.domain;
  return config;
}

function showError(msg) {
  const el = $('#err');
  el.textContent = msg;
  el.classList.remove('hidden');
}

$('#create').addEventListener('click', async () => {
  const btn = $('#create');
  btn.disabled = true;
  const config = assembleConfig();
  if (config.exposure === 'domain' && !config.domain) {
    btn.disabled = false;
    state.step = 2;
    render();
    showError('Enter the domain you own before continuing.');
    return;
  }
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      showError(body && body.reason ? body.reason : 'That configuration was rejected.');
      btn.disabled = false;
      return;
    }
    if (!res.ok) {
      showError('Could not save the configuration. Is the control panel still running?');
      btn.disabled = false;
      return;
    }
    // Saved. Head to the dashboard to start the services.
    window.location.href = 'dashboard.html';
  } catch {
    showError('Could not reach the control panel. Is this app still open?');
    btn.disabled = false;
  }
});

render();
