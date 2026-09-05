import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  listDecks,
  listFlashExportRecords,
  type Deck,
} from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#9B7DDB';

function showComingSoon(feature: string) {
  Alert.alert(
    'Coming soon',
    `${feature} is not yet available in this build. Use Settings > Export for the current JSON, Markdown, and Text bundles.`,
  );
}

export default function ImportExportScreen() {
  const db = useDatabase();

  const decks: Deck[] = useMemo(() => {
    try { return listDecks(db); } catch { return []; }
  }, [db]);

  const exportHistory = useMemo(() => {
    try { return listFlashExportRecords(db); } catch { return []; }
  }, [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Import / Export</Text>

      {/* Import section */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>IMPORT</Text>
        <Text variant="body" color={colors.textSecondary}>
          Import flashcards from Anki (.apkg) files
        </Text>
        <Pressable style={styles.actionButton} onPress={() => showComingSoon('Anki import')}>
          <Text variant="label" color={colors.background}>Select .apkg File</Text>
        </Pressable>
        <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.xs }}>
          Supports Anki 2.1 format. Basic and cloze card types.
        </Text>
      </Card>

      {/* Export section */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>EXPORT</Text>
        <Text variant="body" color={colors.textSecondary}>
          Export your decks for backup or transfer
        </Text>

        {decks.length > 0 ? (
          <>
            <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.sm }}>
              Select deck to export:
            </Text>
            {decks.map((deck) => (
              <View key={deck.id} style={styles.deckRow}>
                <View style={styles.deckInfo}>
                  <Text variant="body">{deck.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {deck.cardCount} cards
                  </Text>
                </View>
                <View style={styles.formatRow}>
                  <Pressable style={styles.formatBtn} onPress={() => showComingSoon('Per-deck CSV export')}>
                    <Text variant="iconCaption" color={ACCENT}>CSV</Text>
                  </Pressable>
                  <Pressable style={styles.formatBtn} onPress={() => showComingSoon('Per-deck JSON export')}>
                    <Text variant="iconCaption" color={ACCENT}>JSON</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text variant="caption" color={colors.textTertiary}>
            No decks to export yet.
          </Text>
        )}
      </Card>

      {/* Export history */}
      {exportHistory.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>EXPORT HISTORY</Text>
          {exportHistory.slice(0, 5).map((record) => (
            <View key={record.id} style={styles.historyRow}>
              <Text variant="body">{record.fileName}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {new Date(record.exportedAt).toLocaleDateString()} - {record.cardsExported} cards
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  actionButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: spacing.sm, minHeight: 44, justifyContent: 'center',
  },
  deckRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  deckInfo: { flex: 1, gap: 2 },
  formatRow: { flexDirection: 'row', gap: spacing.xs },
  formatBtn: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  historyRow: { paddingVertical: 6, gap: 2 },
});
