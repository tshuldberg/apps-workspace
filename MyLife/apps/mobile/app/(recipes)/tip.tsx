import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronRight,
  CreditCard,
  Heart,
  ShieldCheck,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { Text, colors } from '@mylife/ui';

export default function TipScreen() {
  const { chefId, chefName } = useLocalSearchParams<{
    chefId?: string;
    chefName?: string;
  }>();
  const router = useRouter();
  const hasChefProfile = Boolean(chefId);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>NO PAYMENT COLLECTION</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.sealOuter}>
            <View style={styles.sealInner}>
              <CreditCard
                size={30}
                color={RECIPES_ACCENT}
                strokeWidth={1.8}
              />
            </View>
          </View>
          <Text style={styles.title}>Tipping is not available</Text>
          <Text style={styles.subtitle}>
            BestChef does not accept tip payments
            {chefName ? ` for ${chefName}` : ''} at launch. No amount can be
            selected or charged here.
          </Text>
        </View>

        <GlassCard level={2} style={styles.assuranceCard}>
          <View style={styles.assuranceRow}>
            <View style={styles.assuranceIcon}>
              <ShieldCheck
                size={20}
                color={RECIPES_ACCENT}
                strokeWidth={2}
              />
            </View>
            <View style={styles.assuranceCopy}>
              <Text style={styles.assuranceTitle}>No charge can be made</Text>
              <Text style={styles.assuranceBody}>
                This screen does not collect card details or create a payment.
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPORT WITHOUT PAYING</Text>
          <GlassCard level={3} style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <Heart
                size={22}
                color={RECIPES_SECONDARY}
                strokeWidth={2}
              />
            </View>
            <View style={styles.supportCopy}>
              <Text style={styles.supportTitle}>Cheer on great cooking</Text>
              <Text style={styles.supportBody}>
                Follow chefs, vote for dishes, and share recipes you enjoy.
                These community actions are free.
              </Text>
            </View>
          </GlassCard>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasChefProfile ? 'View chef profile' : 'Discover chefs'
            }
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              if (chefId) {
                router.push({
                  pathname: '/(recipes)/chef-profile',
                  params: { profileId: chefId },
                });
                return;
              }
              router.push('/(recipes)/chef-discover');
            }}
          >
            <Text style={styles.primaryButtonText}>
              {hasChefProfile ? 'View chef profile' : 'Discover chefs'}
            </Text>
            <ChevronRight size={18} color={RECIPES_SURFACES.depth} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 24,
  },
  statusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RECIPES_ACCENT,
  },
  statusText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    color: RECIPES_ACCENT,
  },
  hero: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  sealOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.07)',
  },
  sealInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  title: {
    ...RECIPES_TYPOGRAPHY.displayLg,
    fontSize: 28,
    lineHeight: 35,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
  },
  assuranceCard: {
    padding: 18,
  },
  assuranceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  assuranceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  assuranceCopy: {
    flex: 1,
    gap: 4,
  },
  assuranceTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  assuranceBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    color: colors.textTertiary,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
  },
  supportIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 137, 77, 0.12)',
  },
  supportCopy: {
    flex: 1,
    gap: 5,
  },
  supportTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  supportBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RECIPES_ACCENT,
  },
  primaryButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: RECIPES_SURFACES.depth,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  secondaryButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  buttonPressed: {
    opacity: 0.78,
  },
});
