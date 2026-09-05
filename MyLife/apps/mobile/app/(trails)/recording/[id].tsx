import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  DifficultyChip,
  ElevationMiniChart,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  calculateDifficulty,
  deleteRecording,
  exportRecordingAsGPX,
  getCachedWeather,
  getPhotosByRecording,
  getRecording,
  getSegmentEffortsByRecording,
  getSegmentsByTrail,
  getTrail,
  getWaypointsByRecording,
  updateRecording,
} from '@mylife/trails';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  buildElevationSamples,
  createTrackSummary,
  expandBounds,
  formatDistanceLabel,
  formatDurationClock,
  formatElevationLabel,
  formatPaceLabel,
  getGeoBounds,
  projectCoordinate,
  projectTrackPoints,
} from '../phase4-utils';

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 360;

type WeatherSnapshot = {
  label: string;
  startTemperature?: number;
  endTemperature?: number;
  windSpeed?: number;
  precipitation?: number;
};

export default function RecordingDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const recording = useMemo(() => (id ? getRecording(db, id) : null), [db, id, refreshKey]);
  const waypoints = useMemo(() => (id ? getWaypointsByRecording(db, id) : []), [db, id, refreshKey]);
  const photos = useMemo(() => (id ? getPhotosByRecording(db, id) : []), [db, id, refreshKey]);
  const trail = useMemo(
    () => (recording?.trailId ? getTrail(db, recording.trailId) : null),
    [db, recording?.trailId, refreshKey],
  );
  const segmentEfforts = useMemo(
    () => (id ? getSegmentEffortsByRecording(db, id) : []),
    [db, id, refreshKey],
  );
  const segmentsById = useMemo(() => {
    const entries = trail?.id ? getSegmentsByTrail(db, trail.id) : [];
    return new Map(entries.map((entry) => [entry.id, entry]));
  }, [db, trail?.id, refreshKey]);

  const [draftName, setDraftName] = useState(recording?.name ?? '');
  const [draftNotes, setDraftNotes] = useState(recording?.notes ?? '');
  const [draftPrivate, setDraftPrivate] = useState(recording?.isPrivate ?? false);
  const [draftRating, setDraftRating] = useState(recording?.activityRating ?? 4);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const summary = useMemo(() => {
    if (!recording) {
      return createTrackSummary([], 0);
    }

    if (waypoints.length === 0) {
      return {
        distanceMeters: recording.distanceMeters,
        elevationGainMeters: recording.elevationGainMeters,
        elevationLossMeters: 0,
        startElevationMeters: 0,
        maxElevationMeters: 0,
        endElevationMeters: 0,
        calories: 0,
        paceMinPerKm: recording.distanceMeters > 0
          ? recording.durationSeconds / 60 / (recording.distanceMeters / 1000)
          : null,
        maxGradePercent: 0,
      };
    }

    return createTrackSummary(waypoints, recording.durationSeconds);
  }, [recording, waypoints]);

  const difficulty = useMemo(
    () => calculateDifficulty(
      summary.distanceMeters,
      summary.elevationGainMeters,
      summary.maxGradePercent || null,
    ),
    [summary.distanceMeters, summary.elevationGainMeters, summary.maxGradePercent],
  );

  const mapBounds = useMemo(
    () => expandBounds(getGeoBounds([
      ...waypoints,
      ...photos.map((photo) => ({ lat: photo.lat, lng: photo.lng })),
    ])),
    [photos, waypoints],
  );
  const routeMapPoints = useMemo(
    () => projectTrackPoints(waypoints, MAP_WIDTH, MAP_HEIGHT, 26, mapBounds),
    [mapBounds, waypoints],
  );
  const routePolyline = routeMapPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const startMapPoint = routeMapPoints[0];
  const endMapPoint = routeMapPoints.at(-1);
  const elevationSamples = useMemo(() => buildElevationSamples(waypoints), [waypoints]);

  const weather = useMemo<WeatherSnapshot | null>(() => {
    if (waypoints.length === 0) {
      return null;
    }

    try {
      const startCache = getCachedWeather(db, waypoints[0].lat, waypoints[0].lng);
      const endCache = getCachedWeather(db, waypoints.at(-1)!.lat, waypoints.at(-1)!.lng);
      const startPayload = startCache ? JSON.parse(startCache.conditionsJson) : null;
      const endPayload = endCache ? JSON.parse(endCache.conditionsJson) : null;

      if (!startPayload && !endPayload) {
        return null;
      }

      return {
        label: 'Cached trail weather',
        startTemperature: startPayload?.current?.temperature,
        endTemperature: endPayload?.current?.temperature,
        windSpeed: endPayload?.current?.windSpeed ?? startPayload?.current?.windSpeed,
        precipitation: endPayload?.current?.precipitationProbability ?? startPayload?.current?.precipitationProbability,
      };
    } catch {
      return null;
    }
  }, [db, waypoints]);

  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? null;

  if (!recording) {
    return (
      <View style={styles.emptyState}>
        <RNText style={styles.emptyEmoji}>🥾</RNText>
        <RNText style={styles.emptyTitle}>Recording not found</RNText>
        <RNText style={styles.emptyCopy}>This trail session may have been deleted or moved.</RNText>
      </View>
    );
  }

  const handleExport = async () => {
    try {
      const gpx = exportRecordingAsGPX(db, recording.id);
      if (!gpx) {
        Alert.alert('Export unavailable', 'MyTrails could not generate a GPX file for this recording.');
        return;
      }

      const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!targetDir) {
        throw new Error('cache directory unavailable');
      }
      const uri = `${targetDir}${recording.id}.gpx`;
      await FileSystem.writeAsStringAsync(uri, gpx, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/gpx+xml',
        dialogTitle: 'Share trail GPX',
      });
    } catch {
      Alert.alert('Export failed', 'MyTrails could not share this GPX file.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete recording?',
      'This permanently removes the route, waypoints, and attached photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRecording(db, recording.id);
            router.replace('/(trails)/(tabs)/recordings');
          },
        },
      ],
    );
  };

  const handleSaveEdits = () => {
    updateRecording(db, recording.id, {
      name: draftName.trim() || recording.name,
      notes: draftNotes.trim() || null,
      isPrivate: draftPrivate,
      activityRating: draftRating,
    });
    setShowEditSheet(false);
    refresh();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
            <Defs>
              <SvgGradient id="detailBg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#11151B" />
                <Stop offset="100%" stopColor="#090A0E" />
              </SvgGradient>
              <SvgGradient id="detailRoute" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={TR_ACCENT_LIGHT} />
                <Stop offset="100%" stopColor={TR_ACCENT} />
              </SvgGradient>
            </Defs>

            <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#detailBg)" />
            <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="rgba(255,255,255,0.02)" />
            {routePolyline ? (
              <Polyline
                points={routePolyline}
                fill="none"
                stroke="url(#detailRoute)"
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {startMapPoint ? (
              <Circle cx={startMapPoint.x} cy={startMapPoint.y} r={10} fill="#FFFFFF" opacity={0.85} />
            ) : null}
            {endMapPoint ? (
              <Circle cx={endMapPoint.x} cy={endMapPoint.y} r={8} fill={TR_ACCENT_LIGHT} />
            ) : null}
            {photos.map((photo) => {
              const projected = projectCoordinate(photo, mapBounds, MAP_WIDTH, MAP_HEIGHT, 26);
              return (
                <Rect
                  key={photo.id}
                  x={projected.x - 5}
                  y={projected.y - 5}
                  width={10}
                  height={10}
                  rx={3}
                  fill="#8BCFF0"
                />
              );
            })}
          </Svg>

          <LinearGradient
            colors={['rgba(12,13,17,0.1)', 'rgba(12,13,17,0.88)']}
            start={{ x: 0.5, y: 0.05 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.heroHeader}>
            <Pressable onPress={() => router.back()} style={styles.heroAction}>
              <MaterialSymbol name="arrow_back" size={20} color={TR_TEXT} />
            </Pressable>
            <View style={styles.heroActionsRight}>
              <Pressable onPress={handleExport} style={styles.heroActionText}>
                <RNText style={styles.heroActionLabel}>Export</RNText>
              </Pressable>
              <Pressable onPress={() => setShowEditSheet(true)} style={styles.heroActionText}>
                <RNText style={styles.heroActionLabel}>Edit</RNText>
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.heroActionText}>
                <RNText style={[styles.heroActionLabel, { color: '#FFB4AB' }]}>Delete</RNText>
              </Pressable>
            </View>
          </View>
        </View>

        <GlassCard padding={20} style={styles.titleCard}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 8 }}>
              <RNText style={styles.recordingName}>{recording.name}</RNText>
              <RNText style={styles.recordingMeta}>
                {trail?.name ?? 'Trail recording'} · {new Date(recording.startedAt).toLocaleDateString()}
              </RNText>
            </View>
            <DifficultyChip level={difficulty} />
          </View>
          <View style={styles.tagRow}>
            <Tag label={recording.activityType.toUpperCase()} accent={TR_ACCENT_LIGHT} />
            {recording.isPrivate ? <Tag label="PRIVATE" accent="#FFB877" /> : null}
            {recording.activityRating ? <Tag label={`${recording.activityRating}/5`} accent="#8BCFF0" /> : null}
          </View>
        </GlassCard>

        <View style={styles.statsGrid}>
          <MetricCard label="Distance" value={formatDistanceLabel(summary.distanceMeters)} accent={TR_ACCENT_LIGHT} />
          <MetricCard label="Duration" value={formatDurationClock(recording.durationSeconds)} accent={TR_TEXT} />
          <MetricCard label="Elevation" value={formatElevationLabel(summary.elevationGainMeters)} accent={TR_TEXT} />
          <MetricCard label="Max Elev" value={formatElevationLabel(summary.maxElevationMeters)} accent={TR_TEXT} />
          <MetricCard label="Avg Pace" value={`${formatPaceLabel(summary.paceMinPerKm)} /km`} accent={TR_TEXT} />
          <MetricCard label="Calories" value={`${summary.calories} kcal`} accent={TR_TEXT} />
        </View>

        <GlassCard padding={18} style={styles.sectionCard}>
          <SectionHeader
            title="Elevation Profile"
            action={{
              label: 'Open Full View',
              onPress: () => {
                router.push({
                  pathname: '/(trails)/elevation-profile',
                  params: { recordingId: recording.id, trailId: recording.trailId ?? '' },
                });
              },
            }}
          />
          <View style={{ marginTop: 14 }}>
            <ElevationMiniChart points={elevationSamples.map((sample) => ({
              distance: sample.cumulativeDistanceMeters,
              elevation: sample.elevationMeters,
            }))} height={120} />
          </View>
        </GlassCard>

        {photos.length > 0 ? (
          <GlassCard padding={18} style={styles.sectionCard}>
            <SectionHeader title="Photos" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRail}
              style={{ marginTop: 14 }}
            >
              {photos.map((photo) => (
                <Pressable key={photo.id} onPress={() => setSelectedPhotoId(photo.id)}>
                  <Image source={{ uri: photo.uri }} style={styles.photoRailImage} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </GlassCard>
        ) : null}

        <GlassCard padding={18} style={styles.sectionCard}>
          <SectionHeader title="Waypoints" />
          <View style={styles.listStack}>
            {waypoints.length === 0 ? (
              <EmptyCopy text="This recording does not have persisted waypoints yet." />
            ) : (
              waypoints.slice(0, 8).map((waypoint, index) => (
                <View key={waypoint.id} style={styles.listRow}>
                  <View style={styles.listIndex}>
                    <RNText style={styles.listIndexText}>{index + 1}</RNText>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <RNText style={styles.listTitle}>
                      {index === 0 ? 'Trailhead' : index === waypoints.length - 1 ? 'Finish' : waypoint.accuracy === 0 ? 'Manual marker' : `Track point ${index + 1}`}
                    </RNText>
                    <RNText style={styles.listCopy}>
                      {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)} · {new Date(waypoint.timestamp).toLocaleTimeString()}
                    </RNText>
                  </View>
                  <Pressable onPress={() => router.push(`/(trails)/waypoint/${waypoint.id}` as `/${string}`)}>
                    <RNText style={styles.inlineLink}>View</RNText>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.sectionCard}>
          <SectionHeader title="Notes" action={{ label: 'Edit', onPress: () => setShowEditSheet(true) }} />
          <RNText style={styles.notesCopy}>
            {recording.notes?.trim() || 'No notes saved for this session yet.'}
          </RNText>
        </GlassCard>

        <GlassCard padding={18} style={styles.sectionCard}>
          <SectionHeader title="Weather" />
          {weather ? (
            <View style={styles.weatherGrid}>
              <WeatherCard label="Start Temp" value={weather.startTemperature != null ? `${Math.round(weather.startTemperature)}°` : '--'} />
              <WeatherCard label="End Temp" value={weather.endTemperature != null ? `${Math.round(weather.endTemperature)}°` : '--'} />
              <WeatherCard label="Wind" value={weather.windSpeed != null ? `${Math.round(weather.windSpeed)} km/h` : '--'} />
              <WeatherCard label="Precip" value={weather.precipitation != null ? `${Math.round(weather.precipitation)}%` : '--'} />
            </View>
          ) : (
            <EmptyCopy text="Weather cache was not available for this route." />
          )}
        </GlassCard>

        {segmentEfforts.length > 0 ? (
          <GlassCard padding={18} style={styles.sectionCard}>
            <SectionHeader title="Segments Achieved" />
            <View style={styles.listStack}>
              {segmentEfforts.map((effort) => (
                <View key={effort.id} style={styles.listRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <RNText style={styles.listTitle}>
                      {segmentsById.get(effort.segmentId)?.name ?? 'Matched segment'}
                    </RNText>
                    <RNText style={styles.listCopy}>
                      {formatDurationClock(effort.durationSeconds)} · {effort.paceMinPerKm != null ? `${formatPaceLabel(effort.paceMinPerKm)} /km` : 'Pace unavailable'}
                    </RNText>
                  </View>
                  {effort.isPersonalBest ? <Tag label="PR" accent={TR_ACCENT_LIGHT} compact /> : null}
                </View>
              ))}
            </View>
          </GlassCard>
        ) : null}
      </ScrollView>

      <EditRecordingSheet
        visible={showEditSheet}
        draftName={draftName}
        draftNotes={draftNotes}
        draftPrivate={draftPrivate}
        draftRating={draftRating}
        onChangeName={setDraftName}
        onChangeNotes={setDraftNotes}
        onChangePrivate={setDraftPrivate}
        onChangeRating={setDraftRating}
        onClose={() => setShowEditSheet(false)}
        onSave={handleSaveEdits}
      />

      <PhotoLightbox
        photo={selectedPhoto}
        onClose={() => setSelectedPhotoId(null)}
        projectedPoint={selectedPhoto ? projectCoordinate(selectedPhoto, mapBounds, 320, 220, 20) : null}
        routePolyline={routeMapPoints.map((point) => `${(point.x / MAP_WIDTH) * 320},${(point.y / MAP_HEIGHT) * 220}`).join(' ')}
      />
    </View>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <GlassCard padding={14} style={styles.metricCard}>
      <RNText style={styles.metricLabel}>{label}</RNText>
      <RNText style={[styles.metricValue, { color: accent }]}>{value}</RNText>
    </GlassCard>
  );
}

function WeatherCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard padding={14} style={styles.weatherCard}>
      <RNText style={styles.metricLabel}>{label}</RNText>
      <RNText style={styles.weatherValue}>{value}</RNText>
    </GlassCard>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <RNText style={styles.emptyInlineCopy}>{text}</RNText>;
}

function Tag({
  label,
  accent,
  compact,
}: {
  label: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: `${accent}22`,
          paddingHorizontal: compact ? 10 : 12,
          paddingVertical: compact ? 6 : 7,
        },
      ]}
    >
      <RNText style={[styles.tagText, { color: accent }]}>{label}</RNText>
    </View>
  );
}

