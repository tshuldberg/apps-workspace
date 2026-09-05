import { useCallback } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { DatabaseAdapter } from '@mylife/db';
import { Text } from '@mylife/ui';
import {
  JAKARTA_FONTS,
  enqueueReport,
  generatePendingReportLocalId,
  reportContentToModeration,
  type ModerationTargetKind,
  type PendingReportPayload,
} from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { isBestChefPublicLaunchBuild } from '../data/launch-environment';
import { reportContent, type ReportTargetKind } from '../data/local-submissions';
import { useI18n } from '../i18n/I18nProvider';

const VIEWER_ID_STORAGE_KEY = 'bc_viewer_id';

const REASON_KEYS = [
  'Spam or scam',
  'Harassment',
  'Sexual content',
  'Hate speech',
  'Violence',
  'Copyright',
  'Other',
] as const;

type ReasonKey = (typeof REASON_KEYS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapReportTargetToCloudKind(
  targetKind: ReportTargetKind,
): ModerationTargetKind | null {
  if (targetKind === 'chef') return 'profile';
  if (targetKind === 'vote_proof') return 'vote_proof';
  if (targetKind === 'submission' || targetKind === 'comment') return targetKind;
  return null;
}

function resolveReporterId(db: DatabaseAdapter): string {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      ['profile_handle'],
    );
    const handle = rows[0]?.value?.trim();
    if (handle) return `handle:${handle.replace(/^@/, '').toLowerCase()}`;
  } catch {
    // fall through to anonymous id
  }

  try {
    const existing = SecureStore.getItem(VIEWER_ID_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // SecureStore may be unavailable; generate an ephemeral id.
  }

  const generated = Crypto.randomUUID();
  try {
    SecureStore.setItem(VIEWER_ID_STORAGE_KEY, generated);
  } catch {
    // persistence optional
  }
  return generated;
}

export interface ReportMenuProps {
  targetKind: ReportTargetKind;
  targetId: string;
  cloudTargetKind?: ModerationTargetKind | null;
  cloudTargetId?: string | null;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  onReported?: () => void;
}

export function ReportMenu({
  targetKind,
  targetId,
  cloudTargetKind,
  cloudTargetId,
  children,
  style,
  hitSlop,
  accessibilityLabel,
  onReported,
}: ReportMenuProps): React.ReactElement {
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t } = useI18n();
  const tc = useThemeColors();

  const submit = useCallback(
    async (reasonKey: ReasonKey) => {
      const publicLaunch = isBestChefPublicLaunchBuild();
      const resolvedCloudKind = cloudTargetKind ?? mapReportTargetToCloudKind(targetKind);
      const resolvedCloudId = cloudTargetId ?? (UUID_RE.test(targetId) ? targetId : null);
      let cloudReported = false;
      let queuedOffline = false;

      if (cloud.isReady && cloud.profile && resolvedCloudKind && resolvedCloudId) {
        try {
          const cloudResult = await reportContentToModeration({
            targetKind: resolvedCloudKind,
            targetId: resolvedCloudId,
            reason: reasonKey,
            reporterProfileId: cloud.profile.id,
          });

          if (!cloudResult.ok || cloudResult.data.errorCode) {
            const errorMessage = cloudResult.ok
              ? (cloudResult.data.errorCode ?? 'unknown_error')
              : cloudResult.error;
            if (publicLaunch) {
              const payload: PendingReportPayload = {
                targetKind: resolvedCloudKind,
                targetId: resolvedCloudId,
                reason: reasonKey,
                reporterProfileId: cloud.profile.id,
              };
              const enqueueResult = await enqueueReport(
                cloud.supabase ?? null,
                db,
                {
                  localId: generatePendingReportLocalId(),
                  payload,
                  error: errorMessage,
                },
              );
              if (!enqueueResult.ok) {
                Alert.alert(
                  t('Report unavailable'),
                  t('Please try again when your connection is restored.'),
                );
                return;
              }
              queuedOffline = true;
            }
          } else {
            cloudReported = true;
          }
        } catch (err) {
          if (publicLaunch) {
            const payload: PendingReportPayload = {
              targetKind: resolvedCloudKind,
              targetId: resolvedCloudId,
              reason: reasonKey,
              reporterProfileId: cloud.profile.id,
            };
            const errorMessage = err instanceof Error ? err.message : 'unknown_error';
            const enqueueResult = await enqueueReport(
              cloud.supabase ?? null,
              db,
              {
                localId: generatePendingReportLocalId(),
                payload,
                error: errorMessage,
              },
            );
            if (!enqueueResult.ok) {
              Alert.alert(
                t('Report unavailable'),
                t('Please try again when your connection is restored.'),
              );
              return;
            }
            queuedOffline = true;
          }
        }
      } else if (publicLaunch) {
        if (resolvedCloudKind && resolvedCloudId) {
          const payload: PendingReportPayload = {
            targetKind: resolvedCloudKind,
            targetId: resolvedCloudId,
            reason: reasonKey,
            reporterProfileId: cloud.profile?.id ?? null,
          };
          const enqueueResult = await enqueueReport(
            cloud.supabase ?? null,
            db,
            {
              localId: generatePendingReportLocalId(),
              payload,
              error: 'cloud_not_ready',
            },
          );
          if (enqueueResult.ok) {
            queuedOffline = true;
          } else {
            Alert.alert(
              t('Report unavailable'),
              t('Please try again when your connection is restored.'),
            );
            return;
          }
        } else {
          Alert.alert(
            t('Report unavailable'),
            t('Please try again when your connection is restored.'),
          );
          return;
        }
      }

      const reporterId = resolveReporterId(db);
      if (!publicLaunch || !cloudReported) {
        reportContent(db, {
          targetKind,
          targetId,
          reason: reasonKey,
          reporterId,
        });
      }

      if (queuedOffline) {
        Alert.alert(
          t('Report queued'),
          t('report_saved_offline'),
        );
      } else {
        Alert.alert(
          t('Report submitted'),
          t('Thanks for letting us know. Our team reviews every report and takes action on anything that breaks our guidelines.'),
        );
      }
      onReported?.();
    },
    [cloud.isReady, cloud.profile, cloud.supabase, cloudTargetId, cloudTargetKind, db, onReported, t, targetId, targetKind],
  );

  const open = useCallback(() => {
    const translated: Record<ReasonKey, string> = {
      'Spam or scam': t('Spam or scam'),
      Harassment: t('Harassment'),
      'Sexual content': t('Sexual content'),
      'Hate speech': t('Hate speech'),
      Violence: t('Violence'),
      Copyright: t('Copyright'),
      Other: t('Other'),
    };

    if (Platform.OS === 'ios') {
      const options = [
        ...REASON_KEYS.map((key) => translated[key]),
        t('Cancel'),
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('Report content'),
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: options.length - 2,
        },
        (selected) => {
          if (selected < 0 || selected >= REASON_KEYS.length) return;
          void submit(REASON_KEYS[selected]);
        },
      );
      return;
    }

    Alert.alert(
      t('Report content'),
      t('Why are you reporting this?'),
      [
        ...REASON_KEYS.map((key) => ({
          text: translated[key],
          onPress: () => submit(key),
        })),
        { text: t('Cancel'), style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  }, [submit, t]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('Report content')}
      hitSlop={hitSlop ?? 8}
      onPress={open}
      style={({ pressed }) => [
        style,
        pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] },
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={{ color: tc.danger, fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
