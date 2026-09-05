import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getGiftBudget,
  getTotalSpentOnPerson,
  listGiftPeople,
  type GiftPerson,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const DAY = 86_400_000;

function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : '?';
}

function daysUntil(ts: number | null, now: number): number | null {
  if (ts == null) return null;
  return Math.max(0, Math.ceil((ts - now) / DAY));
}

function describeUpcoming(p: GiftPerson, now: number): string {
  const d = daysUntil(p.nextOccasionDate, now);
  if (d == null || !p.nextOccasion) return 'No upcoming occasion';
  if (d === 0) return `${p.nextOccasion} today`;
  if (d === 1) return `${p.nextOccasion} tomorrow`;
  return `${p.nextOccasion} in ${d} days`;
}

export default function GiftsHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const now = Date.now();

  const people = useMemo<GiftPerson[]>(() => {
    try {
      return listGiftPeople(db);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, tick]);

  const cards = useMemo(() => {
    return people.map((p) => {
      let remaining: number | null = null;
      try {
        const budget = getGiftBudget(db, p.id);
        if (budget) {
          const spent = getTotalSpentOnPerson(db, p.id);
          remaining = budget.amountCents - spent;
        }
      } catch {
        remaining = null;
      }
      return { person: p, remaining };
    });
  }, [db, people, tick]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Gifts</Text>
        <Text style={styles.title}>
          {people.length === 0 ? 'Be a thoughtful gift giver' : 'Your people'}
        </Text>
        <Text style={styles.subtitle}>
          Track gifts per person, set budgets per occasion, and never repeat a
          gift you already gave.
        </Text>
      </View>

      {people.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No people tracked yet</Text>
          <Text style={styles.emptyBody}>
            Add the people you give gifts to. MyShop will remember every gift,
            reaction, and budget.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {cards.map(({ person, remaining }) => (
            <Pressable
              key={person.id}
              style={styles.card}
              onPress={() => router.push(`/(shop)/gifts/${person.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial(person.name)}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {person.name}
              </Text>
              {person.relationship ? (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {person.relationship}
                </Text>
              ) : null}
              <Text style={styles.cardOccasion} numberOfLines={1}>
                {describeUpcoming(person, now)}
              </Text>
              {remaining !== null ? (
                <View
                  style={[
                    styles.budgetPill,
                    remaining < 0 && styles.budgetPillOver,
                  ]}
                >
                  <Text
                    style={[
                      styles.budgetPillText,
                      remaining < 0 && styles.budgetPillTextOver,
                    ]}
                  >
                    {remaining < 0
                      ? `Over by $${(Math.abs(remaining) / 100).toFixed(2)}`
                      : `$${(remaining / 100).toFixed(2)} left`}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(shop)/gifts/add-person')}
      >
        <Text style={styles.primaryButtonText}>Add a person</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push('/(shop)/gifts/add')}
      >
        <Text style={styles.secondaryButtonText}>Log a gift given</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  header: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  emptyCard: {
    gap: 6,
    padding: 20,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: SHOP_ACCENT, fontSize: 18, fontWeight: '800' },
  cardName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardOccasion: { color: colors.textSecondary, fontSize: 12 },
  budgetPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.32)',
  },
  budgetPillOver: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  budgetPillText: { color: SHOP_ACCENT, fontSize: 11, fontWeight: '800' },
  budgetPillTextOver: { color: '#FCA5A5' },
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
