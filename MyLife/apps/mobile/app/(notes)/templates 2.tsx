import { useMemo, useState } from 'react';
import { uuid } from '../../lib/uuid';
import { Alert, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import {
  getTemplates,
  seedBuiltInTemplates,
  BUILT_IN_TEMPLATES,
  incrementTemplateUseCount,
  createNote,
  expandVariables,
  buildVariableMap,
  type NoteTemplate,
} from '@mylife/notes';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function TemplatesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick] = useState(0);

  const templates = useMemo(() => {
    try {
      seedBuiltInTemplates(db, BUILT_IN_TEMPLATES);
      return getTemplates(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const builtIn = templates.filter((t) => t.isBuiltIn);
  const custom = templates.filter((t) => !t.isBuiltIn);

  function handleUse(template: NoteTemplate) {
    try {
      incrementTemplateUseCount(db, template.id);
      const vars = buildVariableMap();
      const body = expandVariables(template.body, vars);
      const id = uuid();
      createNote(db, id, { title: `From: ${template.name}`, body });
      router.push(`/(notes)/note-editor?id=${id}`);
    } catch {
      // navigation will show the error
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="heading">Templates</Text>
        <Pressable
          style={styles.createButton}
          onPress={() =>
            Alert.alert(
              'Create template',
              'Save any note as a template from the note editor. Custom template creation from this screen is coming soon.',
            )
          }
        >
          <Text variant="caption" color={ACCENT} style={{ fontWeight: '600' }}>+ Create</Text>
        </Pressable>
      </View>

      <Text variant="caption" color={colors.textSecondary} style={{ fontWeight: '600', marginBottom: spacing.sm }}>
        Built-in
      </Text>
      <View style={styles.grid}>
        {builtIn.map((item) => (
          <TemplateCard key={item.id} item={item} onPress={() => handleUse(item)} />
        ))}
      </View>

      <Text variant="caption" color={colors.textSecondary} style={{ fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.lg }}>
        My Templates
      </Text>
      {custom.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="body" color={colors.textSecondary}>No custom templates yet.</Text>
          <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 4 }}>
            Create one or save a note as a template.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {custom.map((item) => (
            <TemplateCard key={item.id} item={item} onPress={() => handleUse(item)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TemplateCard({ item, onPress }: { item: NoteTemplate; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>{item.icon}</Text>
          <View style={styles.cardContent}>
            <Text variant="body" numberOfLines={1}>{item.name}</Text>
            <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
              {item.description || item.category}
            </Text>
          </View>
          {item.isBuiltIn && (
            <View style={styles.badge}>
              <Text variant="caption" color={ACCENT} style={{ fontSize: 10 }}>Built-in</Text>
            </View>
          )}
        </View>
        {item.useCount > 0 && (
          <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.xs }}>
            Used {item.useCount} time{item.useCount !== 1 ? 's' : ''}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: `${colors.modules.notes}33`,
  },
  grid: { gap: spacing.sm },
  card: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIcon: { fontSize: 28 },
  cardContent: { flex: 1, gap: 2 },
  badge: {
    backgroundColor: `${colors.modules.notes}26`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
});
