import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text } from './Text';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface OnboardingPageProps {
  /** Large icon or emoji displayed at the top. */
  icon: string;
  /** Page heading. */
  title: string;
  /** Subtitle paragraph below the heading. */
  subtitle: string;
  /** Feature bullet rows or other content in the middle area. */
  children?: React.ReactNode;
  /** Bottom area content (buttons, etc). */
  footer?: React.ReactNode;
}

export function OnboardingPage({
  icon,
  title,
  subtitle,
  children,
  footer,
}: OnboardingPageProps) {
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.icon}>{icon}</Text>
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
        {children ? <View style={styles.body}>{children}</View> : null}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

/** A single icon + text row for feature/benefit lists. */
export function OnboardingFeatureRow({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.featureText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 80,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 56,
    // Pair lineHeight with fontSize so the hero emoji renders without
    // ascender/descender clipping when inherited variant lineHeight is small.
    lineHeight: 64,
    marginBottom: spacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 36,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  body: {
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    paddingTop: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIcon: {
    fontSize: 22,
    lineHeight: 28,
    width: 32,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
});
