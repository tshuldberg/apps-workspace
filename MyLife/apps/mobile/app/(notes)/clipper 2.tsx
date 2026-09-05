import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createNote, htmlToMarkdown, buildClipBody, truncateClip } from '@mylife/notes';
import type { ClipType } from '@mylife/notes';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.notes;

const CLIP_TYPES: { key: ClipType; label: string; icon: string }[] = [
  { key: 'full_page', label: 'Full Page', icon: '📄' },
  { key: 'article', label: 'Article', icon: '📰' },
  { key: 'selection', label: 'Selection', icon: '✂️' },
  { key: 'bookmark', label: 'Bookmark Only', icon: '🔖' },
];

export default function ClipperScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [clipType, setClipType] = useState<ClipType>('article');
  const [tags, setTags] = useState('');
  const [clippedContent, setClippedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSaveToNotes = useCallback(() => {
    if (!clippedContent) return;
    try {
      const id = uuid();
      createNote(db, id, {
        title: `Clip from ${url}`,
        body: clippedContent,
      });
      setClippedContent(null);
      setUrl('');
      setTags('');
      router.push(`/(notes)/note-editor?id=${id}`);
    } catch {
      Alert.alert('Error', 'Could not save clip as note.');
    }
  }, [db, clippedContent, url, router]);

  const handleClip = useCallback(() => {
    if (!url.trim()) {
      Alert.alert('Enter URL', 'Please enter a URL to clip.');
      return;
    }
    setLoading(true);
    // TODO: Fetch URL content and use htmlToMarkdown / buildClipBody
    // For now, demonstrate the engine with placeholder HTML
    try {
      const sampleHtml = `<h1>Clipped Page</h1><p>Content from <a href="${url}">${url}</a></p>`;
      const markdown = htmlToMarkdown(sampleHtml);
      const clipBody = buildClipBody(markdown, url.trim(), 'Clipped Page');
      const truncated = truncateClip(clipBody, 5000);
      setClippedContent(truncated);
    } catch {
      Alert.alert('Error', 'Failed to clip this URL.');
    } finally {
      setLoading(false);
    }
  }, [url, clipType]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading">Web Clipper</Text>

      {/* URL input */}
      <Card>
        <TextInput
          style={styles.urlInput}
          placeholder="Enter URL to clip..."
          placeholderTextColor={colors.textTertiary}
          value={url}
          onChangeText={setUrl}
          keyboardType="url"
          autoCapitalize="none"
        />

        {/* Clip type selector */}
        <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>Format</Text>
        <View style={styles.typeRow}>
          {CLIP_TYPES.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.typeChip, clipType === t.key && styles.typeChipActive]}
              onPress={() => setClipType(t.key)}
            >
              <Text style={{ fontSize: 16 }}>{t.icon}</Text>
              <Text variant="caption" color={clipType === t.key ? ACCENT : colors.textSecondary}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tags */}
        <TextInput
          style={styles.tagInput}
          placeholder="Tags (comma-separated)"
          placeholderTextColor={colors.textTertiary}
          value={tags}
          onChangeText={setTags}
        />

        <Pressable
          style={[styles.clipBtn, { backgroundColor: ACCENT }]}
          onPress={handleClip}
        >
          <Text variant="body" color="#fff" style={{ fontWeight: '600' }}>
            {loading ? 'Clipping...' : 'Clip'}
          </Text>
        </Pressable>
      </Card>

      {/* Preview */}
      {clippedContent && (
        <Card>
          <Text variant="subheading">Preview</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.previewText}>
            {clippedContent.slice(0, 500)}
            {clippedContent.length > 500 ? '...' : ''}
          </Text>
          <Pressable style={styles.saveBtn} onPress={handleSaveToNotes}>
            <Text variant="caption" color={ACCENT}>Save to Notes</Text>
          </Pressable>
        </Card>
      )}

      {/* Clip history placeholder */}
      <Card>
        <Text variant="subheading">Recent Clips</Text>
        <View style={styles.emptyHistory}>
          <Text variant="body" color={colors.textSecondary}>
            No clips yet. Clip a URL to get started.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  urlInput: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text, fontSize: 16,
  },
  sectionLabel: { marginTop: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: 8, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  typeChipActive: { borderColor: ACCENT, backgroundColor: `${ACCENT}15` },
  tagInput: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text, fontSize: 14,
    marginTop: spacing.sm,
  },
  clipBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    marginTop: spacing.md,
  },
  previewText: { marginTop: spacing.sm, lineHeight: 20 },
  saveBtn: {
    paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: ACCENT, marginTop: spacing.sm,
  },
  emptyHistory: { paddingVertical: spacing.lg, alignItems: 'center' },
});
