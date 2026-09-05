// Automatic connections card (Plan 29 Phase 2-3, item 12). WEB twin of
// apps/meerkat/app/(root)/components/AutoConnectCard.tsx. Opt-in automatic
// dialing over real recorded sessions. Every line is honest: the toggle reflects
// the stored flag, the last-round line reports real engine counts, and "Sync
// now" runs one real composed round. Nothing claims a peer is online or that
// data moved unless a real session did it. Web is relay-only (no LAN peer-found
// trigger); the round still drains + dials over a reachable connection server.

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { describeAutoConnectRound, describeAutoConnectRecovery } from '../../lib/auto-connect-core';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

export function AutoConnectCard(): React.ReactElement {
  const m = useMeerkat();
  const recovery = describeAutoConnectRecovery(m.lastAutoConnectRound);
  const [running, setRunning] = useState(false);


  const onRunNow = (): void => {
    setRunning(true);
    void m.autoConnectRound('manual').catch(() => undefined).finally(() => setRunning(false));
  };

  return (
    <section className="mk-sync-section">
      <h3 className="mk-sync-section-title">Automatic connections</h3>
      <div className="mk-sync-engine-row">
        <span className="mk-label">
          {m.autoConnectEnabled ? 'Automatic dialing is on' : 'Automatic dialing is off'}
        </span>
        <Button variant="ghost" small onClick={() => m.setAutoConnect(!m.autoConnectEnabled)}>
          {m.autoConnectEnabled ? 'Turn off' : 'Turn on'}
        </Button>
      </div>
      {recovery ? <HonestNotice>{recovery}</HonestNotice> : null}
      {m.lastAutoConnectError ? <HonestNotice>{m.lastAutoConnectError}</HonestNotice> : null}
      <div className="mk-muted">{describeAutoConnectRound(m.lastAutoConnectRound)}</div>
      <Button onClick={onRunNow} disabled={running}>
        {running ? 'Catching up...' : 'Catch up now'}
      </Button>
      <HonestNotice>
        When on, Meerkat runs one round each time this tab becomes active: it drains anything queued
        for you, then dials your paired devices over a reachable connection server. Each dial is a
        real sync session; a device that does not answer is retried later with a growing delay. This
        runs only while this tab is open. It is not background sync and never turns background sync
        on. Numbers above come from real sessions, never a simulated dial or an online count.
      </HonestNotice>
    </section>
  );
}
