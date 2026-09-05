/**
 * Connection status + adopt-a-server (Plan 20, Phase 3, Screens 1 + 2).
 *
 * Honest by construction: the status pill derives ONLY from the cached
 * mk_relay_probe row (a real /healthz result) plus the effective config, never a
 * fabricated dot or peer count. The card runs the real probe on mount (the
 * probe-writer the health gate depends on) and writes mk_relay_probe, so
 * effectiveRelayUrl(db) can flip the default from "waiting" to dialed. The adopt
 * panel parses a connection card (or a bare wss:// URL), sets relay_url, and
 * re-probes. No copy ever claims "connected to {someone}".
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { parseConnectionCard, probeRelays, resolveDefaultRelaySync } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import {
  ADOPTED_SERVER_URL_KEY,
  DEFAULT_RELAY_OPTOUT_KEY,
  getRelayProbe,
  getSetting,
  RELAY_PROBE_TTL_MS,
  setSetting,
  writeRelayProbe,
} from '../data/db';
import { DEFAULT_RELAY_URL, RELAY_URL_SETTING_KEY } from '../data/sync-core';
import { Button, HonestNotice, Panel, SectionHeader } from './kit';
import { QrScanner, isQrScannerAvailable } from './QrScanner';
import { MK_RADIUS, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

type Tone = 'success' | 'warning' | 'info' | 'neutral';

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
  lanPort: number | null | undefined;
}): CardState {
  const { configured, optedOut, lastProbe, probing, lanPort } = args;
  const resolved = resolveDefaultRelaySync({
    configuredUrl: configured,
    defaultUrl: DEFAULT_RELAY_URL,
    optedOut,
    lastProbe,
  });

  if (resolved.source === 'none') {
    if (lanPort != null) {
      return {
        pill: 'Local Wi-Fi only',
        tone: 'info',
        body: 'Same-Wi-Fi pairing works now. Internet sync is waiting on a reachable connection server.',
        checkAgain: false,
      };
    }
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
    if (lanPort != null) {
      return {
        pill: 'Local Wi-Fi only',
        tone: 'info',
        body: 'Same-Wi-Fi pairing works now. Internet sync is waiting on a reachable connection server.',
        checkAgain: true,
      };
    }
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

export function ConnectionStatusCard({ lanPort }: { lanPort?: number | null }): React.ReactElement {
  const db = useMeerkatDatabase();
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
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
  const state = deriveState({ configured, optedOut, lastProbe, probing, lanPort });

  const toneColor =
    state.tone === 'success' ? c.success
    : state.tone === 'warning' ? c.warning
    : state.tone === 'info' ? c.info
    : c.textSecondary;

  return (
    <Panel>
      <SectionHeader title="Connection" />
      <View style={styles.statusRow}>
        {state.pill ? (
          <View style={[styles.pill, { borderColor: toneColor }]}>
            <Text style={[styles.pillText, { color: toneColor }]}>{state.pill}</Text>
          </View>
        ) : (
          <ActivityIndicator size="small" color={c.accent} />
        )}
      </View>
      <Text style={styles.body}>{state.body}</Text>
      {state.checkAgain ? (
        <Button title={probing ? 'Checking…' : 'Check again'} variant="secondary" onPress={() => void runProbe()} disabled={probing} />
      ) : null}
    </Panel>
  );
}

export function AdoptServerPanel(): React.ReactElement {
  const db = useMeerkatDatabase();
  const styles = useMkStyles(makeStyles);
  const [pasteText, setPasteText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const adopt = useCallback(
    (raw: string) => {
      const card = parseConnectionCard(raw);
      if (!card) {
        setResult({ ok: false, msg: "That doesn't look like a Meerkat connection card. Ask the host to resend it." });
        return;
      }
      setSetting(db, RELAY_URL_SETTING_KEY, card.relay);
      setSetting(db, ADOPTED_SERVER_URL_KEY, card.relay);
      // Probe the adopted server so the status card reflects real reachability.
      void probeRelays({ candidates: [card.relay] }).then(([health]) => {
        if (health) writeRelayProbe(db, health);
      });
      setResult({
        ok: true,
        msg: `Server added${card.name ? `: ${card.name}` : ''}. Meerkat will try it for manual sessions. Compare safety codes with people, not servers.`,
      });
      setPasteText('');
    },
    [db],
  );

  if (scanning) {
    return (
      <Panel>
        <SectionHeader title="Scan a connection card" />
        <QrScanner
          onScan={(value) => {
            setScanning(false);
            adopt(value);
          }}
          onCancel={() => setScanning(false)}
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionHeader title="Use a community server" hint="Paste a host's connection card or scan its QR" />
      <TextInput
        style={styles.input}
        value={pasteText}
        onChangeText={setPasteText}
        placeholder="Paste a Meerkat connection card or wss:// URL"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        accessibilityLabel="Connection card"
      />
      <Button title="Add server" onPress={() => adopt(pasteText)} disabled={pasteText.trim().length === 0} />
      {isQrScannerAvailable() ? (
        <Button title="Scan QR" variant="secondary" onPress={() => { setResult(null); setScanning(true); }} />
      ) : null}
      {result ? (
        <Text style={result.ok ? styles.okText : styles.errText}>{result.msg}</Text>
      ) : null}
      <HonestNotice text="A connection server can see when you connect and roughly how much data moves, never your messages, your contacts, or which community you're in. Adding a server is not the same as trusting a person: you still compare safety codes out of band." />
    </Panel>
  );
}

function makeStyles(c: MkColors) {
  return {
    statusRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 6 },
    pill: {
      alignSelf: 'flex-start' as const,
      borderWidth: 1,
      borderRadius: MK_RADIUS.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    pillText: { fontSize: 12, fontWeight: '600' as const },
    body: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: MK_RADIUS.md,
      color: c.text,
      padding: 10,
      minHeight: 60,
      textAlignVertical: 'top' as const,
      marginBottom: 8,
    },
    okText: { color: c.success, fontSize: 13, marginTop: 8 },
    errText: { color: c.danger, fontSize: 13, marginTop: 8 },
  };
}
