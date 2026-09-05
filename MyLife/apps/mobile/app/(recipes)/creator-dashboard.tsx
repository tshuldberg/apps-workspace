import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  ChevronRight,
  CircleDollarSign,
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

export default function CreatorDashboardScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>CREATOR SPACE</Text>
            <Text style={styles.pageTitle}>Creator dashboard</Text>
          </View>
          <View style={styles.freePill}>
            <Text style={styles.freePillText}>FREE</Text>
          </View>
        </View>

        <GlassCard level={2} style={styles.earningsCard}>
          <View style={styles.earningsSeal}>
            <CircleDollarSign
              size={31}
              color={RECIPES_ACCENT}
              strokeWidth={1.8}
            />
          </View>
          <View style={styles.unavailablePill}>
            <View style={styles.unavailableDot} />
            <Text style={styles.unavailableText}>PAYOUTS UNAVAILABLE</Text>
          </View>
          <Text style={styles.earningsTitle}>You are not earning yet</Text>
          <Text style={styles.earningsBody}>
            Creator payouts have not launched. BestChef is not collecting tips
            or paid chef subscriptions, and no earnings balance is being
            tracked.
          </Text>
          <View style={styles.transparencyRow}>
            <ShieldCheck
              size={18}
              color={RECIPES_ACCENT}
              strokeWidth={2}
            />
            <Text style={styles.transparencyText}>
              No payment or payout activity is hidden from this dashboard.
            </Text>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CREATE WITHOUT A PAYWALL</Text>
          <View style={styles.toolList}>
            <GlassCard level={3} style={styles.toolCard}>
              <View style={styles.toolIcon}>
                <ChefHat
                  size={22}
                  color={RECIPES_SECONDARY}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.toolCopy}>
                <Text style={styles.toolTitle}>Publish your cooking</Text>
                <Text style={styles.toolBody}>
                  Submit recipes and take part in the BestChef community for
                  free.
                </Text>
              </View>
            </GlassCard>
            <GlassCard level={3} style={styles.toolCard}>
              <View style={styles.toolIcon}>
                <Heart
                  size={21}
                  color={RECIPES_SECONDARY}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.toolCopy}>
                <Text style={styles.toolTitle}>Grow your creator presence</Text>
                <Text style={styles.toolBody}>
                  Your chef profile, followers, votes, and community feedback
                  are not tied to paid access.
                </Text>
              </View>
            </GlassCard>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit a recipe"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/(recipes)/submit')}
          >
            <Text style={styles.primaryButtonText}>Submit a recipe</Text>
            <ChevronRight size={18} color={RECIPES_SURFACES.depth} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View my chef profile"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/(recipes)/my-chef-profile')}
          >
            <Text style={styles.secondaryButtonText}>View my chef profile</Text>
          </Pressable>
        </View>

        <Text style={styles.policyNote}>
          BestChef's creator experience is free at launch.
        </Text>
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
    paddingTop: 20,
    paddingBottom: 120,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    color: RECIPES_ACCENT,
  },
  pageTitle: {
    ...RECIPES_TYPOGRAPHY.displayLg,
    fontSize: 27,
    lineHeight: 34,
    color: colors.text,
  },
  freePill: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.11)',
  },
  freePillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: RECIPES_ACCENT,
  },
  earningsCard: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  earningsSeal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  unavailablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  unavailableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RECIPES_ACCENT,
  },
  unavailableText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.9,
    color: RECIPES_ACCENT,
  },
  earningsTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 23,
    lineHeight: 30,
    color: colors.text,
    textAlign: 'center',
  },
  earningsBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  transparencyRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.07)',
  },
  transparencyText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
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
  toolList: {
    gap: 10,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 137, 77, 0.12)',
  },
  toolCopy: {
    flex: 1,
    gap: 4,
  },
  toolTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  toolBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
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
  policyNote: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
