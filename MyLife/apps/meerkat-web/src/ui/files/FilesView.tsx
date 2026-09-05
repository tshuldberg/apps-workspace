// FilesView: the per-community Files index (all channels). Mirrors the native
// files/[communityId] screen.
//
// Honesty boundary (Critical):
//   - The list is AGGREGATED from listChannelFiles (resolved, signed message
//     events), so attachments from deleted/superseded messages never appear.
//   - on-device vs removed comes ONLY from a live has() pass (m.listChannelFiles
//     resolves presence per render via buildPresenceMap).
//   - Save downloads the verified bytes; removed files are not saveable.

import { getPublicKeyFingerprint } from '@mylife/sync';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { shortHex } from '../format';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { EmptyState } from '../shell/EmptyState';
import { FileIndexRow } from './FileIndexRow';
import type { PresentFile } from '../../lib/meerkat-data';
import {
  communityFileReportTarget,
  isChannelMuted,
  isCommunityContentReportHidden,
  isCommunityPersonBlocked,
} from '../../lib/community-safety';

export function FilesView({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const revision = m.revision;
  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const names = useMemo(
    () => {
      void revision;
      return m.communityPeerNames(communityId);
    },
    [m, communityId, revision],
  );

  // files === null => the live presence pass has not resolved (checking state).
  const [files, setFiles] = useState<PresentFile[] | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    setFiles(null);
    void (async () => {
      const resolved = await m.listChannelFiles(communityId);
      if (!cancelled) setFiles(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [m, communityId]);

  // Re-resolve presence on mount and after any write (revision), so a remove or
  // a restore in the channel is reflected here.
  useEffect(() => refresh(), [refresh, revision]);

  if (!community) {
    return (
      <div className="mk-main-scroll">
        <div className="mk-files-header">
          <Button variant="ghost" small onClick={() => dispatch({ type: 'BACK_TO_CHANNEL' })}>
            ← Back
          </Button>
          <h1 className="mk-h1" style={{ margin: 0 }}>Files unavailable</h1>
        </div>
        <HonestNotice>
          This browser does not have verified details for that community. Nothing is loaded from a
          server fallback.
        </HonestNotice>
      </div>
    );
  }

  const checking = files === null;
  const liveFiles = (files ?? []).filter((file) => (
    !isChannelMuted(m.db, communityId, file.channelId)
    && !isCommunityPersonBlocked(m.db, communityId, file.authorDeviceId)
    && !isCommunityContentReportHidden(m.db, communityId, 'file', communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }))
    && !isCommunityContentReportHidden(m.db, communityId, 'message', file.messageId)
  ));
  const anyRemoved = liveFiles.some((file) => !file.present);
  const authorName = (file: PresentFile): string => {
    if (file.authorDeviceId === m.identity.publicKey) {
      const communityName = names.get(file.authorDeviceId);
      return communityName ? `You as ${communityName}` : 'You';
    }
    return names.get(file.authorDeviceId) ?? shortHex(getPublicKeyFingerprint(file.authorDeviceId));
  };

  const reportFile = (file: PresentFile): void => {
    const ok = window.confirm(
      'Report and hide this file? This hides it on this device and adds it to local owner review.',
    );
    if (!ok) return;
    m.reportCommunityContent({
      communityId,
      channelId: file.channelId,
      targetKind: 'file',
      targetId: communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }),
      targetAuthorDeviceId: file.authorDeviceId,
      targetLabel: file.name,
      reason: 'Reported from Files',
    });
  };

  return (
    <div className="mk-main-scroll mk-files-view">
      <div className="mk-files-header">
        <Button variant="ghost" small onClick={() => dispatch({ type: 'BACK_TO_CHANNEL' })}>
          ← Back
        </Button>
        <div className="mk-files-header-text">
          <h1 className="mk-h1" style={{ margin: 0 }}>Files</h1>
          <div className="mk-muted">{community.descriptor.name} · all channels</div>
        </div>
        <Button variant="ghost" small onClick={() => dispatch({ type: 'OPEN_DOWNLOADS' })}>
          All downloads
        </Button>
      </div>

      {checking ? (
        <div className="mk-box is-info">Checking this device. Reading which files are stored locally.</div>
      ) : liveFiles.length === 0 ? (
        <EmptyState icon="📁" title="No files yet">
          Files shared in this community's channels will appear here, with their channel and
          on-device state.
        </EmptyState>
      ) : (
        <ul className="mk-file-list">
          {liveFiles.map((file) => (
            <FileIndexRow key={file.id} file={file} authorName={authorName(file)} communityId={communityId} onReport={() => reportFile(file)} />
          ))}
        </ul>
      )}

      {!checking && anyRemoved ? (
        <HonestNotice>
          Removed files were freed from this device. Use Request on a removed file to ask the member
          who shared it to re-send; the request is sealed and sent only when a connection server is
          set and that member is a paired peer.
        </HonestNotice>
      ) : null}

      <HonestNotice>
        This list is built from verified messages recorded in this browser. On-device vs removed is
        checked live against local storage; nothing is fetched from a server fallback. Paid hosted
        file storage is not connected in this build.
      </HonestNotice>
    </div>
  );
}
