import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ban, Flag, ShieldCheck } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { ReportMenu } from '../ReportMenu';
import { blockUser, unblockUser, isBlocked as isBlockedLocal } from '../../data/local-submissions';
import { blockProfileCloud, unblockProfileCloud, isProfileBlockedCloud } from '../../data/cloud-blocks';

// Shared with feed.tsx so the local demo-feed filter and this control agree.
const LOCAL_VIEWER_ID = 'local-viewer';

interface ChefModerationRowProps {
  profileId: string;
  handle: string;
  displayName: string;
}

/**
 * Report + Block / Unblock controls for a chef profile (App Store Guideline 1.2).
 * Blocks are written locally (handle) and, when signed in, server-side (profile id)
 * so they survive reinstall and hide the chef's content from the viewer.
 */
export function ChefModerationRow({ profileId, handle, displayName }: ChefModerationRowProps) {
  const tc = useThemeColors();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t } = useI18n();

  const viewerId = cloud.profile?.id ?? null;
  const isOwnProfile = !!viewerId && viewerId === profileId;

  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      setBlocked(isBlockedLocal(db, LOCAL_VIEWER_ID, handle));
    } catch {
      // best-effort local read
    }
    // Cloud wins, local mirrors (plan 33 Phase 1.5): the bc_blocks row is what
    // the server enforces and it survives reinstall; the handle-keyed local row
    // only exists so offline UI agrees. Reconcile whenever both are readable.
    if (cloud.supabase && viewerId) {
      void isProfileBlockedCloud(cloud.supabase, viewerId, profileId).then((cloudBlocked) => {
        if (cancelled || cloudBlocked === null) return;
        setBlocked(cloudBlocked);
        try {
          if (cloudBlocked) {
            blockUser(db, { blockerId: LOCAL_VIEWER_ID, blockedHandle: handle });
          } else {
            unblockUser(db, { blockerId: LOCAL_VIEWER_ID, blockedHandle: handle });
          }
        } catch {
          // best-effort local mirror
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [db, handle, cloud.supabase, viewerId, profileId]);

  const applyBlock = useCallback(async () => {
    setBusy(true);
    try {
      blockUser(db, { blockerId: LOCAL_VIEWER_ID, blockedHandle: handle });
      if (cloud.supabase && viewerId) {
        await blockProfileCloud(cloud.supabase, viewerId, profileId);
      }
      setBlocked(true);
    } finally {
      setBusy(false);
    }
  }, [db, handle, cloud.supabase, viewerId, profileId]);

  const applyUnblock = useCallback(async () => {
    setBusy(true);
    try {
      unblockUser(db, { blockerId: LOCAL_VIEWER_ID, blockedHandle: handle });
      if (cloud.supabase && viewerId) {
        await unblockProfileCloud(cloud.supabase, viewerId, profileId);
      }
      setBlocked(false);
    } finally {
      setBusy(false);
    }
  }, [db, handle, cloud.supabase, viewerId, profileId]);

  const confirmBlock = useCallback(() => {
    Alert.alert(
      t('Block {chefName}?', { chefName: displayName }),
      t("You won't see their recipes or comments anymore."),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Block chef'), style: 'destructive', onPress: () => { void applyBlock(); } },
      ],
    );
  }, [t, displayName, applyBlock]);

  if (isOwnProfile) return null;

  return (
    <View style={styles.row}>
      <ReportMenu
        targetKind="chef"
        targetId={profileId}
        accessibilityLabel={t('Report chef')}
        style={[styles.pill, { borderColor: tc.border }]}
      >
        <Flag size={15} color={tc.textSecondary} strokeWidth={2} />
        <Text style={[styles.pillText, { color: tc.textSecondary }]}>{t('Report chef')}</Text>
      </ReportMenu>

      <Pressable
        style={[styles.pill, { borderColor: tc.border }, busy && styles.busy]}
        disabled={busy}
        onPress={blocked ? () => { void applyUnblock(); } : confirmBlock}
        accessibilityRole="button"
        accessibilityLabel={blocked ? t('Unblock chef') : t('Block chef')}
      >
        {blocked
          ? <ShieldCheck size={15} color={tc.textSecondary} strokeWidth={2} />
          : <Ban size={15} color={tc.danger} strokeWidth={2} />}
        <Text style={[styles.pillText, { color: blocked ? tc.textSecondary : tc.danger }]}>
          {blocked ? t('Unblock chef') : t('Block chef')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  busy: { opacity: 0.5 },
  pillText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
});
