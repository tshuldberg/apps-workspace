import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TRAILS_MODULE,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  getAlertSettings,
  getSetting,
  setSetting,
  updateAlertSettings,
  withAlpha,
} from '@mylife/trails';
import { useDatabase } from '../../../components/DatabaseProvider';

type GpsAccuracy = 'high' | 'balanced' | 'power_save';
type MapStyle = 'topographic' | 'satellite' | 'hybrid' | 'terrain';
type DistanceUnit = 'miles' | 'kilometers';
type ElevationUnit = 'feet' | 'meters';
type TemperatureUnit = 'fahrenheit' | 'celsius';
type CoordinateFormat = 'decimal' | 'dms';

const RECORDING_ACCURACY: GpsAccuracy[] = ['high', 'balanced', 'power_save'];
const MAP_STYLES: MapStyle[] = ['topographic', 'satellite', 'hybrid', 'terrain'];
const DISTANCE_UNITS: DistanceUnit[] = ['miles', 'kilometers'];
const ELEVATION_UNITS: ElevationUnit[] = ['feet', 'meters'];
const TEMPERATURE_UNITS: TemperatureUnit[] = ['fahrenheit', 'celsius'];
const COORDINATE_FORMATS: CoordinateFormat[] = ['decimal', 'dms'];
const ALERT_THRESHOLDS = [25, 50, 100] as const;

const DELETE_ORDER = [
  'tr_reviews',
  'tr_route_waypoints',
  'tr_planned_routes',
  'tr_trip_activities',
  'tr_trip_days',
  'tr_trips',
  'tr_packing_items',
  'tr_packing_templates',
  'tr_segment_efforts',
  'tr_segments',
  'tr_deviation_events',
  'tr_photos',
  'tr_waypoints',
  'tr_recordings',
  'tr_trail_database',
  'tr_trails',
  'tr_offline_regions',
  'tr_weather_cache',
  'tr_alert_settings',
  'tr_settings',
] as const;

