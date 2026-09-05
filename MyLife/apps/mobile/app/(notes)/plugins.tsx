import { useMemo, useState } from 'react';
import { Alert, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import { getPlugins, enablePlugin, disablePlugin, type NotePlugin } from '@mylife/notes';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

const BUILT_IN_PLUGIN_INFO: Record<string, { icon: string }> = {
  'word-count': { icon: '🔢' },
  'toc': { icon: '📑' },
  'outline': { icon: '📐' },
  'random-note': { icon: '🎲' },
  'focus-mode': { icon: '🧘' },
};

export default function PluginsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);

  const plugins = useMemo(() => {
    try {
      return getPlugins(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const builtIn = plugins.filter((p) => p.isBuiltIn);
  const installed = plugins.filter((p) => !p.isBuiltIn);

  function handleToggle(plugin: NotePlugin) {
    try {
      if (plugin.isEnabled) {
        disablePlugin(db, plugin.id);
      } else {
        enablePlugin(db, plugin.id);
      }
      setTick((t) => t + 1);
    } catch {
      // silently fail
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="heading">Plugins</Text>
        <Pressable
          style={styles.installButton}
          onPress={() =>
            Alert.alert(
              'Coming soon',
              'Installing third-party plugins is not available in this build yet.',
            )
          }
        >
          <Text variant="caption" color={ACCENT} style={{ fontWeight: '600' }}>Install Plugin</Text>
        </Pressable>
      </View>

      <Text variant="caption" color={colors.textSecondary} style={{ fontWeight: '600', marginBottom: spacing.sm }}>
        Built-in
      </Text>
      {builtIn.map((plugin) => {
        const info = BUILT_IN_PLUGIN_INFO[plugin.name.toLowerCase().replace(/\s+/g, '-')] ?? { icon: '🔌' };
        return (
          <Pressable key={plugin.id} style={styles.pluginCard} onPress={() => handleToggle(plugin)}>
            <Text style={styles.pluginIcon}>{info.icon}</Text>
            <View style={styles.pluginContent}>
              <Text variant="body">{plugin.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>{plugin.description}</Text>
            </View>
            <View style={[styles.toggle, plugin.isEnabled && styles.toggleActive]}>
              <Text variant="caption" color={plugin.isEnabled ? ACCENT : colors.textTertiary} style={{ fontWeight: '600' }}>
                {plugin.isEnabled ? 'On' : 'Off'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {builtIn.length === 0 && (
        <View style={styles.pluginCard}>
          <Text style={styles.pluginIcon}>{'🔌'}</Text>
          <View style={styles.pluginContent}>
            <Text variant="body" color={colors.textSecondary}>No built-in plugins yet</Text>
          </View>
        </View>
      )}

      <Text variant="caption" color={colors.textSecondary} style={{ fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        Installed
      </Text>
      {installed.length === 0 ? (
        <Text variant="body" color={colors.textTertiary} style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
          No custom plugins installed.
        </Text>
      ) : (
        installed.map((plugin) => (
          <Pressable key={plugin.id} style={styles.pluginCard} onPress={() => handleToggle(plugin)}>
            <Text style={styles.pluginIcon}>{'🔌'}</Text>
            <View style={styles.pluginContent}>
              <Text variant="body">{plugin.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>{plugin.description}</Text>
            </View>
            <View style={[styles.toggle, plugin.isEnabled && styles.toggleActive]}>
              <Text variant="caption" color={plugin.isEnabled ? ACCENT : colors.textTertiary} style={{ fontWeight: '600' }}>
                {plugin.isEnabled ? 'On' : 'Off'}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  installButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: `${colors.modules.notes}33`,
  },
  pluginCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  pluginIcon: { fontSize: 28, marginRight: spacing.sm },
  pluginContent: { flex: 1, gap: 2 },
  toggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.glassStrong,
  },
  toggleActive: {
    backgroundColor: `${colors.modules.notes}26`,
  },
});
