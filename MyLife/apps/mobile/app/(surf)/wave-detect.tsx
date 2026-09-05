import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getSessions,
  getSessionWaves,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function WaveDetectScreen() {
  const db = useDatabase();
  const sessions = useMemo(() => getSessions(db, { limit: 20 }), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Wave Detection</Text>
        <Text variant="caption" color={colors.textSecondary}>
          GPS-based wave ride detection from your surf sessions. Record a session with GPS tracking to detect individual waves.
        </Text>
      </Card>

      {/* Sessions with wave data */}
      <Card>
        <Text variant="subheading">Sessions</Text>
        <View style={styles.list}>
          {sessions.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No sessions recorded yet. Log a session to start detecting waves.
            </Text>
          ) : (
            sessions.map((session) => {
              const waves = getSessionWaves(db, session.id);
              return (
                <View key={session.id} style={styles.sessionRow}>
                  <View style={styles.mainCopy}>
                    <Text variant="body">
                      {new Date(session.sessionDate).toLocaleDateString()} -- {session.durationMin}min
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Rating: {session.rating}/5
                      {waves.length > 0 ? ` -- ${waves.length} wave${waves.length !== 1 ? 's' : ''} detected` : ''}
                    </Text>
                  </View>
                  {waves.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: ACCENT }]}>
                      <Text variant="caption" color={colors.background}>{waves.length}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </Card>

      {/* Info */}
      <Card>
        <Text variant="subheading">How It Works</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Wave detection uses GPS speed and movement patterns to identify individual wave rides during your session. The algorithm detects acceleration patterns consistent with catching and riding waves.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
});
