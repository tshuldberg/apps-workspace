// Connection status card (Plan 20, Phase 3, Screen 1) -- WEB twin of the mobile
// apps/meerkat/app/(root)/components/ConnectionStatusCard.tsx. Honest by
// construction: the pill derives ONLY from the cached mk_relay_probe row (a real
// /healthz result) plus the effective config, never a fabricated dot or peer
// count. It runs the real probe on mount and writes mk_relay_probe so
// effectiveRelayUrl(db) can flip the free default from "waiting" to dialed. The
// verbatim state copy is byte-identical with the mobile card (AC-7); the web has
// no LAN rung, so the mobile "Local Wi-Fi only" partial state is absent (an
// honest platform difference, never a hidden/fabricated state). No copy ever
// claims "connected to {someone}".

import { useCallback, useEffect, useRef, useState } from 'react';
import { probeRelays, resolveDefaultRelaySync } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  DEFAULT_RELAY_OPTOUT_KEY,
  getRelayProbe,
  getSetting,
  RELAY_PROBE_TTL_MS,
  RELAY_URL_SETTING_KEY,
  writeRelayProbe,
} from '../../lib/meerkat-data';
import { DEFAULT_RELAY_URL } from '../../lib/relay';
import { Button } from '../shell/Button';

type Tone = 'success' | 'warning' | 'neutral';

interface CardState {
  pill: string | null;
  tone: Tone;
  body: string;
  checkAgain: boolean;
}

function deriveState(args: {
  configured: string;
  optedOut: boolean;
  lastProbe: ReturnType<typeof getRelayProbe>;
  probing: boolean;
}): CardState {
  const { configured, optedOut, lastProbe, probing } = args;
  const resolved = resolveDefaultRelaySync({
    configuredUrl: configured,
    defaultUrl: DEFAULT_RELAY_URL,
    optedOut,
    lastProbe,
  });

  if (resolved.source === 'none') {
    return {
      pill: 'No connection server',
      tone: 'neutral',
      body: 'Pair on the same Wi-Fi, set a server below, or use a community server. Friend codes and offline delivery need a connection server.',
      checkAgain: false,
    };
  }

  if (probing && !lastProbe) {
    return { pill: null, tone: 'neutral', body: 'Checking the connection server…', checkAgain: false };
  }

  if (resolved.reachable === true) {
    if (resolved.source === 'default') {
      return {
        pill: 'Free server reachable',
        tone: 'success',
        body: "You're using Meerkat's free, zero-knowledge connection server. It only ever sees scrambled bytes, never your messages or who you talk to. It is the meeting point, not delivery: a sync still needs the other device online.",
        checkAgain: false,
      };
    }
    return {
      pill: 'Your server reachable',
      tone: 'success',
      body: 'Meerkat will use this connection server. It carries encrypted data only.',
      checkAgain: false,
    };
  }

  if (resolved.reachable === false) {
    return {
      pill: 'Unreachable',
      tone: 'warning',
      body: "This connection server didn't answer just now. Try again, pair on the same Wi-Fi, or set a different server. Nothing is connected.",
      checkAgain: true,
    };
  }

  // reachable === 'unknown' and not actively probing yet
  return { pill: null, tone: 'neutral', body: 'Checking the connection server…', checkAgain: false };
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'is-success',
  warning: 'is-warning',
  neutral: 'is-idle',
};

export function ConnectionStatusCard(): React.ReactElement {
  const m = useMeerkat();
  const db = m.db;
  const [, setTick] = useState(0);
  const [probing, setProbing] = useState(true);
  const mounted = useRef(true);

  const runProbe = useCallback(async () => {
    const cfg = getSetting(db, RELAY_URL_SETTING_KEY)?.trim() ?? '';
    const oo = getSetting(db, DEFAULT_RELAY_OPTOUT_KEY) === '1';
    const candidate = cfg || (oo ? '' : DEFAULT_RELAY_URL);
    if (!candidate) {
      if (mounted.current) {
        setProbing(false);
        setTick((t) => t + 1);
      }
      return;
    }
    if (mounted.current) setProbing(true);
    try {
      const [health] = await probeRelays({ candidates: [candidate] });
      if (health) writeRelayProbe(db, health);
    } catch {
      // probeRelays never throws; defensive only.
    } finally {
      if (mounted.current) {
        setProbing(false);
        setTick((t) => t + 1);
      }
    }
  }, [db]);

  useEffect(() => {
    mounted.current = true;
    void runProbe();
    // Re-probe on the cache TTL while mounted (rc13 defect 2): the pill reads
    // the same mk_relay_probe row the dial does, so keeping that row fresh is
    // what keeps the label and the dial from ever disagreeing. Without this,
    // "Free server reachable" outlived the 60s cache and the next sync said
    // "No relay URL configured" two inches below it.
    const interval = setInterval(() => {
      void runProbe();
    }, RELAY_PROBE_TTL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [runProbe]);

  const configured = getSetting(db, RELAY_URL_SETTING_KEY)?.trim() ?? '';
  const optedOut = getSetting(db, DEFAULT_RELAY_OPTOUT_KEY) === '1';
  const candidate = configured || (optedOut ? '' : DEFAULT_RELAY_URL);
  const lastProbe = candidate ? getRelayProbe(db, candidate) : null;
  const state = deriveState({ configured, optedOut, lastProbe, probing });

  return (
    <div className="mk-box mk-connection-card">
      <div className="mk-connection-card-head">
        {state.pill ? (
          <span className={`mk-pill ${TONE_CLASS[state.tone]}`}>{state.pill}</span>
        ) : (
          <span className="mk-muted">Checking…</span>
        )}
      </div>
      <p className="mk-muted mk-connection-card-body">{state.body}</p>
      {state.checkAgain ? (
        <Button variant="ghost" small disabled={probing} onClick={() => { void runProbe(); }}>
          {probing ? 'Checking…' : 'Check again'}
        </Button>
      ) : null}
    </div>
  );
}
