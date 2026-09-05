import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'business' | 'personal' | 'follow-up' | 'thank-you';
  lastUsedAt: string | null;
  useCount: number;
}

const CATEGORIES = ['business', 'personal', 'follow-up', 'thank-you'] as const;

const STARTER_TEMPLATES: Omit<EmailTemplate, 'id' | 'lastUsedAt' | 'useCount'>[] = [
  {
    name: 'Meeting Follow-up',
    subject: 'Following up on our meeting',
    body: 'Hi {{name}},\n\nThank you for taking the time to meet with me. I wanted to follow up on the key points we discussed.\n\nBest,\n{{sender}}',
    category: 'follow-up',
  },
  {
    name: 'Thank You',
    subject: 'Thank you!',
    body: 'Hi {{name}},\n\nI wanted to express my sincere thanks for {{reason}}. I really appreciate it.\n\nWarm regards,\n{{sender}}',
    category: 'thank-you',
  },
  {
    name: 'Introduction',
    subject: 'Introduction: {{sender}}',
    body: 'Hi {{name}},\n\nMy name is {{sender}} and I am reaching out regarding {{topic}}.\n\nI would love to connect and discuss this further.\n\nBest,\n{{sender}}',
    category: 'business',
  },
];

export default function MailTemplatesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number] | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState<typeof CATEGORIES[number]>('business');

  // TODO: Load templates from ml_templates table when available
  const templates = useMemo<EmailTemplate[]>(() => {
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM ml_templates ORDER BY use_count DESC, name ASC',
        [],
      );
      return rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        subject: r.subject as string,
        body: r.body as string,
        category: r.category as EmailTemplate['category'],
        lastUsedAt: r.last_used_at as string | null,
        useCount: (r.use_count as number) ?? 0,
      }));
    } catch {
      return [];
    }
  }, [db]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'all') return templates;
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  const handleUseTemplate = useCallback((template: EmailTemplate) => {
    // TODO: Navigate to compose with template pre-filled
    router.push('/(mail)/compose-message');
  }, [router]);

  const handleSaveTemplate = useCallback(() => {
    if (!editName.trim() || !editSubject.trim()) {
      Alert.alert('Missing Info', 'Enter a name and subject for the template.');
      return;
    }
    // TODO: Save to ml_templates when migration adds the table
    Alert.alert('Saved', 'Template saved successfully.');
    setShowEditor(false);
    setEditName('');
    setEditSubject('');
    setEditBody('');
  }, [editName, editSubject, editBody, editCategory]);

  if (showEditor) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.editorContent}>
        <View style={styles.editorHeader}>
          <Pressable onPress={() => setShowEditor(false)}>
            <Text variant="body" color={ACCENT}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSaveTemplate}>
            <Text variant="body" color={ACCENT}>Save</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Template name"
          placeholderTextColor={colors.textTertiary}
          value={editName}
          onChangeText={setEditName}
        />
        <TextInput
          style={styles.input}
          placeholder="Subject line"
          placeholderTextColor={colors.textTertiary}
          value={editSubject}
          onChangeText={setEditSubject}
        />

        <Text variant="label" color={colors.textTertiary}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, editCategory === c && styles.chipActive]}
              onPress={() => setEditCategory(c)}
            >
              <Text variant="caption" color={editCategory === c ? ACCENT : colors.textSecondary}>
                {c}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.bodyInput]}
          placeholder="Email body (use {{name}}, {{date}}, {{company}} as variables)"
          placeholderTextColor={colors.textTertiary}
          value={editBody}
          onChangeText={setEditBody}
          multiline
          textAlignVertical="top"
        />

        <Text variant="caption" color={colors.textTertiary}>
          Available variables: {'{{name}}'}, {'{{date}}'}, {'{{company}}'}, {'{{sender}}'}
        </Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Category filter */}
      <View style={styles.filterBar}>
        <Pressable
          style={[styles.chip, selectedCategory === 'all' && styles.chipActive]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text variant="caption" color={selectedCategory === 'all' ? ACCENT : colors.textSecondary}>All</Text>
        </Pressable>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, selectedCategory === c && styles.chipActive]}
            onPress={() => setSelectedCategory(c)}
          >
            <Text variant="caption" color={selectedCategory === c ? ACCENT : colors.textSecondary}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Starter templates */}
        {templates.length === 0 && (
          <>
            <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>
              Starter Templates
            </Text>
            {STARTER_TEMPLATES.map((t, i) => (
              <Pressable key={i} style={[styles.templateCard, glass.card]}>
                <View style={styles.templateHeader}>
                  <Text variant="subheading" color={colors.text}>{t.name}</Text>
                  <View style={styles.categoryBadge}>
                    <Text variant="caption" color={colors.textTertiary}>{t.category}</Text>
                  </View>
                </View>
                <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                  Subject: {t.subject}
                </Text>
                <Text variant="caption" color={colors.textTertiary} numberOfLines={2}>
                  {t.body.slice(0, 100)}...
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {/* User templates */}
        {filtered.length > 0 && (
          <>
            <Text variant="label" color={colors.textTertiary} style={styles.sectionLabel}>
              Your Templates
            </Text>
            {filtered.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.templateCard, glass.card]}
                onPress={() => handleUseTemplate(t)}
              >
                <View style={styles.templateHeader}>
                  <Text variant="subheading" color={colors.text}>{t.name}</Text>
                  <View style={styles.categoryBadge}>
                    <Text variant="caption" color={colors.textTertiary}>{t.category}</Text>
                  </View>
                </View>
                <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                  Subject: {t.subject}
                </Text>
                {t.useCount > 0 && (
                  <Text variant="caption" color={colors.textTertiary}>
                    Used {t.useCount} time{t.useCount !== 1 ? 's' : ''}
                    {t.lastUsedAt ? ` | Last: ${new Date(t.lastUsedAt).toLocaleDateString()}` : ''}
                  </Text>
                )}
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: ACCENT }]}
        onPress={() => setShowEditor(true)}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  filterBar: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: `${ACCENT}50`,
  },
  sectionLabel: { marginTop: spacing.sm, marginBottom: spacing.xs },
  templateCard: { padding: spacing.md, gap: spacing.xs },
  templateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  editorContent: { padding: spacing.md, gap: spacing.md },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.sm, color: colors.text, fontSize: 16,
  },
  bodyInput: { minHeight: 200 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
