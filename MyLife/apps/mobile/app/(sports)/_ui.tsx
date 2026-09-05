import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';

export const SPORTS_ACCENT = colors.modules.sports;

type SportsPlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta?: { label: string; href: string };
  footer?: ReactNode;
};

export function SportsPlaceholderScreen({
  eyebrow,
  title,
  subtitle,
  cta,
  footer,
}: SportsPlaceholderScreenProps) {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.icon}>🏟️</Text>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {cta ? (
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push(cta.href as never)}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
        >
          <Text style={styles.primaryButtonText}>{cta.label}</Text>
        </Pressable>
      ) : null}

      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 10,
    padding: 24,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 36,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: SPORTS_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
});
