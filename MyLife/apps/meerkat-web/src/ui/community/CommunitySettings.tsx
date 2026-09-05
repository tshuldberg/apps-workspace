// CommunitySettings (Plan 31 P5 T5.2 + Plan 28 P4 web half): the relocated
// community admin surface. Everything that used to live inline in ChannelSidebar
// (community profile editor, members + block, owner review queue,
// OwnerPublicReports, Make public, invite share, mute, leave, PublicJoinRequests)
// moves here behind the sidebar gear. This mirrors the mobile
// community/[communityId]/settings screen. Role gating is unchanged: owner-only
// rows never render for admins/members.
//
// Plan 28 P4 (web half): an OWNER-ONLY "Remove" control per non-self member row
// calls removeCommunityMemberById -- the SAME engine path the mobile settings
// screen uses. AC-4 binding: an admin (non-owner) never sees an enabled Remove,
// and never for self. The confirm copy is EPOCH-BOUNDARY honest (member-removal-
// view-core), and success/failure copy derives ONLY from the real result counts.
// A GLOBAL single-flight guard runs one removal at a time (the concurrent-removal
// fix: a second removal would sign off the pre-first descriptor, get silently
// dropped by the monotonic upsert, yet still rotate a second epoch and return ok).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Avatar } from '../kit/Avatar';
import { prepareAvatarFromFile, type AvatarPrepResult } from '../kit/avatar-image';
import { communityAdminCaps } from '../../lib/community-list-core';
import { buildCommunityInviteEnvelope } from '../../lib/invite-envelope-core';
import { INSTALL_URL } from '../../lib/install-url';
import { APPEAR_ONLINE_COPY, communityPresenceView, isAppearOnlineEnabled, setAppearOnlineEnabled } from '../../lib/presence-core';
import {
  MEMBER_REMOVAL_CONFIRM_BODY,
  describeMemberRemovalFailure,
  describeMemberRemovalSuccess,
  memberRemovalConfirmTitle,
} from '../../lib/member-removal-view-core';
import {
  CONNECTED_DEVICES_HEADING,
  CONNECTED_DEVICES_HINT,
  NAME_DISAGREEMENT_HINT,
  collapseMembersIntoPersons,
  personDeviceCountLabel,
  PARTIAL_BLOCK_LABEL,
  personRemovalDeviceLine,
  type PersonRow,
} from '../../lib/person-view-core';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { CopyRow } from '../shell/CopyRow';
import { HonestNotice } from '../shell/HonestNotice';
import { qrCanEncode } from '@mylife/meerkat-theme';
import { CommunityAppearanceSection } from './CommunityAppearanceSection';
import { CommunityOrganizationSection } from './CommunityOrganizationSection';
import { LayoutEditorSection } from './LayoutEditorSection';
import { CanvasRenderDialsSection } from '../canvas/CanvasRenderDialsSection';
import { CommunityBadgesSection } from './CommunityBadgesSection';
import { CommunityAssetPacksSection } from './CommunityAssetPacksSection';
import { CommunitySyncPolicySection } from './CommunitySyncPolicySection';
import { CommunityServerSection } from './CommunityServerSection';
import { OwnerPublicReports } from './OwnerPublicReports';
import { PublicJoinRequests } from './PublicJoinRequests';
import { LeaveCommunityButton } from './LeaveCommunityButton';
import { QrCodeSvg } from '../theme/QrCodeSvg';
import {
  getPublicKeyFingerprint,
  PROFILE_BIO_MAX_CHARS,
  PROFILE_NAME_COLOR_TOKENS,
  PROFILE_PRONOUNS_MAX_CHARS,
  type ProfileNameColorToken,
} from '@mylife/sync';
import { shortHex } from '../format';

