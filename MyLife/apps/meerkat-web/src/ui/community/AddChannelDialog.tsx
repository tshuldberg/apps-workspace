// AddChannelDialog: the owner adds a channel. VERIFIED PROTOCOL FACT: this
// revises the local descriptor only. Community descriptors do NOT sync over the
// engine session, so members pick the new channel up ONLY by rejoining from a
// fresh invite link. On success this dialog says exactly that and offers to open
// the Invite dialog so the owner can share a new link right away.

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';

export function AddChannelDialog({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const name = community?.descriptor.name ?? 'this community';
  const [channelName, setChannelName] = useState('');
  // Plan 56 C1: a new channel is Chat or a Commons canvas (4.1).
  const [channelKind, setChannelKind] = useState<'chat' | 'canvas'>('chat');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const onAdd = (): void => {
    setError(null);
    const result = m.addChannel(communityId, channelName, channelKind);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAdded(true);
    setChannelName('');
  };

  return (
    <Modal title={`Add a channel to ${name}`} onClose={close}>
      {added ? (
        <>
          <HonestNotice>
            Channel added locally. Community descriptors do not sync automatically, so existing
            members will not see this channel until they rejoin from a fresh invite link. Share a
            new link so they can pick it up.
          </HonestNotice>
          <div className="mk-btn-row" style={{ marginTop: 'var(--mk-space-md)' }}>
            <Button
              onClick={() =>
                dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'invite', communityId } })
              }
            >
              Share a fresh invite link
            </Button>
            <Button variant="ghost" onClick={close}>
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          <TextField
            label="Channel name"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="channel-name"
            autoFocus
          />
          <div className="mk-layout-editor-chips">
            {(['chat', 'canvas'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`mk-layout-chip ${channelKind === kind ? 'active' : ''}`}
                onClick={() => setChannelKind(kind)}
              >
                {kind === 'chat' ? 'Chat' : 'Canvas'}
              </button>
            ))}
          </div>
          <p className="mk-muted">
            {channelKind === 'canvas'
              ? 'A freeform canvas members decorate together. Older app versions show it read-only.'
              : 'A standard chat channel.'}
          </p>
          <Button onClick={onAdd} disabled={channelName.trim().length === 0}>
            Add channel
          </Button>
          {error && (
            <div className="mk-box is-error" role="alert">
              {error}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
