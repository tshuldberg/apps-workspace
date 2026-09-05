import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';

export default function MindScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.icon}>{'🧠'}</Text>
        <Text style={styles.title}>Mind</Text>
        <Text style={styles.subtitle}>
          Breathing exercises, meditation, CBT tools, and wellness resources.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  hero: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
});
