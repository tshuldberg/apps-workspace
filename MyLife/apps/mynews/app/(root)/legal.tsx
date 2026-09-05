import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import {
  getMyNewsRuntimeCapabilities,
  getMyNewsRuntimeLegalContent,
} from './data/runtime-capabilities';
import { tokens } from './theme/tokens';

/**
 * In-app legal hub. Links the shared Terms, Privacy, and Community Guidelines
 * documents (same content as the web /legal pages), the copyright/DMCA screen,
 * the DSA statement-of-reasons Notices screen, and the published contact info.
 */
export default function LegalHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const capabilities = getMyNewsRuntimeCapabilities();
  const legal = getMyNewsRuntimeLegalContent();
  const contacts = capabilities.emailContact
    ? [
        { label: 'General and legal', email: process.env.EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL! },
        { label: 'Safety and NCII', email: process.env.EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL! },
        { label: 'Copyright / DMCA', email: process.env.EXPO_PUBLIC_MYNEWS_DMCA_EMAIL! },
      ]
    : [];

  const docs: Array<{ route: string; title: string; summary: string }> = [
    { route: '/(root)/legal/terms', title: legal.terms.title, summary: legal.terms.summary },
    { route: '/(root)/legal/privacy', title: legal.privacy.title, summary: legal.privacy.summary },
    {
      route: '/(root)/legal/guidelines',
      title: legal.guidelines.title,
      summary: legal.guidelines.summary,
    },
    {
      route: '/(root)/legal/dmca',
      title: 'Copyright and DMCA',
      summary: 'File a copyright notice and read the repeat-infringer policy.',
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Legal</Text>
      <Text style={styles.body}>
        The documents and policies that govern MyNews: signed bylines, author-controlled edits,
        safety reporting, and zero ads.
      </Text>

      <View style={styles.list}>
        {docs.map((doc) => (
          <Pressable
            key={doc.route}
            style={styles.row}
            onPress={() => router.push(doc.route as never)}
            accessibilityRole="link"
            // The row renders a title and a summary, and a screen reader would
            // otherwise read both as one run-on sentence with no indication that
            // the summary is secondary. The label names the destination; the hint
            // carries the summary.
            accessibilityLabel={doc.title}
            accessibilityHint={doc.summary}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{doc.title}</Text>
              <Text style={styles.rowSummary}>{doc.summary}</Text>
            </View>
            <ChevronRight size={18} color={tokens.textTertiary} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>EU Digital Services Act</Text>
      <View style={styles.card}>
        <Text style={styles.body}>
          <Text style={styles.strong}>Notice and action.</Text> Report illegal or infringing content
          with the report tool on any article, revision, suggestion, or profile. We review reports
          and act where warranted.
        </Text>
        <Text style={styles.body}>
          <Text style={styles.strong}>Statement of reasons.</Text> When we act against your content,
          you can read why in Notices.
        </Text>
        <Pressable
          style={styles.noticesButton}
          onPress={() => router.push('/(root)/notices' as never)}
          accessibilityRole="link"
          accessibilityLabel="Open Notices"
          accessibilityHint="Read the statements of reasons for actions taken against your content"
        >
          <Text style={styles.noticesButtonLabel}>Open Notices</Text>
          <ChevronRight size={18} color={tokens.accent} />
        </Pressable>
        {capabilities.emailContact ? (
          <Text style={styles.body}>
            <Text style={styles.strong}>Point of contact.</Text> Reach our DSA point of contact at the
            controlled address below.
          </Text>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Contact</Text>
      <View style={styles.card}>
        {contacts.length > 0 ? (
          contacts.map((contact) => (
            <ContactRow key={contact.label} label={contact.label} email={contact.email} />
          ))
        ) : (
          <Text style={styles.body}>Email contact is not available in this build.</Text>
        )}
      </View>

      <Text style={styles.footer}>
        These pages describe how MyNews works; they are not legal advice.
      </Text>
    </ScrollView>
  );
}

function ContactRow({ label, email }: { label: string; email: string }) {
  return (
    <Pressable
      style={styles.contactRow}
      onPress={() => void Linking.openURL(`mailto:${email}`)}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${email}`}
      accessibilityHint="Opens your email app"
    >
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactEmail}>{email}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  title: { color: tokens.text, fontSize: 28, fontWeight: '800' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  strong: { color: tokens.text, fontWeight: '700' },
  list: { gap: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: tokens.card, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomColor: tokens.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: tokens.text, fontSize: 16, fontWeight: '700' },
  rowSummary: { color: tokens.textTertiary, fontSize: 13, lineHeight: 18 },
  sectionTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 12,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 10,
  },
  noticesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  noticesButtonLabel: { color: tokens.accent, fontSize: 15, fontWeight: '700' },
  contactRow: {
    gap: 2,
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  contactLabel: { color: tokens.textTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  contactEmail: { color: tokens.accent, fontSize: 15, fontWeight: '700' },
  footer: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
