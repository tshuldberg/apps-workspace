import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { yearnLegalLinks } from '../lib/legalLinks';
import {
  isYearnPushEnabled,
  registerForYearnPush,
  unregisterYearnPush,
  type PushSupabaseClient,
} from '../lib/push';
import { MembershipSection } from './MonetizationPanels';
import { VerificationSection } from './VerificationSection';
import {
  Archive,
  CheckCircle2,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react-native';
import { yearnSecureStorage, type AnySupabaseClient } from '../lib/supabase';
import {
  YEARN_E2EE_KEY_ALGORITHM,
  decryptYearnMessageForDevice,
  encryptYearnUserMessageForRecipient,
  getOrCreateYearnE2eeDeviceIdentity,
  yearnE2eeDevicePublicKeySchema,
  type YearnE2eeDeviceIdentity,
} from '../lib/yearnE2ee';
import {
  YearnRecipientKeyChangedError,
  assertTrustedYearnRecipientKey,
  resolveTrustedYearnSenderKey,
  type YearnSenderKeyDecision,
} from '../lib/yearnKeyDirectory';
import {
  loadYearnSentEchoes,
  persistYearnSentEcho,
} from '../lib/sentMessageEchoStore';
import {
  YearnRepository,
  type YearnEncryptedMessage,
  type YearnIncomingLike,
  type YearnMatch,
  type YearnProfile,
} from '../lib/yearnRepository';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

interface SurfaceProps {
  supabase: AnySupabaseClient | null;
  isAuthenticated: boolean;
}

interface MatchesSurfaceProps extends SurfaceProps {
  userId: string | null;
}

interface ProfileSurfaceProps extends SurfaceProps {
  userId: string | null;
  onSignOut: () => Promise<void>;
}

function formatRelativeDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  const elapsedMs = Date.now() - timestamp;
  const elapsedHours = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)));
  if (elapsedHours < 1) return 'Now';
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function lockedSurface(title: string): React.ReactElement {
  return (
    <View style={styles.panel}>
      <View style={styles.emptyIcon}>
        <LockKeyhole size={22} color={yearnColors.gold} strokeWidth={2.2} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>Sign in to view this Yearn surface.</Text>
    </View>
  );
}

