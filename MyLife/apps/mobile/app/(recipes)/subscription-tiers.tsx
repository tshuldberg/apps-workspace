import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronRight,
  CreditCard,
  ShieldCheck,
  Users,
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

export default function SubscriptionTiersScreen() {
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
          <Text style={styles.statusText}>RECURRING CHARGES OFF</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.sealOuter}>
            <View style={styles.sealInner}>
              <Users
                size={31}
                color={RECIPES_ACCENT}
                strokeWidth={1.8}
              />
            </View>
          </View>
          <Text style={styles.title}>Chef subscriptions are not available</Text>
          <Text style={styles.subtitle}>
            BestChef has no paid tiers for
            {chefName ? ` ${chefName}` : ' chefs'} at launch. No recurring
            subscription can be started on this screen.
          </Text>
        </View>

        <GlassCard level={2} style={styles.factsCard}>
          <View style={styles.factRow}>
            <View style={styles.factIcon}>
              <CreditCard
                size={19}
                color={RECIPES_ACCENT}
                strokeWidth={2}
              />
            </View>
            <View style={styles.factCopy}>
              <Text style={styles.factTitle}>No paid tier selection</Text>
              <Text style={styles.factBody}>
                Prices, checkout controls, and payment forms are intentionally
                absent.
              </Text>
            </View>
          </View>
          <View style={styles.factDivider} />
          <View style={styles.factRow}>
            <View style={styles.factIcon}>
              <ShieldCheck
                size={19}
                color={RECIPES_ACCENT}
                strokeWidth={2}
              />
            </View>
            <View style={styles.factCopy}>
              <Text style={styles.factTitle}>No recurring billing</Text>
              <Text style={styles.factBody}>
                BestChef will not store a payment method or create a monthly
                charge here.
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONNECT FOR FREE</Text>
          <GlassCard level={3} style={styles.communityCard}>
            <View style={styles.communityMark}>
              <Users
                size={22}
                color={RECIPES_SECONDARY}
                strokeWidth={2}
              />
            </View>
            <View style={styles.communityCopy}>
              <Text style={styles.communityTitle}>Follow chefs instead</Text>
              <Text style={styles.communityBody}>
                Recipes, profiles, follows, and community participation remain
                available without a paid chef plan.
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
    fontSize: 27,
    lineHeight: 34,
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
  factsCard: {
    gap: 16,
    padding: 18,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  factIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  factCopy: {
    flex: 1,
    gap: 4,
  },
  factTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  factBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  factDivider: {
    height: 1,
    marginLeft: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  communityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
  },
  communityMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 137, 77, 0.12)',
  },
  communityCopy: {
    flex: 1,
    gap: 5,
  },
  communityTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  communityBody: {
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
