// Plan 56 C2 (feature 37, WEB): community badges. Owner mints with a SIGNED
// supply cap; owner/admin awards up to it. Every count derives from verified
// rows (7.6); reserved trust glyphs are rejected at the protocol layer.

import { useCallback, useMemo, useState } from 'react';
import { communityRole } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { awardCommunityBadge, listCommunityBadges, mintCommunityBadge } from '../../lib/badges-core';
import { resolveCommunityDisplayName } from '../../lib/meerkat-data';
import { shortHex } from '../format';

export function CommunityBadgesSection({ communityId }: { communityId: string }): React.ReactElement | null {
  const m = useMeerkat();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [glyph, setGlyph] = useState('');
  const [supply, setSupply] = useState('10');
  const [awarding, setAwarding] = useState<string | null>(null);

  const community = useMemo(
    () => m.listCommunities().find((c) => c.communityId === communityId) ?? null,
    [m, communityId],
  );
  const badges = useMemo(() => { void revision; return listCommunityBadges(m.db, communityId); }, [m.db, communityId, revision]);
  const myRole = community ? communityRole(community.descriptor, m.identity.publicKey) : null;
  const isOwner = myRole === 'owner';
  const isCurator = isOwner || myRole === 'admin';

  const mint = useCallback(() => {
    try {
      mintCommunityBadge(m.db, m.identity, {
        communityId, name, glyph: glyph.trim(), supplyCap: Number.parseInt(supply, 10),
      }, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      setName(''); setGlyph(''); setSupply('10');
      setNotice('Badge minted. Its supply cap is signed and every member can verify it.');
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not mint that badge.');
    }
  }, [m, communityId, name, glyph, supply]);

  const award = useCallback((badgeId: string, recipientDevice: string) => {
    try {
      awardCommunityBadge(m.db, m.identity, { communityId, badgeId, recipientDevice }, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      setAwarding(null);
      setNotice('Badge awarded.');
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not award that badge.');
    }
  }, [m, communityId]);

  if (!community) return null;
  if (!isCurator && badges.length === 0) return null;

  return (
    <section className="mk-settings-section">
      <h3>Badges</h3>
      <p className="mk-muted">
        Owner-minted collectibles with a signed supply cap. Scarcity is verifiable by every member.
      </p>
      {badges.length === 0 ? <p className="mk-muted">No badges minted yet.</p> : null}
      {badges.map((badge) => (
        <div key={badge.badgeId} className="mk-layout-cap-row">
          <span style={{ fontSize: 22 }}>{badge.glyph}</span>
          <div className="mk-layout-cap-copy">
            <div>{badge.name}</div>
            <div className="mk-layout-cap-pending">{badge.awardedTo.length} of {badge.supplyCap} awarded</div>
          </div>
          {isCurator && badge.awardedTo.length < badge.supplyCap ? (
            <Button variant="ghost" small onClick={() => setAwarding(awarding === badge.badgeId ? null : badge.badgeId)}>
              {awarding === badge.badgeId ? 'Pick member' : 'Award'}
            </Button>
          ) : null}
        </div>
      ))}
      {awarding ? (
        <div className="mk-layout-editor-chips">
          {community.descriptor.members
            .filter((member) => !(badges.find((b) => b.badgeId === awarding)?.awardedTo.includes(member.deviceId)))
            .map((member) => (
              <button
                key={member.deviceId}
                type="button"
                className="mk-layout-chip"
                onClick={() => award(awarding, member.deviceId)}
              >
                {resolveCommunityDisplayName(m.db, communityId, member.deviceId) ?? member.displayName ?? shortHex(member.deviceId)}
              </button>
            ))}
        </div>
      ) : null}
      {isOwner ? (
        <div>
          <div className="mk-canvas-panel-title">Mint a badge</div>
          <div className="mk-layout-editor-chips">
            <input className="mk-input" style={{ width: 56, textAlign: 'center' }} placeholder="🦫" value={glyph} maxLength={16} onChange={(e) => setGlyph(e.target.value)} aria-label="Badge glyph" />
            <input className="mk-input" style={{ flex: 1 }} placeholder="Badge name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Badge name" />
            <input className="mk-input" style={{ width: 72, textAlign: 'center' }} placeholder="10" value={supply} maxLength={5} onChange={(e) => setSupply(e.target.value)} aria-label="Supply cap" />
          </div>
          <Button onClick={mint} disabled={!name.trim() || !glyph.trim()}>Mint badge</Button>
        </div>
      ) : null}
      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
    </section>
  );
}
