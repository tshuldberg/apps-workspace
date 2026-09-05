import { Alert, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@mylife/ui';

const COMING_SOON_MSG =
  'Mobile canvas editing is not available in this build yet. Use the web app to design your canvas.';

function showToolComingSoon(tool: string) {
  Alert.alert('Coming soon', `${tool} tools are not available in this build yet. ${COMING_SOON_MSG}`);
}

export default function CanvasEditorScreen() {
  return (
    <View style={styles.container}>
      {/* Canvas surface with dot grid */}
      <View style={styles.surface}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'+'}</Text>
          <Text style={styles.emptyText}>Canvas editing is web-only for now.</Text>
        </View>
      </View>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <Pressable style={styles.toolButton} onPress={() => showToolComingSoon('Text')}>
          <Text style={styles.toolLabel}>Text</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => showToolComingSoon('Note')}>
          <Text style={styles.toolLabel}>Note</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => showToolComingSoon('Image')}>
          <Text style={styles.toolLabel}>Image</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => showToolComingSoon('Link')}>
          <Text style={styles.toolLabel}>Link</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => showToolComingSoon('Shape')}>
          <Text style={styles.toolLabel}>Shape</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  surface: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, color: colors.glassBorder, fontWeight: '300' },
  emptyText: { fontSize: 14, color: colors.textTertiary, marginTop: 12 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${colors.surface}A6`,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassStrong,
  },
  toolButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.glass,
  },
  toolLabel: { fontSize: 12, fontWeight: '600', color: colors.modules.notes },
});
