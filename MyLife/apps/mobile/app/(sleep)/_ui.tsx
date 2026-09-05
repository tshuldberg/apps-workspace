import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import type { DreamType, SleepDurationTone } from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';

type SleepCardConfig = {
  emoji: string;
  title: string;
  body: string;
};

type SleepPlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: SleepCardConfig[];
  footer?: ReactNode;
};

export const SLEEP_ACCENT = colors.modules.sleep;

export const SLEEP_DURATION_TONES: Record<
  SleepDurationTone,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  success: {
    backgroundColor: 'rgba(48,209,88,0.14)',
    borderColor: 'rgba(48,209,88,0.34)',
    textColor: '#BBF7D0',
  },
  warning: {
    backgroundColor: 'rgba(250,204,21,0.14)',
    borderColor: 'rgba(250,204,21,0.34)',
    textColor: '#FEF08A',
  },
  danger: {
    backgroundColor: 'rgba(255,69,58,0.14)',
    borderColor: 'rgba(255,69,58,0.34)',
    textColor: '#FECACA',
  },
};

export const SLEEP_DREAM_TYPE_TONES: Record<
  DreamType,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  normal: {
    backgroundColor: 'rgba(148,163,184,0.14)',
    borderColor: 'rgba(148,163,184,0.32)',
    textColor: '#E2E8F0',
  },
  vivid: {
    backgroundColor: 'rgba(167,139,250,0.16)',
    borderColor: 'rgba(167,139,250,0.38)',
    textColor: '#E9DDFF',
  },
  nightmare: {
    backgroundColor: 'rgba(255,69,58,0.14)',
    borderColor: 'rgba(255,69,58,0.34)',
    textColor: '#FECACA',
  },
  lucid: {
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderColor: 'rgba(96,165,250,0.34)',
    textColor: '#DBEAFE',
  },
  recurring: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderColor: 'rgba(251,191,36,0.34)',
    textColor: '#FDE68A',
  },
};

export function readSleepTargetHours(db: DatabaseAdapter): number {
  const rawValue = db.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    ['sleep.targetHours'],
  )[0]?.value;
  const parsed = Number(rawValue);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

export function SleepPlaceholderScreen({
  eyebrow,
  title,
  subtitle,
  cards,
  footer,
}: SleepPlaceholderScreenProps) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.cardGrid}>
        {cards.map((card) => (
          <View key={card.title} style={styles.card}>
            <Text style={styles.cardEmoji}>{card.emoji}</Text>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Hidden foundation route</Text>
        <Text style={styles.noteBody}>
          MySleep is wired for build-out, but the module stays hidden from discover and default hub bootstrap
          until a later release-state decision.
        </Text>
      </View>

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
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  cardGrid: {
    gap: 12,
  },
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEmoji: {
    fontSize: 26,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  noteBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
