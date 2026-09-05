// Trainer-side client roster.
//
// Gated on owning a dw_trainers row. Lists every client link grouped by status,
// lets the trainer mint a new per-client invite (QR + link + code share sheet),
// preview each client's form-check thread inline, and end / reactivate links.
// Non-trainers get an honest gate, not a fake roster.

import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, QrCode } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import {
  createClientLink,
  endClientLink,
  listClientLinks,
  listFormChecks,
  reactivateClientLink,
  type ClientLinkRosterEntry,
  type FormCheck,
} from './data/cloud-coaching';
import {
  Card,
  CoachingHeader,
  CoachingScreen,
  EmptyState,
  ErrorBlock,
  GhostButton,
  LoadingBlock,
  PrimaryButton,
  SectionLabel,
  StatusBadge,
  formatClock,
} from './components/coaching/coaching-kit';
import { InviteShareSheet } from './components/coaching/InviteShareSheet';
import { friendlyError } from './data/friendly-errors';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';
import { formatDateLabel } from './(tabs)/_screen-kit';

type ThreadState = 'loading' | { checks: FormCheck[] } | { error: string };

const STATUS_ORDER: Array<{ key: 'active' | 'invited' | 'ended'; label: string }> = [
  { key: 'active', label: 'Active clients' },
  { key: 'invited', label: 'Invites out' },
  { key: 'ended', label: 'Past clients' },
];

