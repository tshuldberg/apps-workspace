import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SHOP_MODULE } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { SHOP_ACCENT } from './_ui';

export default function ShopSettingsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>Your shopping memory</Text>
        <Text style={styles.subtitle}>
          Quick access to sizes, preferences, and module options. Shopping
          intent stays strictly local.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Memory</Text>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/sizes')}
      >
        <Text style={styles.cardTitle}>Sizes</Text>
        <Text style={styles.cardBody}>
          Clothing, shoe, and ring sizes per brand with fit notes.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/preferences')}
      >
        <Text style={styles.cardTitle}>Preferences</Text>
        <Text style={styles.cardBody}>
          Tech, household, color, brand, material, and allergy preferences.
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Decisions</Text>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/research')}
      >
        <Text style={styles.cardTitle}>Research</Text>
        <Text style={styles.cardBody}>
          Side-by-side comparisons with pros, cons, and a winner. Link the
          decision to the purchase you made.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/stores')}
      >
        <Text style={styles.cardTitle}>Stores</Text>
        <Text style={styles.cardBody}>
          Returns policies, shipping quirks, and rewards perks for the stores
          you actually use.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/review')}
      >
        <Text style={styles.cardTitle}>Year in Review</Text>
        <Text style={styles.cardBody}>
          Annual recap of total spend, top categories, best and worst
          purchases, gifts, warranty wins, and impulse audit.
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Awareness</Text>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/spending')}
      >
        <Text style={styles.cardTitle}>Spending dashboard</Text>
        <Text style={styles.cardBody}>
          Monthly totals, 6-month trend, category breakdown, and impulse vs sale ratios.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/spending/impulse')}
      >
        <Text style={styles.cardTitle}>Impulse log</Text>
        <Text style={styles.cardBody}>
          Track regret rate and the categories where impulse buys add up fastest.
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(shop)/spending/thirty-day-rule')}
      >
        <Text style={styles.cardTitle}>30-day rule</Text>
        <Text style={styles.cardBody}>
          Park non-essentials for 30 days, then decide. See your conversion rate
          and total saved by skipping.
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Module</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Return and warranty alerts</Text>
        <Text style={styles.cardBody}>
          Configure how far in advance MyShop nudges you before a return window
          or warranty expires. Coming soon.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export path</Text>
        <Text style={styles.cardBody}>
          Full local export of wishlists, purchases, and warranties will live
          here in a portable format.
        </Text>
      </View>

      <View style={styles.versionBadge}>
        <Text style={styles.versionLabel}>MyShop</Text>
        <Text style={styles.versionValue}>v{SHOP_MODULE.version}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 12,
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
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  versionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    marginTop: 12,
  },
  versionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  versionValue: {
    color: SHOP_ACCENT,
    fontSize: 13,
    fontWeight: '800',
  },
});
