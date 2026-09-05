// Blocked users management (App Review Guideline 1.2).
//
// Lists the accounts the signed-in user has blocked, resolved to public
// handles where available, with one-tap unblock. Reached from Settings.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WK_FONTS } from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { listBlockedUserIds, unblockUser } from './data/cloud-blocks';
import { getPublicProfiles, type CloudUserProfile } from './data/cloud-profiles';
import { DW_ACCENT_LIGHT, DW_BORDER, DW_SURFACES, DW_TEXT } from './theme/tokens';
import { WorkoutHero } from './(tabs)/_screen-kit';
import { ScrollView } from 'react-native';

interface BlockedEntry {
  userId: string;
  profile: CloudUserProfile | null;
}

export default function BlockedUsersScreen() {
  const { supabase, userId } = useDoWorkCloud();
  const [entries, setEntries] = useState<BlockedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setEntries([]);
      return;
    }
    const blocked = await listBlockedUserIds(supabase, userId);
    if (!blocked.ok) {
      setError(blocked.error);
      setEntries([]);
      return;
    }
    const ids = [...blocked.blockedUserIds];
    const profiles = await getPublicProfiles(supabase, ids);
    setEntries(
      ids.map((id) => ({
        userId: id,
        profile: profiles.ok ? profiles.profiles.get(id) ?? null : null,
      })),
    );
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnblock = useCallback(
    async (blockedUserId: string) => {
      if (!supabase || !userId) return;
      const result = await unblockUser(supabase, userId, blockedUserId);
      if (result.ok) {
        setEntries((current) =>
          current ? current.filter((entry) => entry.userId !== blockedUserId) : current,
        );
      } else {
        setError(result.error);
      }
    },
    [supabase, userId],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        title="Blocked Users"
        subtitle="Blocked accounts disappear from your feed and comments. Unblock anytime."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {entries === null ? (
        <Text style={styles.helper}>Loading…</Text>
      ) : entries.length === 0 ? (
        <Text style={styles.helper}>You have not blocked anyone.</Text>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.userId} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.handle}>
                  {entry.profile ? `@${entry.profile.handle}` : 'Deleted account'}
                </Text>
                {entry.profile?.displayName ? (
                  <Text style={styles.name}>{entry.profile.displayName}</Text>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.unblock, pressed && { opacity: 0.86 }]}
                onPress={() => void handleUnblock(entry.userId)}
              >
                <Text style={styles.unblockLabel}>Unblock</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.lowest,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  list: {
    paddingHorizontal: 20,
    gap: 8,
  },
  row: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  handle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  name: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  unblock: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 139, 51, 0.45)',
    backgroundColor: 'rgba(255, 107, 0, 0.10)',
  },
  unblockLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    color: DW_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helper: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.tertiary,
    paddingHorizontal: 20,
  },
  error: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: '#FF6B6B',
    paddingHorizontal: 20,
  },
});
