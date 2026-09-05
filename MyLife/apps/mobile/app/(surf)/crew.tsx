import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getUserCrews,
  createCrew,
  getCrewMembers,
  addCrewMember,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function CrewScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [crewName, setCrewName] = useState('');
  const refresh = () => setTick((v) => v + 1);

  const crews = useMemo(() => getUserCrews(db, 'local'), [db, tick]);

  const handleCreateCrew = () => {
    if (!crewName.trim()) return;
    const id = `crew_${Date.now()}`;
    createCrew(db, id, { name: crewName.trim(), creatorId: 'local' });
    setCrewName('');
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Surf Crew</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Organize your surf friends and plan sessions together.
        </Text>
      </Card>

      {/* Crew list */}
      <Card>
        <Text variant="subheading">Your Crews</Text>
        <View style={styles.list}>
          {crews.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No crews yet. Create one to start coordinating sessions.
            </Text>
          ) : (
            crews.map((crew) => {
              const members = getCrewMembers(db, crew.id);
              return (
                <View key={crew.id} style={styles.crewCard}>
                  <Text variant="body">{crew.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </Text>
                  <View style={styles.memberList}>
                    {members.map((m) => (
                      <View key={m.id} style={styles.memberChip}>
                        <Text variant="caption" color={colors.textSecondary}>{m.userId}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Card>

      {/* Create crew form */}
      <Card>
        <Text variant="subheading">Create Crew</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={crewName}
            onChangeText={setCrewName}
            placeholder="Crew name (e.g. Dawn Patrol)"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable style={styles.primaryButton} onPress={handleCreateCrew}>
            <Text variant="label" color={colors.background}>Create Crew</Text>
          </Pressable>
        </View>
      </Card>

      {/* Session planner placeholder */}
      <Card>
        <Text variant="subheading">Session Planner</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Propose a session with your crew. Coming soon: pick a spot, date, and time, and see who's in.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  crewCard: {
    gap: spacing.xs, padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  memberChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
