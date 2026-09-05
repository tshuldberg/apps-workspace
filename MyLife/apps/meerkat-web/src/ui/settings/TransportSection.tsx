// TransportSection (slice 5): the honest transport reality for web. Unlike the
// native app (relay + LAN + on-demand background drain), the browser has only
// the encrypted relay. LAN and background sync are NOT available in a browser
// (no raw sockets, no scheduler), so we say so plainly. Static rows: nothing
// here reflects live connectivity.

import { useView } from '../navigation/useView';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

interface TransportRow {
  name: string;
  detail: string;
  available: boolean;
}

const TRANSPORT_ROWS: TransportRow[] = [
  { name: 'Connection server', detail: 'Live (manual)', available: true },
  { name: 'LAN (Wi-Fi)', detail: 'Not available in the browser', available: false },
  { name: 'Background sync', detail: 'Not available in the browser', available: false },
];

export function TransportSection(): React.ReactElement {
  const { dispatch } = useView();
  const m = useMeerkat();
  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Connection options</h3>
      {TRANSPORT_ROWS.map((row) => (
        <div key={row.name} className="mk-settings-row">
          <span className="mk-settings-row-name">{row.name}</span>
          <span className={`mk-pill ${row.available ? 'is-success' : 'is-idle'}`}>{row.detail}</span>
        </div>
      ))}
      <div className="mk-settings-row">
        <span className="mk-settings-row-name">
          {m.autoConnectEnabled ? 'Automatic connections: on' : 'Automatic connections: off'}
        </span>
        <Button variant="ghost" small onClick={() => m.setAutoConnect(!m.autoConnectEnabled)}>
          {m.autoConnectEnabled ? 'Turn off' : 'Turn on'}
        </Button>
      </div>
      <Button onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'sync' } })}>
        Open Sync
      </Button>
      <HonestNotice>
        Web Meerkat uses a connection server for manual sessions. Pair two devices, set the same
        server, then run Listen and Sync now. There is no local Wi-Fi transfer in the browser.
        Automatic dialing of your paired devices while this tab is open is an opt-in setting
        (Automatic connections, off by default); scheduled background sync that runs while the tab is
        closed is still pending.
      </HonestNotice>
    </section>
  );
}
