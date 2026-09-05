import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  MOOD_ACCENT,
  MOOD_SURFACES,
  MOOD_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/mood';

// ── Companion options mapped to existing PetSpecies values ────────────
const COMPANIONS = [
  { species: 'bird' as const, label: 'THE OWL', trait: 'Wisdom & Oversight', icon: '\uD83E\uDD89' },
  { species: 'fox' as const, label: 'THE FOX', trait: 'Wit & Agility', icon: '\uD83E\uDD8A' },
  { species: 'cat' as const, label: 'THE CAT', trait: 'Grace & Calm', icon: '\uD83D\uDC31' },
  { species: 'dog' as const, label: 'THE DOG', trait: 'Joy & Loyalty', icon: '\uD83D\uDC36' },
  { species: 'bunny' as const, label: 'THE BUNNY', trait: 'Softness & Peace', icon: '\uD83D\uDC30' },
] as const;

const DEFAULT_HOUR = 8;
const DEFAULT_MINUTE = 0;

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h.toString().padStart(2, '0')}:${m}`;
}

function formatPeriod(hour: number): string {
  return hour >= 12 ? 'PM' : 'AM';
}

export default function MoodOnboardingScreen() {
  const router = useRouter();
  const [selectedSpecies, setSelectedSpecies] = useState<string>('bird');
  const [reminderHour] = useState(DEFAULT_HOUR);
  const [reminderMinute] = useState(DEFAULT_MINUTE);

  const handleGetStarted = useCallback(() => {
    router.replace('/(mood)');
  }, [router]);

  const handleSkip = useCallback(() => {
    router.replace('/(mood)');
  }, [router]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Branding ──────────────────────────────────────────────── */}
      <Text style={styles.branding}>MyMood</Text>

      {/* ── Welcome headline ──────────────────────────────────────── */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>
          Welcome to your{'\n'}
          <Text style={styles.heroAccent}>Quiet Sanctuary.</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          A private space designed for your thoughts, dreams, and mental clarity.
          Your data never leaves your device.
        </Text>
      </View>

      {/* ── Privacy Shield ────────────────────────────────────────── */}
      <GlassCard level={2} style={styles.privacyCard}>
        <View style={styles.privacyRow}>
          <View style={styles.shieldIcon}>
            <Text style={styles.shieldEmoji}>{'\uD83D\uDEE1\uFE0F'}</Text>
          </View>
          <View style={styles.privacyText}>
            <Text style={styles.privacyTitle}>PRIVACY SHIELD ACTIVE</Text>
            <Text style={styles.privacySubtitle}>End-to-end encryption by default.</Text>
          </View>
        </View>
      </GlassCard>

      {/* ── Choose Your Companion ─────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Choose your <Text style={styles.sectionAccent}>Companion</Text>
        </Text>
        <Text style={styles.sectionSubtitle}>
          A digital friend to watch over your journey.
        </Text>

        <View style={styles.companionGrid}>
          {COMPANIONS.map((c) => {
            const selected = selectedSpecies === c.species;
            return (
              <GlassCard
                key={c.species}
                level={selected ? 3 : 2}
                onPress={() => setSelectedSpecies(c.species)}
                style={[
                  styles.companionCard,
                  selected && styles.companionCardSelected,
                ]}
              >
                {selected && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>{'\u2713'}</Text>
                  </View>
                )}
                <View style={styles.companionIconWrap}>
                  <Text style={styles.companionIcon}>{c.icon}</Text>
                </View>
                <Text style={styles.companionLabel}>{c.label}</Text>
                <Text style={styles.companionTrait}>{c.trait}</Text>
              </GlassCard>
            );
          })}
        </View>
      </View>

      {/* ── Build a Routine ───────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Build a <Text style={styles.sectionAccent}>Routine</Text>
        </Text>
        <Text style={styles.sectionSubtitle}>
          Consistency is the key to deep insights.
        </Text>

        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>{formatTime(reminderHour, reminderMinute)}</Text>
          <Text style={styles.timePeriod}>{formatPeriod(reminderHour)}</Text>
        </View>
      </View>

      {/* ── Get Started CTA ───────────────────────────────────────── */}
      <View style={styles.ctaSection}>
        <GradientButton
          title="Get Started  \u2192"
          onPress={handleGetStarted}
        />

        <View style={styles.linksRow}>
          <Pressable hitSlop={8}>
            <Text style={styles.linkText}>Edit Time</Text>
          </Pressable>
          <Pressable hitSlop={8}>
            <Text style={styles.linkText}>Smart Alerts</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleSkip} hitSlop={8} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP ONBOARDING</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },

  // ── Branding ────────────────────────────────────────────────────────
  branding: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },

  // ── Hero ────────────────────────────────────────────────────────────
  heroSection: {
    marginBottom: 32,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 36,
    lineHeight: 42,
    color: colors.text,
    letterSpacing: -0.02 * 36,
  },
  heroAccent: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 36,
    lineHeight: 42,
    color: MOOD_ACCENT,
    fontStyle: 'italic',
  },
  heroSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginTop: 16,
    lineHeight: 24,
  },

  // ── Privacy Shield ──────────────────────────────────────────────────
  privacyCard: {
    marginBottom: 36,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldEmoji: {
    fontSize: 22,
  },
  privacyText: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    letterSpacing: 0.05 * 13,
    color: colors.text,
  },
  privacySubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // ── Section shared ──────────────────────────────────────────────────
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: colors.text,
    letterSpacing: -0.02 * 26,
  },
  sectionAccent: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: MOOD_ACCENT,
  },
  sectionSubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 20,
  },

  // ── Companion grid ──────────────────────────────────────────────────
  companionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  companionCard: {
    width: '47%' as unknown as number,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 8,
  },
  companionCardSelected: {
    borderWidth: 1.5,
    borderColor: MOOD_ACCENT,
  },
  checkmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1008',
  },
  companionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionIcon: {
    fontSize: 30,
  },
  companionLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.text,
    textAlign: 'center',
  },
  companionTrait: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Time display ────────────────────────────────────────────────────
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  timeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 64,
    color: colors.text,
    letterSpacing: -2,
  },
  timePeriod: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 22,
    color: colors.textSecondary,
    marginLeft: 6,
  },

  // ── CTA ─────────────────────────────────────────────────────────────
  ctaSection: {
    gap: 16,
    alignItems: 'center',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  linkText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: MOOD_ACCENT,
  },
  skipButton: {
    marginTop: 4,
  },
  skipText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: 'rgba(255,255,255,0.35)',
  },
});
