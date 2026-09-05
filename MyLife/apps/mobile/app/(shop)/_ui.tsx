import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';

type ShopCardConfig = {
  emoji: string;
  title: string;
  body: string;
};

type ShopPlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: ShopCardConfig[];
  footer?: ReactNode;
};

export const SHOP_ACCENT = colors.modules.shop;

export const PRIORITY_COLOR: Record<'need' | 'want' | 'someday' | 'dream', string> = {
  need: '#EF4444',
  want: '#FFB877',
  someday: '#8BCFF0',
  dream: '#A78BFA',
};

export function ShopPlaceholderScreen({
  eyebrow,
  title,
  subtitle,
  cards,
  footer,
}: ShopPlaceholderScreenProps) {
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
          MyShop is wired for build-out but stays hidden from discover and the hub dashboard
          until the wishlist, purchase journal, and warranty flows ship.
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
    color: SHOP_ACCENT,
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
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
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