function loadingSurface(title: string): React.ReactElement {
  return (
    <View style={styles.panel}>
      <ActivityIndicator color={yearnColors.coral} size="small" />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function errorSurface(message: string, onRetry: () => void): React.ReactElement {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Could not load</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry"
        onPress={onRetry}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <RefreshCw size={17} color={yearnColors.inkwine} strokeWidth={2.4} />
        <Text style={styles.primaryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function YearnLikesSurface({ supabase, isAuthenticated }: SurfaceProps) {
  const [likes, setLikes] = React.useState<YearnIncomingLike[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !supabase) {
      setLikes([]);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);
    void new YearnRepository(supabase).fetchIncomingLikes()
      .then((nextLikes) => {
        if (!cancelled) setLikes(nextLikes);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshToken, supabase]);

  // Realtime: refresh the list when a new like row arrives. No filter is
  // needed: RLS scopes the postgres-changes stream to rows this user may see
  // (received likes plus own sent likes; the latter only costs a refetch).
  // Falls back silently to manual Refresh when Realtime is not enabled.
  React.useEffect(() => {
    if (!supabase || !isAuthenticated) return undefined;

    const channel = supabase
      .channel('yearn:likes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'yearn', table: 'likes' },
        () => {
          setRefreshToken((token) => token + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, isAuthenticated]);

  const runLikeAction = React.useCallback(async (
    like: YearnIncomingLike,
    action: 'like_back' | 'dismiss',
  ) => {
    if (!supabase) return;
    setActionMessage(null);
    setError(null);

    try {
      const repository = new YearnRepository(supabase);
      if (action === 'like_back') {
        const match = await repository.likeBack(like.id);
        setActionMessage(match ? `Matched with ${match.profile.displayName}` : 'Like sent');
      } else {
        await repository.dismissLike(like.id);
        setActionMessage(`Passed on ${like.profile.displayName}`);
      }
      setLikes((current) => current.filter((item) => item.id !== like.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [supabase]);

  if (!isAuthenticated) return lockedSurface('Likes');
  if (isLoading) return loadingSurface('Loading likes');
  if (error) return errorSurface(error, () => setRefreshToken((token) => token + 1));

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.kicker}>Likes</Text>
          <Text style={styles.title}>People who liked you</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh likes"
          onPress={() => setRefreshToken((token) => token + 1)}
          style={styles.iconButton}
        >
          <RefreshCw size={17} color={yearnColors.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {actionMessage ? <Text style={styles.successText}>{actionMessage}</Text> : null}

      {likes.length === 0 ? (
        <Text style={styles.detail}>No new likes right now.</Text>
      ) : likes.map((like) => {
        const introLabel = like.encryptedIntro
          ? 'Encrypted intro'
          : like.intro ? 'Intro note' : 'No intro';
        return (
          <View key={like.id} style={styles.listCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{like.profile.displayName.slice(0, 1)}</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {like.profile.displayName}, {like.profile.age}
                </Text>
                <Text style={styles.metaText}>{formatRelativeDate(like.receivedAt)}</Text>
              </View>
              <Text style={styles.detail}>{introLabel}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Pass on ${like.profile.displayName}`}
                  onPress={() => { void runLikeAction(like, 'dismiss'); }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <X size={16} color={yearnColors.textSecondary} strokeWidth={2.4} />
                  <Text style={styles.secondaryButtonText}>Pass</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Like back ${like.profile.displayName}`}
                  onPress={() => { void runLikeAction(like, 'like_back'); }}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                >
                  <CheckCircle2 size={16} color={yearnColors.inkwine} strokeWidth={2.4} />
                  <Text style={styles.primaryButtonText}>Like back</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function YearnMatchesSurface({ supabase, isAuthenticated, userId }: MatchesSurfaceProps) {
  const [matches, setMatches] = React.useState<YearnMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<YearnEncryptedMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [messagesReloadToken, setMessagesReloadToken] = React.useState(0);
  const [identity, setIdentity] = React.useState<YearnE2eeDeviceIdentity | null>(null);
  const [draft, setDraft] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [chatKeyWarning, setChatKeyWarning] = React.useState<string | null>(null);
  const [acceptChangedChatKey, setAcceptChangedChatKey] = React.useState(false);
  const [sentEchoes, setSentEchoes] = React.useState<Record<string, string>>({});
  const [senderKeyDecisions, setSenderKeyDecisions] = React.useState<Record<string, YearnSenderKeyDecision>>({});
  const [senderKeyWarning, setSenderKeyWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !userId) {
      setIdentity(null);
      return () => {
        cancelled = true;
      };
    }

    void getOrCreateYearnE2eeDeviceIdentity(userId, yearnSecureStorage)
      .then((value) => {
        if (!cancelled) setIdentity(value);
      })
      .catch(() => {
        if (!cancelled) setIdentity(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  React.useEffect(() => {
    setDraft('');
    setSendError(null);
    setChatKeyWarning(null);
    setAcceptChangedChatKey(false);
  }, [selectedMatchId]);

  React.useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !supabase) {
      setMatches([]);
      setSelectedMatchId(null);
      setMessages([]);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);
    void new YearnRepository(supabase).fetchMatches()
      .then((nextMatches) => {
        if (cancelled) return;
        setMatches(nextMatches);
        setSelectedMatchId((current) => {
          // Reconcile the selection against the fresh list: if the previously
          // selected match was archived/removed server-side, drop it instead of
          // keeping a dangling id that silently blanks the chat panel (audit B7).
          if (current && nextMatches.some((match) => match.id === current)) {
            return current;
          }
          return nextMatches[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshToken, supabase]);

  React.useEffect(() => {
    let cancelled = false;
    if (!supabase || !selectedMatchId) {
      setMessages([]);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingMessages(true);
    setSenderKeyWarning(null);
    const repository = new YearnRepository(supabase);
    void loadYearnSentEchoes(selectedMatchId)
      .then((echoes) => {
        if (!cancelled) setSentEchoes((current) => ({ ...echoes, ...current }));
      })
      .catch(() => {});
    void repository.fetchEncryptedMessages(selectedMatchId)
      .then((nextMessages) => {
        if (cancelled) return;
        setMessages(nextMessages);
        if (nextMessages.some((message) => message.senderId !== userId && !message.readAt)) {
          void repository.markEncryptedMessagesRead(selectedMatchId).catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
    // userId and refreshToken are deps: without userId the read-receipt filter
    // runs against a stale/null id; without refreshToken the open conversation
    // never refetches when the user taps Refresh (audit B2). messagesReloadToken
    // lets the realtime subscription trigger a message-only refetch.
  }, [selectedMatchId, supabase, userId, refreshToken, messagesReloadToken]);

  // Realtime: refresh the match list when a new match row lands (either
  // member's like_back). RLS scopes the stream to this user's matches.
  // Falls back silently to manual Refresh when Realtime is not enabled.
  React.useEffect(() => {
    if (!supabase || !isAuthenticated) return undefined;

    const channel = supabase
      .channel('yearn:matches')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'yearn', table: 'matches' },
        () => {
          setRefreshToken((token) => token + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, isAuthenticated]);

  // Realtime: subscribe to new ciphertext rows for the open conversation so
  // incoming messages appear without a manual refresh (Phase 4). Falls back
  // silently to the existing manual Refresh if Realtime is not enabled on the
  // hosted project (see plan 47) — no regression versus today's baseline.
  React.useEffect(() => {
    if (!supabase || !selectedMatchId) return undefined;

    const channel = supabase
      .channel(`yearn:messages:${selectedMatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'yearn',
          table: 'messages_ciphertext',
          filter: `match_id=eq.${selectedMatchId}`,
        },
        () => {
          setMessagesReloadToken((token) => token + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, selectedMatchId]);

  // Receive-path trust-on-first-use for sender keys. The library only enforces
  // sender identity when we pass the expected sender public key; without this a
  // match partner (or a rogue device) can message under a fresh, never-pinned
  // key with no warning (audit Y1). We pin each sender's key on first sight and
  // refuse to render messages whose key changed or whose pin is unreadable.
  React.useEffect(() => {
    let cancelled = false;
    if (!userId || !identity || messages.length === 0) {
      setSenderKeyDecisions({});
      return () => {
        cancelled = true;
      };
    }

    const firstBySender = new Map<string, YearnEncryptedMessage>();
    for (const message of messages) {
      if (message.senderId === userId) continue;
      if (!firstBySender.has(message.senderId)) {
        firstBySender.set(message.senderId, message);
      }
    }

    void (async () => {
      const decisions: Record<string, YearnSenderKeyDecision> = {};
      let sawUntrusted = false;
      for (const [senderId, message] of firstBySender) {
        const headerKey = message.ciphertext.header?.senderPublicKey;
        const incoming = yearnE2eeDevicePublicKeySchema.safeParse({
          userId: senderId,
          deviceId: message.ciphertext.senderDeviceId,
          publicKey: typeof headerKey === 'string' ? headerKey : '',
          keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
        });
        if (!incoming.success) {
          decisions[senderId] = { trust: 'unreadable', trustedPublicKey: null };
          sawUntrusted = true;
          continue;
        }
        try {
          const decision = await resolveTrustedYearnSenderKey({
            storage: yearnSecureStorage,
            ownerUserId: userId,
            senderUserId: senderId,
            incomingKey: incoming.data,
          });
          decisions[senderId] = decision;
          if (decision.trust === 'changed' || decision.trust === 'unreadable') {
            sawUntrusted = true;
          }
        } catch {
          decisions[senderId] = { trust: 'unreadable', trustedPublicKey: null };
          sawUntrusted = true;
        }
      }
      if (cancelled) return;
      setSenderKeyDecisions(decisions);
      setSenderKeyWarning(
        sawUntrusted
          ? "A message used an encryption key that doesn't match this match's pinned key. "
            + 'Verify with them outside Yearn before trusting it. These messages are hidden.'
          : null,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, userId, identity]);

  const archiveSelected = React.useCallback(async () => {
    if (!supabase || !selectedMatchId) return;
    setError(null);
    try {
      await new YearnRepository(supabase).archiveMatch(selectedMatchId);
      setMatches((current) => current.filter((match) => match.id !== selectedMatchId));
      setSelectedMatchId(null);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedMatchId, supabase]);

  const handleSendMessage = React.useCallback(async () => {
    const content = draft.trim();
    const match = matches.find((item) => item.id === selectedMatchId) ?? null;
    if (!supabase || !userId || !identity || !match || !content || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      const repository = new YearnRepository(supabase);
      const recipientKey = await repository.fetchIntroRecipientDeviceKey(match.profile.id);
      if (!recipientKey) {
        throw new Error(`${match.profile.displayName} has not published an encryption key yet.`);
      }

      await assertTrustedYearnRecipientKey({
        storage: yearnSecureStorage,
        ownerUserId: userId,
        fetchedKey: recipientKey,
        acceptChangedKey: acceptChangedChatKey,
      });

      const envelope = encryptYearnUserMessageForRecipient({
        content,
        createdAt: new Date().toISOString(),
        senderIdentity: identity,
        recipientKey,
      });
      const sent = await repository.sendEncryptedMessage(match.id, envelope);

      setSentEchoes((current) => ({ ...current, [sent.id]: content }));
      // Persist a device-local copy so the sender can re-read their own message
      // after a refetch or restart; the ciphertext is addressed to the recipient
      // and cannot be decrypted back by the sender (audit B4/U6).
      void persistYearnSentEcho(match.id, sent.id, content);
      setMessages((current) => [...current, sent]);
      setDraft('');
      setChatKeyWarning(null);
      setAcceptChangedChatKey(false);
    } catch (err) {
      if (err instanceof YearnRecipientKeyChangedError) {
        const name = matches.find((item) => item.id === selectedMatchId)?.profile.displayName ?? 'Their';
        setChatKeyWarning(
          `${name}'s encryption key changed since you last messaged. `
          + 'Verify with them outside Yearn, then press Send again to trust the new key.',
        );
        setAcceptChangedChatKey(true);
      } else {
        setSendError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsSending(false);
    }
  }, [acceptChangedChatKey, draft, identity, isSending, matches, selectedMatchId, supabase, userId]);

  if (!isAuthenticated) return lockedSurface('Matches');
  if (isLoading) return loadingSurface('Loading matches');
  if (error) return errorSurface(error, () => setRefreshToken((token) => token + 1));

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.kicker}>Matches</Text>
          <Text style={styles.title}>Encrypted conversations</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh matches"
          onPress={() => setRefreshToken((token) => token + 1)}
          style={styles.iconButton}
        >
          <RefreshCw size={17} color={yearnColors.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {matches.length === 0 ? (
        <Text style={styles.detail}>No matches yet.</Text>
      ) : (
        <View style={styles.matchGrid}>
          {matches.map((match) => {
            const isSelected = match.id === selectedMatchId;
            return (
              <Pressable
                key={match.id}
                accessibilityRole="button"
                accessibilityLabel={`Open match with ${match.profile.displayName}`}
                onPress={() => setSelectedMatchId(match.id)}
                style={[
                  styles.matchChip,
                  isSelected && styles.matchChipActive,
                ]}
              >
                <Text style={[
                  styles.matchChipText,
                  isSelected && styles.matchChipTextActive,
                ]}>
                  {match.profile.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {selectedMatch ? (
        <View style={styles.chatPanel}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>{selectedMatch.profile.displayName}</Text>
              <Text style={styles.metaText}>
                {selectedMatch.isPending ? 'Pending match cap' : formatRelativeDate(selectedMatch.matchedAt)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Archive ${selectedMatch.profile.displayName}`}
              onPress={() => { void archiveSelected(); }}
              style={styles.iconButton}
            >
              <Archive size={17} color={yearnColors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          {isLoadingMessages ? (
            <ActivityIndicator color={yearnColors.coral} size="small" />
          ) : messages.length === 0 ? (
            <Text style={styles.detail}>No encrypted messages yet.</Text>
          ) : messages.map((message) => {
            const isMine = Boolean(userId && message.senderId === userId);
            let body: string | null = null;
            if (isMine) {
              body = sentEchoes[message.id] ?? null;
            } else if (identity) {
              const decision = senderKeyDecisions[message.senderId];
              // Only decrypt when the sender's key is trusted (first-use or
              // pinned-match). A changed/unreadable key yields no trustedPublicKey,
              // so we refuse to render it as authentic (audit Y1). decrypt itself
              // never throws now (audit B1), but guard anyway.
              if (decision?.trustedPublicKey) {
                try {
                  body = decryptYearnMessageForDevice({
                    envelope: message.ciphertext,
                    recipientIdentity: identity,
                    expectedSender: {
                      senderUserId: message.senderId,
                      senderPublicKey: decision.trustedPublicKey,
                    },
                  })?.body ?? null;
                } catch {
                  body = null;
                }
              }
            }
            const encryptedLabel = message.kind === 'intro' ? 'Encrypted intro' : 'Encrypted message';
            const senderLabel = isMine ? 'You' : selectedMatch.profile.displayName;
            const readSuffix = isMine && message.readAt ? ' · Read' : '';

            return (
              <View key={message.id} style={styles.messageRow}>
                <MessageCircle
                  size={15}
                  color={isMine ? yearnColors.sage : yearnColors.gold}
                  strokeWidth={2.2}
                />
                <View style={styles.messageBody}>
                  <Text style={styles.metaText}>
                    {senderLabel} · {formatRelativeDate(message.createdAt)}{readSuffix}
                  </Text>
                  {body ? (
                    <Text style={styles.messageTitle}>{body}</Text>
                  ) : (
                    <Text style={styles.detail}>
                      {isMine ? `${encryptedLabel} · readable on their device` : encryptedLabel}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          {senderKeyWarning ? <Text style={styles.keyWarningText}>{senderKeyWarning}</Text> : null}
          {chatKeyWarning ? <Text style={styles.keyWarningText}>{chatKeyWarning}</Text> : null}
          {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}

          <View style={styles.composerRow}>
            <TextInput
              accessibilityLabel="Encrypted message"
              editable={!isSending}
              multiline
              onChangeText={setDraft}
              placeholder={identity
                ? 'Send an encrypted message'
                : 'Encryption keys are unavailable on this device'}
              placeholderTextColor={yearnColors.textTertiary}
              style={styles.composerInput}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send encrypted message"
              disabled={isSending || !identity || draft.trim().length === 0}
              onPress={() => { void handleSendMessage(); }}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.composerSend,
                pressed && styles.buttonPressed,
                (isSending || !identity || draft.trim().length === 0) && styles.buttonDisabled,
              ]}
            >
              {isSending ? (
                <ActivityIndicator color={yearnColors.inkwine} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function YearnProfileSurface({
  supabase,
  isAuthenticated,
  userId,
  onSignOut,
}: ProfileSurfaceProps) {
  const [profile, setProfile] = React.useState<YearnProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [pushBusy, setPushBusy] = React.useState(false);
  const [pushNotice, setPushNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void isYearnPushEnabled().then((enabled) => {
      if (!cancelled) setPushEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePush = React.useCallback(
    async (next: boolean) => {
      if (!supabase || pushBusy) return;
      setPushBusy(true);
      setPushNotice(null);
      try {
        const pushClient = supabase as unknown as PushSupabaseClient;
        if (next) {
          const result = await registerForYearnPush(pushClient);
          if (result.ok) {
            setPushEnabled(true);
          } else {
            setPushEnabled(false);
            setPushNotice(result.error);
          }
        } else {
          const result = await unregisterYearnPush(pushClient);
          if (result.ok) {
            setPushEnabled(false);
          } else {
            setPushNotice(result.error);
          }
        }
      } finally {
        setPushBusy(false);
      }
    },
    [pushBusy, supabase],
  );

  const handleDeleteAccount = React.useCallback(async () => {
    if (!supabase || isDeleting) return;
    if (!confirmingDelete) {
      setDeleteError(null);
      setConfirmingDelete(true);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await new YearnRepository(supabase).deleteMyAccount();
      await onSignOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }, [confirmingDelete, isDeleting, onSignOut, supabase]);

  React.useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !supabase || !userId) {
      setProfile(null);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);
    void new YearnRepository(supabase).fetchMyProfile(userId)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshToken, supabase, userId]);

  if (!isAuthenticated) return lockedSurface('You');
  if (isLoading) return loadingSurface('Loading profile');
  if (error) return errorSurface(error, () => setRefreshToken((token) => token + 1));

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.kicker}>You</Text>
          <Text style={styles.title}>{profile?.displayName ?? 'Profile'}</Text>
        </View>
        <View style={styles.emptyIcon}>
          <UserRound size={22} color={yearnColors.coral} strokeWidth={2.2} />
        </View>
      </View>

      {profile ? (
        <>
          <View style={styles.profileStats}>
            <Text style={styles.statText}>{profile.pronouns}</Text>
            <Text style={styles.statText}>{profile.intention}</Text>
            <Text style={styles.statText}>{profile.relationshipStructure}</Text>
          </View>
          <Text style={styles.detail}>
            {profile.isPaused ? 'Profile paused' : 'Profile visible'}
          </Text>
        </>
      ) : (
        <Text style={styles.detail}>Complete onboarding to publish your profile.</Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => { void onSignOut(); }}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>

      <VerificationSection
        supabase={supabase}
        userId={userId}
        isVerified={Boolean(profile?.isVerified)}
      />

      <MembershipSection supabase={supabase} userId={userId} />

      <View style={styles.legalSection}>
        <Text style={styles.metaText}>Notifications</Text>
        <View style={styles.pushRow}>
          <Text style={styles.detail}>Push notifications</Text>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="Push notifications"
            accessibilityState={{ disabled: pushBusy }}
            disabled={pushBusy}
            value={pushEnabled}
            onValueChange={(next) => { void handleTogglePush(next); }}
            trackColor={{ false: yearnColors.line, true: yearnColors.coral }}
          />
        </View>
        {pushNotice ? <Text style={styles.errorText}>{pushNotice}</Text> : null}
      </View>

      <View style={styles.legalSection}>
        <Text style={styles.metaText}>Legal</Text>
        <View style={styles.legalLinkRow}>
          {yearnLegalLinks.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              onPress={() => { void Linking.openURL(link.url).catch(() => {}); }}
            >
              <Text style={styles.legalLinkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
      {confirmingDelete ? (
        <Text style={styles.detail}>
          This permanently deletes your profile, likes, matches, and messages.
        </Text>
      ) : null}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          disabled={isDeleting}
          onPress={() => { void handleDeleteAccount(); }}
          style={({ pressed }) => [
            styles.dangerButton,
            pressed && styles.buttonPressed,
            isDeleting && styles.buttonDisabled,
          ]}
        >
          {isDeleting ? (
            <ActivityIndicator color={yearnColors.alarm} size="small" />
          ) : (
            <Text style={styles.dangerButtonText}>
              {confirmingDelete ? 'Tap again to permanently delete' : 'Delete account'}
            </Text>
          )}
        </Pressable>
        {confirmingDelete && !isDeleting ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel account deletion"
            onPress={() => setConfirmingDelete(false)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.lg,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: yearnSpacing.md,
    justifyContent: 'space-between',
  },
  kicker: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  title: {
    color: yearnColors.vellum,
    ...yearnTypography.title,
  },
  detail: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  errorText: {
    color: yearnColors.alarm,
    ...yearnTypography.body,
  },
  successText: {
    color: yearnColors.sage,
    ...yearnTypography.body,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: yearnColors.surfaceElevated,
    borderRadius: yearnRadius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.surfaceElevated,
    borderRadius: yearnRadius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  listCard: {
    alignItems: 'flex-start',
    backgroundColor: yearnColors.surfaceElevated,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: yearnSpacing.md,
    padding: yearnSpacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: yearnColors.inkwine,
    ...yearnTypography.title,
  },
  cardBody: {
    flex: 1,
    gap: yearnSpacing.sm,
  },
  rowBetween: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: yearnSpacing.md,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: yearnColors.vellum,
    ...yearnTypography.body,
    fontWeight: '600',
  },
  metaText: {
    color: yearnColors.textTertiary,
    ...yearnTypography.label,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  legalSection: {
    borderTopColor: yearnColors.line,
    borderTopWidth: 1,
    gap: yearnSpacing.sm,
    paddingTop: yearnSpacing.md,
  },
  legalLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.md,
  },
  pushRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legalLinkText: {
    color: yearnColors.gold,
    ...yearnTypography.body,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: yearnSpacing.md,
  },
  primaryButtonText: {
    color: yearnColors.inkwine,
    ...yearnTypography.label,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.surfaceElevated,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: yearnSpacing.md,
  },
  secondaryButtonText: {
    color: yearnColors.textSecondary,
    ...yearnTypography.label,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  matchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  matchChip: {
    backgroundColor: yearnColors.surfaceElevated,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 9,
  },
  matchChipActive: {
    backgroundColor: yearnColors.vellum,
    borderColor: yearnColors.vellum,
  },
  matchChipText: {
    color: yearnColors.textSecondary,
    ...yearnTypography.label,
  },
  matchChipTextActive: {
    color: yearnColors.inkwine,
  },
  chatPanel: {
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.md,
  },
  messageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  messageBody: {
    flex: 1,
    gap: 2,
  },
  messageTitle: {
    color: yearnColors.vellum,
    ...yearnTypography.body,
  },
  keyWarningText: {
    color: yearnColors.gold,
    fontSize: 12,
    lineHeight: 17,
  },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  composerInput: {
    backgroundColor: yearnColors.inkwine,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    color: yearnColors.vellum,
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 9,
    ...yearnTypography.body,
  },
  composerSend: {
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 64,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(232, 90, 107, 0.12)',
    borderColor: 'rgba(232, 90, 107, 0.4)',
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: yearnSpacing.md,
  },
  dangerButtonText: {
    color: yearnColors.alarm,
    ...yearnTypography.label,
  },
  profileStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  statText: {
    backgroundColor: yearnColors.surfaceElevated,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    color: yearnColors.textSecondary,
    overflow: 'hidden',
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 8,
    ...yearnTypography.label,
  },
});