function EditRecordingSheet({
  visible,
  draftName,
  draftNotes,
  draftPrivate,
  draftRating,
  onChangeName,
  onChangeNotes,
  onChangePrivate,
  onChangeRating,
  onClose,
  onSave,
}: {
  visible: boolean;
  draftName: string;
  draftNotes: string;
  draftPrivate: boolean;
  draftRating: number;
  onChangeName: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onChangePrivate: (value: boolean) => void;
  onChangeRating: (value: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="pageSheet">
      <View style={styles.sheetScrim}>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <View>
              <RNText style={styles.sheetEyebrow}>Edit Recording</RNText>
              <RNText style={styles.sheetTitle}>Update trail details</RNText>
            </View>
            <Pressable onPress={onClose} style={styles.sheetIconButton}>
              <MaterialSymbol name="arrow_back" size={18} color={TR_TEXT_TERTIARY} />
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <RNText style={styles.fieldLabel}>Recording name</RNText>
            <TextInput
              style={styles.textInput}
              value={draftName}
              onChangeText={onChangeName}
              placeholder="Sunrise ridge loop"
              placeholderTextColor={TR_TEXT_TERTIARY}
            />
          </View>

          <View style={styles.fieldGroup}>
            <RNText style={styles.fieldLabel}>Notes</RNText>
            <TextInput
              multiline
              textAlignVertical="top"
              style={[styles.textInput, styles.notesInput]}
              value={draftNotes}
              onChangeText={onChangeNotes}
              placeholder="Trail conditions and highlights"
              placeholderTextColor={TR_TEXT_TERTIARY}
            />
          </View>

          <View style={styles.sheetToggleRow}>
            <View style={{ flex: 1 }}>
              <RNText style={styles.fieldLabel}>Private recording</RNText>
              <RNText style={styles.sheetHint}>Keep this recording out of share flows.</RNText>
            </View>
            <Switch
              value={draftPrivate}
              onValueChange={onChangePrivate}
              thumbColor={draftPrivate ? TR_ACCENT_LIGHT : '#E9E9ED'}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(132,204,22,0.34)' }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <RNText style={styles.fieldLabel}>Quick rating</RNText>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => onChangeRating(value)}
                  style={[styles.ratingPill, draftRating === value ? styles.ratingPillActive : null]}
                >
                  <MaterialSymbol
                    name="star"
                    size={16}
                    color={draftRating >= value ? '#FFB877' : TR_TEXT_TERTIARY}
                    filled={draftRating >= value}
                  />
                  <RNText style={styles.ratingLabel}>{value}</RNText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={styles.sheetGhostButton}>
              <RNText style={styles.sheetGhostText}>Cancel</RNText>
            </Pressable>
            <Pressable onPress={onSave} style={styles.sheetSaveButton}>
              <LinearGradient
                colors={['#84CC16', '#65A30D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetSaveGradient}
              >
                <RNText style={styles.sheetSaveText}>Save Changes</RNText>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PhotoLightbox({
  photo,
  projectedPoint,
  routePolyline,
  onClose,
}: {
  photo: { id: string; uri: string; takenAt: string; lat: number; lng: number } | null;
  projectedPoint: { x: number; y: number } | null;
  routePolyline: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={photo != null} transparent animationType="fade">
      <View style={styles.lightboxScrim}>
        <View style={styles.lightboxCard}>
          <View style={styles.lightboxHeader}>
            <RNText style={styles.lightboxTitle}>Photo waypoint</RNText>
            <Pressable onPress={onClose} style={styles.sheetIconButton}>
              <MaterialSymbol name="arrow_back" size={18} color={TR_TEXT_TERTIARY} />
            </Pressable>
          </View>
          {photo ? (
            <>
              <Image source={{ uri: photo.uri }} style={styles.lightboxImage} contentFit="cover" />
              <RNText style={styles.lightboxCopy}>{new Date(photo.takenAt).toLocaleString()}</RNText>
              <View style={styles.lightboxMap}>
                <Svg width="100%" height="100%" viewBox="0 0 320 220">
                  <Rect x={0} y={0} width={320} height={220} fill={TR_SURFACES.low} />
                  {routePolyline ? (
                    <Polyline
                      points={routePolyline}
                      fill="none"
                      stroke={TR_ACCENT_LIGHT}
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.75}
                    />
                  ) : null}
                  {projectedPoint ? (
                    <>
                      <Circle cx={projectedPoint.x} cy={projectedPoint.y} r={14} fill="rgba(139,207,240,0.18)" />
                      <Circle cx={projectedPoint.x} cy={projectedPoint.y} r={5} fill="#8BCFF0" />
                    </>
                  ) : null}
                </Svg>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: 18,
  },
  heroWrap: {
    height: 320,
  },
  heroHeader: {
    position: 'absolute',
    top: 58,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,16,20,0.54)',
  },
  heroActionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  heroActionText: {
    borderRadius: 999,
    backgroundColor: 'rgba(15,16,20,0.54)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroActionLabel: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 13,
    color: TR_TEXT,
  },
  titleCard: {
    marginHorizontal: 18,
    marginTop: -46,
    backgroundColor: 'rgba(29,29,34,0.88)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordingName: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 30,
    color: TR_TEXT,
  },
  recordingMeta: {
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
    color: TR_TEXT_SECONDARY,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    borderRadius: 999,
  },
  tagText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 18,
  },
  metricCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: TR_TEXT_TERTIARY,
    marginBottom: 6,
  },
  metricValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 24,
  },
  sectionCard: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  photoRail: {
    gap: 10,
  },
  photoRailImage: {
    width: 112,
    height: 112,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  listStack: {
    gap: 10,
    marginTop: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(132,204,22,0.16)',
  },
  listIndexText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 12,
    color: TR_ACCENT_LIGHT,
  },
  listTitle: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 15,
    color: TR_TEXT,
  },
  listCopy: {
    fontFamily: TR_FONTS.medium,
    fontSize: 12,
    color: TR_TEXT_SECONDARY,
  },
  inlineLink: {
    fontFamily: TR_FONTS.bold,
    fontSize: 12,
    color: TR_ACCENT_LIGHT,
  },
  notesCopy: {
    marginTop: 12,
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
    lineHeight: 22,
    color: TR_TEXT_SECONDARY,
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  weatherCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  weatherValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 22,
    color: TR_TEXT,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TR_SURFACES.lowest,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 24,
    color: TR_TEXT,
  },
  emptyCopy: {
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  emptyInlineCopy: {
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
    color: TR_TEXT_TERTIARY,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.46)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: TR_SURFACES.base,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
    gap: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sheetEyebrow: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: TR_ACCENT_LIGHT,
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 28,
    color: TR_TEXT,
  },
  sheetIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 12,
    color: TR_TEXT_SECONDARY,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  textInput: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TR_TEXT,
    fontFamily: TR_FONTS.medium,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 120,
  },
  sheetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetHint: {
    fontFamily: TR_FONTS.medium,
    fontSize: 13,
    color: TR_TEXT_TERTIARY,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ratingPillActive: {
    backgroundColor: 'rgba(255,184,119,0.12)',
  },
  ratingLabel: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 13,
    color: TR_TEXT,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sheetGhostButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  sheetGhostText: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 15,
    color: TR_TEXT_SECONDARY,
  },
  sheetSaveButton: {
    flex: 1.2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sheetSaveGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  sheetSaveText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 15,
    color: '#112006',
  },
  lightboxScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  lightboxCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(20,20,26,0.96)',
    padding: 18,
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lightboxTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 24,
    color: TR_TEXT,
  },
  lightboxImage: {
    width: '100%',
    height: 260,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  lightboxCopy: {
    fontFamily: TR_FONTS.medium,
    fontSize: 13,
    color: TR_TEXT_SECONDARY,
    marginTop: 10,
  },
  lightboxMap: {
    height: 220,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 14,
  },
});
