import { saveInvitationIntent, clearInvitationIntent } from '../../lib/invitation-intent-core';
// InvitePreviewSheet (Plan 31 P5 T5.3, web twin of the mobile InvitePreviewSheet):
// the ONE preview every web join door renders before any join runs. Shows the
// community name, member + channel counts, an expiry countdown, and the inviter-
// role line, with a single primary Join button. A malformed / failed-verification
// link renders ONLY the existing reason text and no Join button (NC-1: nothing
// joins without an explicit tap). On success it selects the community.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import {
  executeJoin,
  formatInviteExpiry,
  inviterRoleLine,
  joinReasonText,
  previewInvite,
  type ExecuteJoinResult,
} from '../../lib/join-flow';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';

/** Verbatim on both platforms (parity-locked copy). */
export const JOIN_NAME_LABEL = 'Your name in this community';
export const JOIN_NAME_HINT =
  'Only this community sees this name. Your other devices use it here too. You can change it later in community settings.';

export function InvitePreviewSheet({
  link,
  onClose,
  onJoined,
}: {
  /** The raw invite link to preview. */
  link: string;
  onClose: () => void;
  /** Called with the successful join result so a host can surface the notice. */
  onJoined?: (result: Extract<ExecuteJoinResult, { ok: true }>) => void;
}): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    saveInvitationIntent(m.db, link);
    void m.db.flush().catch(() => undefined);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [link, m.db]);
  const verifiedPreview = useMemo(() => previewInvite(link), [link]);
  const preview = verifiedPreview.ok && Date.parse(verifiedPreview.expiresAt) <= now
    ? { ok: false as const, reason: 'expired' as const, message: joinReasonText('expired') }
    : verifiedPreview;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Plan 52 P3: the name to present in THIS community, prefilled with the
  // person's global name. It applies across every linked device.
  const [joinName, setJoinName] = useState(() => m.displayName ?? '');

  const onJoin = useCallback(() => {
    setBusy(true);
    setError(null);
    void executeJoin({
      link,
      joinFromLink: m.joinFromLink,
      queueJoinRequest: m.queueJoinRequest,
      runPostJoinDrain: m.runJoinHandoffDrain,
      joinDisplayName: joinName,
      applyJoinDisplayName: m.applyJoinDisplayName,
    })
      .then(async (result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        clearInvitationIntent(m.db, link);
        await m.db.flush();
        onJoined?.(result);
        onClose();
        dispatch({
          type: 'SELECT_COMMUNITY',
          communityId: result.communityId,
          channelId: result.firstChannelId,
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not join.'))
      .finally(() => setBusy(false));
  }, [m, link, joinName, onJoined, onClose, dispatch]);

  return (
    <Modal title={preview.ok ? 'Join community' : 'Invite unavailable'} onClose={onClose}>
      {preview.ok ? (
        <div className="mk-invite-preview">
          <div className="mk-h1" style={{ margin: 0 }}>{preview.name}</div>
          <p className="mk-muted" style={{ marginTop: 4, fontWeight: 600 }}>
            {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} · {preview.channelCount} channel{preview.channelCount === 1 ? '' : 's'}
          </p>
          <p className="mk-muted" style={{ margin: 0 }}>{inviterRoleLine(preview.inviterRole)}</p>
          <p className="mk-muted" style={{ margin: 0 }}>{formatInviteExpiry(preview.expiresAt, new Date(now))}</p>
          <TextField
            label={JOIN_NAME_LABEL}
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name in this community"
            maxLength={48}
          />
          <HonestNotice>{JOIN_NAME_HINT}</HonestNotice>
          {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}
          <div className="mk-btn-row" style={{ marginTop: 12 }}>
            <Button onClick={onJoin} disabled={busy}>
              {busy ? 'Joining...' : 'Join community'}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mk-box is-error" role="alert">{preview.message}</div>
          <div className="mk-btn-row" style={{ marginTop: 12 }}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
