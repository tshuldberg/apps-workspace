// PublishSheet (Plan 19 P7b, web twin): the owner/admin "Make public" + "Publish
// post publicly" overlay. It drives the REAL P7a orchestrator
// (publishChannelPublicly): the author explicitly selects the Public audience
// (wiring the web AudienceSelector, which surfaces the `public` rule's hosted
// notice verbatim), names + categorizes the publication, and pastes a serving-
// host URL that is REALLY probed (GET {host}/healthz) before Publish enables.
// The hosted managed path uses the cached signed entitlement to upload a real
// archive job. Web uses the global crypto for the published key.

import { useMemo, useRef, useState } from 'react';
import {
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
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { CopyRow } from '../shell/CopyRow';
import { HonestNotice } from '../shell/HonestNotice';
import { TextField, TextArea } from '../shell/Field';
import { AudienceSelector } from '../audience/AudienceRule';
import { PUBLIC_CATEGORIES, PUBLIC_CATEGORY_LABELS } from '../../lib/discover-core';
import { getSetting, PUBLIC_DIRECTORY_URL_SETTING } from '../../lib/meerkat-data';
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
} from '../../lib/public-publish';
import { clearStoredHumanityToken, getStoredHumanityToken, humanityGateState } from '../../lib/humanity-core';
import { liveAccountDeps, presentCredentialHeader } from '../../lib/account';
import { VerifySheet } from '../discover/VerifySheet';
import { HOSTED_COMMUNITY_NODE_URL } from '../../lib/hosted-access';

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'done'; result: HostProbeResult };

