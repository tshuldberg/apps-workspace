import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Text } from '@mylife/ui';
import { getPeopleByCities } from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const ACCENT = '#8BCFF0';

export default function PeopleByCityScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [groups, setGroups] = useState<
    Record<string, Array<{ id: string; display_name: string }>>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setGroups(getPeopleByCities(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleCity = useCallback((city: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
      } else {
        next.add(city);
      }
      return next;
    });
  }, []);

  const cities = Object.keys(groups).sort();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>People by City</Text>
            <Text style={styles.headerSubtitle}>
              Who can I see in...?
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {cities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No cities yet</Text>
              <Text style={styles.emptySubtext}>
                Add a city to a friend or log a move event
              </Text>
            </View>
          ) : (
            cities.map((city) => {
              const people = groups[city];
              const isExpanded = expanded.has(city);

              return (
                <View key={city}>
                  <Pressable
                    style={styles.cityCard}
                    onPress={() => toggleCity(city)}
                  >
                    <Text style={styles.cityPin}>{'\uD83D\uDCCD'}</Text>
                    <View style={styles.cityInfo}>
                      <Text style={styles.cityName}>{city}</Text>
                      <Text style={styles.cityCount}>
                        {people.length} {people.length === 1 ? 'person' : 'people'}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>
                      {isExpanded ? '\u2303' : '\u2304'}
                    </Text>
                  </Pressable>

                  {isExpanded &&
                    people.map((person) => (
                      <Pressable
                        key={person.id}
                        style={styles.personRow}
                        onPress={() =>
                          router.push({
                            pathname: '/(friends)/person-detail',
                            params: { personId: person.id },
                          })
                        }
                      >
                        <View style={styles.personDot} />
                        <Text style={styles.personName}>
                          {person.display_name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  cityCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityPin: {
    fontSize: 20,
    marginRight: 12,
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  cityCount: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: TEXT_SECONDARY,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 48,
    paddingRight: 20,
  },
  personDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
    marginRight: 12,
  },
  personName: {
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9F8E81',
    marginTop: 6,
    textAlign: 'center',
  },
});
