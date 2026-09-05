// Community sync-policy section (Plan 27 P4, item 13). Surfaces the community's
// transport policy: the OWNER picks it (one signed revisePolicy revision), a
// MEMBER sees it read-only plus an honest notice when the owner last changed it.
// Every value comes from the real signed descriptor + the observed policy ledger;
// nothing here claims a change that a signed descriptor did not really make.

import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  communityTransportPolicy,
  getCommunity,
  type CommunityTransportPolicy,
} from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useSync } from '../providers/SyncProvider';
import {
  TRANSPORT_POLICY_LABELS,
  formatPolicyChangeNotice,
  getLatestPolicyChange,
} from '../data/community-core';
import { HonestNotice, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

const POLICY_ORDER: CommunityTransportPolicy[] = ['any', 'local_preferred', 'local_only'];
const POLICY_HINT: Record<CommunityTransportPolicy, string> = {
  any: 'Members can sync over a connection server or local Wi-Fi.',
  local_preferred: 'Prefer local Wi-Fi; fall back to a connection server when needed.',
  local_only: 'Only sync when members are on the same local network. Never uses a connection server.',
};

export function CommunitySyncPolicySection({
  communityId,
  isOwner,
}: {
  communityId: string;
  isOwner: boolean;
}) {
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const { setCommunityTransportPolicy } = useSync();
  const [tick, setTick] = useState(0);

  const stored = useMemo(() => {
    void tick;
    return getCommunity(db, communityId);
  }, [db, communityId, tick]);
  const current: CommunityTransportPolicy | null = stored ? communityTransportPolicy(stored.descriptor) : null;
  const latestChange = useMemo(() => {
    void tick;
    return getLatestPolicyChange(db, communityId);
  }, [db, communityId, tick]);

  const onPick = useCallback((policy: CommunityTransportPolicy) => {
    if (policy === current) return;
    const result = setCommunityTransportPolicy(communityId, policy);
    if (!result.ok) {
      Alert.alert('Sync policy', result.error);
      return;
    }
    setTick((t) => t + 1);
  }, [communityId, current, setCommunityTransportPolicy]);

  if (!current) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Sync policy"
        hint="How members of this community are allowed to connect"
      />
      {isOwner ? (
        <View style={styles.options}>
          {POLICY_ORDER.map((policy) => {
            const selected = policy === current;
            return (
              <Pressable
                key={policy}
                accessibilityRole="button"
                accessibilityLabel={TRANSPORT_POLICY_LABELS[policy]}
                onPress={() => onPick(policy)}
                style={[styles.option, selected && styles.optionOn]}
              >
                <Text style={[styles.optionTitle, selected && styles.optionTitleOn]}>
                  {TRANSPORT_POLICY_LABELS[policy]}
                </Text>
                <Text style={styles.optionHint}>{POLICY_HINT[policy]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.readonlyRow}>
          <Text style={styles.readonlyLabel}>{TRANSPORT_POLICY_LABELS[current]}</Text>
          <Text style={styles.optionHint}>{POLICY_HINT[current]}</Text>
        </View>
      )}
      {latestChange ? (
        <HonestNotice text={formatPolicyChangeNotice(latestChange)} />
      ) : (
        <HonestNotice text="Changing this re-signs the community. Members apply the new policy when they next receive the updated community, not instantly." />
      )}
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
  options: { gap: 10 },
  option: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 3,
  },
  optionOn: { borderColor: c.accent },
  optionTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  optionTitleOn: { color: c.accent },
  optionHint: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  readonlyRow: { gap: 3 },
  readonlyLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
});