export function PublishSheet({
  communityId,
  channelId: fixedChannelId,
  postId,
}: {
  communityId: string;
  channelId?: string;
  postId?: string;
}): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const channels = community?.descriptor.channels ?? [];
  const kind: PublicationKind = postId ? 'post' : 'channel';
  const lockChannel = Boolean(fixedChannelId);

  const communityRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);
  const publicRule = useMemo(() => createAudienceRule({ type: 'public' }), []);
  const audienceOptions = useMemo<readonly AudienceRule[]>(
    () => [communityRule, publicRule],
    [communityRule, publicRule],
  );

  const [audience, setAudience] = useState<AudienceRule>(communityRule);
  const [channelId, setChannelId] = useState<string>(fixedChannelId ?? channels[0]?.id ?? '');
  const [title, setTitle] = useState('');
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
  // FF3 join policy. Off by default (readers can only read); joinPolicy defaults to 'request'.
  const [advertiseJoins, setAdvertiseJoins] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState<PublicationJoinPolicy>('request');
  // Public publish is humanity-gated (AM9): the VerifySheet opens when this device
  // is not verified; nothing is sealed until a real token exists (fail-closed).
  const [showVerify, setShowVerify] = useState(false);
  const managedConfigured = Boolean(HOSTED_COMMUNITY_NODE_URL && m.hostedAccess.entitlementToken);

  const reachable = probe.kind === 'done' && probe.result.reachable;
  const audienceIsPublic = audience.type === 'public';
  const canConfirm = canConfirmArchivePublish({
    title, category, hostReachable: reachable, audienceIsPublic, consentChecked, rightsAssertion, license,
  });

  // Any host edit or tier switch supersedes an in-flight probe; without this a
  // stale in-flight result could land AFTER the reset and mark the NEW host
  // "reachable" off the OLD host's health check (fail-closed violation).
  const probeSeq = useRef(0);

  const onHostChange = (next: string): void => {
    probeSeq.current += 1;
    setHost(next);
    // Re-probing is required after the URL changes (fail-closed: a stale
    // "reachable" can never gate Publish).
    setProbe({ kind: 'idle' });
  };

  const onTierChange = async (next: ArchiveTier): Promise<void> => {
    if (next === 'managed' && !managedConfigured) return;
    const seq = ++probeSeq.current;
    setArchiveTier(next);
    const nextHost = next === 'managed' ? HOSTED_COMMUNITY_NODE_URL : '';
    setHost(nextHost);
    if (next === 'managed') {
      setProbe({ kind: 'probing' });
      const r = await probeServingHost(nextHost);
      if (probeSeq.current === seq) setProbe({ kind: 'done', result: r });
    } else {
      setProbe({ kind: 'idle' });
    }
    setManagedError(null);
  };

  const onProbe = async (): Promise<void> => {
    const seq = ++probeSeq.current;
    setProbe({ kind: 'probing' });
    const r = await probeServingHost(host);
    if (probeSeq.current === seq) setProbe({ kind: 'done', result: r });
  };

  const onPublish = async (): Promise<void> => {
    if (!canConfirm || busy) return;
    // AM9: a public publish is humanity-gated. Not verified => open the VerifySheet
    // and stop here; nothing is sealed until a real token exists (fail-closed).
    if (humanityGateState(m.db) !== 'verified') {
      setShowVerify(true);
      return;
    }
    setBusy(true);
    setResult(null);
    setManagedError(null);
    try {
      const managed = archiveTier === 'managed'
        ? { baseUrl: HOSTED_COMMUNITY_NODE_URL, entitlementToken: m.hostedAccess.entitlementToken ?? '' }
        : undefined;
      if (archiveTier === 'managed' && !managedConfigured) {
        setManagedError('Connect Hosted services and restore an active plan before managed publishing.');
        return;
      }
      const directoryUrl = getSetting(m.db, PUBLIC_DIRECTORY_URL_SETTING) ?? '';
      const credentialHeaders = presentCredentialHeader(liveAccountDeps(m.storageSecretAccess)) ?? undefined;
      // Web has globalThis.crypto.getRandomValues, so the P7a default randomBytes
      // is real; no injection needed.
      const r = await publishChannelPublicly(
        {},
        {
          db: m.db,
          identity: m.identity,
          communityId,
          channelId,
          title: title.trim(),
          description: description.trim(),
          category: category as PublicCategory,
          hostUrls: [host.trim()],
          directoryUrl,
          postId: postId ?? null,
          kind,
          // FF3: mint the owner-signed public-join grant when the owner opts to advertise joins.
          joinPolicy,
          advertiseJoins,
          // Plan 24 P3: the wallet token rides x-mk-humanity so humanity-gated
          // hosts accept the genesis register (the gate above guarantees one).
          humanityToken: getStoredHumanityToken(m.db),
          // Plan 51 P3: attach the anonymous verification credential when one exists.
          // Absent => byte-identical; NO account identifier rides here (AC-2/AC-4).
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
        clearStoredHumanityToken(m.db);
      }
    } catch {
      if (archiveTier === 'managed') {
        setManagedError('Could not reach managed hosting. Your public snapshot was not uploaded.');
        return;
      }
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
  };

  const heading = kind === 'post' ? 'Publish post publicly' : 'Make public';
  const view = result ? archivePublishResultView(result) : null;

  const onArchiveRefresh = async (): Promise<void> => {
    if (!result?.archive || result.archive.tier !== 'managed') return;
    setBusy(true);
    setArchiveActionError(null);
    try {
      const job = await refreshManagedArchiveJob(m.db, m.identity, result.archive.jobId);
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
      const job = await cancelManagedArchiveJob(m.db, m.identity, result.archive.jobId);
      setResult({ ...result, archive: { ...result.archive, status: job.status, moderationState: 'pending' } });
    } catch {
      setArchiveActionError('Could not request archive removal. Nothing was reported as removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={heading} onClose={close} locked={busy}>
      {busy ? (
        <div className="mk-publish-state">
          <p className="mk-publish-heading">{PUBLISH_COPY.loading}</p>
        </div>
      ) : view ? (
        <div className="mk-publish-state">
          <div className={`mk-box ${view.tone === 'error' ? 'is-error' : view.tone === 'success' || view.tone === 'partial' ? 'is-success' : 'is-info'}`}>
            <p className="mk-publish-heading">{view.heading}</p>
            {view.body ? <p className="mk-muted">{view.body}</p> : null}
          </div>
          {view.archiveNote ? (
            <div className="mk-box is-info">
              <p className="mk-publish-heading">{view.archiveNote}</p>
              {view.archiveNoteDetail ? <p className="mk-muted">{view.archiveNoteDetail}</p> : null}
            </div>
          ) : null}
          {view.link ? <CopyRow value={view.link} label="Copy link" /> : null}
          {result?.archive?.tier === 'managed' ? (
            <div className="mk-box is-info">
              <p className="mk-publish-heading">Managed archive status: {result.archive.status}</p>
              {archiveActionError ? <p className="mk-pill is-error">{archiveActionError}</p> : null}
              <div className="mk-publish-actions">
                <Button variant="ghost" onClick={() => void onArchiveRefresh()}>Refresh status</Button>
                {!['removed', 'takedown_pending'].includes(result.archive.status) ? (
                  <Button variant="ghost" onClick={() => void onArchiveCancel()}>Remove archive</Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="mk-publish-actions">
            {view.tone === 'error' || view.tone === 'empty' ? (
              <Button variant="ghost" onClick={() => setResult(null)}>
                Back
              </Button>
            ) : (
              <Button onClick={close}>Done</Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mk-publish-form">
          <p className="mk-label">Audience</p>
          <AudienceSelector value={audience} options={audienceOptions} onChange={setAudience} />

          {!lockChannel && channels.length > 0 ? (
            <div className="mk-field">
              <span className="mk-label">Channel</span>
              <div className="mk-publish-chips" role="group" aria-label="Channel">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`mk-publish-chip ${ch.id === channelId ? 'is-active' : ''}`}
                    aria-pressed={ch.id === channelId}
                    onClick={() => setChannelId(ch.id)}
                  >
                    #{ch.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <TextField
            label="Title"
            value={title}
            placeholder="What is this public space?"
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <TextArea
            label="Description (optional)"
            value={description}
            placeholder="A short description for the directory"
            onChange={(e) => setDescription(e.currentTarget.value)}
          />

          <div className="mk-field">
            <span className="mk-label">Category</span>
            <div className="mk-publish-chips" role="group" aria-label="Categories">
              {PUBLIC_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`mk-publish-chip ${cat === category ? 'is-active' : ''}`}
                  aria-pressed={cat === category}
                  aria-label={`Category ${PUBLIC_CATEGORY_LABELS[cat]}`}
                  onClick={() => setCategory(cat)}
                >
                  {PUBLIC_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <p className="mk-label" style={{ marginTop: 8 }}>Serving host</p>
          <p className="mk-muted">{PUBLISH_COPY.hostFieldLabel}</p>
          <p className="mk-publish-path-label">Self-host (free)</p>
          <p className="mk-muted">{PUBLISH_COPY.selfHostPath}</p>
          <div className="mk-publish-host-row">
            <input
              className="mk-input"
              value={host}
              placeholder="https://my-host.example"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Serving host URL"
              onChange={(e) => onHostChange(e.currentTarget.value)}
            />
            <Button
              variant="ghost"
              disabled={probe.kind === 'probing' || host.trim().length === 0}
              onClick={() => void onProbe()}
            >
              {probe.kind === 'probing' ? 'Checking…' : 'Probe'}
            </Button>
          </div>
          {probe.kind === 'done' ? (
            probe.result.reachable ? (
              <p className="mk-pill is-success">Host reachable. You can publish.</p>
            ) : (
              <p className="mk-pill is-error">
                {probe.result.reason === 'bad_url'
                  ? 'Enter a full http(s) host URL.'
                  : 'No response from that host. Check the URL or that your host is online.'}
              </p>
            )
          ) : null}

          <p className="mk-publish-path-label">Hosted (paid)</p>
          <p className="mk-muted">{hostedServingPath()}</p>
          <HonestNotice>{managedConfigured ? ARCHIVE_COPY.tierManagedAvailable : ARCHIVE_COPY.tierManagedDisabled}</HonestNotice>

          {audienceIsPublic ? (
            <>
              <p className="mk-label" style={{ marginTop: 8 }}>{JOIN_POLICY_COPY.sectionTitle}</p>
              <p className="mk-muted">{JOIN_POLICY_COPY.sectionHint}</p>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={advertiseJoins}
                  onChange={(e) => setAdvertiseJoins(e.currentTarget.checked)}
                  aria-label={JOIN_POLICY_COPY.advertiseToggle}
                  style={{ marginTop: 3 }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="mk-label">{JOIN_POLICY_COPY.advertiseToggle}</span>
                  <span className="mk-muted">{JOIN_POLICY_COPY.advertiseHint}</span>
                </span>
              </label>
              {advertiseJoins ? (
                <>
                  <div className="mk-publish-chips" role="group" aria-label="Join policy">
                    {([
                      { value: 'request' as const, label: JOIN_POLICY_COPY.requestLabel },
                      { value: 'open' as const, label: JOIN_POLICY_COPY.openLabel },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`mk-publish-chip ${opt.value === joinPolicy ? 'is-active' : ''}`}
                        aria-pressed={opt.value === joinPolicy}
                        aria-label={`Join policy ${opt.label}`}
                        onClick={() => setJoinPolicy(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mk-muted">
                    {joinPolicy === 'open' ? JOIN_POLICY_COPY.openHint : JOIN_POLICY_COPY.requestHint}
                  </p>
                  <HonestNotice>{JOIN_POLICY_COPY.membershipNote}</HonestNotice>
                </>
              ) : null}

              <p className="mk-label" style={{ marginTop: 8 }}>{ARCHIVE_COPY.sectionTitle}</p>
              <p className="mk-muted">{ARCHIVE_COPY.sectionHint}</p>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.currentTarget.checked)}
                  aria-label="Consent to publishing publicly"
                  style={{ marginTop: 3 }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="mk-muted">{ARCHIVE_COPY.consent}</span>
                  <span className="mk-label">{ARCHIVE_COPY.consentToggle}</span>
                </span>
              </label>

              <div className="mk-field">
                <span className="mk-label">{ARCHIVE_COPY.rightsTitle}</span>
                <p className="mk-muted">{ARCHIVE_COPY.rightsHint}</p>
                <div className="mk-publish-chips" role="group" aria-label="Rights assertion">
                  {RIGHTS_ASSERTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`mk-publish-chip ${opt.value === rightsAssertion ? 'is-active' : ''}`}
                      aria-pressed={opt.value === rightsAssertion}
                      onClick={() => setRightsAssertion(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mk-field">
                <span className="mk-label">{ARCHIVE_COPY.licenseTitle}</span>
                <div className="mk-publish-chips" role="group" aria-label="License">
                  {ARCHIVE_LICENSE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`mk-publish-chip ${opt.value === license ? 'is-active' : ''}`}
                      aria-pressed={opt.value === license}
                      onClick={() => setLicense(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <TextField
                label={ARCHIVE_COPY.provenanceLabel}
                value={provenance}
                placeholder={ARCHIVE_COPY.provenancePlaceholder}
                onChange={(e) => setProvenance(e.currentTarget.value)}
              />

              <p className="mk-label" style={{ marginTop: 8 }}>{ARCHIVE_COPY.tierTitle}</p>
              <p className="mk-muted">{ARCHIVE_COPY.tierCopy}</p>
              <div className="mk-publish-chips" role="group" aria-label="Hosting tier">
                <button
                  type="button"
                  className={`mk-publish-chip ${archiveTier === 'self_host' ? 'is-active' : ''}`}
                  aria-pressed={archiveTier === 'self_host'}
                  onClick={() => void onTierChange('self_host')}
                >
                  {ARCHIVE_COPY.tierSelfHost}
                </button>
                <button
                  type="button"
                  className={`mk-publish-chip ${archiveTier === 'managed' ? 'is-active' : ''}`}
                  aria-pressed={archiveTier === 'managed'}
                  disabled={!managedConfigured}
                  onClick={() => void onTierChange('managed')}
                >
                  {archiveManagedTierLabel()}
                </button>
              </div>
              <HonestNotice>{managedError ?? (managedConfigured ? ARCHIVE_COPY.tierManagedAvailable : ARCHIVE_COPY.tierManagedDisabled)}</HonestNotice>
            </>
          ) : null}

          <div className="mk-publish-actions">
            <Button disabled={!canConfirm} onClick={() => void onPublish()}>
              {PUBLISH_COPY.confirm}
            </Button>
          </div>
        </div>
      )}
      {showVerify && (
        <VerifySheet
          onClose={() => setShowVerify(false)}
          onVerified={() => { setShowVerify(false); void onPublish(); }}
          purpose="publish to the public directory"
        />
      )}
    </Modal>
  );
}