export default function TrailsSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  const settings = useMemo(() => {
    try {
      const alertSettings = getAlertSettings(db);

      return {
        gpsAccuracy: (getSetting(db, 'gps_accuracy') as GpsAccuracy | null) ?? 'balanced',
        autoPause: readBool(getSetting(db, 'auto_pause'), true),
        autoRecordPhotos: readBool(getSetting(db, 'auto_record_photos'), false),
        waypointRadiusMeters: Number(getSetting(db, 'waypoint_radius_meters') ?? '25'),
        minPointDistanceMeters: Number(getSetting(db, 'min_point_distance_meters') ?? '8'),
        offTrailAlertsEnabled: alertSettings.vibrationEnabled || alertSettings.soundEnabled,
        alertThresholdMeters: Math.round(alertSettings.deviationThresholdMeters),
        elevationWarningEnabled: readBool(getSetting(db, 'alerts_elevation_warning'), false),
        mapStyle: (getSetting(db, 'default_map_style') as MapStyle | null) ?? 'topographic',
        contourLines: readBool(getSetting(db, 'map_contour_lines'), true),
        hazards: readBool(getSetting(db, 'map_hazards'), false),
        distanceUnit: (getSetting(db, 'distance_unit') as DistanceUnit | null) ?? 'miles',
        elevationUnit: (getSetting(db, 'elevation_unit') as ElevationUnit | null) ?? 'meters',
        temperatureUnit:
          (getSetting(db, 'temperature_unit') as TemperatureUnit | null) ?? 'celsius',
        coordinateFormat:
          (getSetting(db, 'coordinate_format') as CoordinateFormat | null) ?? 'decimal',
        shareByDefault: readBool(getSetting(db, 'share_recordings_default'), false),
        blurHomeLocation: readBool(getSetting(db, 'blur_home_location'), true),
        communityReviews: readBool(getSetting(db, 'allow_community_reviews'), true),
      };
    } catch (error) {
      console.error('[MyTrails] failed to build settings tab', error);
      return {
        gpsAccuracy: 'balanced' as const,
        autoPause: true,
        autoRecordPhotos: false,
        waypointRadiusMeters: 25,
        minPointDistanceMeters: 8,
        offTrailAlertsEnabled: true,
        alertThresholdMeters: 50,
        elevationWarningEnabled: false,
        mapStyle: 'topographic' as const,
        contourLines: true,
        hazards: false,
        distanceUnit: 'miles' as const,
        elevationUnit: 'meters' as const,
        temperatureUnit: 'celsius' as const,
        coordinateFormat: 'decimal' as const,
        shareByDefault: false,
        blurHomeLocation: true,
        communityReviews: true,
      };
    }
  }, [db, tick]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const persistValue = useCallback(
    (key: string, value: string) => {
      try {
        setSetting(db, key, value);
        setTick((current) => current + 1);
      } catch {
        Alert.alert('Save failed', 'MyTrails could not persist that preference.');
      }
    },
    [db],
  );

  const persistBool = useCallback(
    (key: string, value: boolean) => {
      persistValue(key, value ? '1' : '0');
    },
    [persistValue],
  );

  const updateAlertToggle = useCallback(
    (enabled: boolean) => {
      try {
        updateAlertSettings(db, {
          vibrationEnabled: enabled,
          soundEnabled: enabled,
        });
        setTick((current) => current + 1);
      } catch {
        Alert.alert('Save failed', 'Alert rules could not be updated.');
      }
    },
    [db],
  );

  const updateAlertThreshold = useCallback(
    (threshold: number) => {
      try {
        updateAlertSettings(db, { deviationThresholdMeters: threshold });
        setTick((current) => current + 1);
      } catch {
        Alert.alert('Save failed', 'The alert threshold could not be updated.');
      }
    },
    [db],
  );

  const clearCache = useCallback(() => {
    Alert.alert('Clear Cache', 'Remove cached weather and offline download state?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          try {
            db.transaction(() => {
              db.execute('DELETE FROM tr_weather_cache');
              db.execute('DELETE FROM tr_offline_regions');
            });
            setTick((current) => current + 1);
          } catch {
            Alert.alert('Clear failed', 'MyTrails could not clear cache right now.');
          }
        },
      },
    ]);
  }, [db]);

  const deleteAllData = useCallback(() => {
    Alert.alert(
      'Delete All Trail Data',
      'This permanently removes trails, recordings, weather cache, offline regions, trips, and reviews.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            try {
              db.transaction(() => {
                for (const table of DELETE_ORDER) {
                  db.execute(`DELETE FROM ${table}`);
                }
              });
              setTick((current) => current + 1);
            } catch {
              Alert.alert('Delete failed', 'MyTrails could not delete all trail data.');
            }
          },
        },
      ],
    );
  }, [db]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={TR_ACCENT} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroRow}>
        <View style={styles.avatarShell}>
          <MaterialSymbol name="hiking" size={20} color={TR_ACCENT_LIGHT} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Recording, maps, units, privacy, and export defaults for every MyTrails session.
          </Text>
        </View>
        <View style={styles.memberChip}>
          <Text style={styles.memberChipCopy}>Pro Member</Text>
        </View>
      </View>

      <SettingsSection title="Recording">
        <SegmentedRow
          label="GPS Accuracy"
          options={RECORDING_ACCURACY}
          value={settings.gpsAccuracy}
          renderLabel={(value) =>
            value === 'power_save'
              ? 'Power Save'
              : value.charAt(0).toUpperCase() + value.slice(1)
          }
          onChange={(value) => persistValue('gps_accuracy', value)}
        />
        <ToggleRow
          label="Auto-pause detection"
          value={settings.autoPause}
          onValueChange={(value) => persistBool('auto_pause', value)}
        />
        <ToggleRow
          label="Auto-record photos"
          value={settings.autoRecordPhotos}
          onValueChange={(value) => persistBool('auto_record_photos', value)}
        />
        <StepperRow
          label="Waypoint radius"
          value={`${settings.waypointRadiusMeters} m`}
          onDecrease={() =>
            persistValue(
              'waypoint_radius_meters',
              String(Math.max(10, settings.waypointRadiusMeters - 5)),
            )
          }
          onIncrease={() =>
            persistValue(
              'waypoint_radius_meters',
              String(Math.min(100, settings.waypointRadiusMeters + 5)),
            )
          }
        />
        <StepperRow
          label="Minimum point spacing"
          value={`${settings.minPointDistanceMeters} m`}
          onDecrease={() =>
            persistValue(
              'min_point_distance_meters',
              String(Math.max(2, settings.minPointDistanceMeters - 2)),
            )
          }
          onIncrease={() =>
            persistValue(
              'min_point_distance_meters',
              String(Math.min(30, settings.minPointDistanceMeters + 2)),
            )
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Alerts"
        actionLabel="Detail"
        onActionPress={() => router.push('/(trails)/alert-settings')}
      >
        <ToggleRow
          label="Off-trail alert"
          value={settings.offTrailAlertsEnabled}
          onValueChange={updateAlertToggle}
        />
        <SegmentedRow
          label="Distance threshold"
          options={ALERT_THRESHOLDS}
          value={settings.alertThresholdMeters as (typeof ALERT_THRESHOLDS)[number]}
          renderLabel={(value) => `${value}m`}
          onChange={(value) => updateAlertThreshold(Number(value))}
        />
        <ToggleRow
          label="Elevation warning"
          value={settings.elevationWarningEnabled}
          onValueChange={(value) => persistBool('alerts_elevation_warning', value)}
        />
      </SettingsSection>

      <SettingsSection
        title="Maps"
        actionLabel="Offline"
        onActionPress={() => router.push('/(trails)/offline-regions')}
      >
        <SegmentedRow
          label="Default map style"
          options={MAP_STYLES}
          value={settings.mapStyle}
          renderLabel={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          onChange={(value) => persistValue('default_map_style', value)}
        />
        <ToggleRow
          label="Show contour lines"
          value={settings.contourLines}
          onValueChange={(value) => persistBool('map_contour_lines', value)}
        />
        <ToggleRow
          label="Show hazards"
          value={settings.hazards}
          onValueChange={(value) => persistBool('map_hazards', value)}
        />
        <NavigationRow
          label="Offline regions"
          value="Manage downloads"
          onPress={() => router.push('/(trails)/offline-regions')}
        />
      </SettingsSection>

      <SettingsSection title="Units">
        <SegmentedRow
          label="Distance"
          options={DISTANCE_UNITS}
          value={settings.distanceUnit}
          renderLabel={(value) => value === 'miles' ? 'Miles' : 'Kilometers'}
          onChange={(value) => persistValue('distance_unit', value)}
        />
        <SegmentedRow
          label="Elevation"
          options={ELEVATION_UNITS}
          value={settings.elevationUnit}
          renderLabel={(value) => value === 'feet' ? 'Feet' : 'Meters'}
          onChange={(value) => persistValue('elevation_unit', value)}
        />
        <SegmentedRow
          label="Temperature"
          options={TEMPERATURE_UNITS}
          value={settings.temperatureUnit}
          renderLabel={(value) => value === 'fahrenheit' ? 'Fahrenheit' : 'Celsius'}
          onChange={(value) => persistValue('temperature_unit', value)}
        />
        <SegmentedRow
          label="Coordinates"
          options={COORDINATE_FORMATS}
          value={settings.coordinateFormat}
          renderLabel={(value) => value === 'decimal' ? 'Decimal' : 'DMS'}
          onChange={(value) => persistValue('coordinate_format', value)}
        />
      </SettingsSection>

      <SettingsSection title="Privacy">
        <ToggleRow
          label="Share recordings by default"
          value={settings.shareByDefault}
          onValueChange={(value) => persistBool('share_recordings_default', value)}
        />
        <ToggleRow
          label="Blur exact home location"
          value={settings.blurHomeLocation}
          onValueChange={(value) => persistBool('blur_home_location', value)}
        />
        <ToggleRow
          label="Allow community reviews"
          value={settings.communityReviews}
          onValueChange={(value) => persistBool('allow_community_reviews', value)}
        />
      </SettingsSection>

      <SettingsSection title="Data">
        <NavigationRow
          label="Export recordings"
          value="Open export"
          onPress={() => router.push('/(trails)/export')}
        />
        <NavigationRow
          label="Import GPX files"
          value="Coming soon"
          onPress={() => Alert.alert('Import GPX', 'GPX import wiring lands in a later phase.')}
        />
        <NavigationRow
          label="Clear cache"
          value="Weather + offline"
          onPress={clearCache}
          destructive
        />
        <NavigationRow
          label="Delete all data"
          value="Permanent"
          onPress={deleteAllData}
          destructive
        />
      </SettingsSection>

      <SettingsSection title="About">
        <StaticRow label="App version" value={TRAILS_MODULE.version} />
        <StaticRow label="Trail database version" value={`Schema v${TRAILS_MODULE.schemaVersion}`} />
        <NavigationRow
          label="Attribution"
          value="OSM + trail providers"
          onPress={() => Alert.alert('Attribution', 'Trail geometry and map data depend on OSM and regional providers.')}
        />
        <NavigationRow
          label="Help"
          value="Support"
          onPress={() => Alert.alert('Help', 'Support entry point is handled from the MyLife hub.')}
        />
      </SettingsSection>
    </ScrollView>
  );
}

