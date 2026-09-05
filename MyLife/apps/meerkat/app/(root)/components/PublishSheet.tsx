// PublishSheet (Plan 19 P7b): the owner/admin "Make public" + "Publish post
// publicly" sheet. It drives the REAL P7a orchestrator (publishChannelPublicly):
// the author explicitly selects the Public audience (wiring the dormant
// AudienceSelector, which surfaces the `public` rule's hosted notice verbatim),
// names + categorizes the publication, and pastes a serving-host URL that is
// REALLY probed (GET {host}/healthz) before Publish enables. The hosted managed
// path obtains a short-lived entitlement and uploads the signed archive job.

import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {
  createHostedAuthBearer,
  createAudienceRule,
  createCommunityAudienceRule,
  type ArchiveLicense,
  type ArchiveTier,
  type AudienceRule,
  type PublicCategory,
  type PublicationJoinPolicy,
  type PublicationKind,
  type RightsAssertion,
} from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { VerifySheet } from './VerifySheet';
import { clearStoredHumanityToken, getStoredHumanityToken, humanityGateState } from '../data/humanity-core';
import { Button, CopyRow, HonestNotice, SectionHeader } from './kit';
import { AudienceSelector } from './AudienceRule';
import { PUBLIC_CATEGORIES, PUBLIC_CATEGORY_LABELS } from '../data/discover-core';
import { getSetting } from '../data/db';
import { PUBLIC_DIRECTORY_URL_SETTING } from '../data/sync-core';
import {
  ARCHIVE_COPY,
  ARCHIVE_LICENSE_OPTIONS,
  JOIN_POLICY_COPY,
  PUBLISH_COPY,
  RIGHTS_ASSERTION_OPTIONS,
  archiveManagedTierLabel,
  archivePublishResultView,
  canConfirmArchivePublish,
  cancelManagedArchiveJob,
  hostedServingPath,
  probeServingHost,
  publishChannelPublicly,
  refreshManagedArchiveJob,
  type HostProbeResult,
  type PublishResult,
} from '../data/public-publish';
import { liveAccountDeps, presentCredentialHeader } from '../data/account-core';
import { MK_RADIUS, type MkColors } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export interface PublishChannelOption {
  id: string;
  name: string;
}

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'done'; result: HostProbeResult };

function hostedArchiveConfig(): { apiUrl: string; communityUrl: string } {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    hostedApiUrl?: unknown;
    hostedCommunityNodeUrl?: unknown;
  };
  const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\/+$/u, '') : '';
  return { apiUrl: text(extra.hostedApiUrl), communityUrl: text(extra.hostedCommunityNodeUrl) };
}

