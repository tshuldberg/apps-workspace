import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { getPerson, archivePerson, type PersonRecord } from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

const RELATIONSHIP_LABELS: Record<string, string> = {
  close_friend: 'Close friend',
  friend: 'Friend',
  acquaintance: 'Acquaintance',
  family: 'Family',
  partner: 'Partner',
  ex: 'Ex',
  colleague: 'Colleague',
  mentor: 'Mentor',
  neighbor: 'Neighbor',
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  close_friend: '#EC4899',
  friend: '#8B5CF6',
  acquaintance: '#9F8E81',
  family: '#F59E0B',
  partner: '#EF4444',
  ex: '#6B7280',
  colleague: '#06B6D4',
  mentor: '#10B981',
  neighbor: '#F97316',
};

const ENERGY_LABELS: Record<string, string> = {
  energizing: 'Energizing',
  neutral: 'Neutral',
  draining: 'Draining',
  complicated: 'Complicated',
};

const ENERGY_COLORS: Record<string, string> = {
  energizing: '#10B981',
  neutral: '#9F8E81',
  draining: '#EF4444',
  complicated: '#F59E0B',
};

const COMM_LABELS: Record<string, string> = {
  text: 'Text',
  call: 'Call',
  in_person: 'In person',
  social_dm: 'Social DM',
};

const GRADIENT_PAIRS: [string, string][] = [
  ['#EC4899', '#F472B6'],
  ['#8B5CF6', '#A78BFA'],
  ['#06B6D4', '#22D3EE'],
  ['#F59E0B', '#FBBF24'],
  ['#10B981', '#34D399'],
  ['#EF4444', '#F87171'],
  ['#6366F1', '#818CF8'],
  ['#E879A1', '#F0ABAF'],
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): [string, string] {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function PersonDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const [person, setPerson] = useState<PersonRecord | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    const result = getPerson(db, id);
    setPerson(result);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleArchive = useCallback(() => {
    if (!person) return;
    Alert.alert(
      'Archive this person?',
      'They will be hidden from your list but their data is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            archivePerson(db, person.id);
            router.back();
          },
        },
      ],
    );
  }, [db, person, router]);

  if (!person) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Person not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const initials = getInitials(person.display_name);
  const [gradStart] = getGradient(person.display_name);
  const relColor = RELATIONSHIP_COLORS[person.relationship_type] ?? '#9F8E81';
  const relLabel = RELATIONSHIP_LABELS[person.relationship_type] ?? person.relationship_type;
  const energyColor = person.energy_tag ? ENERGY_COLORS[person.energy_tag] : null;

  const quickFacts: { label: string; value: string }[] = [];
  if (person.birthday) quickFacts.push({ label: 'Birthday', value: formatDate(person.birthday) ?? person.birthday });
  if (person.city) quickFacts.push({ label: 'City', value: person.city });
  if (person.communication_preference) quickFacts.push({ label: 'Prefers', value: COMM_LABELS[person.communication_preference] ?? person.communication_preference });
  if (person.frequency_goal_days) quickFacts.push({ label: 'Catch up every', value: `${person.frequency_goal_days} days` });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Back button */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroAvatar, { backgroundColor: gradStart }]}>
            <Text style={styles.heroAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{person.display_name}</Text>
          <View style={styles.heroMetaRow}>
            <View style={[styles.relBadge, { backgroundColor: `${relColor}20` }]}>
              <Text style={[styles.relBadgeText, { color: relColor }]}>{relLabel}</Text>
            </View>
            {energyColor && (
              <View style={styles.energyRow}>
                <View style={[styles.energyDot, { backgroundColor: energyColor }]} />
                <Text style={[styles.energyLabel, { color: energyColor }]}>
                  {person.energy_tag ? ENERGY_LABELS[person.energy_tag] : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* How we met */}
        {(person.how_met || person.where_met || person.when_met) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How we met</Text>
            <View style={styles.glassCard}>
              {person.how_met && <Text style={styles.metText}>{person.how_met}</Text>}
              {(person.where_met || person.when_met) && (
                <Text style={styles.metSub}>
                  {[person.where_met, person.when_met].filter(Boolean).join(' \u2022 ')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Quick facts */}
        {quickFacts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick facts</Text>
            <View style={styles.factsGrid}>
              {quickFacts.map((fact) => (
                <View key={fact.label} style={styles.factCard}>
                  <Text style={styles.factLabel}>{fact.label}</Text>
                  <Text style={styles.factValue}>{fact.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests */}
        {person.interests && person.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.tagsRow}>
              {person.interests.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {person.notes_md && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.glassCard}>
              <Text style={styles.notesText}>{person.notes_md}</Text>
            </View>
          </View>
        )}

        {/* Action row */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/(friends)/edit-person',
                params: { id: person.id },
              })
            }
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleArchive}
          >
            <Text style={styles.actionButtonTextSecondary}>Archive</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              // Placeholder for log hangout
            }}
          >
            <Text style={styles.actionButtonTextSecondary}>Log Hangout</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() =>
              router.push({
                pathname: '/(friends)/timeline',
                params: { personId: person.id, personName: person.display_name },
              })
            }
          >
            <Text style={styles.actionButtonTextSecondary}>Timeline</Text>
          </Pressable>
        </View>

        {/* Coming soon placeholders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Hangouts</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </View>

        <Pressable
          style={styles.section}
          onPress={() =>
            router.push({
              pathname: '/(friends)/gift-tracker',
              params: { personId: person.id, personName: person.display_name },
            })
          }
        >
          <Text style={styles.sectionTitle}>Gifts</Text>
          <View style={styles.glassCard}>
            <Text style={[styles.metText, { color: ACCENT }]}>
              View gift tracker {'\u2192'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.section}
          onPress={() =>
            router.push({
              pathname: '/(friends)/journal',
              params: { personId: person.id, personName: person.display_name },
            })
          }
        >
          <Text style={styles.sectionTitle}>Journal</Text>
          <View style={styles.glassCard}>
            <Text style={[styles.metText, { color: ACCENT }]}>
              Gratitude, processing & growth {'\u2192'}
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: SURFACE,
  },
  backButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroAvatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroName: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  relBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  relBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  energyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  energyLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  glassCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    padding: 16,
  },
  metText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  metSub: {
    fontSize: 13,
    color: '#9F8E81',
    marginTop: 6,
  },

  // Facts grid
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    padding: 12,
    width: '48%' as unknown as number,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9F8E81',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  factValue: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: `${ACCENT}15`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '500',
  },

  // Notes
  notesText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 21,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 28,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButtonSecondary: {
    backgroundColor: SURFACE,
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Coming soon
  comingSoon: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 13,
    color: '#9F8E81',
    fontStyle: 'italic',
  },
});
