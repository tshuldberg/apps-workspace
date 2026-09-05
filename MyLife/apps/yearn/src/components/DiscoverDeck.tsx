import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  Ban,
  Flag,
  Heart,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DiscoverFilters } from './DiscoverFilters';
import { BoostButton } from './MonetizationPanels';
import { sampleProfiles } from '../data/sampleProfiles';
import {
  advanceYearnDeckIndex,
  formatYearnDeckAction,
  getNextYearnPhotoIndex,
  getYearnActivePhoto,
  getYearnPhotoProgressSegments,
  recordYearnDeckAction,
  rewindYearnDeck,
  type YearnDeckAction,
  type YearnDeckHistoryEntry,
} from '../lib/discoverDeck';
import {
  resolveYearnPhotoSignedUrls,
  type YearnSignedPhoto,
} from '../lib/photoStorage';
import type { AnySupabaseClient } from '../lib/supabase';
import {
  YearnRepository,
  type YearnDiscoverProfile,
  type YearnReportReason,
} from '../lib/yearnRepository';
import {
  YEARN_INTRO_NOTE_MAX_LENGTH,
  clampYearnIntroNoteDraft,
  createYearnLikeSendPayload,
  getYearnIntroNoteState,
} from '../lib/yearnIntro';
import {
  createEncryptedYearnLikeSendPayload,
  type YearnIntroMessageCiphertext,
  type YearnIntroMessageEncryptor,
} from '../lib/yearnIntroMessage';
import { YearnRecipientKeyChangedError } from '../lib/yearnKeyDirectory';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

// The verified badge renders only because the pipeline behind is_verified is
// now real: a live camera selfie reviewed by a human through yearn-moderation,
// and a DB trigger (20260730000005) that makes is_verified=true impossible
// without an approved verification_submissions row. Liveness vendor screening
// remains a fail-closed founder item that strengthens, not gates, this flow.
const YEARN_VERIFICATION_PIPELINE_LIVE = true;

type DeckIcon = React.ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type YearnDeckProfile = Omit<YearnDiscoverProfile, 'photos'> & {
  photos: YearnSignedPhoto[];
};

interface DiscoverDeckProps {
  supabase: AnySupabaseClient | null;
  isAuthenticated: boolean;
  allowSampleProfiles?: boolean;
  introMessageEncryptor?: YearnIntroMessageEncryptor;
}

function buildFallbackPrompts(
  prompts: readonly { question: string; answer: string }[],
): YearnDiscoverProfile['prompts'] {
  return prompts.map((prompt) => ({
    question: prompt.question,
    answer: prompt.answer,
  }));
}

const fallbackDeckProfiles: YearnDeckProfile[] = sampleProfiles.map((profile) => ({
  id: profile.id,
  displayName: profile.name,
  age: profile.age,
  pronouns: profile.pronouns,
  intention: profile.intention,
  relationshipStructure: profile.relationshipStructure,
  photos: [
    {
      path: null,
      signedUrl: null,
      symbol: 'sparkles',
      tint_hex: profile.accentColor,
    },
  ],
  prompts: buildFallbackPrompts(profile.prompts),
  interests: profile.interests,
  isVerified: profile.verified,
  city: profile.city,
  distanceBucket: `${profile.distanceMiles} mi`,
  distanceMiles: profile.distanceMiles,
  occupation: profile.occupation,
  lastActiveAt: profile.lastActive,
}));

const safetyReportReasons: readonly { reason: YearnReportReason; label: string }[] = [
  { reason: 'fake_profile', label: 'Fake profile' },
  { reason: 'harassment', label: 'Harassment' },
  { reason: 'sexual_content', label: 'Sexual content' },
  { reason: 'underage', label: 'Underage' },
  { reason: 'scam', label: 'Scam' },
  { reason: 'other', label: 'Other' },
];

function formatDistance(profile: YearnDeckProfile): string | null {
  if (profile.distanceBucket) return profile.distanceBucket;
  if (typeof profile.distanceMiles === 'number') {
    return `${Math.round(profile.distanceMiles)} mi`;
  }
  return null;
}

