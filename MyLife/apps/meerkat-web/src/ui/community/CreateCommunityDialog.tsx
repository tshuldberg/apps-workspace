// CreateCommunityDialog: a single modal with two sections. Create (you become the
// owner of a signed descriptor) and Join. Plan 31 P5: Join no longer auto-joins
// from the pasted link (NC-1). "Preview invite" opens the ONE InvitePreviewSheet;
// the sheet's Join button is the only join trigger. A malformed/expired link
// shows the existing reason text in the sheet, never a silent join. On create
// success it selects the community and closes.

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { TextField, TextArea } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';
import { InvitePreviewSheet } from './InvitePreviewSheet';
import { CommunityTemplatePicker } from './CommunityTemplatePicker';

export function CreateCommunityDialog(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The link being previewed (null = no preview open). Preview never mutates
  // state; only the sheet's Join button joins (TC-1 / NC-1).
  const [previewLink, setPreviewLink] = useState<string | null>(null);

  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const onCreate = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // A THROW here (e.g. the signing key is unavailable in secure storage) must
    // surface honestly instead of dying as an unhandled error with no feedback
    // (the template path already catches the same way).
    let signed: ReturnType<typeof m.createCommunity>;
    try {
      signed = m.createCommunity(trimmed);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not create the community.');
      return;
    }
    dispatch({
      type: 'SELECT_COMMUNITY',
      communityId: signed.descriptor.communityId,
      channelId: signed.descriptor.channels[0]?.id ?? null,
    });
    close();
  };

  const onPreview = (): void => {
    const trimmed = link.trim();
    if (!trimmed) return;
    setPreviewLink(trimmed);
  };

  if (previewLink !== null) {
    // The preview sheet joins (its Join button) and then selects + closes the
    // whole flow, or the user cancels back to the paste form.
    return (
      <InvitePreviewSheet
        link={previewLink}
        onClose={() => setPreviewLink(null)}
        onJoined={() => close()}
      />
    );
  }

  return (
    <Modal title="Add a community" onClose={close}>
      <CommunityTemplatePicker onClose={close} />

      <div className="mk-h2" style={{ marginTop: 'var(--mk-space-lg)' }}>Start from scratch</div>
      <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
        You become the owner and can invite people.
      </p>
      <TextField
        label="Community name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Community name"
      />
      {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}
      <Button onClick={onCreate} disabled={name.trim().length === 0}>
        Create community
      </Button>

      <div className="mk-h2" style={{ marginTop: 'var(--mk-space-lg)' }}>
        Join with an invite link
      </div>
      <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Paste a link from a community owner or admin. You preview before joining.
      </p>
      <TextArea
        label="Invite link"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="meerkat://community/join#..."
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <Button variant="ghost" onClick={onPreview} disabled={link.trim().length === 0}>
        Preview invite
      </Button>
      <HonestNotice>
        Communities are invite-only and portable. Nothing leaves this browser until you choose to
        connect with another device or server.
      </HonestNotice>
    </Modal>
  );
}
