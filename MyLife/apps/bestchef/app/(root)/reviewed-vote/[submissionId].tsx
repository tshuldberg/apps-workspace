/**
 * ReviewedVoteSheet -- P4-C.
 *
 * Counts 3x in the leaderboard score. Requires a CookProof photo plus
 * optional verdict, star rating, and notes. Presented as a modal sheet
 * over the Vote feed.
 */

import { useEffect, useRef, useState } from 'react';
import {
  I18nManager,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { readFileBytes } from '../utils/file-bytes';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Heart, Image as ImageIcon, Info, Star, ThumbsDown, ThumbsUp, X } from 'lucide-react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  castVoteWithProof,
  completeVoteProofUpload,
  createLocalVoteProofDraft,
  createVoteProofMediaAsset,
  mediaUploadFailure,
  type MediaUploadFailure,
  describeVoteProofError,
  JAKARTA_FONTS,
  prepareProof,
  type CastVoteProofErrorCode,
  type PreparedVoteProof,
  type ReviewVerdict,
  type VoteProofTier,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { COOK_PROOF_TIERS } from '../components/CookProofCapture';
import { DEMO_SUBMISSIONS, type DemoSubmission } from '../data/demo';
import {
  ensureCloudSubmissionForAppId,
  getCloudSubmissionViewModel,
  isCloudSubmissionId,
} from '../data/cloud-submissions';
import { getAllLocalSubmissions } from '../data/local-submissions';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import {
  useAppThemeColors as useThemeColors,
  useAppThemeProfile as useTheme,
} from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { pickPhoto } from '../utils/media';
import { shouldShowDemoContent } from '../data/public-render-policy';

const NOTES_MAX = 280;

const COMPRESS_QUALITIES = [0.86, 0.72, 0.58, 0.44] as const;
async function processProofImage(input: {
  uri: string;
  maxBytes: number;
}): Promise<{ uri: string; bytes: Uint8Array }> {
  let lastResult: { uri: string; bytes: Uint8Array } | null = null;
  for (const quality of COMPRESS_QUALITIES) {
    const result = await ImageManipulator.manipulateAsync(input.uri, [], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const bytes = await readFileBytes(result.uri);
    lastResult = { uri: result.uri, bytes };
    if (bytes.byteLength <= input.maxBytes) return lastResult;
  }
  if (lastResult) return lastResult;
  return { uri: input.uri, bytes: await readFileBytes(input.uri) };
}

/**
 * PUT the proof bytes to storage. Returns a typed MediaUploadFailure (never
 * throws for expected failures) so the caller can route through the same
 * retryable-vs-permanent gate as the intent/finalize legs (plan 33 Phase 2.2).
 */
async function uploadProofBytes(
  supabase: SupabaseClient,
  upload: { bucket: string; key: string; token: string | null; signedUploadUrl: string },
  bytes: Uint8Array,
): Promise<MediaUploadFailure | null> {
  try {
    if (upload.token) {
      const { error } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.key, upload.token, bytes, { contentType: 'image/jpeg' });
      if (error) {
        const rawStatus = (error as { statusCode?: string | number }).statusCode;
        const status = typeof rawStatus === 'string' ? Number.parseInt(rawStatus, 10) : rawStatus;
        return mediaUploadFailure(status === 413 ? 'file_too_large' : 'service_unavailable');
      }
      return null;
    }
    const res = await fetch(upload.signedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: bytes as unknown as RequestInit['body'],
    });
    if (!res.ok) {
      return mediaUploadFailure(res.status === 413 ? 'file_too_large' : 'service_unavailable');
    }
    return null;
  } catch {
    return mediaUploadFailure('network');
  }
}

const FIRST_PROOF_FLAG_KEY = 'first_cookproof_celebrated';

function readFirstProofFlag(db: ReturnType<typeof useDatabase>): boolean {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      [FIRST_PROOF_FLAG_KEY],
    );
    return rows[0]?.value === '1';
  } catch {
    return true; // fail closed: never celebrate twice on a broken read
  }
}

function writeFirstProofFlag(db: ReturnType<typeof useDatabase>): void {
  try {
    db.execute(
      `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, '1')`,
      [FIRST_PROOF_FLAG_KEY],
    );
  } catch {
    // Best effort; worst case the celebration repeats once.
  }
}

