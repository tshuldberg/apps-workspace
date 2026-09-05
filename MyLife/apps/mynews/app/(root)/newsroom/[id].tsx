import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ProfileView } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsIdentity } from '../providers/IdentityProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { LoadingView, MessageView } from '../components/StateViews';
import { atHandle, relativeTime } from '../lib/format';
import {
  INVITE_REVIEWER_LABEL,
  NEWSROOM_EXPLAINER,
  inviteMemberFlow,
  loadNewsroomDetail,
  removeMemberFlow,
  setEmbargoFlow,
  type NewsroomDetailModel,
} from '../lib/newsrooms';
import { ErrorText } from '../components/ErrorText';

type DetailState =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'no-profile' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; profile: ProfileView; model: NewsroomDetailModel };

type InviteRole = 'coauthor' | 'reviewer';

export default function NewsroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const identity = useMyNewsIdentity();

  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [inviteHandle, setInviteHandle] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('coauthor');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [embargoFor, setEmbargoFor] = useState<string | null>(null);
  const [embargoText, setEmbargoText] = useState('');
  const [embargoError, setEmbargoError] = useState<string | null>(null);
  const [embargoSaving, setEmbargoSaving] = useState(false);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const load = useCallback(async () => {
    if (!isConfigured || !port) {
      setState({ status: 'unconfigured' });
      return;
    }
    if (!hasSession) {
      setState({ status: 'signed-out' });
      return;
    }
    if (typeof id !== 'string' || id.length === 0) {
      setState({ status: 'not-found' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const loaded = await loadNewsroomDetail({ port, id });
      if (loaded.status === 'loaded') {
        setState({ status: 'loaded', profile: loaded.profile, model: loaded.model });
      } else {
        setState({ status: loaded.status });
      }
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [hasSession, id, isConfigured, port]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleInvite = useCallback(async () => {
    if (state.status !== 'loaded' || !port) return;
    setInviting(true);
    setInviteError(null);
    const res = await inviteMemberFlow({
      port,
      newsroomId: state.model.newsroom.id,
      handle: inviteHandle,
      role: inviteRole,
      invitedBy: state.profile.id,
    });
    setInviting(false);
    if (res.ok) {
      setInviteHandle('');
      await load();
      return;
    }
    setInviteError(res.message);
  }, [inviteHandle, inviteRole, load, port, state]);

  const handleRemove = useCallback(
    async (profileId: string) => {
      if (state.status !== 'loaded' || !port) return;
      setMemberError(null);
      const res = await removeMemberFlow({
        port,
        newsroomId: state.model.newsroom.id,
        profileId,
      });
      if (res.ok) {
        await load();
        return;
      }
      setMemberError(res.message);
    },
    [load, port, state],
  );

  const handleLeave = useCallback(async () => {
    if (state.status !== 'loaded' || !port) return;
    setLeaving(true);
    setMemberError(null);
    const res = await removeMemberFlow({
      port,
      newsroomId: state.model.newsroom.id,
      profileId: state.profile.id,
    });
    setLeaving(false);
    if (res.ok) {
      router.back();
      return;
    }
    setMemberError(res.message);
  }, [port, router, state]);

  const openEmbargoEditor = useCallback((articleId: string, current: string | null) => {
    setEmbargoFor(articleId);
    setEmbargoText(current ? current.slice(0, 10) : '');
    setEmbargoError(null);
  }, []);

  const handleSaveEmbargo = useCallback(async () => {
    if (!port || !embargoFor) return;
    setEmbargoSaving(true);
    setEmbargoError(null);
    const res = await setEmbargoFlow({ port, identity, articleId: embargoFor, raw: embargoText });
    setEmbargoSaving(false);
    if (res.ok) {
      setEmbargoFor(null);
      await load();
      return;
    }
    setEmbargoError(res.message);
  }, [embargoFor, embargoText, identity, load, port]);

  if (state.status === 'loading') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Newsroom" />
        <LoadingView label="Loading newsroom..." />
      </View>
    );
  }

  if (state.status !== 'loaded') {
    const copy = ((): { title: string; body: string } => {
      switch (state.status) {
        case 'unconfigured':
          return {
            title: 'Not connected',
            body: `${reason ?? 'Not connected to a MyNews server yet.'} Newsrooms live on the server; nothing here is simulated.`,
          };
        case 'signed-out':
          return {
            title: 'Signed out',
            body: 'You are reading anonymously. Newsrooms need an account and a public profile.',
          };
        case 'no-profile':
          return {
            title: 'No profile yet',
            body: 'You need a public profile to use newsrooms. Register a handle to continue.',
          };
        case 'not-found':
          return {
            title: 'Newsroom not found',
            body: 'This newsroom does not exist or you are not a member of it.',
          };
        case 'error':
          return { title: 'Could not load this newsroom', body: state.message };
        default:
          return { title: 'Newsroom', body: '' };
      }
    })();
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Newsroom" />
        <MessageView title={copy.title} body={copy.body} />
        {state.status === 'signed-out' || state.status === 'no-profile' ? (
          <View style={styles.gateAction}>
            <PrimaryButton
              label="Register to publish or suggest"
              onPress={() =>
                router.push(
                  `/(root)/register?returnTo=${encodeURIComponent(`/(root)/newsroom/${String(id)}`)}`,
                )
              }
            />
          </View>
        ) : null}
      </View>
    );
  }

  const { model } = state;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={model.newsroom.name} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Drafts */}
          <Text style={styles.sectionTitle}>Drafts</Text>
          {model.drafts.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardBody}>
                No drafts in this room yet. Save a draft here from the composer to share it with
                the members below.
              </Text>
            </View>
          ) : (
            model.drafts.map((row) => (
              <View key={row.draft.articleId} style={styles.card}>
                <Pressable
                  onPress={() =>
                    router.push(row.openPath as Parameters<typeof router.push>[0])
                  }
                  accessibilityRole="button"
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowHeadline} numberOfLines={1}>
                      {row.draft.headline}
                    </Text>
                    {row.embargoLabel ? (
                      <Text style={styles.embargoTag}>{row.embargoLabel}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.cardMeta}>
                    rev {row.draft.rev} · {atHandle(row.draft.authorHandle)} · edited{' '}
                    {relativeTime(row.draft.updatedAt)}
                  </Text>
                </Pressable>
                {row.canSetEmbargo ? (
                  embargoFor === row.draft.articleId ? (
                    <View style={styles.embargoEditor}>
                      <TextInput
                        accessibilityLabel="Embargo date, year-month-day"
                        value={embargoText}
                        onChangeText={(text) => {
                          setEmbargoText(text);
                          setEmbargoError(null);
                        }}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={tokens.textTertiary}
                        style={styles.input}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!embargoSaving}
                      />
                      <Text style={styles.hint}>Leave empty to clear the embargo.</Text>
                      {embargoError ? <ErrorText style={styles.error}>{embargoError}</ErrorText> : null}
                      <View style={styles.embargoActions}>
                        <PrimaryButton
                          label="Save embargo"
                          onPress={() => void handleSaveEmbargo()}
                          loading={embargoSaving}
                        />
                        <SecondaryButton
                          label="Cancel"
                          onPress={() => setEmbargoFor(null)}
                          disabled={embargoSaving}
                        />
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() =>
                        openEmbargoEditor(row.draft.articleId, row.draft.embargoUntil)
                      }
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionText}>Set embargo</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ))
          )}

          {/* Members */}
          <Text style={styles.sectionTitle}>Members</Text>
          {model.members.map((row) => (
            <View key={row.member.profileId} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.rowHeadline} numberOfLines={1}>
                  {row.member.displayName}{' '}
                  <Text style={styles.handleText}>{atHandle(row.member.handle)}</Text>
                </Text>
                <Text style={styles.roleChip}>{row.chip}</Text>
              </View>
              {row.note ? <Text style={styles.cardMeta}>{row.note}</Text> : null}
              {row.canRemove ? (
                <Pressable
                  onPress={() => void handleRemove(row.member.profileId)}
                  accessibilityRole="button"
                >
                  <Text style={styles.removeText}>Remove member</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {memberError ? <ErrorText style={styles.error}>{memberError}</ErrorText> : null}

          {/* Owner: invite */}
          {model.isOwner ? (
            <>
              <Text style={styles.sectionTitle}>
                {inviteRole === 'reviewer' ? INVITE_REVIEWER_LABEL : 'Invite a coauthor'}
              </Text>
              <View style={styles.card}>
                <TextInput
                  accessibilityLabel="Handle to invite"
                  value={inviteHandle}
                  onChangeText={(text) => {
                    setInviteHandle(text);
                    setInviteError(null);
                  }}
                  placeholder="Handle, e.g. jane_doe"
                  placeholderTextColor={tokens.textTertiary}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!inviting}
                />
                <View style={styles.segment}>
                  {(
                    [
                      ['coauthor', 'Coauthor'],
                      ['reviewer', 'Reviewer'],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => setInviteRole(value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: inviteRole === value }}
                      style={[
                        styles.segmentOption,
                        inviteRole === value && styles.segmentOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          inviteRole === value && styles.segmentTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hint}>
                  {inviteRole === 'reviewer'
                    ? 'Reviewers can read and suggest on room drafts, never publish.'
                    : 'Coauthors can read, suggest, and save drafts into this room.'}
                </Text>
                {inviteError ? <ErrorText style={styles.error}>{inviteError}</ErrorText> : null}
                <PrimaryButton
                  label="Invite"
                  onPress={() => void handleInvite()}
                  disabled={inviteHandle.trim().length === 0}
                  loading={inviting}
                />
              </View>
            </>
          ) : null}

          {/* Non-owner member: leave */}
          {model.canLeave ? (
            <SecondaryButton
              label={leaving ? 'Leaving...' : 'Leave newsroom'}
              onPress={() => void handleLeave()}
              disabled={leaving}
            />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardBody}>{NEWSROOM_EXPLAINER}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 10,
  },
  gateAction: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 8,
  },
  cardBody: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowHeadline: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  handleText: {
    color: tokens.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  embargoTag: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  roleChip: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  embargoEditor: {
    gap: 8,
  },
  embargoActions: {
    gap: 8,
  },
  actionText: {
    color: tokens.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  removeText: {
    color: tokens.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: tokens.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentOptionActive: {
    backgroundColor: tokens.elevated,
  },
  segmentText: {
    color: tokens.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: tokens.text,
  },
  input: {
    backgroundColor: tokens.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hint: {
    color: tokens.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
});
