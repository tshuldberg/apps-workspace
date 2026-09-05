import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  getMemory,
  deleteMemory,
  listPeople,
  type MemoryRecord,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const DANGER = '#EF4444';

const GRADIENT_PAIRS: string[] = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getAvatarColor(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MemoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();

  const [memory, setMemory] = useState<MemoryRecord | null>(null);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const m = getMemory(db, id);
    setMemory(m);

    const people = listPeople(db, { is_archived: false });
    const archived = listPeople(db, { is_archived: true });
    const map: Record<string, PersonRecord> = {};
    for (const p of [...people, ...archived]) {
      map[p.id] = p;
    }
    setPeopleMap(map);
    setLoading(false);
  }, [db, id]);

  const handleDelete = useCallback(() => {
    if (!memory) return;
    Alert.alert(
      'Delete Memory',
      'This cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMemory(db, memory.id);
            router.back();
          },
        },
      ],
    );
  }, [db, memory, router]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </>
    );
  }

  if (!memory) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <Text style={styles.loadingText}>Memory not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: ACCENT, fontSize: 15, marginTop: 12 }}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: BG },
          headerTintColor: TEXT_PRIMARY,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Inside joke badge */}
        {memory.is_inside_joke && (
          <View style={styles.jokeBanner}>
            <Text style={styles.jokeBannerText}>�� Inside Joke</Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{memory.title}</Text>

        {/* Date */}
        {memory.happened_at && (
          <Text style={styles.date}>{formatDate(memory.happened_at)}</Text>
        )}

        {/* Description */}
        {memory.description_md && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>THE STORY</Text>
            <View style={styles.glassCard}>
              <Text style={styles.description}>{memory.description_md}</Text>
            </View>
          </View>
        )}

        {/* People */}
        {memory.person_ids.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHO WAS THERE</Text>
            <View style={styles.peopleList}>
              {memory.person_ids.map((pid) => {
                const person = peopleMap[pid];
                const name = person?.display_name ?? 'Unknown';
                return (
                  <Pressable
                    key={pid}
                    style={styles.personRow}
                    onPress={() => {
                      if (person) {
                        router.push({
                          pathname: '/(friends)/person-detail',
                          params: { id: pid },
                        });
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.personAvatar,
                        { backgroundColor: getAvatarColor(name) },
                      ]}
                    >
                      <Text style={styles.personAvatarText}>
                        {getInitials(name)}
                      </Text>
                    </View>
                    <Text style={styles.personName}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Tags */}
        {memory.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagsRow}>
              {memory.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Memory</Text>
          </Pressable>
        </View>
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
    padding: 20,
    paddingBottom: 60,
    gap: 24,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
  },
  jokeBanner: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  jokeBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A855F7',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  date: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: -8,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TEXT_SECONDARY,
  },
  glassCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  description: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  peopleList: {
    gap: 6,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  personAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${ACCENT}15`,
    borderWidth: 1,
    borderColor: `${ACCENT}30`,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  actions: {
    marginTop: 16,
  },
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: `${DANGER}10`,
    borderWidth: 1,
    borderColor: `${DANGER}30`,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: DANGER,
  },
});
