import { StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TheMarlinTraders</Text>
      <Text style={styles.subtitle}>
        All-in-one trading platform — charting, strategy, execution, journaling, and community.
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Phase 1: Core Charting Platform</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0f',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  badge: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f0f1a',
  },
  badgeText: {
    fontSize: 14,
    color: '#94a3b8',
  },
})
