// Plan 56 C1 (3.6): the receiver-side render dials, the entire moderation
// answer for a serverless canvas. DEVICE-LOCAL (mk_render_prefs): what THIS
// member renders is their private choice; nothing here touches the community
// or replicates. High contrast and reduced motion from the OS always win over
// these dials in the renderer; muted authors are managed from the canvas
// itself and listed here for un-muting.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { SectionHeader } from './kit';
import { useMkStyles } from '../providers/AppThemeProvider';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import {
  getRenderPrefs,
  setCanvasAuthorMuted,
  setRenderPref,
  type RenderDialKey,
} from '../data/canvas-core';
import { resolveCommunityDisplayName } from '../data/community-core';

const DIALS: ReadonlyArray<{ key: RenderDialKey; label: string; values: readonly string[]; valueLabels: Record<string, string> }> = [
  { key: 'animations', label: 'Animations', values: ['on', 'reduced', 'off'], valueLabels: { on: 'On', reduced: 'Reduced', off: 'Off' } },
  { key: 'sounds', label: 'Sounds', values: ['on', 'tap_only', 'off'], valueLabels: { on: 'On', tap_only: 'Tap only', off: 'Off' } },
  { key: 'backgrounds', label: 'Backgrounds', values: ['on', 'dimmed', 'off'], valueLabels: { on: 'On', dimmed: 'Dimmed', off: 'Off' } },
  { key: 'member_decorations', label: 'Member stickers and drawings', values: ['on', 'off'], valueLabels: { on: 'On', off: 'Off' } },
  { key: 'external_links', label: 'Link cards', values: ['on', 'off'], valueLabels: { on: 'On', off: 'Off' } },
  { key: 'effects', label: 'Effects', values: ['on', 'off'], valueLabels: { on: 'On', off: 'Off' } },
];

const PREF_TO_FIELD: Record<RenderDialKey, 'animations' | 'sounds' | 'backgrounds' | 'memberDecorations' | 'externalLinks' | 'effects'> = {
  animations: 'animations',
  sounds: 'sounds',
  backgrounds: 'backgrounds',
  member_decorations: 'memberDecorations',
  external_links: 'externalLinks',
  effects: 'effects',
};

export function CanvasRenderDialsSection({ db, communityId }: { db: DatabaseAdapter; communityId: string }) {
  const styles = useMkStyles(makeStyles);
  const [revision, setRevision] = useState(0);
  const prefs = useMemo(() => { void revision; return getRenderPrefs(db, communityId); }, [db, communityId, revision]);

  const setDial = useCallback((key: RenderDialKey, value: string) => {
    setRenderPref(db, communityId, key, value);
    setRevision((v) => v + 1);
  }, [db, communityId]);

  return (
    <View style={styles.panel}>
      <SectionHeader
        title="Canvas rendering"
        hint="What YOUR device renders on this community's canvases. Only you see these choices; nothing is removed for anyone else. Your system high-contrast and reduced-motion settings always win."
      />
      {DIALS.map((dial) => (
        <View key={dial.key} style={styles.dialRow}>
          <Text style={styles.dialLabel}>{dial.label}</Text>
          <View style={styles.dialValues}>
            {dial.values.map((value) => {
              const active = prefs[PREF_TO_FIELD[dial.key]] === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`${dial.label}: ${dial.valueLabels[value]}`}
                  onPress={() => setDial(dial.key, value)}
                  style={[styles.valueChip, active && styles.valueChipActive]}
                >
                  <Text style={[styles.valueChipText, active && styles.valueChipTextActive]}>
                    {dial.valueLabels[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {prefs.mutedAuthors.length > 0 ? (
        <View style={styles.mutedBlock}>
          <Text style={styles.dialLabel}>Hidden decorators</Text>
          {prefs.mutedAuthors.map((deviceId) => (
            <View key={deviceId} style={styles.mutedRow}>
              <Text style={styles.mutedName} numberOfLines={1}>
                {resolveCommunityDisplayName(db, communityId, deviceId) ?? shortHex(deviceId)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show this member's decorations again"
                onPress={() => { setCanvasAuthorMuted(db, communityId, deviceId, false); setRevision((v) => v + 1); }}
              >
                <Text style={styles.unmute}>Show again</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    panel: {
      backgroundColor: c.surface,
      borderColor: c.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.lg,
      padding: 14,
      gap: 10,
    },
    dialRow: { gap: 6 },
    dialLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    dialValues: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    valueChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: MK_RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
    },
    valueChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    valueChipText: { color: c.text, fontSize: 12 },
    valueChipTextActive: { color: c.onAccent, fontWeight: '600' },
    mutedBlock: { gap: 6, marginTop: 4 },
    mutedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mutedName: { color: c.textSecondary, fontSize: 13, flex: 1 },
    unmute: { color: c.accent, fontSize: 13, fontWeight: '600' },
  });