function SettingsSection({
  title,
  actionLabel,
  onActionPress,
  children,
}: {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        action={actionLabel && onActionPress ? { label: actionLabel, onPress: onActionPress } : undefined}
      />
      <GlassCard style={styles.sectionCard}>{children}</GlassCard>
    </View>
  );
}

function SegmentedRow<T extends string | number>({
  label,
  options,
  value,
  renderLabel,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  renderLabel: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.rowBlock}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.segmentedWrap}>
        {options.map((option) => (
          <Pressable
            key={String(option)}
            onPress={() => onChange(option)}
            style={[
              styles.segmentButton,
              option === value ? styles.segmentButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.segmentCopy,
                { color: option === value ? '#102108' : TR_TEXT_SECONDARY },
              ]}
            >
              {renderLabel(option)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.inlineRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: withAlpha('#FFFFFF', 0.12), true: withAlpha(TR_ACCENT_LIGHT, 0.45) }}
        thumbColor={value ? TR_ACCENT_LIGHT : '#8B8B96'}
      />
    </View>
  );
}

function StepperRow({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.inlineRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepperShell}>
        <Pressable onPress={onDecrease} style={styles.stepperButton}>
          <Text style={styles.stepperCopy}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={onIncrease} style={styles.stepperButton}>
          <Text style={styles.stepperCopy}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavigationRow({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.inlineRow}>
      <Text style={[styles.rowLabel, destructive ? styles.destructiveCopy : null]}>{label}</Text>
      <View style={styles.navValue}>
        <Text style={[styles.rowValue, destructive ? styles.destructiveCopy : null]}>{value}</Text>
        <MaterialSymbol
          name="more_vert"
          size={16}
          color={destructive ? '#FFB4AB' : TR_TEXT_TERTIARY}
        />
      </View>
    </Pressable>
  );
}

function StaticRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.inlineRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function readBool(value: string | null, fallback = false): boolean {
  if (value == null) {
    return fallback;
  }

  return value === '1' || value === 'true';
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
    gap: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarShell: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.12),
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...TR_TYPOGRAPHY.displayLg,
    color: TR_TEXT,
    fontSize: 32,
  },
  subtitle: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    maxWidth: 300,
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.12),
  },
  memberChipCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  section: {
    gap: 10,
  },
  sectionCard: {
    gap: 14,
  },
  rowBlock: {
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT,
    flex: 1,
  },
  rowValue: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  segmentedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: TR_SURFACES.high,
  },
  segmentButtonActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  segmentCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
  },
  stepperShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TR_SURFACES.high,
  },
  stepperButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.14),
  },
  stepperCopy: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_ACCENT_LIGHT,
  },
  stepperValue: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT,
    minWidth: 44,
    textAlign: 'center',
  },
  navValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destructiveCopy: {
    color: '#FFB4AB',
  },
});
