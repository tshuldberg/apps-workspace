import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  CosmicFAB,
  GlassCard,
  MaterialSymbol,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  deleteBirthProfile,
  getBirthProfiles,
  getRecentCompatibilityResults,
  withAlpha,
} from '@mylife/stars';
import {
  AvatarOrb,
  MetaPill,
  PhaseHeading,
  sortFriendProfiles,
  type FriendsSortMode,
} from '../../lib/stars-phase2';

const SORT_OPTIONS: Array<{ key: FriendsSortMode; label: string }> = [
  { key: 'alphabetical', label: 'Alphabetical' },
  { key: 'sign', label: 'By Sign' },
  { key: 'recent', label: 'Recent' },
];

export default function StarsFriendsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [sortMode, setSortMode] = useState<FriendsSortMode>('alphabetical');

  const profiles = useMemo(() => getBirthProfiles(db), [db, version]);
  const history = useMemo(() => getRecentCompatibilityResults(db, 32), [db, version]);
  const sortedProfiles = useMemo(() => sortFriendProfiles(profiles, sortMode), [profiles, sortMode]);

  const historyByPair = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of history) {
      map.set([item.profileAId, item.profileBId].sort().join('::'), item.overallScore);
    }
    return map;
  }, [history]);

  async function handleDelete(profileId: string, name: string): Promise<void> {
    Alert.alert('Delete friend profile?', `Remove ${name} from your saved charts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteBirthProfile(db, profileId);
          setVersion((current) => current + 1);
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <PhaseHeading
          eyebrow="Cosmic Connections"
          title="Friends"
          detail="Keep the people you compare most often in one private list, with direct actions for chart view, synastry, and cleanup."
        />

        <GlassCard variant="high" style={styles.heroCard}>
          <Text style={styles.heroTitle}>Your celestial circle</Text>
          <Text style={styles.heroCopy}>
            Every saved profile stays on-device. Add people you read often, then jump straight into chart comparison or revisit the strongest matches.
          </Text>
          <View style={styles.sortWrap}>
            {SORT_OPTIONS.map((option) => {
              const active = option.key === sortMode;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.sortChip, active ? styles.sortChipActive : null]}
                  onPress={() => setSortMode(option.key)}
                >
                  <Text style={[styles.sortChipText, active ? styles.sortChipTextActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {sortedProfiles.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No profiles yet.</Text>
            <Text style={styles.emptyCopy}>
              Add your first friend profile to build a reusable comparison roster inside MyStars.
            </Text>
          </GlassCard>
        ) : (
          sortedProfiles.map((profile) => {
            const pairKeys = profiles
              .filter((other) => other.id !== profile.id)
              .map((other) => historyByPair.get([profile.id, other.id].sort().join('::')) ?? 0);
            const bestScore = pairKeys.length > 0 ? Math.max(...pairKeys) : 0;
            return (
              <GlassCard key={profile.id} style={styles.friendCard}>
                <View style={styles.friendHeader}>
                  <View style={styles.friendIdentity}>
                    <AvatarOrb name={profile.name} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.friendName}>{profile.name}</Text>
                      <Text style={styles.friendMeta}>
                        {profile.sunSign ? `Sun in ${profile.sunSign}` : 'Birth sign pending'}
                        {profile.birthPlace ? ` · ${profile.birthPlace}` : ''}
                      </Text>
                    </View>
                  </View>
                  {bestScore > 0 ? (
                    <MetaPill
                      label={`${bestScore}% best match`}
                      tone={withAlpha(ST_ACCENT, 0.18)}
                      textColor={ST_ACCENT_LIGHT}
                    />
                  ) : null}
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => router.push(`/(stars)/birth-chart?id=${profile.id}` as never)}
                  >
                    <MaterialSymbol name="auto_awesome" size={16} color={ST_ACCENT_LIGHT} />
                    <Text style={styles.actionButtonText}>View Chart</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => router.push(`/(stars)/compatibility?bId=${profile.id}` as never)}
                  >
                    <MaterialSymbol name="favorite" size={16} color={ST_ACCENT_LIGHT} />
                    <Text style={styles.actionButtonText}>Compare</Text>
                  </Pressable>

                  <Pressable
                    style={styles.dangerButton}
                    onPress={() => void handleDelete(profile.id, profile.name)}
                  >
                    <MaterialSymbol name="delete" size={16} color="#FFB4AB" />
                    <Text style={styles.dangerButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      <CosmicFAB
        icon="add"
        label="Add Friend"
        onPress={() => router.push('/(stars)/add-profile?mode=friend' as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.lowest,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  heroCard: {
    gap: 12,
  },
  heroTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 26,
    color: ST_TEXT,
  },
  heroCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
  sortWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  sortChipActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  sortChipText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  sortChipTextActive: {
    color: ST_ACCENT_LIGHT,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 17,
    color: ST_TEXT,
  },
  emptyCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  friendCard: {
    gap: 14,
  },
  friendHeader: {
    gap: 10,
  },
  friendIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendName: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  friendMeta: {
    fontFamily: ST_FONTS.regular,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
    textTransform: 'capitalize',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.16),
  },
  actionButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 180, 171, 0.1)',
  },
  dangerButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: '#FFB4AB',
  },
});
