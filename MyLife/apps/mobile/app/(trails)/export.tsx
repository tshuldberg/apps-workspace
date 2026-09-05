import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getPackingTemplates,
  getPhotos,
  getRecordings,
  getReviewsByTrail,
  getSegmentsByTrail,
  getTrails,
  getTrips,
  getWaypointsByRecording,
  MaterialSymbol,
  type PackingTemplate,
  type Segment,
  type Trail,
  type TrailPhoto,
  type TrailRecording,
  type TrailReview,
  type Trip,
  type Waypoint,
} from '@mylife/trails';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  TrailsChip,
  TrailsEmptyState,
  TrailsGlassCard,
  TrailsHero,
  TrailsPrimaryButton,
  TrailsScreen,
} from './_ui';

const EXPORT_FORMATS = ['gpx', 'csv', 'json', 'kml'] as const;
const RANGE_PRESETS = ['7d', '30d', '90d', 'year', 'all', 'custom'] as const;
const INCLUDE_KEYS = ['recordings', 'waypoints', 'photos', 'trails', 'segments', 'reviews', 'packing', 'trips'] as const;

type ExportFormat = (typeof EXPORT_FORMATS)[number];
type RangePreset = (typeof RANGE_PRESETS)[number];
type IncludeKey = (typeof INCLUDE_KEYS)[number];

interface ExportBundle {
  recordings: TrailRecording[];
  waypoints: Waypoint[];
  photos: Array<Pick<TrailPhoto, 'id' | 'recordingId' | 'trailId' | 'lat' | 'lng' | 'caption' | 'takenAt'> & {
    uri?: string;
  }>;
  trails: Trail[];
  segments: Segment[];
  reviews: TrailReview[];
  packingTemplates: PackingTemplate[];
  trips: Trip[];
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  gpx: 'GPX',
  csv: 'CSV',
  json: 'JSON',
  kml: 'KML',
};

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  gpx: 'Best for GPS devices and map imports.',
  csv: 'Best for spreadsheets and ad hoc analysis.',
  json: 'Best for complete structured backups.',
  kml: 'Best for Google Earth and map overlays.',
};

const INCLUDE_LABELS: Record<IncludeKey, string> = {
  recordings: 'Recordings',
  waypoints: 'Waypoints',
  photos: 'Photos',
  trails: 'Trails',
  segments: 'Segments',
  reviews: 'Reviews',
  packing: 'Packing templates',
  trips: 'Trips',
};

function normalizeDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPresetLabel(preset: RangePreset): string {
  switch (preset) {
    case '7d':
      return 'Last 7';
    case '30d':
      return 'Last 30';
    case '90d':
      return 'Last 90';
    case 'year':
      return 'This year';
    case 'all':
      return 'All time';
    case 'custom':
      return 'Custom';
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
}

function buildDateRange(preset: RangePreset, customStart: string, customEnd: string) {
  const now = new Date();
  const end = customEnd ? normalizeDate(customEnd) ?? now : now;

  if (preset === 'all') {
    return { start: null as Date | null, end, label: 'All time' };
  }

  if (preset === 'custom') {
    return {
      start: normalizeDate(customStart),
      end,
      label: customStart && customEnd ? `${customStart} to ${customEnd}` : 'Custom range',
    };
  }

  const start = new Date(now);
  if (preset === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end, label: 'This year' };
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  start.setDate(now.getDate() - days);
  return { start, end, label: `Last ${days} days` };
}

function isWithinRange(value: string | null | undefined, start: Date | null, end: Date | null) {
  const date = normalizeDate(value);
  if (!date) {
    return false;
  }
  if (start && date < start) {
    return false;
  }
  if (end && date > end) {
    return false;
  }
  return true;
}

function estimateFileSize(content: string): string {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes > 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function buildGpx(bundle: ExportBundle): string {
  const waypointsByRecording = new Map<string, Waypoint[]>();
  bundle.waypoints.forEach((point) => {
    const existing = waypointsByRecording.get(point.recordingId);
    if (existing) {
      existing.push(point);
    } else {
      waypointsByRecording.set(point.recordingId, [point]);
    }
  });

  const trackBlocks = bundle.recordings.map((recording) => {
    const points = waypointsByRecording.get(recording.id) ?? [];
    const trackPoints = points.map((point) => {
      const elevationTag = point.elevation !== null ? `<ele>${point.elevation.toFixed(2)}</ele>` : '';
      return `      <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lng.toFixed(6)}">${elevationTag}<time>${point.timestamp}</time></trkpt>`;
    }).join('\n');

    return [
      '  <trk>',
      `    <name>${escapeXml(recording.name)}</name>`,
      `    <type>${escapeXml(recording.activityType)}</type>`,
      '    <trkseg>',
      trackPoints,
      '    </trkseg>',
      '  </trk>',
    ].join('\n');
  }).join('\n');

  const trailWaypoints = bundle.trails.map((trail) => (
    `  <wpt lat="${trail.lat.toFixed(6)}" lon="${trail.lng.toFixed(6)}"><name>${escapeXml(trail.name)}</name></wpt>`
  )).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="MyTrails" xmlns="http://www.topografix.com/GPX/1/1">',
    trailWaypoints,
    trackBlocks,
    '</gpx>',
  ].filter(Boolean).join('\n');
}

function buildKml(bundle: ExportBundle): string {
  const tracks = bundle.recordings.map((recording) => {
    const coordinates = bundle.waypoints
      .filter((point) => point.recordingId === recording.id)
      .map((point) => `${point.lng},${point.lat},${point.elevation ?? 0}`)
      .join(' ');

    return [
      '    <Placemark>',
      `      <name>${escapeXml(recording.name)}</name>`,
      '      <LineString>',
      '        <tessellate>1</tessellate>',
      `        <coordinates>${coordinates}</coordinates>`,
      '      </LineString>',
      '    </Placemark>',
    ].join('\n');
  }).join('\n');

  const photoPoints = bundle.photos.map((photo) => [
    '    <Placemark>',
    `      <name>${escapeXml(photo.caption ?? 'Trail photo')}</name>`,
    '      <Point>',
    `        <coordinates>${photo.lng},${photo.lat},0</coordinates>`,
    '      </Point>',
    '    </Placemark>',
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    tracks,
    photoPoints,
    '  </Document>',
    '</kml>',
  ].filter(Boolean).join('\n');
}

function buildCsv(bundle: ExportBundle): string {
  const sections: string[] = [];

  const pushSection = (title: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) {
      return;
    }

    const keys = Object.keys(rows[0] ?? {});
    sections.push(title);
    sections.push(keys.join(','));
    rows.forEach((row) => {
      sections.push(keys.map((key) => escapeCsv(row[key])).join(','));
    });
    sections.push('');
  };

  pushSection('[recordings]', bundle.recordings.map((recording) => ({
    id: recording.id,
    name: recording.name,
    activityType: recording.activityType,
    startedAt: recording.startedAt,
    distanceMeters: recording.distanceMeters,
    elevationGainMeters: recording.elevationGainMeters,
    durationSeconds: recording.durationSeconds,
  })));
  pushSection('[waypoints]', bundle.waypoints.map((point) => ({
    id: point.id,
    recordingId: point.recordingId,
    lat: point.lat,
    lng: point.lng,
    elevation: point.elevation,
    timestamp: point.timestamp,
  })));
  pushSection('[photos]', bundle.photos.map((photo) => ({
    id: photo.id,
    recordingId: photo.recordingId,
    trailId: photo.trailId,
    lat: photo.lat,
    lng: photo.lng,
    caption: photo.caption,
    takenAt: photo.takenAt,
    uri: photo.uri,
  })));
  pushSection('[trails]', bundle.trails.map((trail) => ({
    id: trail.id,
    name: trail.name,
    difficulty: trail.difficulty,
    distanceMeters: trail.distanceMeters,
    elevationGainMeters: trail.elevationGainMeters,
    region: trail.region,
  })));
  pushSection('[segments]', bundle.segments.map((segment) => ({
    id: segment.id,
    trailId: segment.trailId,
    name: segment.name,
    distanceMeters: segment.distanceMeters,
    elevationGainMeters: segment.elevationGainMeters,
  })));
  pushSection('[reviews]', bundle.reviews.map((review) => ({
    id: review.id,
    trailId: review.trailId,
    rating: review.rating,
    title: review.title,
    createdAt: review.createdAt,
  })));
  pushSection('[packing]', bundle.packingTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    isBuiltIn: template.isBuiltIn,
    createdAt: template.createdAt,
  })));
  pushSection('[trips]', bundle.trips.map((trip) => ({
    id: trip.id,
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    packingTemplateId: trip.packingTemplateId,
  })));

  return sections.join('\n');
}

function buildJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'gpx':
      return 'application/gpx+xml';
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'kml':
      return 'application/vnd.google-earth.kml+xml';
  }
}

export default function ExportScreen() {
  const db = useDatabase();
  const [format, setFormat] = useState<ExportFormat>('gpx');
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [includeFiles, setIncludeFiles] = useState(false);
  const [include, setInclude] = useState<Record<IncludeKey, boolean>>({
    recordings: true,
    waypoints: true,
    photos: true,
    trails: true,
    segments: true,
    reviews: true,
    packing: true,
    trips: true,
  });

  const range = useMemo(() => buildDateRange(preset, customStart, customEnd), [customEnd, customStart, preset]);

  const recordings = useMemo(
    () => getRecordings(db).filter((recording) => isWithinRange(recording.startedAt, range.start, range.end)),
    [db, range.end, range.start],
  );

  const trails = useMemo(
    () => getTrails(db).filter((trail) => !range.start || isWithinRange(trail.createdAt, range.start, range.end)),
    [db, range.start, range.end],
  );

  const waypoints = useMemo(
    () => recordings.flatMap((recording) => getWaypointsByRecording(db, recording.id)),
    [db, recordings],
  );

  const photos = useMemo(
    () => getPhotos(db)
      .filter((photo) => {
        const matchesRecording = photo.recordingId ? recordings.some((recording) => recording.id === photo.recordingId) : false;
        const matchesTrail = photo.trailId ? trails.some((trail) => trail.id === photo.trailId) : false;
        return matchesRecording || matchesTrail || isWithinRange(photo.takenAt, range.start, range.end);
      })
      .map((photo) => ({
        id: photo.id,
        recordingId: photo.recordingId,
        trailId: photo.trailId,
        lat: photo.lat,
        lng: photo.lng,
        caption: photo.caption,
        takenAt: photo.takenAt,
        uri: includeFiles ? photo.uri : undefined,
      })),
    [db, includeFiles, range.end, range.start, recordings, trails],
  );

  const segments = useMemo(
    () => trails.flatMap((trail) => getSegmentsByTrail(db, trail.id)),
    [db, trails],
  );

  const reviews = useMemo(
    () => trails.flatMap((trail) => getReviewsByTrail(db, trail.id)),
    [db, trails],
  );

  const packingTemplates = useMemo(
    () => getPackingTemplates(db).filter((template) => !range.start || isWithinRange(template.createdAt, range.start, range.end)),
    [db, range.end, range.start],
  );

  const trips = useMemo(
    () => getTrips(db).filter((trip) => !range.start || isWithinRange(trip.createdAt, range.start, range.end)),
    [db, range.end, range.start],
  );

  const counts = useMemo<Record<IncludeKey, number>>(() => ({
    recordings: recordings.length,
    waypoints: waypoints.length,
    photos: photos.length,
    trails: trails.length,
    segments: segments.length,
    reviews: reviews.length,
    packing: packingTemplates.length,
    trips: trips.length,
  }), [packingTemplates.length, photos.length, recordings.length, reviews.length, segments.length, trails.length, trips.length, waypoints.length]);

  const bundle = useMemo<ExportBundle>(() => ({
    recordings: include.recordings ? recordings : [],
    waypoints: include.waypoints ? waypoints : [],
    photos: include.photos ? photos : [],
    trails: include.trails ? trails : [],
    segments: include.segments ? segments : [],
    reviews: include.reviews ? reviews : [],
    packingTemplates: include.packing ? packingTemplates : [],
    trips: include.trips ? trips : [],
  }), [include, packingTemplates, photos, recordings, reviews, segments, trails, trips, waypoints]);

  const previewContent = useMemo(() => {
    switch (format) {
      case 'gpx':
        return buildGpx(bundle);
      case 'csv':
        return buildCsv(bundle);
      case 'json':
        return buildJson(bundle);
      case 'kml':
        return buildKml(bundle);
    }
  }, [bundle, format]);

  const totalRows = useMemo(
    () => Object.values(bundle).reduce((total, value) => total + value.length, 0),
    [bundle],
  );

  const handleToggleInclude = useCallback((key: IncludeKey, value: boolean) => {
    setInclude((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const handleExport = useCallback(async () => {
    if (totalRows === 0) {
      Alert.alert('Nothing to export', 'Change the date range or include at least one data category.');
      return;
    }

    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('sharing unavailable');
      }

      const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!targetDir) {
        throw new Error('export directory unavailable');
      }

      const filename = sanitizeFilename(`mytrails-${format}-${new Date().toISOString().slice(0, 10)}`);
      const uri = `${targetDir}${filename}.${format}`;
      await FileSystem.writeAsStringAsync(uri, previewContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(uri, {
        mimeType: getMimeType(format),
        dialogTitle: `Share ${FORMAT_LABELS[format]} export`,
      });
    } catch {
      Alert.alert('Export failed', 'MyTrails could not generate or share that export right now.');
    }
  }, [format, previewContent, totalRows]);

  return (
    <TrailsScreen>
      <TrailsHero
        title="Export"
        subtitle="Choose a date range, export format, and included datasets before sending your trail data to another app."
        action={<MaterialSymbol name="share" size={22} color={colors.modules.trails} />}
      />

      <TrailsGlassCard style={styles.sectionCard}>
        <Text variant="subheading">Date Range</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {range.label}
        </Text>
        <View style={styles.chipRow}>
          {RANGE_PRESETS.map((value) => (
            <TrailsChip
              key={value}
              label={formatPresetLabel(value)}
              active={preset === value}
              onPress={() => setPreset(value)}
            />
          ))}
        </View>
        {preset === 'custom' ? (
          <View style={styles.customRangeRow}>
            <TextInput
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="2026-01-01"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <TextInput
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder="2026-12-31"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </View>
        ) : null}
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.sectionCard}>
        <Text variant="subheading">Format</Text>
        <View style={styles.chipRow}>
          {EXPORT_FORMATS.map((value) => (
            <TrailsChip
              key={value}
              label={FORMAT_LABELS[value]}
              active={format === value}
              onPress={() => setFormat(value)}
            />
          ))}
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          {FORMAT_DESCRIPTIONS[format]}
        </Text>
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.sectionCard}>
        <Text variant="subheading">Included Data</Text>
        <View style={styles.includeList}>
          {INCLUDE_KEYS.map((key) => (
            <IncludeRow
              key={key}
              label={INCLUDE_LABELS[key]}
              count={counts[key]}
              value={include[key]}
              onToggle={(value) => handleToggleInclude(key, value)}
            />
          ))}
          <IncludeRow
            label="Include photo file URIs"
            count={includeFiles ? counts.photos : 0}
            value={includeFiles}
            onToggle={setIncludeFiles}
            helper="Metadata is always included. This adds the source URIs."
          />
        </View>
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.sectionCard}>
        <Text variant="subheading">Preview</Text>
        {totalRows === 0 ? (
          <TrailsEmptyState
            icon="📤"
            title="No data in this range"
            copy="Change the date range or turn on more datasets to generate an export preview."
          />
        ) : (
          <>
            <View style={styles.previewStats}>
              <PreviewPill label="Rows" value={`${totalRows}`} />
              <PreviewPill label="File size" value={estimateFileSize(previewContent)} />
              <PreviewPill label="Format" value={FORMAT_LABELS[format]} />
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              {FORMAT_DESCRIPTIONS[format]}
            </Text>
          </>
        )}
      </TrailsGlassCard>

      <TrailsPrimaryButton
        label={`Export ${FORMAT_LABELS[format]}`}
        onPress={handleExport}
        style={totalRows === 0 ? styles.buttonDisabled : undefined}
      />
    </TrailsScreen>
  );
}

function IncludeRow({
  label,
  count,
  value,
  onToggle,
  helper,
}: {
  label: string;
  count: number;
  value: boolean;
  onToggle: (value: boolean) => void;
  helper?: string;
}) {
  return (
    <View style={styles.includeRow}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {helper ?? `${count} items`}
        </Text>
      </View>
      <View style={styles.includeToggleWrap}>
        <Text variant="caption" style={styles.includeCount}>
          {count}
        </Text>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(101,163,13,0.28)' }}
          thumbColor={value ? colors.modules.trails : colors.textTertiary}
        />
      </View>
    </View>
  );
}

function PreviewPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.previewPill}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="label" style={styles.previewPillValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  customRangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  includeList: {
    gap: spacing.sm,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.sm,
  },
  includeToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  includeCount: {
    minWidth: 28,
    textAlign: 'right',
    color: colors.modules.trails,
    fontWeight: '700',
  },
  previewStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewPill: {
    minWidth: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  previewPillValue: {
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