function findSubmission(db: ReturnType<typeof useDatabase>, id: string | undefined): DemoSubmission | null {
  if (!id) return null;
  const demo = shouldShowDemoContent()
    ? DEMO_SUBMISSIONS.find((s) => s.id === id) ?? null
    : null;
  return demo ?? getAllLocalSubmissions(db).find((s) => s.id === id) ?? null;
}

const VOTE_FLOW_ERROR_CODES: CastVoteProofErrorCode[] = [
  'vote_already_exists',
  'proof_duplicate',
  'cannot_vote_on_own',
  'rate_limited',
  'recast_cooldown',
  'network',
];

// ── Verdict config ────────────────────────────────────────────────────────

type VerdictConfig = {
  value: ReviewVerdict;
  labelKey: string;
  color: string;
  IconComp: typeof ThumbsUp;
};

function useVerdictConfigs() {
  const tc = useThemeColors();
  const { t } = useI18n();
  const configs: VerdictConfig[] = [
    { value: 'liked', labelKey: 'Liked it', color: tc.success, IconComp: ThumbsUp },
    { value: 'loved', labelKey: 'Loved it', color: tc.accent, IconComp: Heart },
    { value: 'mixed', labelKey: 'Mixed', color: tc.primaryContainer, IconComp: ThumbsDown },
    { value: 'disliked', labelKey: "Didn't like", color: tc.textSecondary, IconComp: ThumbsDown },
  ];
  return { configs, t };
}

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ visible, message, holdMs }: { visible: boolean; message: string; holdMs?: number }) {
  const tc = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(holdMs ?? 1400),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [holdMs, visible, opacity]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: tc.success, opacity }]}>
      <Text style={[styles.toastText, { color: tc.background }]}>{message}</Text>
    </Animated.View>
  );
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ title, required, subtitle }: { title: string; required?: boolean; subtitle?: string }) {
  const tc = useThemeColors();
  return (
    <View style={styles.sectionLabelWrap}>
      <View style={styles.sectionLabelRow}>
        <Text style={[styles.sectionTitle, { color: tc.text }]}>{title}</Text>
        {required && (
          <View style={[styles.requiredBadge, { backgroundColor: `${tc.accent}22` }]}>
            <Text style={[styles.requiredText, { color: tc.accent }]}>REQUIRED</Text>
          </View>
        )}
      </View>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: tc.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function ReviewedVoteSheet() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const router = useRouter();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const [submission, setSubmission] = useState<DemoSubmission | null>(null);
  const [cloudSubmissionId, setCloudSubmissionId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<VoteProofTier>('like');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastHoldMs, setToastHoldMs] = useState<number | undefined>(undefined);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (backTimerRef.current) clearTimeout(backTimerRef.current);
  }, []);

  const targetSubmissionId = cloudSubmissionId ?? submissionId ?? '';
  const title = submission?.title ?? t('Recipe');
  const canSubmit = Boolean(photoUri) && !busy;

  const { configs: verdictConfigs } = useVerdictConfigs();

  useEffect(() => {
    let cancelled = false;
    const nextSubmission = findSubmission(db, submissionId);
    setSubmission(nextSubmission);
    if (!submissionId || !cloud.isReady || !cloud.profile) {
      setCloudSubmissionId(isCloudSubmissionId(submissionId) ? submissionId : null);
      return () => { cancelled = true; };
    }
    void ensureCloudSubmissionForAppId(db, cloud.profile, submissionId)
      .then(async (resolvedId) => {
        if (!cancelled) setCloudSubmissionId(resolvedId);
        if (resolvedId && !nextSubmission) {
          const cloudSub = await getCloudSubmissionViewModel(resolvedId, cloud.profile);
          if (!cancelled && cloudSub) setSubmission(cloudSub);
        }
      })
      .catch(() => {
        if (!cancelled) setCloudSubmissionId(isCloudSubmissionId(submissionId) ? submissionId : null);
      });
    return () => { cancelled = true; };
  }, [cloud.isReady, cloud.profile, db, submissionId]);

  const pickProofPhoto = async (source: 'camera' | 'library') => {
    if (busy) return;
    try {
      const uri = await pickPhoto(source, { aspect: [1, 1], quality: 0.88 }, t);
      if (!uri) return;
      setPhotoUri(uri);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Unable to choose proof photo.'));
    }
  };

  const queueOfflineDraft = (prepared: PreparedVoteProof, reason: string) => {
    try {
      createLocalVoteProofDraft(db, {
        // Prefer the resolved cloud id so the sweep can commit directly;
        // the raw app id still resolves through the sweep's alias bridge.
        submissionId: cloudSubmissionId ?? submissionId ?? targetSubmissionId,
        tier: selectedTier,
        localImageUri: prepared.compressedUri,
        contentHash: prepared.contentHash,
        verdict: verdict ?? undefined,
        rating,
        notes: notes.trim() || undefined,
      });
      setPhotoUri(prepared.compressedUri);
      setErrorMessage(reason);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : reason);
    }
  };

  const submitVote = async () => {
    if (!photoUri || busy) return;
    setBusy(true);
    setErrorMessage(null);

    let prepared: PreparedVoteProof;
    try {
      prepared = await prepareProof(photoUri, {
        readFileBytes,
        processImage: async ({ uri, maxBytes }) => processProofImage({ uri, maxBytes }),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Unable to prepare proof photo.'));
      setBusy(false);
      return;
    }

    let preparedBytes: Uint8Array;
    try {
      preparedBytes = await readFileBytes(prepared.compressedUri);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Unable to read proof photo.'));
      setBusy(false);
      return;
    }

    if (!cloud.isReady || !cloud.profile || !cloud.supabase || !cloudSubmissionId) {
      queueOfflineDraft(prepared, t('Offline draft queued'));
      setBusy(false);
      return;
    }

    try {
      const upload = await createVoteProofMediaAsset({
        submissionId: cloudSubmissionId,
        contentHash: prepared.contentHash,
        byteSize: prepared.byteSize,
      }, cloud.supabase);
      if (!upload.ok) {
        // Retryable failures (network/outage) become offline drafts; permanent
        // rejections (too large, unsupported type) must NOT queue a draft that
        // would retry forever (plan 33 Phase 2.2).
        if (upload.retryable) {
          queueOfflineDraft(prepared, t(upload.message, upload.params));
        } else {
          setErrorMessage(t(upload.message, upload.params));
        }
        setBusy(false);
        return;
      }

      const putFailure = await uploadProofBytes(cloud.supabase, upload.data, preparedBytes);
      if (putFailure) {
        if (putFailure.retryable) {
          queueOfflineDraft(prepared, t(putFailure.message, putFailure.params));
        } else {
          setErrorMessage(t(putFailure.message, putFailure.params));
        }
        setBusy(false);
        return;
      }

      const finalized = await completeVoteProofUpload({
        assetId: upload.data.assetId,
        contentHash: prepared.contentHash,
        byteSize: prepared.byteSize,
      }, cloud.supabase);
      if (!finalized.ok) {
        if (finalized.retryable) {
          queueOfflineDraft(prepared, t(finalized.message, finalized.params));
        } else {
          setErrorMessage(t(finalized.message, finalized.params));
        }
        setBusy(false);
        return;
      }

      const result = await castVoteWithProof({
        submissionId: cloudSubmissionId,
        tier: selectedTier,
        contentHash: prepared.contentHash,
        mediaAssetId: upload.data.assetId,
        supabase: cloud.supabase,
        verdict: verdict ?? undefined,
        rating,
        notes: notes.trim() || undefined,
      });

      if (result.ok) {
        const isFirstProof = !readFirstProofFlag(db);
        if (isFirstProof) {
          writeFirstProofFlag(db);
          setToastMessage(t('First CookProof! Reviewed votes carry extra weight.'));
          setToastHoldMs(2100);
        }
        setToastVisible(true);
        backTimerRef.current = setTimeout(() => router.back(), isFirstProof ? 2500 : 1800);
        return;
      }

      if (result.retryable) {
        queueOfflineDraft(prepared, t(result.message));
        setBusy(false);
        return;
      }

      setErrorMessage(
        t(
          VOTE_FLOW_ERROR_CODES.includes(result.code)
            ? result.message
            : describeVoteProofError(result.code).message,
        ),
      );
    } catch {
      // All three cloud legs return typed failures now; anything thrown here
      // is unexpected. Localized copy only, never a raw error string.
      const message = t('Upload failed. Try again.');
      try {
        queueOfflineDraft(prepared!, message);
      } catch {
        setErrorMessage(message);
      }
    }

    setBusy(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: `${tc.border}` }]}>
        <View style={styles.headerHandle} />
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: tc.text }]}>{t('Reviewed Vote')}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: `${tc.text}12` },
              pressed && { opacity: 0.68 },
            ]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
          >
            <X size={16} color={tc.text} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro card */}
        <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <Text style={[styles.eyebrow, { color: tc.accent }]}>{t('Reviewed Vote').toUpperCase()}</Text>
          <Text style={[styles.cardTitle, { color: tc.text }]}>{title}</Text>
          <View style={[styles.weightBadge, { backgroundColor: `${tc.primaryContainer}18` }]}>
            <Text style={[styles.weightBadgeText, { color: tc.primaryContainer }]}>
              {t('Counts 3\u00d7 in the leaderboard score')}
            </Text>
          </View>
        </View>

        {/* Photo proof */}
        <View style={styles.section}>
          <SectionLabel
            title={t('Photo proof')}
            required
            subtitle={t('Upload a photo of your completed plated dish before you eat. No photo, no vote.')}
          />
          <View style={[styles.photoPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <View style={[styles.preview, { backgroundColor: tc.surface }]}>
              {photoUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" />
                  <Pressable
                    style={[styles.removePhoto, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                    onPress={() => setPhotoUri(null)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Remove photo')}
                  >
                    <X size={13} color="#fff" strokeWidth={2.5} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyPreview}>
                  <Camera size={36} color={tc.accent} strokeWidth={1.8} />
                  <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No candidate photo')}</Text>
                </View>
              )}
            </View>
            <View style={styles.photoActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.photoButton,
                  { backgroundColor: tc.accent },
                  pressed && !busy && { opacity: 0.82 },
                ]}
                disabled={busy}
                onPress={() => void pickProofPhoto('camera')}
                accessibilityRole="button"
                accessibilityLabel={t('Open camera for CookProof photo')}
              >
                <Camera size={17} color={tc.background} strokeWidth={2.4} />
                <Text style={[styles.photoButtonText, { color: tc.background }]}>{t('Camera')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.photoButton,
                  { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, borderWidth: 1 },
                  pressed && !busy && { opacity: 0.82 },
                ]}
                disabled={busy}
                onPress={() => void pickProofPhoto('library')}
                accessibilityRole="button"
                accessibilityLabel={t('Choose CookProof photo from library')}
              >
                <ImageIcon size={17} color={tc.accent} strokeWidth={2.3} />
                <Text style={[styles.photoButtonText, { color: tc.accent }]}>{t('Library')}</Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.notice, { backgroundColor: `${tc.primaryContainer}16`, borderColor: `${tc.primaryContainer}44` }]}>
            <Text style={[styles.noticeText, { color: tc.text }]}>
              {t('Your photo will be public on this recipe and your profile.')}
            </Text>
          </View>
        </View>

        {/* Tier picker */}
        <View style={styles.section}>
          <SectionLabel title={t('Vote Tier')} required />
          <View style={styles.tierGrid}>
            {COOK_PROOF_TIERS.map((item) => {
              const selected = item.tier === selectedTier;
              return (
                <Pressable
                  key={item.tier}
                  style={({ pressed }) => [
                    styles.tierButton,
                    {
                      backgroundColor: selected ? `${tc.accent}20` : theme.glass.cardFill,
                      borderColor: selected ? tc.accent : theme.glass.cardBorder,
                    },
                    pressed && !busy && { opacity: 0.82 },
                  ]}
                  disabled={busy}
                  onPress={() => setSelectedTier(item.tier)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy }}
                  accessibilityLabel={t('Select {tier} vote', { tier: item.label })}
                >
                  <Text style={[styles.tierLabel, { color: selected ? tc.accent : tc.text }]}>{t(item.label)}</Text>
                  <Text style={[styles.tierValue, { color: tc.textSecondary }]}>{t(item.value)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Verdict picker */}
        <View style={styles.section}>
          <SectionLabel title={t('Your verdict')} />
          <View style={styles.verdictGrid}>
            {verdictConfigs.map((cfg) => {
              const on = verdict === cfg.value;
              return (
                <Pressable
                  key={cfg.value}
                  style={({ pressed }) => [
                    styles.verdictButton,
                    {
                      backgroundColor: on ? `${cfg.color}22` : theme.glass.cardFill,
                      borderColor: on ? cfg.color : theme.glass.cardBorder,
                    },
                    pressed && { opacity: 0.82 },
                  ]}
                  onPress={() => setVerdict(on ? null : cfg.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(cfg.labelKey)}
                >
                  <cfg.IconComp
                    size={17}
                    color={on ? cfg.color : tc.textSecondary}
                    strokeWidth={2.2}
                  />
                  <Text style={[styles.verdictLabel, { color: on ? cfg.color : tc.text }]}>
                    {t(cfg.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Star rating */}
        <View style={styles.section}>
          <SectionLabel title={t('Tap to rate')} />
          <View style={[styles.ratingRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable
                  key={i}
                  onPress={() => setRating(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${i} star`}
                >
                  <Star
                    size={28}
                    color={i <= rating ? tc.primaryContainer : `${tc.textSecondary}50`}
                    fill={i <= rating ? tc.primaryContainer : 'none'}
                    strokeWidth={1.8}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={[styles.ratingNum, { color: tc.text }]}>{rating}.0</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <SectionLabel title={t('Notes')} subtitle={t('What stood out?')} />
          <View style={[styles.notesWrap, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <TextInput
              style={[styles.notesInput, { color: tc.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('What stood out?')}
              placeholderTextColor={`${tc.textSecondary}99`}
              multiline
              maxLength={NOTES_MAX}
              textAlignVertical="top"
              accessibilityLabel={t('Notes')}
            />
            <Text style={[styles.charCount, { color: `${tc.textSecondary}80` }]}>
              {notes.length}/{NOTES_MAX}
            </Text>
          </View>
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: `${tc.primaryContainer}12`, borderColor: `${tc.primaryContainer}30` }]}>
          <Info size={15} color={tc.primaryContainer} strokeWidth={2.2} style={styles.infoIcon} />
          <View style={styles.infoBody}>
            <Text style={[styles.infoTitle, { color: tc.text }]}>{t('How Reviewed Votes work')}</Text>
            <Text style={[styles.infoText, { color: tc.textSecondary }]}>
              {t('Reviewed Votes carry 3\u00d7 the weight of swipe votes. Photos are reviewed for authenticity before they affect the leaderboard.')}
            </Text>
          </View>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: `${tc.danger}18`, borderColor: `${tc.danger}40` }]}>
            <Text style={[styles.errorText, { color: tc.danger }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Bottom spacer for sticky submit */}
        <View style={styles.submitSpacer} />
      </ScrollView>

      {/* Sticky submit */}
      <View style={[styles.submitBar, { backgroundColor: tc.background }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: canSubmit ? tc.accent : tc.surfaceElevated,
            },
            pressed && canSubmit && { opacity: 0.85 },
          ]}
          disabled={!canSubmit}
          onPress={() => void submitVote()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy }}
          accessibilityLabel={t('Submit Reviewed Vote')}
        >
          <Text style={[styles.submitText, { color: canSubmit ? tc.background : tc.textSecondary }]}>
            {busy ? t('Uploading') : t('Submit Reviewed Vote')}
          </Text>
        </Pressable>
      </View>

      <Toast visible={toastVisible} message={toastMessage ?? t('Reviewed vote submitted')} holdMs={toastHoldMs} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  headerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 17, flex: 1, textAlign: 'center' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
  },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, gap: 20 },

  // Intro card
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  eyebrow: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20, lineHeight: 26 },
  weightBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  weightBadgeText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },

  section: { gap: 10 },
  sectionLabelWrap: { gap: 3 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  sectionSubtitle: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 17 },
  requiredBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  requiredText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 9, letterSpacing: 0.5 },

  // Photo
  photoPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  preview: { minHeight: 200, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewWrap: { width: '100%', height: '100%' },
  previewImage: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreview: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 22 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  photoButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12 },
  noticeText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12, lineHeight: 18 },

  // Tier
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tierButton: {
    width: '47%' as unknown as number,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    justifyContent: 'center',
  },
  tierLabel: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  tierValue: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 15 },

  // Verdict
  verdictGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  verdictButton: {
    width: '47%' as unknown as number,
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verdictLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13, flex: 1 },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  stars: { flexDirection: 'row', gap: 6 },
  ratingNum: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22 },

  // Notes
  notesWrap: { borderRadius: 16, borderWidth: 1, padding: 12 },
  notesInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 100,
  },
  charCount: { fontFamily: JAKARTA_FONTS.regular, fontSize: 11, textAlign: I18nManager.isRTL ? 'left' : 'right', marginTop: 4 },

  // Info card
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: { marginTop: 1 },
  infoBody: { flex: 1, gap: 4 },
  infoTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  infoText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 18 },

  // Error
  errorBanner: { borderRadius: 12, borderWidth: 1, padding: 12 },
  errorText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },

  submitSpacer: { height: 80 },

  // Submit bar
  submitBar: { paddingHorizontal: 18, paddingVertical: 12, paddingBottom: 28 },
  submitButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  toastText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
});