export function PublishSheet({
  visible,
  onClose,
  communityId,
  channels,
  initialChannelId,
  lockChannel = false,
  postId = null,
  kind = 'channel',
  initialTitle = '',
}: {
  visible: boolean;
  onClose: () => void;
  communityId: string;
  channels: PublishChannelOption[];
  initialChannelId?: string;
  lockChannel?: boolean;
  postId?: string | null;
  kind?: PublicationKind;
  initialTitle?: string;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();

  const communityRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);
  const publicRule = useMemo(() => createAudienceRule({ type: 'public' }), []);
  const audienceOptions = useMemo<readonly AudienceRule[]>(
    () => [communityRule, publicRule],
    [communityRule, publicRule],
  );

  const [audience, setAudience] = useState<AudienceRule>(communityRule);
  const [channelId, setChannelId] = useState<string>(initialChannelId ?? channels[0]?.id ?? '');
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [host, setHost] = useState('');
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  // Durable-archive step (Plan 19 P9.3e). Rights/license have NO default (NC-8).
  const [consentChecked, setConsentChecked] = useState(false);
  const [rightsAssertion, setRightsAssertion] = useState<RightsAssertion | null>(null);
  const [license, setLicense] = useState<ArchiveLicense | null>(null);
  const [provenance, setProvenance] = useState('');
  const [archiveTier, setArchiveTier] = useState<ArchiveTier>('self_host');
  const [managedError, setManagedError] = useState<string | null>(null);
  const [archiveActionError, setArchiveActionError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  // FF3 join policy. Off by default (readers can only read); joinPolicy defaults to 'request'.
  const [advertiseJoins, setAdvertiseJoins] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState<PublicationJoinPolicy>('request');
  // Publishing publicly reaches other people, so it is humanity-gated (AM9). The
  // VerifySheet opens when this device is not yet verified; publish is blocked
  // (never sealed) until a real token exists, and honestly says so with no service.
  const [showVerify, setShowVerify] = useState(false);
  const managedConfig = useMemo(hostedArchiveConfig, []);
  const managedConfigured = Boolean(managedConfig.apiUrl && managedConfig.communityUrl);

  const reachable = probe.kind === 'done' && probe.result.reachable;
  const audienceIsPublic = audience.type === 'public';
  const canConfirm = canConfirmArchivePublish({
    title, category, hostReachable: reachable, audienceIsPublic, consentChecked, rightsAssertion, license,
  });

  // Any host edit or tier switch supersedes an in-flight probe; without this a
  // stale in-flight result could land AFTER the reset and mark the NEW host
  // "reachable" off the OLD host's health check (fail-closed violation).
  const probeSeq = useRef(0);

  // Re-probing is required after the URL changes, so editing the host resets the
  // verified state (fail-closed: a stale "reachable" can never gate Publish).
  const onHostChange = useCallback((next: string) => {
    probeSeq.current += 1;
    setHost(next);
    setProbe({ kind: 'idle' });
  }, []);

  const onTierChange = useCallback(async (next: ArchiveTier): Promise<void> => {
    if (next === 'managed' && !managedConfigured) return;
    const seq = ++probeSeq.current;
    setArchiveTier(next);
    const nextHost = next === 'managed' ? managedConfig.communityUrl : '';
    setHost(nextHost);
    if (next === 'managed') {
      setProbe({ kind: 'probing' });
      const r = await probeServingHost(nextHost);
      if (probeSeq.current === seq) setProbe({ kind: 'done', result: r });
    } else {
      setProbe({ kind: 'idle' });
    }
    setManagedError(null);
  }, [managedConfig.communityUrl, managedConfigured]);

  const onProbe = useCallback(async () => {
    const seq = ++probeSeq.current;
    setProbe({ kind: 'probing' });
    const r = await probeServingHost(host);
    if (probeSeq.current === seq) setProbe({ kind: 'done', result: r });
  }, [host]);

  const onPublish = useCallback(async () => {
    if (!canConfirm || busy) return;
    // AM9: a public publish is humanity-gated. Not verified => open the VerifySheet
    // and stop here; nothing is sealed until a real token exists (fail-closed).
    if (humanityGateState(db) !== 'verified') {
      setShowVerify(true);
      return;
    }
    setBusy(true);
    setResult(null);
    setManagedError(null);
    try {
      let managed: { baseUrl: string; entitlementToken: string } | undefined;
      if (archiveTier === 'managed') {
        const entitlementResponse = await fetch(`${managedConfig.apiUrl}/api/entitlements/meerkat`, {
          headers: { Authorization: `Bearer ${createHostedAuthBearer(identity)}` },
        });
        if (entitlementResponse.status === 402) {
          setManagedError('Managed hosting needs an active hosted plan. Open Hosted services to subscribe or restore access.');
          return;
        }
        if (!entitlementResponse.ok) {
          setManagedError(`Managed hosting access could not be verified (${entitlementResponse.status}).`);
          return;
        }
        const entitlement = await entitlementResponse.json() as { token?: unknown };
        if (typeof entitlement.token !== 'string' || !entitlement.token.trim()) {
          setManagedError('Managed hosting access returned no signed entitlement.');
          return;
        }
        managed = { baseUrl: managedConfig.communityUrl, entitlementToken: entitlement.token };
      }
      const directoryUrl = getSetting(db, PUBLIC_DIRECTORY_URL_SETTING) ?? '';
      // Plan 51 P3: attach the anonymous verification-account credential when one
      // exists (carries NO account identifier, AC-2). Absent leaves the register
      // byte-identical to the pre-Plan-51 publish.
      const credentialHeaders = (await presentCredentialHeader(liveAccountDeps())) ?? undefined;
      const r = await publishChannelPublicly(
        // Hermes may lack globalThis.crypto.getRandomValues; inject expo-crypto so
        // the published key is real (the P7a default throws fail-closed).
        { randomBytes: (n: number) => Crypto.getRandomBytes(n) },
        {
          db,
          identity,
          communityId,
          channelId,
          title: title.trim(),
          description: description.trim(),
          category: category as PublicCategory,
          hostUrls: [host.trim()],
          directoryUrl,
          postId,
          kind,
          // FF3: mint the owner-signed public-join grant when the owner opts to advertise joins.
          joinPolicy,
          advertiseJoins,
          // Plan 24 P3: the wallet token rides x-mk-humanity so humanity-gated
          // hosts accept the genesis register (the gate above guarantees one).
          humanityToken: getStoredHumanityToken(db),
          // Plan 51 P3: the anonymous verification-account credential (AC-2).
          ...(credentialHeaders ? { credentialHeaders } : {}),
          // Durable-archive step: rights are signed into the descriptor + persisted.
          // license/rightsAssertion are non-null here (canConfirm gates on them).
          archive: {
            rights: {
              license: license as ArchiveLicense,
              rightsAssertion: rightsAssertion as RightsAssertion,
              provenance: provenance.trim(),
              consentAt: new Date().toISOString(),
            },
            tier: archiveTier,
            ...(managed ? { managed } : {}),
          },
        },
      );
      setResult(r);
      // The wallet token is SINGLE-USE: once a host accepted the register, a
      // humanity-gated host has spent it server-side; and a humanity_invalid
      // rejection means the token is spent/dead server-side too. Keeping it
      // either way would replay a dead token forever (humanityGateState only
      // checks signature + expiry locally). Clearing flips the gate back to
      // needs_verification honestly; the silent re-verify refills. Worst case
      // (an ungated host accepted) wastes one free token.
      if (r.hosts.some((h) => h.accepted || h.reason === 'humanity_invalid')) {
        clearStoredHumanityToken(db);
      }
    } catch {
      if (archiveTier === 'managed') {
        setManagedError('Could not reach managed hosting. Your public snapshot was not uploaded.');
        return;
      }
      // A thrown orchestrator error is surfaced as the honest Error state with
      // the no-host reason (no host accepted, nothing announced or persisted).
      setResult({
        state: 'error',
        message: PUBLISH_COPY.errorNoHost,
        publicationId: null,
        link: null,
        hosts: [],
        announced: false,
      });
    } finally {
      setBusy(false);
    }
  }, [
    busy, canConfirm, db, identity, communityId, channelId, title, description,
    category, host, postId, kind, license, rightsAssertion, provenance,
    joinPolicy, advertiseJoins, archiveTier, managedConfig.apiUrl, managedConfig.communityUrl,
  ]);

  const view = result ? archivePublishResultView(result) : null;
  const title2 = kind === 'post' ? 'Publish post publicly' : 'Make public';

  const onArchiveRefresh = async (): Promise<void> => {
    if (!result?.archive || result.archive.tier !== 'managed') return;
    setBusy(true);
    setArchiveActionError(null);
    try {
      const job = await refreshManagedArchiveJob(db, identity, result.archive.jobId);
      const moderationState = job.status === 'approved' || job.status === 'pinned' || job.status === 'announced'
        ? 'approved' : job.status === 'rejected' ? 'rejected' : job.status === 'failed' ? 'failed' : 'pending';
      setResult({ ...result, archive: { ...result.archive, status: job.status, moderationState } });
    } catch {
      setArchiveActionError('Could not refresh archive status. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const onArchiveCancel = async (): Promise<void> => {
    if (!result?.archive || result.archive.tier !== 'managed') return;
    setBusy(true);
    setArchiveActionError(null);
    try {
      const job = await cancelManagedArchiveJob(db, identity, result.archive.jobId);
      setResult({ ...result, archive: { ...result.archive, status: job.status, moderationState: 'pending' } });
    } catch {
      setArchiveActionError('Could not request archive removal. Nothing was reported as removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{title2}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {busy ? (
              <View style={styles.statePanel}>
                <Text style={styles.stateHeading}>{PUBLISH_COPY.loading}</Text>
              </View>
            ) : view ? (
              <View style={styles.statePanel}>
                <Text
                  style={[
                    styles.stateHeading,
                    view.tone === 'error' && { color: c.danger },
                    view.tone === 'success' && { color: c.success },
                  ]}
                >
                  {view.heading}
                </Text>
                {view.body ? <Text style={styles.stateBody}>{view.body}</Text> : null}
                {view.archiveNote ? (
                  <View style={styles.archiveNote}>
                    <Text style={styles.archiveNoteText}>{view.archiveNote}</Text>
                    {view.archiveNoteDetail ? <Text style={styles.archiveNoteDetail}>{view.archiveNoteDetail}</Text> : null}
                  </View>
                ) : null}
                {view.link ? (
                  <CopyRow
                    label={`Copy link  ${view.link}`}
                    accessibilityLabel="Copy public link"
                    onPress={() => {
                      if (!view.link) return;
                      setCopyError(null);
                      // The clipboard write can reject; a swallowed rejection is a
                      // silent dead tap.
                      Clipboard.setStringAsync(view.link).catch(() => {
                        setCopyError('Could not copy the link.');
                      });
                    }}
                  />
                ) : null}
                {copyError ? <Text style={{ color: c.danger, fontSize: 12.5 }}>{copyError}</Text> : null}
                {result?.archive?.tier === 'managed' ? (
                  <View style={styles.archiveNote}>
                    <Text style={styles.archiveNoteText}>Managed archive status: {result.archive.status}</Text>
                    {archiveActionError ? <Text style={[styles.archiveNoteDetail, { color: c.danger }]}>{archiveActionError}</Text> : null}
                    <View style={styles.chips}>
                      <Button title="Refresh status" variant="secondary" onPress={() => { void onArchiveRefresh(); }} />
                      {!['removed', 'takedown_pending'].includes(result.archive.status) ? (
                        <Button title="Remove archive" variant="secondary" onPress={() => { void onArchiveCancel(); }} />
                      ) : null}
                    </View>
                  </View>
                ) : null}
                <View style={styles.stateActions}>
                  {view.tone === 'error' || view.tone === 'empty' ? (
                    <Button title="Back" variant="secondary" onPress={() => setResult(null)} />
                  ) : (
                    <Button title="Done" onPress={onClose} />
                  )}
                </View>
              </View>
            ) : (
              <>
                <SectionHeader title="Audience" hint="Choose Public to publish where anyone can read it." />
                <AudienceSelector value={audience} options={audienceOptions} onChange={setAudience} />

                {!lockChannel && channels.length > 0 ? (
                  <>
                    <Text style={styles.fieldLabel}>Channel</Text>
                    <View style={styles.chips}>
                      {channels.map((ch) => {
                        const on = ch.id === channelId;
                        return (
                          <Pressable
                            key={ch.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`Channel ${ch.name}`}
                            onPress={() => setChannelId(ch.id)}
                            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>#{ch.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What is this public space?"
                  placeholderTextColor={c.textTertiary}
                  accessibilityLabel="Publication title"
                />

                <Text style={styles.fieldLabel}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="A short description for the directory"
                  placeholderTextColor={c.textTertiary}
                  multiline
                  accessibilityLabel="Publication description"
                />

                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.chips}>
                  {PUBLIC_CATEGORIES.map((cat) => {
                    const on = cat === category;
                    return (
                      <Pressable
                        key={cat}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`Category ${PUBLIC_CATEGORY_LABELS[cat]}`}
                        onPress={() => setCategory(cat)}
                        style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{PUBLIC_CATEGORY_LABELS[cat]}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <SectionHeader title="Serving host" hint={PUBLISH_COPY.hostFieldLabel} />
                <Text style={styles.pathLabel}>Self-host (free)</Text>
                <Text style={styles.pathHint}>{PUBLISH_COPY.selfHostPath}</Text>
                <View style={styles.hostRow}>
                  <TextInput
                    style={[styles.input, styles.hostInput]}
                    value={host}
                    onChangeText={onHostChange}
                    placeholder="https://my-host.example"
                    placeholderTextColor={c.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    accessibilityLabel="Serving host URL"
                  />
                  <Button
                    title={probe.kind === 'probing' ? 'Checking…' : 'Probe'}
                    variant="secondary"
                    disabled={probe.kind === 'probing' || host.trim().length === 0}
                    onPress={() => { void onProbe(); }}
                  />
                </View>
                {probe.kind === 'done' ? (
                  probe.result.reachable ? (
                    <Text style={[styles.probeNote, { color: c.success }]}>Host reachable. You can publish.</Text>
                  ) : (
                    <Text style={[styles.probeNote, { color: c.danger }]}>
                      {probe.result.reason === 'bad_url'
                        ? 'Enter a full http(s) host URL.'
                        : 'No response from that host. Check the URL or that your host is online.'}
                    </Text>
                  )
                ) : null}

                <Text style={styles.pathLabel}>Hosted (paid)</Text>
                <Text style={styles.pathHint}>{hostedServingPath()}</Text>
                <HonestNotice text={managedConfigured ? ARCHIVE_COPY.tierManagedAvailable : ARCHIVE_COPY.tierManagedDisabled} />

                {audienceIsPublic ? (
                  <>
                    <SectionHeader title={JOIN_POLICY_COPY.sectionTitle} hint={JOIN_POLICY_COPY.sectionHint} />
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: advertiseJoins }}
                      accessibilityLabel={JOIN_POLICY_COPY.advertiseToggle}
                      onPress={() => setAdvertiseJoins((v) => !v)}
                      style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
                    >
                      <View style={[styles.checkbox, advertiseJoins && styles.checkboxOn]}>
                        {advertiseJoins ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                      <View style={styles.consentTextWrap}>
                        <Text style={styles.consentToggle}>{JOIN_POLICY_COPY.advertiseToggle}</Text>
                        <Text style={styles.consentText}>{JOIN_POLICY_COPY.advertiseHint}</Text>
                      </View>
                    </Pressable>
                    {advertiseJoins ? (
                      <>
                        <View style={styles.chips}>
                          {([
                            { value: 'request' as const, label: JOIN_POLICY_COPY.requestLabel },
                            { value: 'open' as const, label: JOIN_POLICY_COPY.openLabel },
                          ]).map((opt) => {
                            const on = opt.value === joinPolicy;
                            return (
                              <Pressable
                                key={opt.value}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                accessibilityLabel={`Join policy ${opt.label}`}
                                onPress={() => setJoinPolicy(opt.value)}
                                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                              >
                                <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Text style={styles.pathHint}>
                          {joinPolicy === 'open' ? JOIN_POLICY_COPY.openHint : JOIN_POLICY_COPY.requestHint}
                        </Text>
                        <HonestNotice text={JOIN_POLICY_COPY.membershipNote} />
                      </>
                    ) : null}

                    <SectionHeader title={ARCHIVE_COPY.sectionTitle} hint={ARCHIVE_COPY.sectionHint} />

                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: consentChecked }}
                      accessibilityLabel="Consent to publishing publicly"
                      onPress={() => setConsentChecked((v) => !v)}
                      style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
                    >
                      <View style={[styles.checkbox, consentChecked && styles.checkboxOn]}>
                        {consentChecked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                      <View style={styles.consentTextWrap}>
                        <Text style={styles.consentText}>{ARCHIVE_COPY.consent}</Text>
                        <Text style={styles.consentToggle}>{ARCHIVE_COPY.consentToggle}</Text>
                      </View>
                    </Pressable>

                    <Text style={styles.fieldLabel}>{ARCHIVE_COPY.rightsTitle}</Text>
                    <Text style={styles.pathHint}>{ARCHIVE_COPY.rightsHint}</Text>
                    <View style={styles.chips}>
                      {RIGHTS_ASSERTION_OPTIONS.map((opt) => {
                        const on = opt.value === rightsAssertion;
                        return (
                          <Pressable
                            key={opt.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`Rights: ${opt.label}`}
                            onPress={() => setRightsAssertion(opt.value)}
                            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>{ARCHIVE_COPY.licenseTitle}</Text>
                    <View style={styles.chips}>
                      {ARCHIVE_LICENSE_OPTIONS.map((opt) => {
                        const on = opt.value === license;
                        return (
                          <Pressable
                            key={opt.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`License: ${opt.label}`}
                            onPress={() => setLicense(opt.value)}
                            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>{ARCHIVE_COPY.provenanceLabel}</Text>
                    <TextInput
                      style={styles.input}
                      value={provenance}
                      onChangeText={setProvenance}
                      placeholder={ARCHIVE_COPY.provenancePlaceholder}
                      placeholderTextColor={c.textTertiary}
                      accessibilityLabel="Source or attribution"
                    />

                    <Text style={styles.fieldLabel}>{ARCHIVE_COPY.tierTitle}</Text>
                    <Text style={styles.pathHint}>{ARCHIVE_COPY.tierCopy}</Text>
                    <View style={styles.chips}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: archiveTier === 'self_host' }}
                        accessibilityLabel={ARCHIVE_COPY.tierSelfHost}
                        onPress={() => { void onTierChange('self_host'); }}
                        style={({ pressed }) => [styles.chip, archiveTier === 'self_host' && styles.chipOn, pressed && styles.pressed]}
                      >
                        <Text style={[styles.chipText, archiveTier === 'self_host' && styles.chipTextOn]}>{ARCHIVE_COPY.tierSelfHost}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: archiveTier === 'managed', disabled: !managedConfigured }}
                        accessibilityLabel={archiveManagedTierLabel()}
                        disabled={!managedConfigured}
                        onPress={() => { void onTierChange('managed'); }}
                        style={({ pressed }) => [
                          styles.chip,
                          archiveTier === 'managed' && styles.chipOn,
                          !managedConfigured && styles.chipDisabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[
                          styles.chipText,
                          archiveTier === 'managed' && styles.chipTextOn,
                          !managedConfigured && styles.chipTextDisabled,
                        ]}>{archiveManagedTierLabel()}</Text>
                      </Pressable>
                    </View>
                    <HonestNotice text={managedError ?? (managedConfigured ? ARCHIVE_COPY.tierManagedAvailable : ARCHIVE_COPY.tierManagedDisabled)} />
                  </>
                ) : null}

                <View style={styles.confirmWrap}>
                  <Button title={PUBLISH_COPY.confirm} disabled={!canConfirm} onPress={() => { void onPublish(); }} />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
      <VerifySheet
        visible={showVerify}
        onClose={() => setShowVerify(false)}
        onVerified={() => { setShowVerify(false); void onPublish(); }}
        purpose="publish to the public directory"
      />
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: c.background,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: c.border },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  headerTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
  close: { color: c.accent, fontSize: 14, fontWeight: '700' },
  body: { gap: 10, paddingBottom: 28 },
  fieldLabel: { color: c.textSecondary, fontSize: 12.5, fontWeight: '700', marginTop: 4 },
  input: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: c.accent, backgroundColor: c.glass },
  chipText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '700' },
  chipTextOn: { color: c.accent },
  pathLabel: { color: c.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  pathHint: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hostInput: { flex: 1 },
  probeNote: { fontSize: 12, fontWeight: '700' },
  confirmWrap: { marginTop: 8 },
  statePanel: { gap: 12, paddingVertical: 12 },
  stateHeading: { color: c.text, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  stateBody: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  stateActions: { marginTop: 4 },
  archiveNote: {
    backgroundColor: c.glass,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 4,
  },
  archiveNoteText: { color: c.text, fontSize: 13, fontWeight: '700' },
  archiveNoteDetail: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderColor: c.border,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { borderColor: c.accent, backgroundColor: c.accent },
  checkboxMark: { color: c.background, fontSize: 14, fontWeight: '900' },
  consentTextWrap: { flex: 1, gap: 2 },
  consentText: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  consentToggle: { color: c.text, fontSize: 12.5, fontWeight: '700' },
  chipDisabled: { opacity: 0.5 },
  chipTextDisabled: { color: c.textSecondary, fontSize: 12.5, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
