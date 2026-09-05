import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { SurfSession, SurfSpot } from '@mylife/surf';
import {
  createSession,
  deleteSession,
  getSessions,
  getSpots,
} from '@mylife/surf';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SURF_ACCENT,
  SurfEmptyState,
  SurfGlassCard,
  SurfHero,
  SurfMetricCard,
  SurfPrimaryButton,
  SurfScreen,
  SurfSection,
} from './_ui';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurfSessionsScreen() {
  const db = useDatabase();

  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [sessions, setSessions] = useState<SurfSession[]>([]);

  const [spotId, setSpotId] = useState('');
  const [durationMin, setDurationMin] = useState('90');
  const [rating, setRating] = useState('4');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(() => {
    const nextSpots = getSpots(db);
    const nextSessions = getSessions(db, { limit: 100 });
    setSpots(nextSpots);
    setSessions(nextSessions);
    if (!spotId && nextSpots[0]) {
      setSpotId(nextSpots[0].id);
    }
  }, [db, spotId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = () => {
    if (!spotId) return;
    createSession(db, makeId('session'), {
      spotId,
      sessionDate: new Date().toISOString(),
      durationMin: Math.max(15, Number(durationMin) || 60),
      rating: Math.min(5, Math.max(1, Number(rating) || 3)),
      notes: notes.trim() || undefined,
    });
    setNotes('');
    loadData();
  };

  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMin, 0);

  return (
    <SurfScreen contentContainerStyle={styles.container}>
      <SurfHero
        title="Session Journal"
        subtitle="Log surf days, keep conditions attached to each paddle-out, and build your local history."
      />

      <View style={styles.metricGrid}>
        <SurfMetricCard label="Sessions" value={String(sessions.length)} />
        <SurfMetricCard label="Water Time" value={`${Math.round(totalMinutes / 60)}h`} />
      </View>

      <SurfSection eyebrow="Log" title="Log Session">
        <SurfGlassCard>
        <View style={styles.form}>
          <View style={styles.rowWrap}>
            {spots.map((spot) => (
              <Pressable
                key={spot.id}
                onPress={() => setSpotId(spot.id)}
                style={[
                  styles.chip,
                  spot.id === spotId && styles.chipActive,
                ]}
              >
                <Text variant="caption" color={spot.id === spotId ? colors.modules.surf : colors.textSecondary}>
                  {spot.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Duration (min)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={durationMin}
            onChangeText={setDurationMin}
          />
          <TextInput
            style={styles.input}
            placeholder="Rating (1-5)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={rating}
            onChangeText={setRating}
          />
          <TextInput
            style={styles.input}
            placeholder="Notes"
            placeholderTextColor={colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
          />
          <SurfPrimaryButton label="Save Session" onPress={handleCreate} />
        </View>
        </SurfGlassCard>
      </SurfSection>

      <SurfSection eyebrow="History" title="Recent Sessions">
      <View style={styles.list}>
        {sessions.map((session) => (
          <SurfGlassCard key={session.id}>
            <View style={styles.itemHeader}>
              <View style={styles.itemCopy}>
                <Text variant="body" style={styles.sessionTitle}>
                  {new Date(session.sessionDate).toLocaleDateString()} · {session.durationMin} min · {session.rating}/5
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {spots.find((spot) => spot.id === session.spotId)?.name ?? 'Unknown spot'}
                  {session.notes ? ` · ${session.notes}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => {
                deleteSession(db, session.id);
                loadData();
              }}>
                <Text variant="label" color={colors.danger}>Delete</Text>
              </Pressable>
            </View>
          </SurfGlassCard>
        ))}
        {sessions.length === 0 && (
          <SurfEmptyState
            icon="🏄"
            title="Log your first session"
            copy="Track your time in the water to build your surf history."
          />
        )}
      </View>
      </SurfSection>
    </SurfScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  form: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    borderColor: colors.modules.surf,
    backgroundColor: colors.glassStrong,
  },
  list: {
    gap: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionTitle: {
    fontWeight: '700',
    color: SURF_ACCENT,
  },
});
