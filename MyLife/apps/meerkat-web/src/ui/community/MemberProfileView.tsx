// Plan 56 C2 (features 53-54, WEB): a member's per-community profile. The
// standard card renders ONLY verified data (signed v3 profile persona,
// verified badge awards); below it, the member's designed profile canvas
// (kind 'profile') renders through CanvasHost when one exists. Viewing your
// own profile adds "Design my profile" and copy-forward from your designs in
// other communities (new signed events, re-sealed assets, honest skip counts).

import { useCallback, useMemo, useState } from 'react';
import { communityRole, getCommunity } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Avatar } from '../kit/Avatar';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { CanvasHost } from '../canvas/CanvasHost';
import {
  copyProfileDesignForward,
  ensureMyProfileCanvas,
  getCanvasForSubject,
  listMyProfileDesigns,
} from '../../lib/canvas-core';
import { resealCanvasAssetForCommunity } from '../../lib/canvas-assets';
import { badgesForMember } from '../../lib/badges-core';
import { resolveCommunityPersona } from '../../lib/meerkat-data';
import { shortHex } from '../format';

const NAME_COLOR_CLASSES: Record<string, string> = {
  accent: ' mk-name-accent',
  success: ' mk-name-success',
  warning: ' mk-name-warning',
  danger: ' mk-name-danger',
  info: ' mk-name-info',
};

export function MemberProfileView({
  communityId,
  memberDeviceId,
}: {
  communityId: string;
  memberDeviceId: string;
}): React.ReactElement {
  const m = useMeerkat();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Per-design busy: only the tapped row reads "Copying…" (a single boolean
  // would make every design row claim the in-flight verb).
  const [busyCanvasId, setBusyCanvasId] = useState<string | null>(null);
  const bump = useCallback(() => setRevision((v) => v + 1), []);

  const isSelf = memberDeviceId === m.identity.publicKey;
  const community = useMemo(
    () => { void revision; return getCommunity(m.db, communityId); },
    [m.db, communityId, revision],
  );
  const isMember = community ? communityRole(community.descriptor, memberDeviceId) !== null : false;
  const displayName = m.communityDisplayName(communityId, memberDeviceId) ?? shortHex(memberDeviceId);
  const avatarInitial = m.communityAvatarInitial(communityId, memberDeviceId, displayName) ?? '?';
  const avatarImage = m.communityAvatarImage(communityId, memberDeviceId);
  const persona = useMemo(
    () => { void revision; return resolveCommunityPersona(m.db, communityId, memberDeviceId); },
    [m.db, communityId, memberDeviceId, revision],
  );
  const badges = useMemo(
    () => { void revision; return badgesForMember(m.db, communityId, memberDeviceId); },
    [m.db, communityId, memberDeviceId, revision],
  );
  const profileCanvas = useMemo(
    () => { void revision; return getCanvasForSubject(m.db, communityId, 'profile', memberDeviceId); },
    [m.db, communityId, memberDeviceId, revision],
  );
  const otherDesigns = useMemo(() => {
    void revision;
    if (!isSelf) return [];
    return listMyProfileDesigns(m.db, m.identity)
      .filter((d) => d.canvas.communityId !== communityId && d.nodeCount > 0)
      .map((d) => ({
        ...d,
        communityName: getCommunity(m.db, d.canvas.communityId)?.descriptor.name ?? shortHex(d.canvas.communityId),
      }));
  }, [m.db, m.identity, isSelf, communityId, revision]);

  const designMyProfile = useCallback(() => {
    try {
      ensureMyProfileCanvas(m.db, m.identity, communityId, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      setNotice(null);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create your profile canvas.');
    }
  }, [m, communityId, bump]);

  const copyForward = useCallback((fromCanvasId: string) => {
    if (busyCanvasId !== null) return;
    setBusyCanvasId(fromCanvasId);
    void (async () => {
      try {
        const result = await copyProfileDesignForward(m.db, m.identity, {
          fromCanvasId,
          toCommunityId: communityId,
          resealAsset: (asset, fromCommunityId) => resealCanvasAssetForCommunity({
            db: m.db,
            store: m.nodeStore,
            identity: m.identity,
            asset,
            fromCommunityId,
            toCommunityId: communityId,
            authorDevice: m.identity.publicKey,
          }),
        }, m.recordLocalChange);
        void m.db.flush().catch(() => undefined);
        setNotice(result.skipped > 0
          ? `Copied ${result.copied} pieces. ${result.skipped} could not be copied here (their sealed files belong to the other community) and were skipped.`
          : `Copied ${result.copied} pieces into your profile here.`);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not copy that design.');
      } finally {
        setBusyCanvasId(null);
      }
    })();
  }, [m, communityId, bump, busyCanvasId]);

  if (!community) {
    return (
      <div className="mk-main-scroll">
        <HonestNotice>This community is not in this browser.</HonestNotice>
      </div>
    );
  }

  const nameColorClass = (persona.nameColor && NAME_COLOR_CLASSES[persona.nameColor]) || '';

  return (
    <div className="mk-main-scroll mk-member-profile" aria-label={isSelf ? 'My profile here' : `${displayName}'s profile`}>
      <section className="mk-member-profile-card">
        <div className="mk-member-profile-head">
          <Avatar imageBase64={avatarImage} initial={avatarInitial} size={52} />
          <div className="mk-member-profile-copy">
            <h2 className={`mk-member-profile-name${nameColorClass}`}>{displayName}{isSelf ? ' (you)' : ''}</h2>
            {persona.pronouns ? <p className="mk-muted">{persona.pronouns}</p> : null}
            {!isMember ? <p className="mk-muted">Not currently a member of this community.</p> : null}
          </div>
        </div>
        {persona.bio ? <p className="mk-member-profile-bio">{persona.bio}</p> : null}
        {badges.length > 0 ? (
          <div className="mk-member-profile-badges">
            {badges.map((badge) => (
              <span key={badge.badgeId} className="mk-member-profile-badge">
                <span aria-hidden>{badge.glyph}</span> {badge.name}
              </span>
            ))}
          </div>
        ) : null}
        {isSelf ? (
          <p className="mk-muted">
            Edit your name, photo, bio, pronouns, and name color in this community's settings.
          </p>
        ) : null}
      </section>

      {profileCanvas ? (
        <CanvasHost community={community} canvas={profileCanvas} />
      ) : isSelf ? (
        <section className="mk-member-profile-card">
          <p className="mk-muted">
            You have not designed this profile yet. A designed profile is a freeform canvas other members see here.
          </p>
          <Button onClick={designMyProfile}>Design my profile</Button>
        </section>
      ) : (
        <p className="mk-muted">
          {displayName} has not designed a profile here, or it has not arrived in this browser yet.
        </p>
      )}

      {isSelf && otherDesigns.length > 0 ? (
        <section className="mk-member-profile-card">
          <h3>Use one of my other designs</h3>
          <p className="mk-muted">
            Copies the pieces into this community as your own new work; the original stays untouched. Sealed images are re-sealed for this community when this browser can open them.
          </p>
          {otherDesigns.map((design) => (
            <div key={design.canvas.id} className="mk-member-profile-design-row">
              <div className="mk-member-profile-copy">
                <div className="mk-member-profile-design-name">{design.communityName}</div>
                <div className="mk-muted">{design.nodeCount} pieces</div>
              </div>
              <Button variant="ghost" small disabled={busyCanvasId !== null} onClick={() => copyForward(design.canvas.id)}>
                {busyCanvasId === design.canvas.id ? 'Copying…' : 'Use this design here'}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
    </div>
  );
}
