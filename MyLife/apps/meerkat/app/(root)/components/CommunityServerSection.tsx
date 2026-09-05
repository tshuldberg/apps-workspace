// Community server section (Plan 57 W2). The Realms pattern: ONLY the owner
// ever sees this infrastructure decision; members see one honest availability
// line. Every state here is real: "reachable" comes from a live /healthz
// answer, attaching commits only after the server accepted the owner's
// publish, and removal is the signed community exit that a dead server can
// never block. No online counts, no fake connectivity, ever.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import {
  clearCommunityHost,
  getCommunityHostUrl,
  probeCommunityHosting,
  setCommunityHost,
} from '../data/community-core';
import { Button, HonestNotice, SectionHeader } from './kit';
import { type MkColors, MK_MONO, MK_RADIUS } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

type ProbeState = 'checking' | 'hosted' | 'server_only' | 'unreachable';

export const COMMUNITY_SERVER_STATE_COPY = {
  deviceOnly: 'Available from members who have it, when a sync connects.',
  hosted: 'Always available via this community’s server.',
  server_only: 'The server answers, but does not confirm hosting this community. Content syncs from members when connected.',
  unreachable: 'This community’s server is not reachable right now. Content syncs from members when connected.',
  checking: 'Checking this community’s server…',
} as const;

export function CommunityServerSection({
  communityId,
  isOwner,
}: {
  communityId: string;
  isOwner: boolean;
}) {
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const [tick, setTick] = useState(0);
  const [draftUrl, setDraftUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeState>('checking');

  const hostUrl = useMemo(() => {
    void tick;
    return getCommunityHostUrl(db, communityId);
  }, [db, communityId, tick]);

  // Real hosting probe, refreshed whenever the attached host changes. Three
  // honest states: the node CONFIRMS hosting this community, a process answers
  // without confirming it, or nothing answers. Never a fake "available".
  useEffect(() => {
    let cancelled = false;
    if (!hostUrl) return undefined;
    setProbe('checking');
    void probeCommunityHosting(hostUrl, communityId)
      .then((verdict) => {
        if (!cancelled) setProbe(verdict);
      })
      .catch(() => {
        if (!cancelled) setProbe('unreachable');
      });
    return () => { cancelled = true; };
  }, [communityId, hostUrl, tick]);

  const onAttach = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await setCommunityHost(db, identity, communityId, draftUrl);
      if (!result.ok) {
        setNotice(result.detail ? `${result.error} (${result.detail})` : result.error);
        return;
      }
      setDraftUrl('');
      setNotice(null);
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }, [busy, communityId, db, draftUrl, identity]);

  const onRemove = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await clearCommunityHost(db, identity, communityId);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice(result.exitRepublished
        ? 'Server removed. The old server recorded the exit; it keeps only sealed data it cannot read.'
        : 'Server removed. The old server could not be reached; it keeps only sealed data it cannot read.');
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }, [busy, communityId, db, identity]);

  const availabilityLine = hostUrl
    ? COMMUNITY_SERVER_STATE_COPY[probe]
    : COMMUNITY_SERVER_STATE_COPY.deviceOnly;

  if (!isOwner) {
    return (
      <View style={styles.section}>
        <SectionHeader title="Community server" hint="Where this community lives when everyone is offline" />
        {hostUrl ? (
          <Text style={styles.hostUrl} numberOfLines={1}>{hostUrl}</Text>
        ) : null}
        <HonestNotice text={availabilityLine} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader title="Community server" hint="Keep this community available while everyone's devices are asleep" />
      {hostUrl ? (
        <>
          <Text style={styles.hostUrl} numberOfLines={1}>{hostUrl}</Text>
          <HonestNotice
            text={availabilityLine}
            tone={probe === 'unreachable' || probe === 'server_only' ? 'warning' : 'info'}
          />
          <Button
            title={busy ? 'Removing…' : 'Remove server'}
            variant="danger"
            onPress={() => { void onRemove(); }}
            disabled={busy}
          />
        </>
      ) : (
        <>
          <HonestNotice text="A community server stores only sealed data it cannot read, and serves history to members while your devices are asleep. Attach one you run, or one you rent." />
          <TextInput
            style={styles.input}
            value={draftUrl}
            onChangeText={setDraftUrl}
            placeholder="https://your-community-server.example"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Community server address"
          />
          <Button
            title={busy ? 'Verifying…' : 'Verify and attach'}
            onPress={() => { void onAttach(); }}
            disabled={busy || draftUrl.trim().length === 0}
          />
        </>
      )}
      {notice ? <HonestNotice text={notice} tone="warning" /> : null}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  section: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  hostUrl: {
    color: c.text,
    fontSize: 13,
    fontFamily: MK_MONO,
  },
  input: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