export function CommunitySettings({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  // Read m.revision so members/profile/review refresh after a removal/block/sync.
  void m.revision;
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;

  if (!community) {
    return (
      <Modal title="Community settings" onClose={close}>
        <div className="mk-box is-error" role="alert">
          This community is not on this device.
        </div>
      </Modal>
    );
  }

  const d = community.descriptor;
  const { isOwner, canInvite } = communityAdminCaps(community.myRole);
  const muted = m.isCommunityMuted(d.communityId);
  const reviewItems = canInvite ? m.ownerReviewItems(d.communityId) : [];

  return (
    <Modal title={`${d.name} settings`} onClose={close}>
      <div className="mk-community-settings">
        <div className="mk-sidebar-actions">
          <Button variant="ghost" small onClick={() => m.setCommunityMuted(d.communityId, !muted, d.name)}>
            {muted ? 'Unmute community' : 'Mute community'}
          </Button>
          {muted ? <span className="mk-muted" style={{ fontSize: 12 }}>Hidden from Feed</span> : null}
        </div>

        <CommunityProfileEditor communityId={d.communityId} communityName={d.name} canEdit={community.myRole !== null} />

        {isOwner ? <CommunityAppearanceSection communityId={d.communityId} /> : null}

        {isOwner ? <CommunityOrganizationSection communityId={d.communityId} /> : null}

        {isOwner ? <LayoutEditorSection communityId={d.communityId} /> : null}

        <CommunitySyncPolicySection communityId={d.communityId} isOwner={isOwner} />

        <CommunityServerSection communityId={d.communityId} isOwner={isOwner} />

        <CanvasRenderDialsSection communityId={d.communityId} />

        <CommunityBadgesSection communityId={d.communityId} />

        <CommunityAssetPacksSection communityId={d.communityId} isCurator={isOwner || community.myRole === 'admin'} />

        <MembersSection communityId={d.communityId} isOwner={isOwner} />

        {isOwner ? <PublicJoinRequests communityId={d.communityId} /> : null}

        {canInvite ? (
          <section className="mk-owner-review" aria-label="Owner review">
            <h2 className="mk-h2">Owner Review</h2>
            {reviewItems.length === 0 ? (
              <p className="mk-muted">No local reports need review.</p>
            ) : (
              reviewItems.map((item) => (
                <div key={item.id} className="mk-review-row">
                  <div>
                    <div className="mk-member-name">{item.target_label ?? item.target_kind}</div>
                    <div className="mk-muted" style={{ fontSize: 12 }}>
                      {item.reason ?? 'Reported'} · {item.channel_id ? `#${item.channel_id}` : 'community'}
                    </div>
                    {item.status === 'reviewed' ? (
                      <div className="mk-reviewed-pill">Reviewed - still hidden</div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {item.status === 'reviewed' ? null : (
                      <Button
                        variant="ghost"
                        small
                        onClick={() => m.markSafetyReviewed(item.id, 'reviewed')}
                        title="Mark reviewed, keep hidden"
                      >
                        Reviewed
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      small
                      onClick={() => m.markSafetyReviewed(item.id, 'dismissed')}
                      title="Un-hide this content for me"
                    >
                      Un-hide for me
                    </Button>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}

        {canInvite ? <OwnerPublicReports communityId={d.communityId} /> : null}

        {canInvite ? (
          <section className="mk-card" aria-label="Make public">
            <h2 className="mk-h2">Make public</h2>
            <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Publish a channel where anyone with a reachable host can read it.
            </p>
            <Button
              variant="ghost"
              small
              onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'publish', communityId: d.communityId } })}
            >
              Make public
            </Button>
          </section>
        ) : null}

        {canInvite ? <InviteSharePanel communityId={d.communityId} /> : null}

        <div className="mk-btn-row" aria-label="Leave community">
          <LeaveCommunityButton communityId={d.communityId} />
        </div>
      </div>
    </Modal>
  );
}

function MembersSection({ communityId, isOwner }: { communityId: string; isOwner: boolean }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  void m.revision;
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  // GLOBAL single-flight: one removal at a time across the whole member list. A
  // per-member guard would let an owner start B off the pre-A descriptor -- a
  // monotonic upsert silently drops B while a second epoch rotation still runs
  // and returns ok, a success claim for a removal that did not durably persist.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const members = community?.descriptor.members ?? [];
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [blockingKey, setBlockingKey] = useState<string | null>(null);
  // Plan 52 P4: collapse the member devices into persons using VERIFIED
  // announces only. A device with no link stays its own row.
  const personRows = collapseMembersIntoPersons(
    members.map((member) => {
      const label = m.communityDisplayName(communityId, member.deviceId, member.displayName) ?? shortHex(member.deviceId);
      const profile = m.communityProfile(communityId, member.deviceId);
      return {
        deviceId: member.deviceId,
        displayName: label,
        avatarInitial: m.communityAvatarInitial(communityId, member.deviceId, label),
        avatarImage: m.communityAvatarImage(communityId, member.deviceId),
        role: member.role,
        shortDeviceId: shortHex(member.deviceId),
        // A comparable safety code exists only for a device this user has
        // PAIRED with; for everyone else the honest identifier is the
        // fingerprint of the signing key, which is what we show.
        safetyCode: shortHex(getPublicKeyFingerprint(member.deviceId)),
        isSelf: member.deviceId === m.identity.publicKey,
        blocked: m.isCommunityPersonBlocked(communityId, member.deviceId),
        profileUpdatedAt: profile?.updatedAt ?? null,
      };
    }),
    m.personLinks(communityId),
  );

  /**
   * Plan 52 P5: removal is PERSON-scoped. Every attested device of the person
   * is removed in sequence, and the epoch rotation excludes all of them (each
   * call rotates against the descriptor the previous one produced, which is
   * why they run sequentially under the same global single-flight guard).
   * The notice reports the LAST result's real counts; a partial failure says
   * so rather than claiming the person is gone.
   */
  const removePerson = (row: PersonRow): void => {
    if (!community) return;
    if (removingId !== null) return;
    const body = `${MEMBER_REMOVAL_CONFIRM_BODY} ${personRemovalDeviceLine(row)}`;
    if (!window.confirm(`${memberRemovalConfirmTitle(row.displayName)}\n\n${body}`)) return;
    setRemovingId(row.key);
    setNotice(null);
    void (async () => {
      try {
        let last: Awaited<ReturnType<typeof m.removeCommunityMemberById>> | null = null;
        let removed = 0;
        for (const device of row.devices) {
          last = await m.removeCommunityMemberById(community.communityId, device.deviceId);
          if (last.ok) removed += 1;
          else break;
        }
        if (!last) return;
        if (last.ok) {
          setNotice(describeMemberRemovalSuccess(last, row.displayName));
        } else if (removed > 0) {
          setNotice(`Removed ${removed} of ${row.devices.length} devices. ${describeMemberRemovalFailure(last, row.displayName)}`);
        } else {
          setNotice(describeMemberRemovalFailure(last, row.displayName));
        }
      } catch {
        setNotice('Could not remove this member. Please try again.');
      } finally {
        setRemovingId(null);
      }
    })();
  };

  /**
   * Plan 52 P5: blocking a person blocks EVERY attested device. Single-flight
   * and error-reporting, matching the mobile confirm, so a mid-loop failure
   * cannot leave the person half-blocked with no signal.
   */
  const toggleBlockPerson = (row: PersonRow): void => {
    if (!community) return;
    if (blockingKey !== null) return;
    const next = !row.blocked;
    if (next && !window.confirm(
      `Block ${row.displayName}?\n\nThis hides their local posts, messages, and files in this browser. `
      + `It does not remove them from the community or rotate keys. ${personRemovalDeviceLine(row)
        .replace('removes', 'covers')
        .replace('from the community.', 'in this browser.')}`,
    )) return;
    setBlockingKey(row.key);
    setNotice(null);
    let done = 0;
    try {
      for (const device of row.devices) {
        m.setCommunityPersonBlocked(community.communityId, device.deviceId, next, row.displayName);
        done += 1;
      }
    } catch {
      setNotice(
        done === 0
          ? `Could not ${next ? 'block' : 'unblock'} ${row.displayName}.`
          : `Only ${done} of ${row.devices.length} devices were ${next ? 'blocked' : 'unblocked'}. Try again.`,
      );
    } finally {
      setBlockingKey(null);
    }
  };

  const presence = communityPresenceView(m.db, communityId, m.identity.publicKey);
  const appearOnline = isAppearOnlineEnabled(m.db, communityId);
  const toggleAppearOnline = (): void => {
    setAppearOnlineEnabled(m.db, communityId, !appearOnline);
    void m.db.flush().catch(() => undefined);
    m.refresh();
  };

  return (
    <section aria-label="Members">
      <h2 className="mk-h2">Members</h2>
      <p className="mk-muted" style={{ marginTop: 0, fontSize: 13 }}>{presence.label}</p>
      <Button variant="ghost" small onClick={toggleAppearOnline}>
        {appearOnline ? 'Appearing online here (on)' : 'Appear online here (off)'}
      </Button>
      <p className="mk-muted" style={{ fontSize: 12 }}>{APPEAR_ONLINE_COPY.hint}</p>
      {notice ? <div className="mk-box is-info" role="status">{notice}</div> : null}
      {personRows.map((row) => {
        const expanded = expandedKey === row.key;
        return (
          <div key={row.key}>
            <div className="mk-member-row">
              <button
                type="button"
                className="mk-member-identity"
                aria-label={`Open ${row.displayName}'s profile in this community`}
                onClick={() => {
                  dispatch({ type: 'OPEN_MEMBER_PROFILE', communityId, memberDeviceId: row.devices[0]!.deviceId });
                  dispatch({ type: 'CLOSE_OVERLAY' });
                }}
              >
                <Avatar imageBase64={row.avatarImage} initial={row.avatarInitial ?? '?'} size={30} className="mk-member-avatar" />
                <div>
                  <div className="mk-member-name">{row.isSelf ? `${row.displayName} (you)` : row.displayName}</div>
                  <div className="mk-muted" style={{ fontSize: 12 }}>
                    {row.role} · {row.deviceCount > 1
                      ? personDeviceCountLabel(row)
                      : shortHex(row.devices[0]!.deviceId)}
                  </div>
                </div>
              </button>
              <div className="mk-member-actions">
                {/* Plan 52 P4: devices are always ONE expand away, never hidden. */}
                <Button
                  variant="ghost"
                  small
                  aria-expanded={expanded}
                  onClick={() => setExpandedKey(expanded ? null : row.key)}
                >
                  {expanded ? 'Hide devices' : CONNECTED_DEVICES_HEADING}
                </Button>
                {!row.isSelf ? (
                  <>
                    {/* AC-4 + Plan 52 P5: owner-only removal, person-scoped --
                        removing a person removes EVERY attested device. The
                        disabled guard is GLOBAL, never per-member, so no
                        concurrent double rotation. */}
                    {isOwner ? (
                      <Button
                        variant="danger"
                        small
                        disabled={removingId !== null}
                        onClick={() => removePerson(row)}
                      >
                        {removingId === row.key ? 'Removing...' : 'Remove'}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      small
                      disabled={blockingKey !== null}
                      onClick={() => toggleBlockPerson(row)}
                    >
                      {row.blocked ? 'Blocked' : row.partiallyBlocked ? PARTIAL_BLOCK_LABEL : 'Block'}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {expanded ? (
              <div className="mk-member-devices">
                {row.nameDisagreement ? (
                  <p className="mk-muted" style={{ fontSize: 12 }}>{NAME_DISAGREEMENT_HINT}</p>
                ) : null}
                {row.devices.map((device) => (
                  <div key={device.deviceId} className="mk-member-device-row">
                    <div className="mk-member-name" style={{ fontSize: 13 }}>{device.displayName}</div>
                    <div className="mk-muted" style={{ fontSize: 12 }}>
                      {device.role} · {device.shortDeviceId}
                      {device.safetyCode ? ` · safety code ${device.safetyCode}` : ''}
                      {device.blocked ? ' · blocked' : ''}
                    </div>
                  </div>
                ))}
                <p className="mk-muted" style={{ fontSize: 12 }}>{CONNECTED_DEVICES_HINT}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function InviteSharePanel({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  // Mint the link once per open (createInviteLink is non-mutating; the modal is a
  // fresh mount each time). Re-mint if the descriptor revision changes.
  const link = useMemo(
    () => m.createInviteLink(communityId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [communityId, community?.descriptor.revision],
  );
  const canQr = link !== null && qrCanEncode(link);

  return (
    <section className="mk-card" aria-label="Invite people">
      <h2 className="mk-h2">Invite people</h2>
      {link ? (
        <>
          {/* QR SIZE BOUNDARY (honesty): an invite link embeds the full signed
              descriptor including every member, so a large community exceeds the
              in-repo QR encoder ceiling. QrCodeSvg returns null then; we render
              copy + the honest line and NO broken/blank QR (web has no native
              share sheet, so copy is the share path). */}
          {canQr ? (
            <div className="mk-invite-qr">
              <QrCodeSvg value={link} size={196} />
            </div>
          ) : (
            <p className="mk-muted" style={{ fontSize: 13 }}>
              This community is too large for a QR code. Share the invite link instead.
            </p>
          )}
          <CopyRow value={link} label="Copy invite link" />
          {/* Ready-to-text envelope: install + join steps wrapped around the
              link so it works for someone who has never installed Meerkat. */}
          <CopyRow
            value={buildCommunityInviteEnvelope({
              communityName: community?.descriptor.name ?? '',
              link,
              installUrl: INSTALL_URL,
            })}
            label="Copy invite message"
          />
          <HonestNotice>
            Links are signed by an owner or admin and expire in 48 hours. If you have added channels since
            members joined, share this new link so they can rejoin and pick up the new channels. There is no
            automatic descriptor sync.
          </HonestNotice>
        </>
      ) : (
        <div className="mk-box is-error" role="alert">
          Could not create an invite link for this community.
        </div>
      )}
    </section>
  );
}

// Relocated from ChannelSidebar (Plan 31 P5): a member's per-community display
// name + initial + photo editor. Plan 32 T4.2: the photo path is now the web twin
// of the mobile picker (data/avatar-photo.ts) -- a file input feeds a 128x128 JPEG
// canvas downscale to the SAME 32 KB cap, and setCommunityProfile carries the
// signed avatarImage. Rendering precedence is image -> initial -> `?` via the
// shared <Avatar/>.
function describePhotoFailure(reason: Exclude<AvatarPrepResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'too_large':
      return 'That photo is too large even after resizing. Try a different image.';
    case 'unavailable':
      return 'Photo avatars are not supported in this browser. You can still set your name and initial.';
    default:
      return 'Could not prepare that photo. Try a different image.';
  }
}

function CommunityProfileEditor({
  communityId,
  communityName,
  canEdit,
}: {
  communityId: string;
  communityName: string;
  canEdit: boolean;
}): React.ReactElement {
  const m = useMeerkat();
  const currentProfile = m.communityProfile(communityId, m.identity.publicKey);
  const currentName = m.communityDisplayName(communityId, m.identity.publicKey, m.identity.displayName)
    ?? m.identity.displayName;
  const currentInitial = m.communityAvatarInitial(communityId, m.identity.publicKey, currentName) ?? '';
  const currentImage = m.communityAvatarImage(communityId, m.identity.publicKey);
  const [draftName, setDraftName] = useState(currentName);
  const [draftInitial, setDraftInitial] = useState(currentInitial);
  // undefined = untouched (keep current image); null = remove; string = new photo.
  const [draftImage, setDraftImage] = useState<string | null | undefined>(undefined);
  const currentBio = currentProfile?.bio ?? '';
  const currentPronouns = currentProfile?.pronouns ?? '';
  const currentNameColor = (currentProfile?.nameColor ?? null) as ProfileNameColorToken | null;
  const [draftBio, setDraftBio] = useState(currentBio);
  const [draftPronouns, setDraftPronouns] = useState(currentPronouns);
  const [draftNameColor, setDraftNameColor] = useState<ProfileNameColorToken | null>(currentNameColor);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(currentName);
    setDraftInitial(currentInitial);
    setDraftImage(undefined);
    setDraftBio(currentBio);
    setDraftPronouns(currentPronouns);
    setDraftNameColor(currentNameColor);
    setNotice(null);
  }, [communityId, currentBio, currentInitial, currentName, currentNameColor, currentPronouns]);

  const trimmedName = draftName.trim();
  const trimmedInitial = Array.from(draftInitial.trim())[0]?.toUpperCase() ?? '';
  const effectiveImage = draftImage === undefined ? currentImage : draftImage;
  const imageDirty = draftImage !== undefined && (draftImage ?? null) !== (currentImage ?? null);
  const personaDirty = draftBio.trim() !== currentBio
    || draftPronouns.trim() !== currentPronouns
    || draftNameColor !== currentNameColor;
  const dirty = trimmedName !== currentName || trimmedInitial !== currentInitial || imageDirty || personaDirty;

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    // Reset the input so re-picking the SAME file still fires change.
    event.currentTarget.value = '';
    if (!file) return;
    setPhotoBusy(true);
    void (async () => {
      try {
        const result = await prepareAvatarFromFile(file);
        if (result.ok) {
          setDraftImage(result.base64);
          setNotice(null);
        } else {
          setNotice(describePhotoFailure(result.reason));
        }
      } catch {
        // A thrown read must surface, never die as an idle-looking dead tap.
        setNotice('Could not open your photos. Try again.');
      } finally {
        setPhotoBusy(false);
      }
    })();
  };

  const save = (): void => {
    // Plan 52: write the presentation-profile OVERRIDE, not just this device's
    // profile event. The override is the source of truth that every linked
    // device adopts, and alignment re-signs this device to match; naming the
    // local device alone would be silently reverted on the next pass.
    const result = m.setCommunityPresentation(communityId, trimmedName, {
      avatarInitial: trimmedInitial || null,
      avatarImage: draftImage === undefined ? currentImage : draftImage,
      bio: draftBio.trim() || null,
      pronouns: draftPronouns.trim() || null,
      nameColor: draftNameColor,
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setDraftImage(undefined);
    setNotice(`Saved your ${communityName} profile. Your other linked devices use this name here too. Other members see it after their app connects and receives the update.`);
  };

  return (
    <section className="mk-community-profile" aria-label="Community profile">
      <div className="mk-community-profile-head">
        <Avatar imageBase64={effectiveImage} initial={trimmedInitial || currentInitial} size={40} />
        <div className="mk-community-profile-copy">
          <h2 className="mk-h2">Name in this community</h2>
          <p className="mk-muted">
            {currentProfile
              ? 'This community profile is tied to your safety identity.'
              : 'Using your main profile until you choose a community name.'}
          </p>
        </div>
      </div>
      {canEdit ? (
        <div className="mk-community-profile-photo">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="mk-sr-only"
            aria-label="Choose a community photo"
            onChange={onFileChange}
          />
          <Button
            variant="ghost"
            small
            disabled={photoBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoBusy ? 'Preparing…' : effectiveImage ? 'Change photo' : 'Choose photo'}
          </Button>
          {effectiveImage ? (
            <Button variant="ghost" small disabled={photoBusy} onClick={() => setDraftImage(null)}>
              Remove photo
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mk-community-profile-fields">
        <label>
          <span className="mk-sr-only">Name shown in {communityName}</span>
          <input
            className="mk-input"
            value={draftName}
            placeholder="Community name"
            disabled={!canEdit}
            onChange={(event) => setDraftName(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className="mk-sr-only">Initial shown in {communityName}</span>
          <input
            className="mk-input mk-community-profile-initial"
            value={draftInitial}
            placeholder="A"
            disabled={!canEdit}
            maxLength={2}
            onChange={(event) => setDraftInitial(Array.from(event.currentTarget.value).slice(0, 1).join('').toUpperCase())}
          />
        </label>
      </div>
      <label>
        <span className="mk-sr-only">Bio shown in {communityName}</span>
        <textarea
          className="mk-input mk-community-profile-bio"
          value={draftBio}
          placeholder="A short bio for this community (optional)"
          disabled={!canEdit}
          maxLength={PROFILE_BIO_MAX_CHARS}
          rows={3}
          onChange={(event) => setDraftBio(event.currentTarget.value)}
        />
      </label>
      <label>
        <span className="mk-sr-only">Pronouns shown in {communityName}</span>
        <input
          className="mk-input"
          value={draftPronouns}
          placeholder="Pronouns (optional)"
          disabled={!canEdit}
          maxLength={PROFILE_PRONOUNS_MAX_CHARS}
          onChange={(event) => setDraftPronouns(event.currentTarget.value)}
        />
      </label>
      <div className="mk-name-color-row" role="group" aria-label="Name color">
        <span className="mk-community-profile-note">Name color</span>
        <button
          type="button"
          className={`mk-name-color-swatch mk-name-color-default${draftNameColor === null ? ' is-active' : ''}`}
          aria-label="Default name color"
          disabled={!canEdit}
          onClick={() => setDraftNameColor(null)}
        >
          A
        </button>
        {PROFILE_NAME_COLOR_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            className={`mk-name-color-swatch mk-name-swatch-${token}${draftNameColor === token ? ' is-active' : ''}`}
            aria-label={`Name color ${token}`}
            disabled={!canEdit}
            onClick={() => setDraftNameColor(token)}
          />
        ))}
      </div>
      <p className="mk-community-profile-note">
        Members see this name on your posts, replies, messages, files, and member row. It is a pseudonym, not anonymity: owners still have safety details for trust and moderation.
      </p>
      {!canEdit ? (
        <p className="mk-community-profile-note">
          Owner approval is still pending, so this device cannot publish a community profile yet.
        </p>
      ) : null}
      {notice ? <p className="mk-community-profile-notice">{notice}</p> : null}
      <Button variant="ghost" small disabled={!canEdit || !trimmedName || !dirty} onClick={save}>
        Save community profile
      </Button>
    </section>
  );
}
