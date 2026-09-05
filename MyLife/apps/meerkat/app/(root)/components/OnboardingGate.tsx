import { getDeviceLayoutDefault, getLayoutDeviceClass } from '../data/device-layout-core';
import { AutoConnectCard } from './AutoConnectCard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, ChevronRight, Compass, Link, MessageCircle, Plus, UserPlus, UserRound } from 'lucide-react-native';
import { getCommunity, createCommunityInvite } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { useChatActions } from '../providers/ChatProvider';
import { createCommunityFromTemplate } from '../data/community-template-commit';
import { buildOnboardingExperience, findOnboardingExperience, type ExperienceId } from '../data/onboarding-experience-core';
import { visibleCommunityName } from '../data/community-templates';
import { useSync } from '../providers/SyncProvider';
import { ExperienceChooser } from './ExperienceChooser';
import {
  ONBOARDING_START_ROWS,
  getDeepLinkInvitePending,
  isOnboardingComplete,
  markOnboardingComplete,
  subscribeDeepLinkInvitePending,
  subscribeOnboardingComplete,
  suggestedDisplayName,
  type OnboardingStartOption,
} from '../data/onboarding-core';
import { Button, HonestNotice } from './kit';
import { InvitePreviewSheet } from './InvitePreviewSheet';
import { QrScanner, isQrScannerAvailable } from './QrScanner';
import { type MkColors, MK_MONO, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

type Step = 'layout' | 'theme' | 'name' | 'start' | 'create' | 'join' | 'message' | 'restore';
type BusyAction = 'create' | 'message' | 'open' | null;
// Navigation queued until the gate's native modal has actually dismissed.
// Navigating while the Modal tears down raced the navigator and left a stuck
// invisible modal window eating every touch on iOS (founder freeze 2026-08-30).
type PendingNav = { kind: 'push' | 'replace'; href: Href };

interface FirstMessageTarget {
  communityId: string;
  channelId: string;
  communityName: string;
}

const ROW_ICON: Record<OnboardingStartOption, typeof Plus> = {
  create: Plus,
  join: Link,
  add_friend: UserPlus,
  browse: Compass,
};

export function OnboardingGate({ unlocked }: { unlocked: boolean }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity, displayName, setDisplayName, restoreIdentity } = useIdentity();
  const { sendMessage } = useChatActions();
  const { recordLocalChange } = useSync();
  const creating = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const deviceProfile = getLayoutDeviceClass(db, 'mobile');
  const [experienceId, setExperienceId] = useState<ExperienceId>(() => { const choice = getDeviceLayoutDefault(db, deviceProfile); return choice === 'community' ? 'standard' : choice; });
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [themeId, setThemeId] = useState('open-burrow');

  const [complete, setComplete] = useState(() => isOnboardingComplete(db));
  // While a deep-link invite sheet is up, suppress this gate's modal so the two
  // never co-present (M1: never two visible modals).
  const [invitePending, setInvitePending] = useState(() => getDeepLinkInvitePending());
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(displayName);
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [step]);
  const [communityName, setCommunityName] = useState('Friends');
  const [inviteLink, setInviteLink] = useState('');
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [firstMessage, setFirstMessage] = useState('Hi everyone');
  const [target, setTarget] = useState<FirstMessageTarget | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreBackup, setRestoreBackup] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);

  const visible = !complete && !invitePending;

  const flushPendingNav = useCallback(() => {
    if (!pendingNav) return;
    setPendingNav(null);
    if (pendingNav.kind === 'push') router.push(pendingNav.href);
    else router.replace(pendingNav.href);
  }, [pendingNav, router]);

  // Modal onDismiss fires on iOS only; Android dismissal is synchronous enough
  // that flushing right after the hide commit is safe.
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    if (!visible) flushPendingNav();
  }, [visible, flushPendingNav]);

  useEffect(() => {
    setComplete(isOnboardingComplete(db));
  }, [db, identity.publicKey]);

  // A deep-link invite join (via CommunityInviteLinkListener) completes onboarding
  // externally; re-read on the signal so this gate dismisses at runtime (M1).
  useEffect(() => subscribeOnboardingComplete(() => setComplete(isOnboardingComplete(db))), [db]);
  useEffect(() => subscribeDeepLinkInvitePending(() => setInvitePending(getDeepLinkInvitePending())), []);

  const trimmedName = name.trim();
  const trimmedCommunityName = communityName.trim();
  const trimmedInviteLink = inviteLink.trim();
  const trimmedFirstMessage = firstMessage.trim();
  const suggestion = useMemo(() => suggestedDisplayName(displayName), [displayName]);

  const finishOnboarding = useCallback((nextTarget?: FirstMessageTarget) => {
    markOnboardingComplete(db);
    setComplete(true);
    if (nextTarget) {
      // push (not replace) so Back from the channel returns to the tabs root
      // instead of exiting the app (m3). Queued until the modal dismisses.
      setPendingNav({
        kind: 'push',
        href: {
          pathname: '/channel/[communityId]/[channelId]',
          params: { communityId: nextTarget.communityId, channelId: nextTarget.channelId },
        },
      });
    }
  }, [db]);

  const continueWithName = useCallback((value?: string) => {
    const chosen = (value ?? name).trim();
    if (!chosen) return;
    setDisplayName(chosen);
    setName(chosen);
    setStep('start');
    setNotice(null);
  }, [name, setDisplayName]);

  const chooseStart = useCallback((option: OnboardingStartOption) => {
    setNotice(null);
    if (option !== 'browse' && !unlocked) {
      // Locked: complete onboarding and close. The AppStack entitlement gate
      // owns the navigation to /upgrade (single navigation authority); an
      // imperative replace here raced the gate and the modal teardown and
      // froze the app (2026-08-30).
      markOnboardingComplete(db);
      setComplete(true);
      return;
    }
    if (option === 'create') { setStep('create'); return; }
    if (option === 'join') { setStep('join'); return; }
    if (option === 'add_friend') {
      finishOnboarding();
      setPendingNav({ kind: 'push', href: '/add-friend' });
      return;
    }
    // browse: complete onboarding with NO side effects and land on Discover (a
    // tab root; back-exits-app is the standard terminal here, m3).
    finishOnboarding();
    setPendingNav({ kind: 'replace', href: '/discover' });
  }, [db, finishOnboarding, unlocked]);

  const createFirstCommunity = useCallback(() => {
    if (creating.current || busy !== null || target) return; // guard rapid repeated activation
    if (!trimmedCommunityName) return;
    creating.current = true;
    setBusy('create');
    try {
      const draft = buildOnboardingExperience(communityName, experienceId, themeId);
      const result = createCommunityFromTemplate(db, identity, {
        name: draft.name, template: draft.template, adoptThemeBlob: draft.themeBlob,
        genesisChannels: draft.channels, layoutBlob: draft.layoutBlob, completeOnboarding: true,
        ...(useAsDefault ? { localLayoutDefault: { profile: deviceProfile, choice: experienceId } } : {}),
      }, recordLocalChange);
      const signed = getCommunity(db, result.communityId);
      setTarget({ communityId: result.communityId, channelId: 'general', communityName: draft.name });
      setFirstMessage('Hi everyone');
      setNotice('Community created. Send a first message or open your community.');
      setStep('message');
      try {
        setCopiedInvite(signed ? createCommunityInvite(identity, { descriptor: signed.descriptor, signature: signed.signature }).link : null);
      } catch {
        setCopiedInvite(null);
      }
    } catch (error) {
      creating.current = false;
      setNotice(error instanceof Error ? error.message : 'Could not create that community.');
    } finally {
      setBusy(null);
    }
  }, [busy, target, db, identity, communityName, experienceId, themeId, recordLocalChange, trimmedCommunityName, deviceProfile, useAsDefault]);

  const sendFirstMessage = useCallback(() => {
    if (busy !== null) return; // m1: a double-tap must not send two first messages
    if (!target || !trimmedFirstMessage) return;
    setBusy('message');
    try {
      const result = sendMessage(target.communityId, target.channelId, trimmedFirstMessage);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      finishOnboarding(target);
    } finally {
      setBusy(null);
    }
  }, [busy, finishOnboarding, sendMessage, target, trimmedFirstMessage]);

  const openChannel = useCallback(() => {
    if (!target || busy !== null) return;
    finishOnboarding();
    setPendingNav({ kind: 'push', href: { pathname: '/community/[communityId]', params: { communityId: target.communityId } },
    });
  }, [busy, finishOnboarding, target]);

  const trimmedRestoreKey = restoreKey.trim();
  const trimmedRestoreBackup = restoreBackup.trim();

  // Restore an existing identity from a recovery key + encrypted backup. On
  // success the identity swaps in (rebooting the engine) and onboarding is
  // marked complete, so this gate dismisses on the identity change. Fail-closed:
  // a wrong key or tampered backup shows an honest reason and changes nothing.
  const restoreFromBackup = useCallback(() => {
    if (busy !== null) return;
    if (!trimmedRestoreKey || !trimmedRestoreBackup) return;
    setBusy('open');
    setRestoreError(null);
    try {
      const result = restoreIdentity(trimmedRestoreKey, trimmedRestoreBackup);
      if (result.ok) {
        setComplete(true);
        return;
      }
      setRestoreError(
        result.reason === 'bad_key'
          ? 'That recovery key is not valid. Check for typos; it starts with MKR1.'
          : 'That backup could not be opened with this key. The key may be wrong, or the backup may be corrupt or from a different identity.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, restoreIdentity, trimmedRestoreKey, trimmedRestoreBackup]);

  const progressText = useMemo(() => {
    if (step === 'create') return 'Create · 1 of 3 · Community';
    if (step === 'layout') return 'Create · 2 of 3 · Layout';
    if (step === 'theme') return 'Create · 3 of 3 · Theme';
    if (step === 'message') return 'Your community is ready';
    return step === 'name' ? 'Your private name' : step === 'restore' ? 'Restore your identity' : 'How to begin';
  }, [step]);

  // The modal stays MOUNTED and toggles via `visible` (invitePending suppression
  // keeps M1: never two visible modals). Unmounting a visible RN Modal outright
  // is what left the stuck touch-eating window; visible=false lets the native
  // dismissal run to completion, and onDismiss flushes any queued navigation.
  if (scanning) {
    return (
      <Modal visible transparent={false} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scannerFill}>
          <QrScanner
            permissionRationale="Meerkat needs the camera only to scan a community invite. Nothing is photographed or stored."
            scanHint="Point the camera at a community invite QR."
            onScan={(value) => { setScanning(false); setPendingInvite(value.trim()); }}
            onCancel={() => setScanning(false)}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
      statusBarTranslucent
      onDismiss={flushPendingNav}
    >
      <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.mark}><UserRound size={24} color={c.accent} strokeWidth={1.9} /></View>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>{progressText}</Text>
                <Text style={styles.title}>Private social, controlled by you</Text>
                <Text style={styles.subtitle}>One step at a time. Pick a name, then choose how to begin.</Text>
              </View>
            </View>

            {step === 'name' ? (
              <View style={styles.panel}>
                <Text style={styles.fieldLabel}>Your name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="My Meerkat"
                  placeholderTextColor={c.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                  accessibilityLabel="Your name"
                  onSubmitEditing={() => continueWithName()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Use the name ${suggestion}`}
                  onPress={() => continueWithName(suggestion)}
                  style={({ pressed }) => [styles.suggestChip, pressed && styles.pressed]}
                >
                  <Text style={styles.suggestChipText}>Use "{suggestion}"</Text>
                </Pressable>
                <Button title="Continue" onPress={() => continueWithName()} disabled={!trimmedName} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Restore from a backup"
                  onPress={() => { setRestoreError(null); setStep('restore'); }}
                  style={({ pressed }) => [styles.restoreLink, pressed && styles.pressed]}
                >
                  <Text style={styles.restoreLinkText}>Already have a backup? Restore your identity</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 'restore' ? (
              <View style={styles.panel}>
                <BackRow label="Restore your identity" onBack={() => { setRestoreError(null); setStep('name'); }} />
                <Text style={styles.fieldLabel}>Recovery key</Text>
                <TextInput
                  style={styles.input}
                  value={restoreKey}
                  onChangeText={setRestoreKey}
                  placeholder="MKR1-XXXXX-XXXXX-..."
                  placeholderTextColor={c.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel="Recovery key"
                />
                <Text style={styles.fieldLabel}>Encrypted identity backup</Text>
                <TextInput
                  style={styles.linkInput}
                  value={restoreBackup}
                  onChangeText={setRestoreBackup}
                  placeholder="Paste the encrypted backup"
                  placeholderTextColor={c.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  accessibilityLabel="Encrypted identity backup"
                />
                <Button
                  title={busy === 'open' ? 'Restoring...' : 'Restore identity'}
                  onPress={restoreFromBackup}
                  disabled={!trimmedRestoreKey || !trimmedRestoreBackup || busy !== null}
                />
                {restoreError ? <Text style={styles.noticeText}>{restoreError}</Text> : null}
                <HonestNotice text="Restoring rebuilds the SAME identity from your recovery key and its encrypted backup: same device id and pairings. It restores identity keys, not your synced data, which re-flows from peers as you reconnect. A wrong key or a tampered backup fails closed and changes nothing." />
              </View>
            ) : null}

            {step === 'start' && unlocked ? <AutoConnectCard /> : null}
            {step === 'start' ? (
              <View style={styles.rows}>
                {ONBOARDING_START_ROWS.map((row) => {
                  const Icon = ROW_ICON[row.option];
                  return (
                    <Pressable
                      key={row.option}
                      accessibilityRole="button"
                      accessibilityLabel={row.title}
                      onPress={() => chooseStart(row.option)}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <View style={styles.rowIcon}><Icon size={20} color={c.accent} strokeWidth={1.9} /></View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{row.title}</Text>
                        <Text style={styles.rowDetail}>{row.detail}</Text>
                      </View>
                      <ChevronRight size={20} color={c.textTertiary} strokeWidth={2} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'create' || step === 'layout' || step === 'theme' ? (
              <View style={styles.panel}>
                <BackRow label="Create a community" onBack={() => { if (busy === null) { setNotice(null); setStep(step === 'create' ? 'start' : step === 'layout' ? 'create' : 'layout'); } }} />
                {step === 'create' && <TextInput style={styles.input} value={communityName} onChangeText={setCommunityName} maxLength={80} placeholder="Community name" placeholderTextColor={c.textTertiary} accessibilityLabel="Community name" />}
                <ExperienceChooser stage={step === 'create' ? 'intro' : step} name={communityName} experienceId={experienceId} themeId={themeId} onExperienceChange={setExperienceId} onThemeChange={setThemeId} />
                {step === 'layout' && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: useAsDefault }} onPress={() => setUseAsDefault((value) => !value)} style={styles.row}><Text style={styles.rowTitle}>{useAsDefault ? '✓ ' : ''}Use this layout by default on this device ({deviceProfile})</Text></Pressable>}
                {step === 'theme' && <Text style={styles.subtitle}>Create “{trimmedCommunityName}” with {findOnboardingExperience(experienceId)?.name}. You can invite people after creating it.</Text>}
                {step === 'create' && <Button title="Choose a layout" onPress={() => setStep('layout')} disabled={!visibleCommunityName(communityName)} />}
                {step === 'layout' && <Button title="Choose a theme" onPress={() => setStep('theme')} disabled={!findOnboardingExperience(experienceId)} />}
                {step === 'theme' && <Button title={busy === 'create' ? 'Creating...' : 'Create community'} onPress={createFirstCommunity} disabled={busy !== null} />}
              </View>
            ) : null}

            {step === 'join' ? (
              <View style={styles.panel}>
                <BackRow label="Join with an invite" onBack={() => setStep('start')} />
                {isQrScannerAvailable() ? (
                  <Button title="Scan an invite QR" variant="secondary" onPress={() => { setNotice(null); setScanning(true); }} />
                ) : null}
                <TextInput
                  style={styles.linkInput}
                  value={inviteLink}
                  onChangeText={setInviteLink}
                  placeholder="meerkat://community/join#..."
                  placeholderTextColor={c.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  accessibilityLabel="Community invite link"
                />
                <Button title="Preview invite" onPress={() => setPendingInvite(trimmedInviteLink)} disabled={!trimmedInviteLink} />
              </View>
            ) : null}

            {step === 'message' && target ? (
              <View style={styles.panel}>
                <View style={styles.actionHeader}>
                  <View style={styles.rowIcon}><MessageCircle size={18} color={c.accent} strokeWidth={1.9} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Say hello in {target.communityName}</Text>
                    <Text style={styles.rowDetail}>This message stays inside the community channel.</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.messageInput}
                  value={firstMessage}
                  onChangeText={setFirstMessage}
                  placeholder="Write a first message"
                  placeholderTextColor={c.textTertiary}
                  multiline
                  accessibilityLabel="First channel message"
                />
                {copiedInvite ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy invite link"
                    onPress={() => { void Clipboard.setStringAsync(copiedInvite); }}
                    style={({ pressed }) => [styles.inviteCopy, pressed && styles.pressed]}
                  >
                    <Text style={styles.inviteCopyText}>Copy invite link</Text>
                  </Pressable>
                ) : null}
                <View style={styles.buttonRow}>
                  <Button title={busy === 'message' ? 'Sending...' : 'Send first message'} onPress={sendFirstMessage} disabled={!trimmedFirstMessage || busy !== null} />
                  <Button title="Open community" variant="secondary" onPress={openChannel} disabled={busy !== null} />
                </View>
              </View>
            ) : null}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            <HonestNotice text="Messages need a connection to reach another device. Check their delivery status in each conversation." />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <InvitePreviewSheet
        link={pendingInvite}
        visible={pendingInvite !== null}
        onClose={() => setPendingInvite(null)}
        onJoined={() => { finishOnboarding(); }}
        // This gate's Modal hides in the join commit and unmounts the sheet
        // (and any queue inside it) with it, so the post-join push rides the
        // gate's own queue, flushed only after the gate's full teardown.
        onNavigate={(href) => setPendingNav({ kind: 'push', href })}
      />
    </Modal>
  );
}

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onBack}
      style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
    >
      <ChevronLeft size={20} color={c.accent} strokeWidth={2} />
      <Text style={styles.backRowText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.34)' },
  scannerFill: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { minHeight: '100%', justifyContent: 'center', paddingHorizontal: 16 },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 18,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  mark: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { color: c.accent, fontSize: 12, fontWeight: '800' },
  title: { color: c.text, fontSize: 24, lineHeight: 29, fontWeight: '800' },
  subtitle: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  panel: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 14,
    gap: 10,
  },
  fieldLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 44,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  linkInput: {
    minHeight: 70,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: MK_MONO,
    textAlignVertical: 'top',
  },
  messageInput: {
    minHeight: 76,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  suggestChip: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestChipText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  rows: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 14,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  rowDetail: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backRowText: { color: c.accent, fontSize: 14, fontWeight: '800' },
  actionHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  inviteCopy: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteCopyText: { color: c.accent, fontSize: 13, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  noticeText: { color: c.accent, fontSize: 13, lineHeight: 19 },
  restoreLink: { alignSelf: 'center', paddingVertical: 6 },
  restoreLinkText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
