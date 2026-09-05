// Plan 38 Phase 1c (web): the member render path for a community's VERIFIED
// identity, shown at the top of the community channel sidebar. It renders ONLY
// what getCommunityIdentity returns (owner-signed + verified): the icon (fallback
// initial), the description, and -- when its sealed object opens LOCALLY -- the
// banner. A banner that is not (yet) local renders nothing extra (no spinner lie).
// The device-local theme source line + toggle rides alongside.

import { useEffect, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Avatar } from '../kit/Avatar';
import { CommunityThemeToggle } from './CommunityThemeToggle';

export function CommunityIdentityHeader({ communityId }: { communityId: string }): React.ReactElement | null {
  const m = useMeerkat();
  void m.revision;
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const identity = m.communityIdentity(communityId);
  const [banner, setBanner] = useState<string | null>(null);

  const bannerCid = identity?.banner?.cid ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!bannerCid) {
      setBanner(null);
      return;
    }
    void m.communityBannerImage(communityId).then((uri) => {
      if (!cancelled) setBanner(uri);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, bannerCid, m.revision]);

  if (!community) return null;
  const name = community.descriptor.name;
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="mk-community-identity">
      {banner ? (
        <div
          className="mk-community-banner"
          role="img"
          aria-label={`${name} banner`}
          style={{ backgroundImage: `url(${banner})` }}
        />
      ) : null}
      <div className="mk-community-identity-row">
        <Avatar imageBase64={identity?.iconImage ?? null} initial={initial} size={32} />
        <div className="mk-community-identity-copy">
          <div className="mk-community-identity-name" title={name}>{name}</div>
          {identity?.description ? (
            <div className="mk-muted mk-community-identity-desc">{identity.description}</div>
          ) : null}
        </div>
      </div>
      <CommunityThemeToggle communityId={communityId} />
    </div>
  );
}
