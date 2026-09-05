// Plan 56 C1 (4.4, WEB): the Pages directory, a host surface every community
// always has, plus the member-page pane. Create (propose) is open to members;
// owners/curators promote a page to a 'page'-kind tab via one descriptor
// revision (12-tab cap) and demote it back; the page survives demotion here.

import { useCallback, useMemo, useState } from 'react';
import { communityRole } from '@mylife/sync';
import { CANVAS_PROMOTED_TABS_CAP } from '@mylife/meerkat-canvas';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { createPageCanvas, getCanvasById, listCommunityPages, type CanvasPageListing } from '../../lib/canvas-core';
import { resolveCommunityDisplayName } from '../../lib/meerkat-data';
import { shortHex } from '../format';
import { CanvasHost } from './CanvasHost';

export function PagesView({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<CanvasPageListing | null>(null);
  const [tabName, setTabName] = useState('');

  const community = useMemo(
    () => m.listCommunities().find((c) => c.communityId === communityId) ?? null,
    [m, communityId],
  );
  const pages = useMemo(() => { void revision; return listCommunityPages(m.db, communityId); }, [m.db, communityId, revision]);
  const myRole = community ? communityRole(community.descriptor, m.identity.publicKey) : null;
  const mayPromote = myRole === 'owner' || myRole === 'admin';

  const promotedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const channel of community?.descriptor.channels ?? []) {
      if (channel.kind === 'page') ids.add(channel.id);
    }
    return ids;
  }, [community]);

  const createPage = useCallback(() => {
    try {
      const canvas = createPageCanvas(m.db, m.identity, communityId, m.recordLocalChange);
      void m.db.flush().catch(() => undefined);
      dispatch({ type: 'OPEN_COMMUNITY_PAGE', communityId, canvasId: canvas.id });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create a page.');
    }
  }, [m, communityId, dispatch]);

  const promote = useCallback(() => {
    if (!community || !promoteTarget) return;
    const name = tabName.trim();
    if (!name) return;
    if (promotedIds.size >= CANVAS_PROMOTED_TABS_CAP) {
      setNotice(`This community already has ${CANVAS_PROMOTED_TABS_CAP} promoted tabs. Demote one first.`);
      return;
    }
    try {
      m.promotePageChannel(communityId, promoteTarget.canvas.id, name);
      setNotice(`Promoted to the "${name}" tab. Members receive the new tab on their next sync with you.`);
      setPromoteTarget(null);
      setTabName('');
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not promote that page.');
    }
  }, [community, promoteTarget, tabName, promotedIds, m, communityId]);

  const demote = useCallback((listing: CanvasPageListing) => {
    try {
      m.demotePageChannel(communityId, listing.canvas.id);
      setNotice('Tab removed. The page stays here in the directory.');
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not demote that page.');
    }
  }, [m, communityId]);

  if (!community) {
    return <div className="mk-home-scroll"><HonestNotice>This community is not on this device.</HonestNotice></div>;
  }

  return (
    <div className="mk-home-scroll">
      <div className="mk-layout-editor-chips">
        <h2 style={{ flex: 1, margin: 0 }}>Pages</h2>
        <Button onClick={createPage}>New page</Button>
      </div>
      <p className="mk-muted">
        Anything a member builds lists here instantly. Owners can promote a page to a community tab.
      </p>

      {pages.length === 0 ? <p className="mk-muted">No pages yet. Build the first one.</p> : null}

      {pages.map((listing) => {
        const authorName = resolveCommunityDisplayName(m.db, communityId, listing.authorDevice)
          ?? shortHex(listing.authorDevice);
        const promoted = promotedIds.has(listing.canvas.id);
        return (
          <div key={listing.canvas.id} className="mk-block-card mk-block-row">
            <button
              type="button"
              className="mk-canvas-page-open"
              onClick={() => dispatch({ type: 'OPEN_COMMUNITY_PAGE', communityId, canvasId: listing.canvas.id })}
            >
              <span className="mk-block-line">{listing.titleHint ?? 'Untitled page'}</span>
              <span className="mk-block-meta">
                By {authorName} · {listing.nodeCount} piece{listing.nodeCount === 1 ? '' : 's'}{promoted ? ' · promoted tab' : ''}
              </span>
            </button>
            {mayPromote ? (
              promoted ? (
                <Button variant="ghost" small onClick={() => demote(listing)}>Demote</Button>
              ) : (
                <Button variant="ghost" small onClick={() => { setPromoteTarget(listing); setTabName(''); }}>Promote</Button>
              )
            ) : null}
          </div>
        );
      })}

      {promoteTarget ? (
        <div className="mk-block-card">
          <div className="mk-canvas-panel-title">Promote to a tab</div>
          <p className="mk-muted">One signed community revision. Old app versions show it as a read-only channel.</p>
          <input
            className="mk-input"
            placeholder="Tab name"
            value={tabName}
            maxLength={40}
            onChange={(e) => setTabName(e.target.value)}
          />
          <div className="mk-layout-editor-chips" style={{ marginTop: 8 }}>
            <Button onClick={promote} disabled={!tabName.trim()}>Promote</Button>
            <Button variant="ghost" onClick={() => setPromoteTarget(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
    </div>
  );
}

export function CommunityPageView({ communityId, canvasId }: { communityId: string; canvasId: string }): React.ReactElement {
  const m = useMeerkat();
  const [revision] = useState(0);
  const community = useMemo(
    () => m.listCommunities().find((c) => c.communityId === communityId) ?? null,
    [m, communityId],
  );
  const canvas = useMemo(() => { void revision; return getCanvasById(m.db, canvasId); }, [m.db, canvasId, revision]);
  const authorName = useMemo(() => {
    if (!canvas) return null;
    return resolveCommunityDisplayName(m.db, communityId, canvas.signedBy) ?? shortHex(canvas.signedBy);
  }, [m.db, communityId, canvas]);

  if (!community) {
    return <div className="mk-home-scroll"><HonestNotice>This community is not on this device.</HonestNotice></div>;
  }
  if (!canvas || canvas.kind !== 'page') {
    return (
      <div className="mk-home-scroll">
        <HonestNotice>
          This page is not on this device yet. It arrives when a sync connects with a member who has it.
        </HonestNotice>
      </div>
    );
  }
  return (
    <div className="mk-home-scroll">
      <p className="mk-muted" style={{ marginTop: 0 }}>Page by {authorName}</p>
      <CanvasHost community={community} canvas={canvas} />
    </div>
  );
}
