import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LegalDocument } from '@mylife/mynews';
import { tokens } from '../theme/tokens';

/**
 * Renders a shared LegalDocument (Terms / Privacy / Community Guidelines) from
 * @mylife/mynews. The same document data backs the web /legal pages, so the two
 * surfaces never diverge.
 */
export function LegalDocView({ doc }: { doc: LegalDocument }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>{doc.title}</Text>
      <Text style={styles.meta}>Effective {doc.effectiveDate}</Text>
      <Text style={styles.body}>{doc.intro}</Text>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.heading}</Text>
          {section.paragraphs.map((paragraph, i) => (
            <Text key={i} style={styles.body}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}

      <Text style={styles.footer}>
        This document describes how MyNews works; it is not legal advice.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  title: { color: tokens.text, fontSize: 28, fontWeight: '800' },
  meta: { color: tokens.textTertiary, fontSize: 13 },
  section: {
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 6,
  },
  sectionTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  body: { color: tokens.textSecondary, fontSize: 15, lineHeight: 22 },
  footer: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
