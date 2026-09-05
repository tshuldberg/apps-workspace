// Running dashboard (Plan 20, Phase 6.2 / 6.4). Vanilla ES module, no crypto.
//
// Polls GET /api/status, drives Start/Stop, and renders the connection card + QR
// STRICTLY through cardView(GET /api/card): the card is shown ONLY when the pure
// view-model says show === true (server available === true). The connectivity line
// derives from service state only -- never a peer count or "connected to" claim --
// and the lifecycle banner is always present.
import { cardView, connectivityLabel, lifecycleBanner } from './ui-view-model.js';

const $ = (sel) => document.querySelector(sel);

const POLL_MS = 3000;
let timer = null;
let busy = false;

$('#lifecycle-text').textContent = lifecycleBanner();

// ---- rendering --------------------------------------------------------------

const SVC_LABELS = {
  relay: 'Connection server (relay)',
  communityNode: 'Community server',
  seeder: 'Seeder',
};

function renderServices(status) {
  const list = $('#services');
  list.innerHTML = '';
  const services = status && Array.isArray(status.services) ? status.services : [];
  if (services.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="svc-name muted">No services configured yet.</span>';
    list.appendChild(li);
    return;
  }
  for (const svc of services) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'svc-name';
    name.textContent = SVC_LABELS[svc.name] || svc.name;
    const st = document.createElement('span');
    const state = String(svc.state || 'unknown');
    st.className = `svc-state ${state}`;
    st.textContent = state;
    li.append(name, st);
    list.appendChild(li);
  }
}

function renderConnectivity(status) {
  const view = connectivityLabel(status);
  $('#status-label').textContent = view.label;
  const dot = $('#state-dot');
  dot.classList.toggle('online', view.online);
  dot.classList.toggle('offline', !view.online);
  return view;
}

function renderCard(apiCard, online) {
  const view = cardView(apiCard);
  const cardSection = $('#card-section');
  const withheldSection = $('#withheld-section');

  // Offline (stopped/errored) OR the view withholds -> hide the card entirely.
  if (!online || !view.show) {
    cardSection.classList.add('hidden');
    // Show the honest "why" only while online but not yet shareable.
    if (online && !view.show) {
      withheldSection.classList.remove('hidden');
      $('#withheld-reason').textContent = view.reason;
      const cand = $('#withheld-candidate');
      if (view.candidateUrl) {
        cand.classList.remove('hidden');
        cand.textContent = `Candidate address (unverified): ${view.candidateUrl}`;
      } else {
        cand.classList.add('hidden');
      }
      const stepsEl = $('#withheld-steps');
      stepsEl.innerHTML = '';
      if (Array.isArray(view.steps) && view.steps.length > 0) {
        stepsEl.classList.remove('hidden');
        for (const step of view.steps) {
          const li = document.createElement('li');
          const t = document.createElement('span');
          t.className = 'st-title';
          t.textContent = step.title;
          li.append(t, document.createTextNode(` — ${step.detail}`));
          stepsEl.appendChild(li);
        }
      } else {
        stepsEl.classList.add('hidden');
      }
    } else {
      withheldSection.classList.add('hidden');
    }
    return;
  }

  // show === true: the ONLY path that renders the card + QR.
  withheldSection.classList.add('hidden');
  cardSection.classList.remove('hidden');
  // Only claim internet-reachability for an explicit public scope (the server sets
  // available:true only after a real off-host check); same-network stays local.
  $('#card-scope').textContent =
    view.scope === 'public'
      ? 'Verified reachable from the internet.'
      : view.scope === 'same-network'
        ? 'Reachable on this local network.'
        : 'Ready for members to adopt.';
  $('#qr').innerHTML = view.qr && typeof view.qr.svg === 'string' ? view.qr.svg : '';
  $('#card-string').textContent = view.card;
}

function renderOffline(online) {
  $('#offline').classList.toggle('hidden', online);
}

// ---- polling ----------------------------------------------------------------

async function refresh() {
  let status = null;
  try {
    const res = await fetch('/api/status');
    status = await res.json();
  } catch {
    // Panel unreachable: treat as offline, hide the card, keep the banner.
    $('#status-label').textContent = 'The control panel is not responding.';
    $('#state-dot').classList.remove('online');
    $('#state-dot').classList.add('offline');
    renderOffline(false);
    renderCard(null, false);
    return;
  }

  renderServices(status);
  const conn = renderConnectivity(status);
  renderOffline(conn.online);

  // Only fetch the card when online; when offline we withdraw it without a call.
  let apiCard = null;
  if (conn.online) {
    try {
      const res = await fetch('/api/card');
      apiCard = await res.json();
    } catch {
      apiCard = null;
    }
  }
  renderCard(apiCard, conn.online);
}

// ---- lifecycle buttons ------------------------------------------------------

async function post(path) {
  if (busy) return;
  busy = true;
  $('#start').disabled = true;
  $('#stop').disabled = true;
  try {
    await fetch(path, { method: 'POST' });
  } catch {
    // Swallow: the next poll reflects the real state honestly.
  } finally {
    busy = false;
    $('#start').disabled = false;
    $('#stop').disabled = false;
    await refresh();
  }
}

$('#start').addEventListener('click', () => post('/api/start'));
$('#stop').addEventListener('click', () => post('/api/stop'));

function loop() {
  clearTimeout(timer);
  refresh().finally(() => {
    timer = setTimeout(loop, POLL_MS);
  });
}

loop();
