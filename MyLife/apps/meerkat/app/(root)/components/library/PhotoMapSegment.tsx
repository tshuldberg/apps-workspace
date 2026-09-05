// Plan 38 amendment C.6 (MOBILE): the photo library Map segment. DEFAULT-OFF per
// library (device-local mk_settings photo_map_enabled). The map renders ONLY over
// a founder-hosted STATIC tile pack that the user downloaded ONCE with explicit
// consent and whose bytes were verified against a PINNED sha512. There is NO
// per-location tile query and NO network tile URL anywhere: the MapLibre style
// points only at the on-device pack file. Pins come from photoMapPoints, which
// yields only the photos whose contributor consented to keep location at ingest
// (D.7). Honest fallbacks by construction:
//   - native map module absent (Expo Go / no dev build): "Maps need a dev build."
//   - no packs configured in this build:                 "No map packs are configured in this build."
//   - packs configured but none downloaded yet:          the one-time consent + download flow.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { MK_RADIUS, type MkColors } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { isPhotoMapEnabled, setPhotoMapEnabled } from '../../data/db';
import { Button } from '../kit';
import type { ResolvedLibraryItem } from '../../data/library-data-core';
import { photoMapPoints, type PhotoMapPoint } from '../../data/photo-timeline-core';
import {
  TILE_PACK_STRINGS,
  downloadTilePack,
  isTilePackInstalled,
  loadMapLibreModule,
  localTilePackStyle,
  readConfiguredTilePacks,
  tilePackConsentCopy,
  tilePackLocalPath,
  type TilePackDescriptor,
} from '../../data/tile-packs';

interface InstalledPack {
  descriptor: TilePackDescriptor;
  localPath: string;
}

function centerOf(points: readonly PhotoMapPoint[]): [number, number] {
  if (points.length === 0) return [0, 20];
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return [lng / points.length, lat / points.length];
}

