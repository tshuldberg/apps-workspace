import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { SurfSession, SurfSpot } from '@mylife/surf';
import {
  createSession,
  getSessions,
  getSpotById,
  getSpotNarrative,
  getSpotForecast,
  toggleSpotFavorite,
  updateSpotConditions,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurfSpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();

  const [spot, setSpot] = useState<SurfSpot | null>(null);
  const [sessions, setSessions] = useState<SurfSession[]>([]);

  const [waveHeightFt, setWaveHeightFt] = useState('0');
  const [windKts, setWindKts] = useState('0');
  const [durationMin, setDurationMin] = useState('90');
  const [rating, setRating] = useState('4');

  const loadData = useCallback(() => {
    const nextSpot = getSpotById(db, id ?? '') ?? null;
    setSpot(nextSpot);
    if (nextSpot) {
      setWaveHeightFt(String(nextSpot.waveHeightFt));
      setWindKts(String(nextSpot.windKts));
      setSessions(getSessions(db, { spotId: nextSpot.id, limit: 50 }));
    } else {
      setSessions([]);
    }
  }, [db, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!spot) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="subheading">Spot not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text variant="subheading">{spot.name}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {spot.region} · {spot.breakType} · {spot.tide} tide · {spot.swellDirection} swell
            </Text>
          </View>
          <Pressable
            onPress={() => {
              toggleSpotFavorite(db, spot.id);
              loadData();
            }}
          >
            <Text variant="label" color={spot.isFavorite ? colors.modules.surf : colors.textSecondary}>
              {spot.isFavorite ? 'Favorited' : 'Favorite'}
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* Forecast narrative */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const narrative = getSpotNarrative(db, spot.id, today);
        const forecasts = getSpotForecast(db, spot.id);
        const nextForecast = forecasts[0] ?? null;
        return (
          <Card>
            <Text variant="subheading">Forecast</Text>
            {narrative ? (
              <Text variant="body" color={colors.textSecondary}>
                {narrative.body}
              </Text>
            ) : nextForecast ? (
              <View style={{ gap: 4 }}>
                <Text variant="body" color={colors.textSecondary}>
                  Swell: {nextForecast.waveHeightMinFt}-{nextForecast.waveHeightMaxFt}ft
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  Wind: {nextForecast.windSpeedKts}kts {nextForecast.windLabel}
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  Rating: {nextForecast.rating}/5 -- {nextForecast.conditionColor}
                </Text>
              </View>
            ) : (
              <Text variant="caption" color={colors.textSecondary}>
                No forecast data available. Check back when data is synced.
              </Text>
            )}
          </Card>
        );
      })()}

      <Card>
        <Text variant="subheading">Update Conditions</Text>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Wave height (ft)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={waveHeightFt}
            onChangeText={setWaveHeightFt}
          />
          <TextInput
            style={styles.input}
            placeholder="Wind (kts)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={windKts}
            onChangeText={setWindKts}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              updateSpotConditions(db, spot.id, {
                waveHeightFt: Number(waveHeightFt) || spot.waveHeightFt,
                windKts: Number(windKts) || spot.windKts,
              });
              loadData();
            }}
          >
            <Text variant="label" color={colors.background}>Save</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Log Session</Text>
        <View style={styles.form}>
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
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              createSession(db, makeId('session'), {
                spotId: spot.id,
                sessionDate: new Date().toISOString(),
                durationMin: Math.max(15, Number(durationMin) || 60),
                rating: Math.min(5, Math.max(1, Number(rating) || 3)),
              });
              loadData();
            }}
          >
            <Text variant="label" color={colors.background}>Add Session</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.list}>
        {sessions.map((session) => (
          <Card key={session.id}>
            <Text variant="body">
              {new Date(session.sessionDate).toLocaleDateString()} · {session.durationMin} min · {session.rating}/5
            </Text>
            {session.notes && (
              <Text variant="caption" color={colors.textSecondary}>{session.notes}</Text>
            )}
          </Card>
        ))}
        {sessions.length === 0 && (
          <Card>
            <View style={styles.emptyState}>
              <Text variant="subheading">Ready to paddle out?</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Log a session above to start tracking your time at this spot
              </Text>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  form: {
    marginTop: spacing.sm,
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
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: colors.modules.surf,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
});
