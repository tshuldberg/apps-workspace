import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';

interface ModuleBetaScreenProps {
  badge: string;
  title: string;
  summary: string;
  accentColor: string;
  highlights: readonly string[];
}

export function ModuleBetaScreen({
  badge,
  title,
  summary,
  accentColor,
  highlights,
}: ModuleBetaScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: `${accentColor}22` }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What is live in this beta shell</Text>
        {highlights.map((highlight) => (
          <View key={highlight} style={styles.highlightRow}>
            <View style={[styles.dot, { backgroundColor: accentColor }]} />
            <Text style={styles.highlightText}>{highlight}</Text>
          </View>
        ))}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Production hardening in progress</Text>
        <Text style={styles.noteText}>
          This route is wired into MyLife so navigation, module registration, and future deep links
          are stable. The remaining work is full workflow UI, moderation and abuse tooling, and
          end-to-end validation against the live Supabase contracts.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  noteCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
