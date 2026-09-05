import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { fetchCustodyStatus } from '@mylife/mynews';
import type { EditorProfileView, ProfileView, ReportView } from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { useMyNewsCloud } from '../providers/CloudProvider';
import { useMyNewsIdentity, useMyNewsIdentityCreatedAt } from '../providers/IdentityProvider';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { buildCredibilityViewModel } from '../lib/credibility';
import { toMyReportRow } from '../lib/reports';
import { relativeTime, shortKey } from '../lib/format';
import {
  custodyErrorMessage,
  custodyPosture,
  postureCopy,
  type PostureCopy,
} from '../lib/keys';
import { ErrorText } from '../components/ErrorText';

type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; profile: ProfileView | null }
  | { status: 'error'; message: string };

type EmailMode = 'link' | 'signin';

/** Keys and Recovery card state; 'idle' covers signed-out and unconfigured. */
type CustodyCardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; copy: PostureCopy }
  | { status: 'error'; message: string };

export default function MeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useMyNewsAuth();
  const { isConfigured, port, reason } = useMyNewsCloud();
  const identity = useMyNewsIdentity();
  const identityCreatedAt = useMyNewsIdentityCreatedAt();

  const [profileState, setProfileState] = useState<ProfileState>({ status: 'idle' });
  const [editorProfile, setEditorProfile] = useState<EditorProfileView | null>(null);
  const [myReports, setMyReports] = useState<ReportView[] | null>(null);

  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<EmailMode | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  // Key custody posture (plan 48 WP6). Loaded alongside the profile so the card
  // can say something true instead of a generic label.
  const [custodyState, setCustodyState] = useState<CustodyCardState>({ status: 'idle' });

  const [pubOpen, setPubOpen] = useState(false);
  const [bio, setBio] = useState('');
  const [beats, setBeats] = useState('');
  const [region, setRegion] = useState('');
  const [publicationStatus, setPublicationStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [pubError, setPubError] = useState<string | null>(null);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';
  const profile = profileState.status === 'loaded' ? profileState.profile : null;

  const loadCustody = useCallback(async () => {
    if (!port) {
      setCustodyState({ status: 'idle' });
      return;
    }
    setCustodyState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    const result = await fetchCustodyStatus(port);
    if (!result.ok) {
      // 'no-profile' is not an error here: a reader has no keys to report on.
      if (result.code === 'no-profile') {
        setCustodyState({ status: 'idle' });
        return;
      }
      setCustodyState({
        status: 'error',
        message: custodyErrorMessage(result.code, result.detail),
      });
      return;
    }
    const { ok: _ok, ...custody } = result;
    setCustodyState({
      status: 'loaded',
      copy: postureCopy(custodyPosture(custody, identity?.pubkeyHex ?? null)),
    });
  }, [identity, port]);

  const loadProfile = useCallback(async () => {
    if (!port || !hasSession) {
      setProfileState({ status: 'idle' });
      setEditorProfile(null);
      setMyReports(null);
      setCustodyState({ status: 'idle' });
      return;
    }
    setProfileState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    try {
      const mine = await port.getMyProfile();
      setProfileState({ status: 'loaded', profile: mine });
      if (mine) {
        setEditorProfile(await port.getEditorProfile(mine.handle));
        try {
          setMyReports(await port.getMyReports(mine.id));
        } catch {
          // The reports card falls back to an honest "could not load" state.
          setMyReports(null);
        }
      } else {
        setEditorProfile(null);
        setMyReports(null);
      }
    } catch (err) {
      setProfileState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [hasSession, port]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void loadCustody();
    }, [loadCustody, loadProfile]),
  );

  const onCreateAccount = useCallback(async () => {
    setAccountBusy(true);
    setAccountError(null);
    const result = await auth.ensureSession();
    setAccountBusy(false);
    if (result.ok) {
      router.push('/(root)/register');
    } else {
      setAccountError(result.error);
    }
  }, [auth, router]);

  const onSignOut = useCallback(async () => {
    setAccountBusy(true);
    setAccountError(null);
    await auth.signOut();
    setAccountBusy(false);
    setEmailMode(null);
    setEmailStatus('idle');
  }, [auth]);

  const onSendEmail = useCallback(async () => {
    if (!emailMode) return;
    setEmailStatus('sending');
    setEmailError(null);
    const send = emailMode === 'link' ? auth.linkEmail : auth.signInWithEmail;
    const result = await send(emailDraft);
    if (result.ok) {
      setEmailStatus('sent');
    } else {
      setEmailStatus('idle');
      setEmailError(result.error ?? 'Could not send the email.');
    }
  }, [auth, emailDraft, emailMode]);

  const onBecomeJournalist = useCallback(async () => {
    if (!port || !profile) return;
    setPublicationStatus('saving');
    setPubError(null);
    try {
      const result = await port.becomeJournalist({
        profileId: profile.id,
        bio: bio.trim(),
        beats: beats
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
        region: region.trim(),
      });
      if (result.ok) {
        setPublicationStatus('done');
        await loadProfile();
      } else {
        setPublicationStatus('idle');
        setPubError(result.error ?? 'Could not create your journalist profile.');
      }
    } catch (err) {
      setPublicationStatus('idle');
      setPubError(err instanceof Error ? err.message : String(err));
    }
  }, [beats, bio, loadProfile, port, profile, region]);

  const onExportLedger = useCallback(async () => {
    if (!editorProfile) return;
    try {
      await Share.share({
        message: JSON.stringify(
          { handle: editorProfile.profile.handle, ledger: editorProfile.ledger },
          null,
          2,
        ),
      });
    } catch {
      // The user cancelled or the share sheet failed; nothing to fake.
    }
  }, [editorProfile]);

  const statusLine = ((): string => {
    switch (auth.status) {
      case 'unconfigured':
        return reason ?? 'Not connected to a MyNews server yet.';
      case 'loading':
        return 'Checking your session...';
      case 'signed-out':
        return 'Reading anonymously';
      case 'anonymous':
        return 'Anonymous account';
      case 'linked':
        return `Signed in as ${auth.email ?? 'your email'}`;
    }
  })();

  const credibility =
    editorProfile !== null
      ? buildCredibilityViewModel({ profile: editorProfile, nowMs: Date.now() })
      : null;

  const unconfigured = auth.status === 'unconfigured';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.screenTitle}>Me</Text>

      {/* Identity card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your identity</Text>
        <Text style={styles.keyValue}>
          {identity ? shortKey(identity.pubkeyHex) : 'Preparing your signing key...'}
        </Text>
        {identity && identityCreatedAt ? (
          <Text style={styles.cardMeta}>Key created {relativeTime(identityCreatedAt)}</Text>
        ) : null}
        <Text style={styles.cardBody}>Your keys, created on this device</Text>
      </View>

      {/* Account card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.statusLine}>{statusLine}</Text>
        {auth.status === 'signed-out' ? (
          <Text style={styles.cardBody}>Reading? No account needed.</Text>
        ) : null}
        {auth.lastAuthError ? (
          <View style={styles.authErrorRow}>
            <Text style={[styles.error, styles.authErrorText]}>
              Sign-in link failed: {auth.lastAuthError}. Request a new link.
            </Text>
            <Pressable
              onPress={auth.clearAuthError}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss sign-in error"
            >
              <Text style={styles.dismiss}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
        {accountError ? <ErrorText style={styles.error}>{accountError}</ErrorText> : null}

        {unconfigured ? (
          <Text style={styles.cardMeta}>
            Account actions turn on once a MyNews server is configured for this build.
          </Text>
        ) : (
          <View style={styles.buttonColumn}>
            {auth.status === 'signed-out' ? (
              <>
                <PrimaryButton
                  label="Create account"
                  onPress={() => void onCreateAccount()}
                  loading={accountBusy}
                />
                <SecondaryButton
                  label="Sign in with email"
                  onPress={() => {
                    setEmailMode(emailMode === 'signin' ? null : 'signin');
                    setEmailStatus('idle');
                    setEmailError(null);
                  }}
                />
              </>
            ) : null}
            {auth.status === 'anonymous' ? (
              <>
                <SecondaryButton
                  label="Link email"
                  onPress={() => {
                    setEmailMode(emailMode === 'link' ? null : 'link');
                    setEmailStatus('idle');
                    setEmailError(null);
                  }}
                />
                <SecondaryButton label="Sign out" onPress={() => void onSignOut()} />
              </>
            ) : null}
            {auth.status === 'linked' ? (
              <SecondaryButton label="Sign out" onPress={() => void onSignOut()} />
            ) : null}
          </View>
        )}

        {emailMode && !unconfigured && (auth.status === 'signed-out' || auth.status === 'anonymous') ? (
          <View style={styles.emailForm}>
            <Text style={styles.cardMeta}>
              {emailMode === 'link'
                ? 'Link an email so you can sign in to this account from another device.'
                : 'We will email you a sign-in link for your existing account.'}
            </Text>
            <TextInput
              accessibilityLabel="Email address"
              value={emailDraft}
              onChangeText={(text) => {
                setEmailDraft(text);
                setEmailError(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor={tokens.textTertiary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={emailStatus !== 'sending'}
            />
            {emailError ? <ErrorText style={styles.error}>{emailError}</ErrorText> : null}
            {emailStatus === 'sent' ? (
              <Text style={styles.success}>
                Check your email for a magic link, then open it on this device.
              </Text>
            ) : (
              <PrimaryButton
                label={emailMode === 'link' ? 'Send link email' : 'Send sign-in email'}
                onPress={() => void onSendEmail()}
                loading={emailStatus === 'sending'}
              />
            )}
          </View>
        ) : null}
      </View>

      {/* Profile card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Public profile</Text>
        {unconfigured ? (
          <Text style={styles.cardMeta}>
            Profiles live on the MyNews server. Not connected yet.
          </Text>
        ) : profileState.status === 'loading' ? (
          <Text style={styles.cardMeta}>Loading your profile...</Text>
        ) : profileState.status === 'error' ? (
          <ErrorText style={styles.error}>Could not load your profile: {profileState.message}</ErrorText>
        ) : profile ? (
          <>
            <Text style={styles.handle}>@{profile.handle}</Text>
            <Text style={styles.cardBody}>{profile.displayName}</Text>
            <Text style={styles.kindChip}>
              {profile.kind === 'journalist'
                ? 'Journalist'
                : profile.kind === 'editor'
                  ? 'Editor'
                  : 'Reader'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>
              No public profile yet. Reading never needs one; publishing and suggesting do.
            </Text>
            <PrimaryButton
              label="Register to publish or suggest"
              onPress={() => router.push('/(root)/register')}
            />
          </>
        )}
      </View>

      {/* Start publishing row */}
      {profile && profile.kind !== 'journalist' && !unconfigured ? (
        <View style={styles.card}>
          <Pressable
            onPress={() => setPubOpen((open) => !open)}
            accessibilityRole="button"
            style={styles.rowHeader}
          >
            <Text style={styles.cardTitle}>Start publishing</Text>
            <ChevronRight
              color={tokens.textTertiary}
              size={18}
              style={pubOpen ? styles.chevronOpen : undefined}
            />
          </Pressable>
          {pubOpen ? (
            publicationStatus === 'done' ? (
              <Text style={styles.success}>
                Journalist profile created. Your byline is ready in the Desk tab.
              </Text>
            ) : (
              <View style={styles.emailForm}>
                <Text style={styles.cardMeta}>
                  A journalist profile adds a public byline. Articles publish signed with your
                  device key.
                </Text>
                <TextInput
                  accessibilityLabel="Bio"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Bio"
                  placeholderTextColor={tokens.textTertiary}
                  style={styles.input}
                  multiline
                />
                <TextInput
                  accessibilityLabel="Beats, comma separated"
                  value={beats}
                  onChangeText={setBeats}
                  placeholder="Beats, comma separated (e.g. climate, courts)"
                  placeholderTextColor={tokens.textTertiary}
                  style={styles.input}
                  autoCapitalize="none"
                />
                <TextInput
                  accessibilityLabel="Region"
                  value={region}
                  onChangeText={setRegion}
                  placeholder="Region"
                  placeholderTextColor={tokens.textTertiary}
                  style={styles.input}
                />
                {pubError ? <ErrorText style={styles.error}>{pubError}</ErrorText> : null}
                <PrimaryButton
                  label="Create journalist profile"
                  onPress={() => void onBecomeJournalist()}
                  disabled={!bio.trim() || !region.trim()}
                  loading={publicationStatus === 'saving'}
                />
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {/* Credibility summary card */}
      {profile && credibility ? (
        <Pressable
          onPress={() => router.push(`/(root)/credibility/${profile.handle}`)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.cardTitle}>Credibility</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          <Text style={styles.scoreValue}>{credibility.total.toFixed(1)} pts</Text>
          <Text style={styles.cardMeta}>
            {credibility.levelName} · {editorProfile?.ledger.length ?? 0} accepted ·{' '}
            {credibility.distinctAuthors} distinct authors
          </Text>
          <Text style={styles.cardBody}>formula + full ledger public</Text>
        </Pressable>
      ) : null}

      {/* Export signed ledger */}
      {profile ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Export signed ledger</Text>
          <Text style={styles.cardBody}>Your record is provable without MyNews</Text>
          <SecondaryButton
            label="Export ledger JSON"
            onPress={() => void onExportLedger()}
            disabled={!editorProfile}
          />
          {!editorProfile ? (
            <Text style={styles.cardMeta}>Your public ledger has not loaded yet.</Text>
          ) : null}
        </View>
      ) : null}

      {/* Blocked accounts */}
      {hasSession && !unconfigured ? (
        <Pressable
          onPress={() => router.push('/(root)/blocked')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.cardTitle}>Blocked accounts</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          <Text style={styles.cardBody}>
            Manage the accounts you have blocked or muted. Their content stays out of your feeds.
          </Text>
        </Pressable>
      ) : null}

      {/* Keys and Recovery (plan 48 WP6). Surfaced right under the identity card
          because losing a signing key used to be terminal for a byline: the
          journalist could still sign in but could never publish another revision
          of their own work. The card states the posture honestly, including when
          this device cannot sign, and routes to the full screen. */}
      {profile && !unconfigured ? (
        <Pressable
          onPress={() => router.push('/(root)/keys')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.cardTitle}>Keys and Recovery</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          {custodyState.status === 'loaded' ? (
            <>
              <Text
                style={[
                  styles.statusLine,
                  custodyState.copy.tone === 'bad' && styles.statusLineBad,
                ]}
              >
                {custodyState.copy.title}
              </Text>
              <Text style={styles.cardBody}>{custodyState.copy.body}</Text>
            </>
          ) : custodyState.status === 'error' ? (
            <ErrorText style={styles.error}>Could not load your keys: {custodyState.message}</ErrorText>
          ) : (
            <Text style={styles.cardMeta}>Checking your signing keys...</Text>
          )}
        </Pressable>
      ) : null}

      {/* Account rights: export and deletion (plan 48 WP5) */}
      {hasSession && !unconfigured ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your data</Text>
          <Text style={styles.cardBody}>
            Export everything your account owns, or delete your account. Deletion starts a grace
            period you can cancel.
          </Text>
          <Pressable
            onPress={() => router.push('/(root)/account-export')}
            accessibilityRole="button"
            style={styles.rowHeader}
          >
            <Text style={styles.rowLink}>Export my data</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(root)/account-delete')}
            accessibilityRole="button"
            style={styles.rowHeader}
          >
            <Text style={[styles.rowLink, styles.rowLinkDanger]}>Delete my account</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </Pressable>
        </View>
      ) : null}

      {/* Legal hub (always reachable, not session-gated) */}
      <Pressable
        onPress={() => router.push('/(root)/legal')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.cardTitle}>Legal</Text>
          <ChevronRight color={tokens.textTertiary} size={18} />
        </View>
        <Text style={styles.cardBody}>
          Terms of Service, Privacy Policy, Community Guidelines, copyright / DMCA, and how to reach
          us.
        </Text>
      </Pressable>

      {/* Notices: DSA Art 17 statements of reasons for your own content */}
      {profile && !unconfigured ? (
        <Pressable
          onPress={() => router.push('/(root)/notices')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.cardTitle}>Notices</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          <Text style={styles.cardBody}>
            If MyNews removes or restricts your content, the reason appears here.
          </Text>
        </Pressable>
      ) : null}

      {/* Held submissions: pre-publication screening holds and appeals (WP8) */}
      {profile && !unconfigured ? (
        <Pressable
          onPress={() => router.push('/(root)/held')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.cardTitle}>Held submissions</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          <Text style={styles.cardBody}>
            Anything of yours waiting for a person to read it before it publishes, and where to
            appeal.
          </Text>
        </Pressable>
      ) : null}

      {/* Verification center (WP8) */}
      {profile && !unconfigured ? (
        <Pressable
          onPress={() => router.push('/(root)/verification')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.cardTitle}>Verification</Text>
            <ChevronRight color={tokens.textTertiary} size={18} />
          </View>
          <Text style={styles.cardBody}>
            Ask a reviewer to confirm who you are. Optional, and it does not change how your work is
            ranked.
          </Text>
        </Pressable>
      ) : null}

      {/* My reports */}
      {profile && !unconfigured ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My reports</Text>
          {myReports === null ? (
            <Text style={styles.cardMeta}>Your reports have not loaded yet.</Text>
          ) : myReports.length === 0 ? (
            <Text style={styles.cardBody}>You have not reported any content.</Text>
          ) : (
            myReports.map((report) => {
              const row = toMyReportRow(report);
              return (
                <View key={row.id} style={styles.reportRow}>
                  <Text style={styles.reportTitle}>{row.title}</Text>
                  <Text style={styles.cardMeta}>
                    {row.status} · {relativeTime(report.createdAt)}
                  </Text>
                  {row.detail ? <Text style={styles.cardBody}>{row.detail}</Text> : null}
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 14,
  },
  screenTitle: {
    color: tokens.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardPressed: {
    opacity: 0.85,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  cardTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  keyValue: {
    color: tokens.accent,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statusLine: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statusLineBad: {
    color: tokens.danger,
  },
  handle: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  kindChip: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '700',
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
  scoreValue: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '800',
  },
  reportRow: {
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 3,
  },
  reportTitle: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonColumn: {
    gap: 8,
    marginTop: 4,
  },
  emailForm: {
    gap: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: tokens.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  authErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  authErrorText: {
    flex: 1,
  },
  dismiss: {
    color: tokens.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  success: {
    color: tokens.success,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  rowLink: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowLinkDanger: {
    color: tokens.danger,
  },
});
