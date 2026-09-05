// Plan 38 C.10: the per-community "Notifications" section. A device-local sound
// picker for THIS community, shown to every member (not just the owner). The
// picker is VISIBLE ONLY when background sync is enabled (the same dev-build flag
// that gates every background notification). When off, an honest line explains
// that notifications need background sync. The mute toggle lives elsewhere on this
// screen (existing community mute); a muted community never notifies.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { isBackgroundSyncEnabled } from '../data/background-sync';
import { NOTIFICATION_SOUND_PRESETS } from '../data/notification-identity-core';
import {
  getCommunityNotificationSoundId,
  setCommunityNotificationSoundId,
} from '../data/notification-prefs';
import { SectionHeader } from './kit';
import { type MkColors as TokenColors, MK_RADIUS } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

export function CommunityNotificationSection({
  db,
  communityId,
}: {
  db: DatabaseAdapter;
  communityId: string;
}) {
  const styles = useMkStyles(makeStyles);
  const [tick, setTick] = useState(0);

  const enabled = useMemo(() => {
    void tick;
    return isBackgroundSyncEnabled(db);
  }, [db, tick]);
  const selectedId = useMemo(() => {
    void tick;
    return getCommunityNotificationSoundId(db, communityId);
  }, [db, communityId, tick]);

  const choose = (presetId: string) => {
    setCommunityNotificationSoundId(db, communityId, presetId);
    setTick((t) => t + 1);
  };

  return (
    <View style={styles.panel}>
      <SectionHeader title="Notifications" hint="Only this device. Muted communities never notify." />
      {enabled ? (
        <>
          <Text style={styles.fieldLabel}>Notification sound</Text>
          <View style={styles.chipRow}>
            {NOTIFICATION_SOUND_PRESETS.map((preset) => {
              const active = preset.id === selectedId;
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Notification sound ${preset.label}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => choose(preset.id)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={styles.offText}>Notifications need background sync (dev build).</Text>
      )}
    </View>
  );
}

const makeStyles = (c: TokenColors) => StyleSheet.create({
  panel: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  fieldLabel: { color: c.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: MK_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    backgroundColor: c.surfaceElevated,
  },
  chipActive: { borderColor: c.accent, backgroundColor: c.glass },
  chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: c.accent },
  offText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
