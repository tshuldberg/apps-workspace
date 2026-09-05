// ShareInboxSection (Plan 20, Phase 10 web): the manual entry point into the OS
// share / file-pick inbox. Opening it replaces the Settings overlay (single
// overlay model). The Web Share Target (share INTO the installed PWA) is
// mentioned only as a capability that needs an installed app + a device share
// sheet -- never presented as wired here.

import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

export function ShareInboxSection(): React.ReactElement {
  const { dispatch } = useView();
  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Bring in from your device</h3>
      <Button onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'share-inbox' } })}>
        Open Share Inbox
      </Button>
      <HonestNotice>
        Files you bring in are staged only on this device. Nothing is sent until you route an item
        into a community channel. Sharing INTO Meerkat from other apps needs the app installed to
        your home screen on a device with a share sheet.
      </HonestNotice>
    </section>
  );
}
