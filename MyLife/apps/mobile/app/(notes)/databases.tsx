import { useMemo } from 'react';
import { Alert, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import { getDatabases, type NoteDatabase } from '@mylife/notes';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

function showDatabasesComingSoon() {
  Alert.alert(
    'Coming soon',
    'Creating and editing structured databases is not available in this build yet.',
  );
}

export default function DatabasesScreen() {
  const db = useDatabase();

  const databases = useMemo(() => {
    try {
      return getDatabases(db);
    } catch {
      return [];
    }
  }, [db]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="heading">Databases</Text>
        <Pressable style={styles.createButton} onPress={showDatabasesComingSoon}>
          <Text variant="caption" color={ACCENT} style={{ fontWeight: '600' }}>+ New Database</Text>
        </Pressable>
      </View>

      {databases.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>{'🗄️'}</Text>
          <Text variant="subheading" style={{ marginTop: spacing.sm }}>No Databases Yet</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xl }}>
            Create a database to organize structured data with custom columns, views, and filters.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {databases.map((d: NoteDatabase) => (
            <Pressable key={d.id} style={styles.card} onPress={showDatabasesComingSoon}>
              <Text variant="body">{d.title}</Text>
              <Text variant="caption" color={colors.textSecondary}>{d.description || 'No description'}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, flexGrow: 1 },
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
});
