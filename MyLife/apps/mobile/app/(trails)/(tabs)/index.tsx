import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  GlassCard,
  MaterialSymbol,
  MiniMapCard,
  RecordingCard,
  SectionHeader,
  StatDisplay,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  TrailCard,
  WeatherChip,
  formatWindSpeed,
  withAlpha,
} from '@mylife/trails';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getHomeTabData } from '../phase1-data';

export default function TrailsHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  const home = useMemo(() => {
    try {
      return getHomeTabData(db);
    } catch (error) {
      console.error('[MyTrails] failed to build home tab', error);
      return null;
    }
  }, [db, tick]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 250);
  }, []);

  if (!home) {
    return (
      <View style={styles.centeredState}>
        <MaterialSymbol name="warning" size={28} color={TR_ACCENT_LIGHT} />
        <Text style={styles.stateTitle}>Home tab unavailable</Text>
        <Text style={styles.stateBody}>
          MyTrails could not load the dashboard surfaces right now.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TR_ACCENT}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroIntro}>
        <Text style={styles.heroEyebrow}>Last Explored</Text>
        <Text style={styles.heroHeadline}>
          {home.heroRecording?.name ?? home.heroTrail?.name ?? 'Tap To Start'}
        </Text>
        <Text style={styles.heroBody}>
          Live route capture, nearby trail scouting, and weather prep in one field-ready hub.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Field Map"
          action={{
            label: 'Open',
            onPress: () => router.push('/(trails)/record'),
          }}
        />
        <Pressable onPress={() => router.push('/(trails)/record')}>
          <MiniMapCard
            trail={home.heroTrail}
            recording={home.heroRecording}
            center={home.anchor}
            zoom={13}
            showLiveGPS={home.liveGpsActive}
            style={styles.mapHero}
          />
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Performance Overview"
          action={{
            label: 'This Month',
            onPress: () => router.push('/(trails)/recordings'),
          }}
        />
        <View style={styles.statsGrid}>
          <OverviewTile
            icon="route"
            label="Total Distance"
            value={(home.monthSummary.totalDistanceMeters / 1000).toFixed(1)}
            unit="km"
          />
          <OverviewTile
            icon="terrain"
            label="Total Elevation"
            value={Math.round(home.monthSummary.totalElevationGainMeters)}
            unit="m"
          />
          <OverviewTile
            icon="flag"
            label="Trails Completed"
            value={home.monthSummary.trailsCompleted}
          />
          <OverviewTile
            icon="schedule"
            label="Active Days"
            value={home.monthSummary.activeDays}
          />
        </View>
      </View>

      <Pressable onPress={() => router.push('/(trails)/weather')}>
        <GlassCard style={styles.weatherCard}>
          <View style={styles.weatherHeader}>
            <Text style={styles.weatherEyebrow}>Conditions</Text>
            <MaterialSymbol name="cloud" size={18} color={TR_ACCENT_LIGHT} />
          </View>
          {home.weather ? (
            <View style={styles.weatherRow}>
              <WeatherChip
                condition={home.weather.current.description}
                temperature={home.weather.current.temperature}
              />
              <View style={styles.weatherCopy}>
                <Text style={styles.weatherTitle}>{home.weather.current.description}</Text>
                <Text style={styles.weatherMeta}>
                  {formatWindSpeed(
                    home.weather.current.windSpeed,
                    home.weather.current.windDirection,
                  )}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.weatherMeta}>
              Cache a weather forecast from the weather screen to pin it here.
            </Text>
          )}
        </GlassCard>
      </Pressable>

      <View style={styles.section}>
        <SectionHeader
          title="Nearby"
          action={{
            label: 'View All',
            onPress: () => router.push('/(trails)/discover'),
          }}
        />
        {home.nearbyTrails.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalRail}
          >
            {home.nearbyTrails.map((trail) => (
              <View key={trail.id} style={styles.trailRailCard}>
                <TrailCard
                  trail={{
                    ...trail,
                    lastExploredLabel: `${(trail.distanceFromAnchorMeters / 1000).toFixed(1)} km away`,
                    liveGps: false,
                  }}
                  onPress={() => router.push(`/(trails)/trail/${trail.id}` as `/${string}`)}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <EmptyCard
            title="No nearby trails yet"
            copy="Save a few trails or import a database region to populate nearby recommendations."
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Recent Adventures"
          action={{
            label: 'View All',
            onPress: () => router.push('/(trails)/recordings'),
          }}
        />
        {home.recentRecordings.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalRail}
          >
            {home.recentRecordings.map((recording) => (
              <View key={recording.id} style={styles.recordingRailCard}>
                <RecordingCard
                  recording={recording}
                  onPress={() =>
                    router.push(`/(trails)/recording/${recording.id}` as `/${string}`)
                  }
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <EmptyCard
            title="No recordings yet"
            copy="Start your first route capture to unlock recent adventures, monthly stats, and live pacing."
            actionLabel="Start Recording"
            onPress={() => router.push('/(trails)/record')}
          />
        )}
      </View>
    </ScrollView>
  );
}

function OverviewTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: number | string;
  unit?: string;
}) {
  return (
    <GlassCard style={styles.statTile}>
      <MaterialSymbol name={icon} size={18} color={TR_ACCENT_LIGHT} />
      <StatDisplay value={value} unit={unit} label={label} />
    </GlassCard>
  );
}

function EmptyCard({
  title,
  copy,
  actionLabel,
  onPress,
}: {
  title: string;
  copy: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <GlassCard style={styles.emptyCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{copy}</Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress} style={styles.inlineButton}>
          <Text style={styles.inlineButtonCopy}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.base,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
    gap: 22,
  },
  heroIntro: {
    gap: 6,
  },
  heroEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  heroHeadline: {
    ...TR_TYPOGRAPHY.displayLg,
    color: TR_TEXT,
    fontSize: 34,
  },
  heroBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    maxWidth: 320,
  },
  section: {
    gap: 12,
  },
  mapHero: {
    minHeight: 256,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statTile: {
    width: '48%',
    minWidth: 154,
    gap: 14,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.05),
  },
  weatherCard: {
    gap: 12,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.06),
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weatherEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weatherCopy: {
    flex: 1,
    gap: 4,
  },
  weatherTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  weatherMeta: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_TERTIARY,
  },
  horizontalRail: {
    gap: 12,
    paddingRight: 16,
  },
  trailRailCard: {
    width: 220,
  },
  recordingRailCard: {
    width: 286,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    backgroundColor: TR_SURFACES.base,
  },
  emptyCard: {
    gap: 10,
  },
  stateTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  stateBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_TERTIARY,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.16),
  },
  inlineButtonCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
});
