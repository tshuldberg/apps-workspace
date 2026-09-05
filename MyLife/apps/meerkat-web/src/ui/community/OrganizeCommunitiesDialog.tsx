// Plan 38 Phase 2 (web, G4): organize the Communities rail. Pin communities to
// the top, reorder them by hand, and sort them into optional folders. ALL of this
// is device-local (mk_community_prefs, never replicated), so the honest line says
// exactly that: "Only on this device". Nothing here signs or revises a descriptor.

import { useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { orderCommunitiesForRail, type RailGroup } from '../../lib/community-organization-core';
import type { CommunityPrefRow } from '../../lib/community-prefs';

export function OrganizeCommunitiesDialog(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });
  void m.revision;

  const communities = m.listCommunities();
  const nameById = new Map(communities.map((c) => [c.communityId, c.descriptor.name] as const));
  const prefsMap = useMemo<Record<string, CommunityPrefRow>>(() => {
    const map: Record<string, CommunityPrefRow> = {};
    for (const p of m.communityPrefs()) map[p.communityId] = p;
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.revision]);

  // Present communities in their current rail order so up/down matches the rail.
  const groups: RailGroup[] = orderCommunitiesForRail(
    communities.map((c) => c.communityId),
    prefsMap,
  );
  const orderedIds = groups.flatMap((g) => g.communityIds);

  const [folderDraft, setFolderDraft] = useState<Record<string, string>>({});

  const pref = (id: string): CommunityPrefRow =>
    prefsMap[id] ?? { communityId: id, pinned: false, sortIndex: null, folder: null };

  const move = (id: string, dir: 'up' | 'down'): void => {
    const i = orderedIds.indexOf(id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= orderedIds.length) return;
    const next = orderedIds.slice();
    [next[i], next[j]] = [next[j], next[i]];
    m.reorderCommunities(next);
  };

  const commitFolder = (id: string): void => {
    const value = folderDraft[id];
    if (value === undefined) return;
    m.setCommunityPref(id, { folder: value.trim() || null });
    setFolderDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  };

  if (communities.length === 0) {
    return (
      <Modal title="Organize communities" onClose={close}>
        <p className="mk-muted">You have not joined any communities yet.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Organize communities" onClose={close}>
      <HonestNotice>Only on this device. Pins, order, and folders are never shared with other members.</HonestNotice>
      <div className="mk-organize-list">
        {orderedIds.map((id, index) => {
          const p = pref(id);
          const folderValue = folderDraft[id] !== undefined ? folderDraft[id] : p.folder ?? '';
          return (
            <div key={id} className="mk-organize-row">
              <div className="mk-organize-row-head">
                <span className="mk-organize-name" title={nameById.get(id)}>
                  {nameById.get(id) ?? id}
                  {p.pinned ? <span className="mk-organize-pin-badge"> Pinned</span> : null}
                </span>
                <div className="mk-org-channel-actions">
                  <Button variant="ghost" small aria-label={`Move ${nameById.get(id)} up`} disabled={index === 0} onClick={() => move(id, 'up')}>↑</Button>
                  <Button variant="ghost" small aria-label={`Move ${nameById.get(id)} down`} disabled={index === orderedIds.length - 1} onClick={() => move(id, 'down')}>↓</Button>
                  <Button variant="ghost" small onClick={() => m.setCommunityPref(id, { pinned: !p.pinned })}>
                    {p.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                </div>
              </div>
              <label className="mk-organize-folder">
                <span className="mk-sr-only">Folder for {nameById.get(id)}</span>
                <input
                  className="mk-input"
                  placeholder="Folder (optional)"
                  value={folderValue}
                  onChange={(e) => setFolderDraft((d) => ({ ...d, [id]: e.currentTarget.value }))}
                  onBlur={() => commitFolder(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitFolder(id);
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