export function PhotoMapSegment({
  channelId,
  items,
}: {
  channelId: string;
  items: readonly ResolvedLibraryItem[];
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();

  const points = useMemo(() => photoMapPoints(items), [items]);
  const maplibre = useMemo(() => loadMapLibreModule(), []);
  const packs = useMemo(() => readConfiguredTilePacks(), []);

  const [enabled, setEnabled] = useState<boolean>(() => isPhotoMapEnabled(db, channelId));
  const [installed, setInstalled] = useState<InstalledPack | null>(null);
  const [checkingInstall, setCheckingInstall] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      for (const p of packs) {
        // eslint-disable-next-line no-await-in-loop
        if (await isTilePackInstalled(p.id)) {
          if (live) setInstalled({ descriptor: p, localPath: tilePackLocalPath(p.id) });
          break;
        }
      }
      if (live) setCheckingInstall(false);
    })();
    return () => { live = false; };
  }, [packs]);

  const onDownload = useCallback((descriptor: TilePackDescriptor) => {
    setError(null);
    setDownloadingId(descriptor.id);
    setProgress(0);
    void (async () => {
      try {
        const res = await downloadTilePack(descriptor, {
          onProgress: (p) => setProgress(p.fraction),
        });
        setInstalled({ descriptor, localPath: res.localPath });
        setPhotoMapEnabled(db, channelId, true);
        setEnabled(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDownloadingId(null);
      }
    })();
  }, [db, channelId]);

  const toggleShow = useCallback((next: boolean) => {
    setPhotoMapEnabled(db, channelId, next);
    setEnabled(next);
  }, [db, channelId]);

  const locatedLine = `${points.length} ${points.length === 1 ? 'photo has' : 'photos have'} a location you kept`;

  // Native map module absent: honest, cannot render a map at all.
  if (!maplibre) {
    return (
      <View style={styles.container}>
        <MapPin size={26} color={c.textSecondary} strokeWidth={1.6} />
        <Text style={styles.title}>Photo map</Text>
        <Text style={styles.body}>{TILE_PACK_STRINGS.mapsNeedDevBuild}</Text>
        <Text style={styles.muted}>{locatedLine}.</Text>
      </View>
    );
  }

  // No founder-hosted packs baked into this build.
  if (packs.length === 0) {
    return (
      <View style={styles.container}>
        <MapPin size={26} color={c.textSecondary} strokeWidth={1.6} />
        <Text style={styles.title}>Photo map</Text>
        <Text style={styles.body}>{TILE_PACK_STRINGS.noPacksConfigured}</Text>
        <Text style={styles.muted}>{locatedLine}.</Text>
      </View>
    );
  }

  if (checkingInstall) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  // Packs exist but none is downloaded yet: the one-time consent + download flow.
  if (!installed) {
    return (
      <View style={styles.setup}>
        <Text style={styles.title}>Show photos on a map</Text>
        <Text style={styles.muted}>{locatedLine}.</Text>
        <Text style={styles.body}>
          The map works fully offline from a downloaded map pack. Download one below to turn it on.
        </Text>
        {packs.map((p) => (
          <View key={p.id} style={styles.packCard}>
            <Text style={styles.packName}>{p.name}</Text>
            <Text style={styles.packRegion}>{p.region}</Text>
            <Text style={styles.consent}>{tilePackConsentCopy(p.sizeBytes)}</Text>
            {downloadingId === p.id ? (
              <View style={styles.progressRow}>
                <ActivityIndicator color={c.accent} />
                <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
              </View>
            ) : (
              <Button title="Download map pack" onPress={() => onDownload(p)} />
            )}
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  // Installed pack + native module present. Respect the default-off flag.
  if (!enabled) {
    return (
      <View style={styles.setup}>
        <Text style={styles.title}>Map ready</Text>
        <Text style={styles.muted}>{locatedLine}.</Text>
        <Text style={styles.body}>The {installed.descriptor.name} map pack is on this device.</Text>
        <Button title="Show map" onPress={() => toggleShow(true)} />
      </View>
    );
  }

  const MapView = maplibre.MapView as React.ComponentType<Record<string, unknown>>;
  const Camera = maplibre.Camera as React.ComponentType<Record<string, unknown>>;
  const PointAnnotation = maplibre.PointAnnotation as React.ComponentType<Record<string, unknown>> | undefined;
  const style = localTilePackStyle(installed.localPath, installed.descriptor.name);

  return (
    <View style={styles.mapWrap}>
      <View style={styles.mapBar}>
        <Text style={styles.muted}>{locatedLine}.</Text>
        <Pressable onPress={() => toggleShow(false)} hitSlop={8}>
          <Text style={styles.hide}>Hide map</Text>
        </Pressable>
      </View>
      {/* mapStyle is the @maplibre/maplibre-react-native v10 style prop; it takes a
          local style object with no network source. Exact prop wiring is verified
          during founder-ops device QA (this whole path is dev-build only). */}
      <MapView style={styles.map} mapStyle={style} logoEnabled={false} attributionEnabled={false}>
        <Camera
          defaultSettings={{ centerCoordinate: centerOf(points), zoomLevel: points.length > 0 ? 3 : 1 }}
        />
        {PointAnnotation
          ? points.map((p) => (
              <PointAnnotation key={p.id} id={p.id} coordinate={[p.longitude, p.latitude]}>
                <View style={styles.pin} />
              </PointAnnotation>
            ))
          : null}
      </MapView>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  setup: { padding: 20, gap: 10 },
  title: { color: c.text, fontSize: 17, fontWeight: '800' },
  body: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  muted: { color: c.textTertiary, fontSize: 12.5, lineHeight: 18 },
  packCard: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    padding: 14,
    gap: 6,
    marginTop: 6,
  },
  packName: { color: c.text, fontSize: 15, fontWeight: '800' },
  packRegion: { color: c.textSecondary, fontSize: 12.5 },
  consent: { color: c.textTertiary, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  progressText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  error: { color: c.danger, fontSize: 13, marginTop: 8 },
  mapWrap: { flex: 1 },
  mapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hide: { color: c.accent, fontSize: 13, fontWeight: '800' },
  map: { flex: 1 },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.surface,
  },
});
