// InviteDialog: shows a freshly minted, signed, expiring invite link for the
// community. The link is created once when the dialog opens. The honest notice
// makes the descriptor-sync boundary explicit: there is NO automatic descriptor
// sync, so a member who joined before a channel was added must rejoin from a new
// link to pick the new channel up.

import { useMemo } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { CopyRow } from '../shell/CopyRow';
import { HonestNotice } from '../shell/HonestNotice';

export function InviteDialog({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const community = m.listCommunities().find((c) => c.communityId === communityId) ?? null;
  const name = community?.descriptor.name ?? 'this community';
  // Mint the link once per open (createInviteLink is non-mutating; the modal is
  // a fresh mount each time it opens, so this runs once).
  const link = useMemo(() => m.createInviteLink(communityId), [m, communityId]);

  return (
    <Modal title={`Invite to ${name}`} onClose={close}>
      {link ? (
        <>
          <CopyRow value={link} label="Copy invite link" />
          <HonestNotice>
            Links are signed by an owner or admin and expire. If you have added channels since
            members joined, share this new link so they can rejoin and pick up the new channels.
            There is no automatic descriptor sync.
          </HonestNotice>
        </>
      ) : (
        <div className="mk-box is-error" role="alert">
          Could not create an invite link for this community.
        </div>
      )}
    </Modal>
  );
}
