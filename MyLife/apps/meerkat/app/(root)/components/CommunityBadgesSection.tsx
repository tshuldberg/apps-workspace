// Plan 56 C2 (feature 37): community badges. The owner mints (name + glyph +
// SIGNED supply cap); the owner or an admin awards up to that cap. Every
// count shown here derives from verified mint/award rows (7.6): scarcity is
// verifiable, not promised. Reserved trust glyphs are rejected at the
// protocol layer, so a badge can never counterfeit a checkmark or lock.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '@mylife/sync';
import { Button, HonestNotice, SectionHeader } from './kit';
import { useMkStyles } from '../providers/AppThemeProvider';
import { useSync } from '../providers/SyncProvider';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import { awardCommunityBadge, listCommunityBadges, mintCommunityBadge } from '../data/badges-core';
import { resolveCommunityDisplayName } from '../data/community-core';

export function CommunityBadgesSection({
  db,
  identity,
  communityId,
  isOwner,
  isCurator,
  members,
}: {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  isOwner: boolean;
  isCurator: boolean;
  members: ReadonlyArray<{ deviceId: string; displayName?: string }>;
}) {
  const styles = useMkStyles(makeStyles);
  const { recordLocalChange } = useSync();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [glyph, setGlyph] = useState('');
  const [supply, setSupply] = useState('10');
  const [awarding, setAwarding] = useState<string | null>(null);

  const badges = useMemo(() => { void revision; return listCommunityBadges(db, communityId); }, [db, communityId, revision]);

  const mint = useCallback(() => {
    try {
      const supplyCap = Number.parseInt(supply, 10);
      mintCommunityBadge(db, identity, { communityId, name, glyph: glyph.trim(), supplyCap }, recordLocalChange);
      setName('');
      setGlyph('');
      setSupply('10');
      setNotice('Badge minted. Its supply cap is signed and every member can verify it.');
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not mint that badge.');
    }
  }, [db, identity, communityId, name, glyph, supply, recordLocalChange]);

  const award = useCallback((badgeId: string, recipientDevice: string) => {
    try {
      awardCommunityBadge(db, identity, { communityId, badgeId, recipientDevice }, recordLocalChange);
      setAwarding(null);
      setNotice('Badge awarded.');
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not award that badge.');
    }
  }, [db, identity, communityId, recordLocalChange]);

  if (!isCurator && badges.length === 0) return null;

  return (
    <View style={styles.panel}>
      <SectionHeader
        title="Badges"
        hint="Owner-minted collectibles with a signed supply cap. Scarcity is verifiable by every member."
      />
      {badges.length === 0 ? <Text style={styles.emptyLine}>No badges minted yet.</Text> : null}
      {badges.map((badge) => (
        <View key={badge.badgeId} style={styles.badgeRow}>
          <Text style={styles.badgeGlyph}>{badge.glyph}</Text>
          <View style={styles.badgeCopy}>
            <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
            <Text style={styles.badgeMeta}>
              {badge.awardedTo.length} of {badge.supplyCap} awarded
            </Text>
          </View>
          {isCurator && badge.awardedTo.length < badge.supplyCap ? (
            <Button
              title={awarding === badge.badgeId ? 'Pick member' : 'Award'}
              variant="secondary"
              onPress={() => setAwarding(awarding === badge.badgeId ? null : badge.badgeId)}
            />
          ) : null}
        </View>
      ))}
      {awarding ? (
        <View style={styles.awardList}>
          {members
            .filter((m) => !(badges.find((b) => b.badgeId === awarding)?.awardedTo.includes(m.deviceId)))
            .map((m) => (
              <Pressable
                key={m.deviceId}
                accessibilityRole="button"
                accessibilityLabel={`Award to ${m.displayName ?? shortHex(m.deviceId)}`}
                onPress={() => award(awarding, m.deviceId)}
                style={styles.awardRow}
              >
                <Text style={styles.awardName} numberOfLines={1}>
                  {resolveCommunityDisplayName(db, communityId, m.deviceId) ?? m.displayName ?? shortHex(m.deviceId)}
                </Text>
              </Pressable>
            ))}
        </View>
      ) : null}

      {isOwner ? (
        <View style={styles.mintBlock}>
          <Text style={styles.mintLabel}>Mint a badge</Text>
          <View style={styles.mintRow}>
            <TextInput
              style={[styles.input, styles.inputGlyph]}
              placeholder="🦫"
              value={glyph}
              onChangeText={setGlyph}
              maxLength={16}
              accessibilityLabel="Badge glyph"
            />
            <TextInput
              style={[styles.input, styles.inputName]}
              placeholder="Badge name"
              value={name}
              onChangeText={setName}
              maxLength={60}
              accessibilityLabel="Badge name"
            />
            <TextInput
              style={[styles.input, styles.inputSupply]}
              placeholder="10"
              value={supply}
              onChangeText={setSupply}
              keyboardType="number-pad"
              maxLength={5}
              accessibilityLabel="Supply cap"
            />
          </View>
          <Button title="Mint badge" onPress={mint} disabled={!name.trim() || !glyph.trim()} />
        </View>
      ) : null}

      {notice ? <HonestNotice text={notice} /> : null}
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    panel: {
      backgroundColor: c.surface,
      borderColor: c.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.lg,
      padding: 14,
      gap: 10,
    },
    emptyLine: { color: c.textSecondary, fontSize: 13 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    badgeGlyph: { fontSize: 24 },
    badgeCopy: { flex: 1 },
    badgeName: { color: c.text, fontSize: 14, fontWeight: '600' },
    badgeMeta: { color: c.textTertiary, fontSize: 12 },
    awardList: { gap: 4 },
    awardRow: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.sm,
    },
    awardName: { color: c.text, fontSize: 13 },
    mintBlock: { gap: 8, marginTop: 4 },
    mintLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    mintRow: { flexDirection: 'row', gap: 6 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surfaceElevated,
      fontSize: 14,
    },
    inputGlyph: { width: 56, textAlign: 'center' },
    inputName: { flex: 1 },
    inputSupply: { width: 64, textAlign: 'center' },
  });