function formatLastActive(value: string | undefined): string | null {
  if (!value) return null;
  if (value.toLowerCase().startsWith('active')) return value;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  const elapsedMs = Date.now() - timestamp;
  const elapsedHours = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)));
  if (elapsedHours < 1) return 'Active now';
  if (elapsedHours < 24) return `Active ${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return 'Active yesterday';
  return `Active ${elapsedDays}d ago`;
}

function formatProfileMeta(profile: YearnDeckProfile): string {
  const values = [
    profile.city,
    formatDistance(profile),
    formatLastActive(profile.lastActiveAt),
  ].filter((value): value is string => Boolean(value));

  return values.length > 0 ? values.join(' · ') : 'Nearby';
}

async function fetchSignedDeckProfiles(
  supabase: AnySupabaseClient,
): Promise<YearnDeckProfile[]> {
  const repository = new YearnRepository(supabase);
  const profiles = await repository.fetchDeck(30);
  return Promise.all(profiles.map(async (profile) => ({
    ...profile,
    photos: await resolveYearnPhotoSignedUrls(supabase, profile.photos),
  })));
}

export function DiscoverDeck({
  allowSampleProfiles = false,
  supabase,
  isAuthenticated,
  introMessageEncryptor,
}: DiscoverDeckProps) {
  const [profiles, setProfiles] = React.useState<YearnDeckProfile[]>(
    allowSampleProfiles ? fallbackDeckProfiles : [],
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [history, setHistory] = React.useState<YearnDeckHistoryEntry[]>([]);
  const [photoIndexByProfileId, setPhotoIndexByProfileId] = React.useState<Record<string, number>>({});
  const [lastActionMessage, setLastActionMessage] = React.useState<string | null>(null);
  const [writeError, setWriteError] = React.useState<string | null>(null);
  const [isWritingAction, setIsWritingAction] = React.useState(false);
  const [isPreparingIntro, setIsPreparingIntro] = React.useState(false);
  const [introKeyWarning, setIntroKeyWarning] = React.useState<string | null>(null);
  const [acceptChangedIntroKey, setAcceptChangedIntroKey] = React.useState(false);
  const [loadRequestId, setLoadRequestId] = React.useState(0);
  const [introComposerProfileId, setIntroComposerProfileId] = React.useState<string | null>(null);
  const [introDraft, setIntroDraft] = React.useState('');
  const [safetyPanelProfileId, setSafetyPanelProfileId] = React.useState<string | null>(null);
  const [isWritingSafetyAction, setIsWritingSafetyAction] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const loadDeck = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextProfiles = isAuthenticated && supabase
          ? await fetchSignedDeckProfiles(supabase)
          : allowSampleProfiles ? fallbackDeckProfiles : [];

        if (cancelled) return;
        setProfiles(nextProfiles);
        setCurrentIndex(0);
        setHistory([]);
        setPhotoIndexByProfileId({});
        setLastActionMessage(null);
        setWriteError(null);
        setSafetyPanelProfileId(null);
      } catch (err) {
        if (cancelled) return;
        setProfiles([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadDeck();

    return () => {
      cancelled = true;
    };
  }, [allowSampleProfiles, isAuthenticated, loadRequestId, supabase]);

  const currentProfile = profiles[currentIndex] ?? null;
  const currentProfileId = currentProfile?.id ?? null;
  const isIntroComposerOpen = Boolean(
    currentProfileId && introComposerProfileId === currentProfileId,
  );
  const isSafetyPanelOpen = Boolean(
    currentProfileId && safetyPanelProfileId === currentProfileId,
  );
  const introNoteState = React.useMemo(() => (
    getYearnIntroNoteState(introDraft)
  ), [introDraft]);
  const currentPhotoIndex = currentProfile
    ? photoIndexByProfileId[currentProfile.id] ?? 0
    : 0;
  const activePhoto = currentProfile
    ? getYearnActivePhoto(currentProfile, currentPhotoIndex) as YearnSignedPhoto | null
    : null;
  const progressSegments = currentProfile
    ? getYearnPhotoProgressSegments(currentProfile, currentPhotoIndex)
    : [];

  const handleRefresh = React.useCallback(() => {
    setLoadRequestId((requestId) => requestId + 1);
  }, []);

  const removeProfileFromDeck = React.useCallback((profileId: string) => {
    // Compute the new index from the SAME snapshot we filter, not a stale
    // closure length. Shift left only when the removed card sat before the
    // current one, then clamp to the new bounds (audit B3).
    setProfiles((current) => {
      const removedIndex = current.findIndex((profile) => profile.id === profileId);
      const next = current.filter((profile) => profile.id !== profileId);
      if (removedIndex !== -1) {
        setCurrentIndex((index) => {
          const shifted = removedIndex < index ? index - 1 : index;
          return Math.min(Math.max(shifted, 0), Math.max(next.length - 1, 0));
        });
      }
      return next;
    });
    setPhotoIndexByProfileId((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    setIntroComposerProfileId(null);
    setIntroDraft('');
    setSafetyPanelProfileId(null);
  }, []);

  React.useEffect(() => {
    if (!introComposerProfileId) return;
    if (introComposerProfileId === currentProfileId) return;
    setIntroComposerProfileId(null);
    setIntroDraft('');
  }, [currentProfileId, introComposerProfileId]);

  React.useEffect(() => {
    if (!safetyPanelProfileId) return;
    if (safetyPanelProfileId === currentProfileId) return;
    setSafetyPanelProfileId(null);
  }, [currentProfileId, safetyPanelProfileId]);

  const handlePhotoAdvance = React.useCallback(() => {
    if (!currentProfile) return;
    setPhotoIndexByProfileId((current) => ({
      ...current,
      [currentProfile.id]: getNextYearnPhotoIndex(
        currentProfile,
        current[currentProfile.id] ?? 0,
      ),
    }));
  }, [currentProfile]);

  const persistDeckWrite = React.useCallback(async (
    action: Extract<YearnDeckAction, 'like' | 'pass'>,
    profile: YearnDeckProfile,
    profileIndex: number,
    intro: string | null = null,
    introCiphertext: YearnIntroMessageCiphertext | null = null,
  ) => {
    if (!isAuthenticated || !supabase) return;

    setIsWritingAction(true);
    setWriteError(null);

    try {
      const repository = new YearnRepository(supabase);
      if (action === 'like') {
        const match = await repository.sendLike(profile.id, intro, introCiphertext);
        if (match) {
          setLastActionMessage(`Matched with ${match.profile.displayName}`);
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        }
      } else {
        await repository.sendPass(profile.id);
      }
    } catch (err) {
      const verb = action === 'like' ? 'Like' : 'Pass';
      setWriteError(`${verb} was not saved. ${err instanceof Error ? err.message : String(err)}`);
      setLastActionMessage(`${verb} was not saved`);
      setCurrentIndex(profileIndex);
      setHistory((current) => {
        const lastEntry = current.at(-1);
        if (
          lastEntry?.profileId === profile.id
          && lastEntry.action === action
          && lastEntry.profileIndex === profileIndex
        ) {
          return current.slice(0, -1);
        }
        return current;
      });
    } finally {
      setIsWritingAction(false);
    }
  }, [isAuthenticated, supabase]);

  const commitDeckAction = React.useCallback((
    action: YearnDeckAction,
    intro: string | null = null,
    introCiphertext: YearnIntroMessageCiphertext | null = null,
  ) => {
    if (!currentProfile) return;
    if (isWritingAction && (action === 'like' || action === 'pass')) return;

    setWriteError(null);
    setIntroComposerProfileId(null);
    setIntroDraft('');
    setIntroKeyWarning(null);
    setAcceptChangedIntroKey(false);
    setHistory((current) => recordYearnDeckAction(
      current,
      currentProfile,
      currentIndex,
      action,
    ));
    setLastActionMessage(formatYearnDeckAction(action, currentProfile.displayName, {
      hasIntro: Boolean(intro || introCiphertext),
    }));
    setCurrentIndex((index) => advanceYearnDeckIndex(index, profiles.length));

    if (action === 'like' || action === 'pass') {
      void Haptics.impactAsync(
        action === 'like'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {});
      void persistDeckWrite(action, currentProfile, currentIndex, intro, introCiphertext);
    }
  }, [currentIndex, currentProfile, isWritingAction, persistDeckWrite, profiles.length]);

  const openIntroComposer = React.useCallback(() => {
    if (
      !currentProfile
      || isIntroComposerOpen
      || isSafetyPanelOpen
      || isWritingAction
      || isPreparingIntro
      || isWritingSafetyAction
    ) {
      return;
    }
    setWriteError(null);
    setLastActionMessage(null);
    setIntroDraft('');
    setIntroKeyWarning(null);
    setAcceptChangedIntroKey(false);
    setIntroComposerProfileId(currentProfile.id);
  }, [
    currentProfile,
    isIntroComposerOpen,
    isPreparingIntro,
    isSafetyPanelOpen,
    isWritingAction,
    isWritingSafetyAction,
  ]);

  const handleDeckAction = React.useCallback((action: YearnDeckAction) => {
    if (isIntroComposerOpen) return;
    if (isSafetyPanelOpen || isWritingSafetyAction) return;

    if (action === 'like') {
      openIntroComposer();
      return;
    }

    commitDeckAction(action);
  }, [
    commitDeckAction,
    isIntroComposerOpen,
    isSafetyPanelOpen,
    isWritingSafetyAction,
    openIntroComposer,
  ]);

  const handleIntroDraftChange = React.useCallback((value: string) => {
    setIntroDraft(clampYearnIntroNoteDraft(value));
  }, []);

  const handleCancelIntro = React.useCallback(() => {
    setIntroComposerProfileId(null);
    setIntroDraft('');
    setIntroKeyWarning(null);
    setAcceptChangedIntroKey(false);
  }, []);

  const toggleSafetyPanel = React.useCallback(() => {
    if (!currentProfile || isIntroComposerOpen || isWritingSafetyAction) return;
    if (!isAuthenticated || !supabase) {
      setWriteError('Sign in to report or block profiles.');
      return;
    }
    setWriteError(null);
    setLastActionMessage(null);
    setSafetyPanelProfileId((profileId) => (
      profileId === currentProfile.id ? null : currentProfile.id
    ));
  }, [
    currentProfile,
    isAuthenticated,
    isIntroComposerOpen,
    isWritingSafetyAction,
    supabase,
  ]);

  const handleBlockCurrentProfile = React.useCallback(async () => {
    if (!currentProfile || isWritingSafetyAction) return;
    if (!isAuthenticated || !supabase) {
      setWriteError('Sign in to block profiles.');
      return;
    }

    setIsWritingSafetyAction(true);
    setWriteError(null);

    try {
      await new YearnRepository(supabase).blockUser(currentProfile.id);
      setLastActionMessage(`Blocked ${currentProfile.displayName}`);
      removeProfileFromDeck(currentProfile.id);
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsWritingSafetyAction(false);
    }
  }, [
    currentProfile,
    isAuthenticated,
    isWritingSafetyAction,
    removeProfileFromDeck,
    supabase,
  ]);

  const handleReportCurrentProfile = React.useCallback(async (reason: YearnReportReason) => {
    if (!currentProfile || isWritingSafetyAction) return;
    if (!isAuthenticated || !supabase) {
      setWriteError('Sign in to report profiles.');
      return;
    }

    setIsWritingSafetyAction(true);
    setWriteError(null);

    try {
      await new YearnRepository(supabase).reportUser({
        reportedId: currentProfile.id,
        reason,
      });
      setLastActionMessage(`Reported ${currentProfile.displayName}`);
      removeProfileFromDeck(currentProfile.id);
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsWritingSafetyAction(false);
    }
  }, [
    currentProfile,
    isAuthenticated,
    isWritingSafetyAction,
    removeProfileFromDeck,
    supabase,
  ]);

  const handleSendLike = React.useCallback(async (includeIntro: boolean) => {
    if (
      !currentProfile
      || isPreparingIntro
      || isWritingAction
      || isWritingSafetyAction
    ) {
      return;
    }

    setIsPreparingIntro(true);

    try {
      let payload;
      if (includeIntro) {
        if (!introMessageEncryptor) {
          throw new Error('Encrypted intros are not available yet. Send a like without an intro.');
        }
        payload = await createEncryptedYearnLikeSendPayload({
          profileId: currentProfile.id,
          introDraft,
          encryptor: introMessageEncryptor,
          acceptChangedRecipientKey: acceptChangedIntroKey,
        });
      } else {
        payload = createYearnLikeSendPayload(
          currentProfile.id,
          '',
        );
      }
      commitDeckAction('like', payload.intro, payload.introCiphertext);
    } catch (err) {
      if (err instanceof YearnRecipientKeyChangedError) {
        setIntroKeyWarning(
          `${currentProfile.displayName}'s encryption key changed since you last sent an intro. `
          + 'Verify with them outside Yearn, then press Send again to trust the new key.',
        );
        setAcceptChangedIntroKey(true);
      } else {
        setWriteError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsPreparingIntro(false);
    }
  }, [
    acceptChangedIntroKey,
    commitDeckAction,
    currentProfile,
    introDraft,
    introMessageEncryptor,
    isPreparingIntro,
    isWritingAction,
    isWritingSafetyAction,
  ]);

  const lastHistoryEntry = history.at(-1) ?? null;
  const canUndo = Boolean(
    lastHistoryEntry
    && !isWritingAction
    && !isPreparingIntro
    && !isWritingSafetyAction
    && !isIntroComposerOpen
    && !isSafetyPanelOpen
    && (!isAuthenticated || (lastHistoryEntry.action !== 'like' && lastHistoryEntry.action !== 'pass')),
  );

  const handleUndo = React.useCallback(() => {
    if (!canUndo) return;
    const rewound = rewindYearnDeck(history, currentIndex);
    setHistory(rewound.history);
    setCurrentIndex(rewound.profileIndex);
    setLastActionMessage(rewound.entry ? 'Last action undone' : 'Nothing to undo');
  }, [canUndo, currentIndex, history]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture) => (
      Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
    ),
    onPanResponderRelease: (_event: GestureResponderEvent, gesture) => {
      if (gesture.dx > 72) {
        handleDeckAction('like');
      } else if (gesture.dx < -72) {
        handleDeckAction('pass');
      }
    },
  }), [handleDeckAction]);

  if (isLoading) {
    return (
      <View style={styles.statusPanel}>
        <ActivityIndicator color={yearnColors.coral} size="small" />
        <Text style={styles.statusTitle}>Loading profiles</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>Profiles unavailable</Text>
        <Text style={styles.statusDetail}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry profiles"
          onPress={handleRefresh}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <RefreshCw size={17} color={yearnColors.inkwine} strokeWidth={2.4} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const filtersPanel = isAuthenticated && supabase ? (
    <>
      <DiscoverFilters supabase={supabase} onChanged={handleRefresh} />
      <BoostButton supabase={supabase} />
    </>
  ) : null;

  if (!currentProfile) {
    return (
      <View>
        {filtersPanel}
        <View style={styles.statusPanel}>
          <Text style={styles.statusTitle}>No more profiles</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review profiles again"
            onPress={handleRefresh}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
          >
            <RefreshCw size={17} color={yearnColors.inkwine} strokeWidth={2.4} />
            <Text style={styles.retryButtonText}>Review again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const firstPrompt = currentProfile.prompts[0];
  const meta = formatProfileMeta(currentProfile);
  const photoTint = activePhoto?.tint_hex ?? yearnColors.surfaceElevated;
  const hasSignedPhoto = Boolean(activePhoto?.signedUrl);
  const canUseSafetyControls = Boolean(
    isAuthenticated
    && supabase
    && !isWritingAction
    && !isPreparingIntro
    && !isWritingSafetyAction
    && !isIntroComposerOpen
  );

  return (
    <View style={styles.deck}>
      {filtersPanel}
      <View style={styles.card} {...panResponder.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next photo for ${currentProfile.displayName}`}
          onPress={handlePhotoAdvance}
          style={[styles.photo, { backgroundColor: photoTint }]}
        >
          {hasSignedPhoto ? (
            <Image
              contentFit="cover"
              source={{ uri: activePhoto?.signedUrl ?? undefined }}
              style={styles.photoImage}
              transition={160}
            />
          ) : (
            <View style={styles.photoInitial}>
              <Text style={styles.photoInitialText}>
                {currentProfile.displayName.slice(0, 1)}
              </Text>
            </View>
          )}

          <View style={styles.progressRow}>
            {progressSegments.map((segment) => (
              <View
                key={segment.index}
                style={[
                  styles.progressSegment,
                  segment.isActive && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>

          <LinearGradient
            colors={['rgba(26, 14, 20, 0)', 'rgba(26, 14, 20, 0.86)']}
            style={styles.photoOverlay}
          />

          <View style={styles.cardIdentity}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {currentProfile.displayName}, {currentProfile.age}
              </Text>
              {YEARN_VERIFICATION_PIPELINE_LIVE && currentProfile.isVerified ? (
                <ShieldCheck
                  size={20}
                  color={yearnColors.sage}
                  strokeWidth={2.4}
                />
              ) : null}
            </View>
            <Text style={styles.meta}>{currentProfile.pronouns}</Text>
          </View>
        </Pressable>

        <View style={styles.profileBody}>
          <View style={styles.locationRow}>
            <MapPin size={15} color={yearnColors.gold} strokeWidth={2.2} />
            <Text style={styles.locationText}>{meta}</Text>
          </View>

          {currentProfile.occupation ? (
            <Text style={styles.occupation}>{currentProfile.occupation}</Text>
          ) : null}

          {currentProfile.bio ? (
            <Text style={styles.bio}>{currentProfile.bio}</Text>
          ) : null}

          <Text style={styles.intent}>{currentProfile.intention}</Text>

          {firstPrompt ? (
            <View style={styles.promptBlock}>
              <Text style={styles.promptQuestion}>{firstPrompt.question}</Text>
              <Text style={styles.promptAnswer}>{firstPrompt.answer}</Text>
            </View>
          ) : null}

          <View style={styles.interestRow}>
            {currentProfile.interests.map((interest) => (
              <View key={interest} style={styles.interestPill}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>

          {isAuthenticated && supabase ? (
            <View style={styles.safetyRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Report ${currentProfile.displayName}`}
                disabled={!canUseSafetyControls}
                onPress={toggleSafetyPanel}
                style={({ pressed }) => [
                  styles.safetyButton,
                  pressed && styles.safetyButtonPressed,
                  isSafetyPanelOpen && styles.safetyButtonActive,
                  !canUseSafetyControls && styles.safetyButtonDisabled,
                ]}
              >
                <Flag size={15} color={yearnColors.gold} strokeWidth={2.2} />
                <Text style={styles.safetyButtonText}>Report</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Block ${currentProfile.displayName}`}
                disabled={!canUseSafetyControls}
                onPress={() => { void handleBlockCurrentProfile(); }}
                style={({ pressed }) => [
                  styles.safetyButton,
                  pressed && styles.safetyButtonPressed,
                  !canUseSafetyControls && styles.safetyButtonDisabled,
                ]}
              >
                <Ban size={15} color={yearnColors.alarm} strokeWidth={2.2} />
                <Text style={styles.safetyButtonText}>Block</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {lastActionMessage ? (
        <Text style={styles.actionMessage}>{lastActionMessage}</Text>
      ) : null}

      {writeError ? (
        <Text style={styles.writeError}>{writeError}</Text>
      ) : null}

      {isIntroComposerOpen ? (
        <View style={styles.introComposer}>
          <Text style={styles.introTitle}>
            Send an intro to {currentProfile.displayName}
          </Text>
          <TextInput
            accessibilityLabel="Intro note"
            maxLength={YEARN_INTRO_NOTE_MAX_LENGTH}
            multiline
            onChangeText={handleIntroDraftChange}
            placeholder="Mention something specific from their profile"
            placeholderTextColor={yearnColors.textTertiary}
            style={styles.introInput}
            textAlignVertical="top"
            value={introDraft}
          />
          {introKeyWarning ? (
            <Text accessibilityRole="alert" style={styles.introKeyWarning}>
              {introKeyWarning}
            </Text>
          ) : null}
          <View style={styles.introFooter}>
            <Text
              style={[
                styles.introCounter,
                introNoteState.isAtLimit && styles.introCounterAtLimit,
              ]}
            >
              {introNoteState.counterLabel}
            </Text>
            <View style={styles.introButtonRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel intro"
                onPress={handleCancelIntro}
                style={({ pressed }) => [
                  styles.introSecondaryButton,
                  pressed && styles.introButtonPressed,
                ]}
              >
                <Text style={styles.introSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Like without intro"
                disabled={isWritingAction || isPreparingIntro}
                onPress={() => handleSendLike(false)}
                style={({ pressed }) => [
                  styles.introSecondaryButton,
                  pressed && styles.introButtonPressed,
                  (isWritingAction || isPreparingIntro) && styles.introButtonDisabled,
                ]}
              >
                <Text style={styles.introSecondaryButtonText}>Skip</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send like"
                disabled={isWritingAction || isPreparingIntro}
                onPress={() => handleSendLike(true)}
                style={({ pressed }) => [
                  styles.introPrimaryButton,
                  pressed && styles.introPrimaryButtonPressed,
                  (isWritingAction || isPreparingIntro) && styles.introButtonDisabled,
                ]}
              >
                <Text style={styles.introPrimaryButtonText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {isSafetyPanelOpen ? (
        <View style={styles.safetyPanel}>
          <Text style={styles.safetyPanelTitle}>
            Report {currentProfile.displayName}
          </Text>
          <View style={styles.safetyReasonGrid}>
            {safetyReportReasons.map((item) => (
              <Pressable
                key={item.reason}
                accessibilityRole="button"
                accessibilityLabel={`Report ${currentProfile.displayName} for ${item.label}`}
                disabled={isWritingSafetyAction}
                onPress={() => { void handleReportCurrentProfile(item.reason); }}
                style={({ pressed }) => [
                  styles.safetyReasonButton,
                  pressed && styles.safetyButtonPressed,
                  isWritingSafetyAction && styles.safetyButtonDisabled,
                ]}
              >
                <Text style={styles.safetyReasonText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel report"
            disabled={isWritingSafetyAction}
            onPress={() => setSafetyPanelProfileId(null)}
            style={({ pressed }) => [
              styles.safetyCancelButton,
              pressed && styles.safetyButtonPressed,
              isWritingSafetyAction && styles.safetyButtonDisabled,
            ]}
          >
            <Text style={styles.safetyCancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <DeckActionButton
          disabled={!canUndo}
          icon={RotateCcw}
          label="Undo"
          onPress={handleUndo}
          tone="quiet"
        />
        <DeckActionButton
          disabled={isWritingAction || isIntroComposerOpen || isSafetyPanelOpen || isWritingSafetyAction}
          icon={X}
          label="Pass"
          onPress={() => handleDeckAction('pass')}
          tone="danger"
        />
        {/* Star and Boost were removed: they showed a success toast and advanced
            the deck but never persisted anything server-side (audit U1/B5).
            They return as real features once the shortlist store and the
            monetization paywall + server receipt validation ship. */}
        <DeckActionButton
          disabled={
            isWritingAction
            || isPreparingIntro
            || isIntroComposerOpen
            || isSafetyPanelOpen
            || isWritingSafetyAction
          }
          icon={Heart}
          label="Like"
          onPress={() => handleDeckAction('like')}
          tone="coral"
        />
      </View>
    </View>
  );
}

function DeckActionButton({
  disabled = false,
  icon: Icon,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  icon: DeckIcon;
  label: string;
  onPress: () => void;
  tone: 'quiet' | 'danger' | 'gold' | 'sage' | 'coral';
}) {
  const colorByTone = {
    quiet: yearnColors.textSecondary,
    danger: yearnColors.alarm,
    gold: yearnColors.gold,
    sage: yearnColors.sage,
    coral: yearnColors.coral,
  };
  const color = disabled ? yearnColors.textTertiary : colorByTone[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        { borderColor: color },
        disabled && styles.actionButtonDisabled,
      ]}
    >
      <Icon color={color} size={23} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  deck: {
    gap: yearnSpacing.lg,
  },
  statusPanel: {
    alignItems: 'center',
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.xl,
  },
  statusTitle: {
    color: yearnColors.vellum,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusDetail: {
    color: yearnColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.sm,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  retryButtonPressed: {
    backgroundColor: yearnColors.coralPressed,
  },
  retryButtonText: {
    color: yearnColors.inkwine,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photo: {
    aspectRatio: 0.82,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    left: yearnSpacing.md,
    position: 'absolute',
    right: yearnSpacing.md,
    top: yearnSpacing.md,
    zIndex: 2,
  },
  progressSegment: {
    backgroundColor: 'rgba(245, 230, 216, 0.32)',
    borderRadius: yearnRadius.pill,
    flex: 1,
    height: 4,
  },
  progressSegmentActive: {
    backgroundColor: yearnColors.vellum,
  },
  photoInitial: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 14, 20, 0.28)',
    borderColor: 'rgba(245, 230, 216, 0.18)',
    borderRadius: 82,
    borderWidth: 1,
    height: 164,
    justifyContent: 'center',
    position: 'absolute',
    top: '30%',
    width: 164,
  },
  photoInitialText: {
    color: yearnColors.vellum,
    fontSize: 78,
    fontWeight: '500',
  },
  cardIdentity: {
    padding: yearnSpacing.xl,
    zIndex: 1,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  name: {
    color: yearnColors.vellum,
    ...yearnTypography.display,
  },
  meta: {
    color: yearnColors.textSecondary,
    fontSize: 15,
    marginTop: 2,
  },
  profileBody: {
    gap: yearnSpacing.md,
    padding: yearnSpacing.xl,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  locationText: {
    color: yearnColors.textSecondary,
    fontSize: 13,
  },
  occupation: {
    color: yearnColors.vellum,
    fontSize: 16,
    fontWeight: '600',
  },
  bio: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  intent: {
    color: yearnColors.sage,
    fontSize: 14,
  },
  promptBlock: {
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.xs,
    padding: yearnSpacing.lg,
  },
  promptQuestion: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: yearnColors.vellum,
    ...yearnTypography.body,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  interestPill: {
    backgroundColor: 'rgba(232, 133, 107, 0.12)',
    borderColor: 'rgba(232, 133, 107, 0.26)',
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  interestText: {
    color: yearnColors.vellum,
    fontSize: 12,
    fontWeight: '600',
  },
  safetyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  safetyButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.surfaceElevated,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  safetyButtonActive: {
    borderColor: yearnColors.gold,
  },
  safetyButtonPressed: {
    opacity: 0.78,
  },
  safetyButtonDisabled: {
    opacity: 0.5,
  },
  safetyButtonText: {
    color: yearnColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionMessage: {
    color: yearnColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  writeError: {
    color: yearnColors.alarm,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  introComposer: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.lg,
  },
  introTitle: {
    color: yearnColors.vellum,
    fontSize: 15,
    fontWeight: '700',
  },
  introInput: {
    backgroundColor: yearnColors.inkwine,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    color: yearnColors.vellum,
    minHeight: 92,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: yearnSpacing.md,
    ...yearnTypography.body,
  },
  introFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: yearnSpacing.md,
    justifyContent: 'space-between',
  },
  introCounter: {
    color: yearnColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  introCounterAtLimit: {
    color: yearnColors.gold,
  },
  introKeyWarning: {
    color: yearnColors.gold,
    fontSize: 12,
    lineHeight: 17,
  },
  introButtonRow: {
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  introPrimaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.sm,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 14,
  },
  introPrimaryButtonPressed: {
    backgroundColor: yearnColors.coralPressed,
  },
  introPrimaryButtonText: {
    color: yearnColors.inkwine,
    fontSize: 13,
    fontWeight: '800',
  },
  introSecondaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 14,
  },
  introButtonPressed: {
    opacity: 0.78,
  },
  introSecondaryButtonText: {
    color: yearnColors.vellum,
    fontSize: 13,
    fontWeight: '700',
  },
  introButtonDisabled: {
    opacity: 0.5,
  },
  safetyPanel: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.lg,
  },
  safetyPanelTitle: {
    color: yearnColors.vellum,
    fontSize: 15,
    fontWeight: '700',
  },
  safetyReasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  safetyReasonButton: {
    backgroundColor: yearnColors.surfaceElevated,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  safetyReasonText: {
    color: yearnColors.vellum,
    fontSize: 13,
    fontWeight: '700',
  },
  safetyCancelButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
  },
  safetyCancelText: {
    color: yearnColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: yearnSpacing.md,
    justifyContent: 'center',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.06)',
    borderRadius: 30,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  actionButtonDisabled: {
    opacity: 0.44,
  },
});