export default function ClientsScreen() {
  const router = useRouter();
  const { supabase, trainerProfile, isReady } = useDoWorkCloud();
  const [roster, setRoster] = useState<ClientLinkRosterEntry[] | null>(null);
  const [noConnection, setNoConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, ThreadState>>({});
  const [busyLink, setBusyLink] = useState<string | null>(null);

  const trainerId = trainerProfile?.id ?? null;

  const load = useCallback(async () => {
    if (!supabase || !trainerId) {
      // No cloud client: show an honest connection state, never a fake empty
      // roster that reads as "you have no clients".
      setNoConnection(true);
      setRoster([]);
      return;
    }
    const result = await listClientLinks(supabase, trainerId);
    if (!result.ok) {
      setNoConnection(false);
      setError(friendlyError(result.error));
      setRoster([]);
      return;
    }
    setNoConnection(false);
    setError(null);
    setRoster(result.links);
  }, [supabase, trainerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleInvite = useCallback(async () => {
    if (!supabase || !trainerId || creating) return;
    setCreating(true);
    const result = await createClientLink(supabase, trainerId);
    setCreating(false);
    if (!result.ok) {
      setError(friendlyError(result.error));
      return;
    }
    setShareCode(result.link.inviteCode);
    setSheetVisible(true);
    await load();
  }, [supabase, trainerId, creating, load]);

  const openShare = useCallback((code: string) => {
    setShareCode(code);
    setSheetVisible(true);
  }, []);

  const toggleThread = useCallback(
    async (linkId: string) => {
      const current = expanded[linkId];
      if (current) {
        setExpanded((prev) => {
          const next = { ...prev };
          delete next[linkId];
          return next;
        });
        return;
      }
      if (!supabase) return;
      setExpanded((prev) => ({ ...prev, [linkId]: 'loading' }));
      const result = await listFormChecks(supabase, linkId);
      setExpanded((prev) => ({
        ...prev,
        [linkId]: result.ok ? { checks: result.formChecks } : { error: friendlyError(result.error) },
      }));
    },
    [supabase, expanded],
  );

  const performEnd = useCallback(
    async (linkId: string) => {
      if (!supabase) return;
      setBusyLink(linkId);
      const result = await endClientLink(supabase, linkId);
      setBusyLink(null);
      if (!result.ok) {
        setError(friendlyError(result.error));
        return;
      }
      await load();
    },
    [supabase, load],
  );

  // Ending a link is destructive (the client loses premium access until
  // reactivated), so confirm before running it.
  const handleEnd = useCallback(
    (link: ClientLinkRosterEntry) => {
      if (!supabase) return;
      const name = clientNameFor(link);
      Alert.alert(
        'End coaching?',
        `End coaching with ${name}? They lose access to your premium library until you reactivate.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End', style: 'destructive', onPress: () => void performEnd(link.id) },
        ],
      );
    },
    [supabase, performEnd],
  );

  const handleReactivate = useCallback(
    async (link: ClientLinkRosterEntry) => {
      if (!supabase) return;
      setBusyLink(link.id);
      const result = await reactivateClientLink(supabase, {
        id: link.id,
        clientUserId: link.clientUserId,
      });
      setBusyLink(null);
      if (!result.ok) {
        setError(friendlyError(result.error));
        return;
      }
      await load();
    },
    [supabase, load],
  );

  // Wait for the cloud identity to resolve before deciding trainer vs not.
  // Rendering the not-trainer gate while trainerProfile is still loading would
  // flash "This space is for trainers" at a real trainer on deep entry.
  if (!isReady) {
    return (
      <CoachingScreen>
        <CoachingHeader title="Clients" />
        <LoadingBlock label="Loading your clients…" />
      </CoachingScreen>
    );
  }

  if (!trainerId) {
    return (
      <CoachingScreen>
        <CoachingHeader title="Clients" />
        <EmptyState
          title="This space is for trainers"
          body="Client coaching is available once you claim a trainer invite. If a DoWork trainer sent you one, redeem it to open your studio."
          cta={{ label: 'Have an invite code?', onPress: () => router.push('/(root)/redeem-invite') }}
        />
      </CoachingScreen>
    );
  }

  return (
    <>
      <CoachingScreen
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DW_ACCENT} />
        }
      >
        <CoachingHeader
          title="Clients"
          subtitle={roster ? `${roster.filter((l) => l.status === 'active').length} active` : undefined}
        />

        <View style={styles.inviteWrap}>
          <PrimaryButton label="Invite a client" onPress={handleInvite} busy={creating} />
        </View>

        {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}

        {noConnection ? (
          <EmptyState
            title="Clients need a connection"
            body="We couldn't reach the cloud to load your roster. Check your connection and try again."
            cta={{ label: 'Retry', onPress: () => void load() }}
          />
        ) : roster === null ? (
          <LoadingBlock label="Loading your clients…" />
        ) : roster.length === 0 ? (
          <EmptyState
            title="No clients yet"
            body="Invite your first client. They scan your QR or open the link, tap Join, and you can start trading form checks."
          />
        ) : (
          STATUS_ORDER.map(({ key, label }) => {
            const group = roster.filter((l) => l.status === key);
            if (group.length === 0) return null;
            return (
              <View key={key} style={styles.group}>
                <SectionLabel>{label}</SectionLabel>
                {group.map((link) => (
                  <ClientCard
                    key={link.id}
                    link={link}
                    thread={expanded[link.id]}
                    busy={busyLink === link.id}
                    onToggleThread={() => void toggleThread(link.id)}
                    onShare={() => openShare(link.inviteCode)}
                    onEnd={() => handleEnd(link)}
                    onReactivate={() => void handleReactivate(link)}
                    onOpenCheck={(id) => router.push(`/(root)/form-check/${id}`)}
                  />
                ))}
              </View>
            );
          })
        )}
      </CoachingScreen>

      <InviteShareSheet visible={sheetVisible} code={shareCode} onClose={() => setSheetVisible(false)} />
    </>
  );
}

function ClientCard({
  link,
  thread,
  busy,
  onToggleThread,
  onShare,
  onEnd,
  onReactivate,
  onOpenCheck,
}: {
  link: ClientLinkRosterEntry;
  thread: ThreadState | undefined;
  busy: boolean;
  onToggleThread: () => void;
  onShare: () => void;
  onEnd: () => void;
  onReactivate: () => void;
  onOpenCheck: (formCheckId: string) => void;
}) {
  const name = clientNameFor(link);
  const canPreview = link.status !== 'invited';
  const expandedOpen = thread !== undefined;

  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={styles.cardIdentity}>
          <Text style={styles.cardName}>{name}</Text>
          <Text style={styles.cardMeta}>
            {link.status === 'invited'
              ? `Invite created ${formatDateLabel(link.createdAt)}`
              : `Since ${formatDateLabel(link.activatedAt ?? link.createdAt)}`}
          </Text>
        </View>
        <StatusBadge tone={link.status} />
      </View>

      {canPreview ? (
        <Pressable
          style={({ pressed }) => [styles.threadToggle, pressed && { opacity: 0.8 }]}
          onPress={onToggleThread}
          accessibilityRole="button"
          accessibilityLabel={expandedOpen ? 'Hide form checks' : 'Show form checks'}
        >
          {expandedOpen ? (
            <ChevronDown size={16} color={DW_TEXT.secondary} />
          ) : (
            <ChevronRight size={16} color={DW_TEXT.secondary} />
          )}
          <Text style={styles.threadToggleText}>Form checks</Text>
        </Pressable>
      ) : null}

      {expandedOpen ? (
        <View style={styles.thread}>
          {thread === 'loading' ? (
            <Text style={styles.threadHint}>Loading…</Text>
          ) : 'error' in thread ? (
            <Text style={styles.threadError}>{thread.error}</Text>
          ) : thread.checks.length === 0 ? (
            <Text style={styles.threadHint}>No form checks yet.</Text>
          ) : (
            thread.checks.map((check) => (
              <Pressable
                key={check.id}
                style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.85 }]}
                onPress={() => onOpenCheck(check.id)}
                accessibilityRole="button"
              >
                <View style={styles.checkText}>
                  <Text style={styles.checkTitle} numberOfLines={1}>
                    {check.exerciseSlug ? formatSlug(check.exerciseSlug) : 'Form check'}
                  </Text>
                  <Text style={styles.checkMeta}>
                    {formatDateLabel(check.createdAt)}
                    {check.durationSeconds ? ` · ${formatClock(check.durationSeconds)}` : ''}
                    {check.feedbackCount > 0 ? ` · ${check.feedbackCount} notes` : ''}
                  </Text>
                </View>
                <StatusBadge tone={check.status} />
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.cardActions}>
        {link.status === 'invited' ? (
          <Pressable
            style={({ pressed }) => [styles.shareChip, pressed && { opacity: 0.85 }]}
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share invite"
          >
            <QrCode size={16} color={DW_ON_ACCENT} />
            <Text style={styles.shareChipText}>Share invite</Text>
          </Pressable>
        ) : null}
        {link.status === 'ended' ? (
          <GhostButton label={busy ? 'Working…' : 'Reactivate'} onPress={onReactivate} />
        ) : (
          <GhostButton label={busy ? 'Working…' : 'End'} tone="danger" onPress={onEnd} />
        )}
      </View>
    </Card>
  );
}

function clientNameFor(link: ClientLinkRosterEntry): string {
  return (
    link.clientDisplayName ??
    (link.clientHandle ? `@${link.clientHandle}` : link.status === 'invited' ? 'Waiting to join' : 'Client')
  );
}

function formatSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  inviteWrap: {
    paddingHorizontal: 16,
  },
  group: {
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardIdentity: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    color: DW_TEXT.primary,
  },
  cardMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  threadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  threadToggleText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  thread: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: DW_BORDER.subtle,
    paddingTop: 10,
  },
  threadHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.tertiary,
  },
  threadError: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: '#FF9A9A',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: DW_SURFACES.mid,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkText: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  checkMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  shareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DW_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shareChipText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: DW_ON_ACCENT,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
