// RelaySection (slice 5): set the relay URL the web node joins. Reuses the
// shared RelayBar (the same control the Sync dialog uses). Web Meerkat is
// relay-only, so this is the only transport configuration. Plan 20 adds the
// free-default opt-out toggle (AC-4) when a default is configured for the build.

import { RelayBar } from '../sync/RelayBar';
import { ConnectionStatusCard } from '../sync/ConnectionStatusCard';
import { HonestNotice } from '../shell/HonestNotice';
import { Button } from '../shell/Button';
import { useMeerkat } from '../../lib/MeerkatProvider';

export function RelaySection(): React.ReactElement {
  const m = useMeerkat();
  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Connection server</h3>
      <ConnectionStatusCard />
      <RelayBar />
      {m.defaultRelayConfigured && (
        <div className="mk-relay-mode-row">
          <span className="mk-muted">
            Free default server: {m.defaultRelayOptedOut ? 'off' : 'on'}
          </span>
          <Button
            small
            variant="ghost"
            type="button"
            onClick={() => m.setDefaultRelayOptedOut(!m.defaultRelayOptedOut)}
          >
            {m.defaultRelayOptedOut ? 'Turn on' : 'Turn off'}
          </Button>
        </div>
      )}
      <HonestNotice>
        A connection server only sees an invite phrase token and encrypted data: no device ids, no
        message types, no timestamps. It is used for manual sessions only. Pair two devices, set the
        same server on both, then run Listen and Sync now. A connection server is a zero-knowledge
        meeting point; the paid tier ($4.99/mo) adds capacity, backup, public reach, and always-on
        history, not a different meeting point. Turning the free default off (above) makes the app
        stop using it.
      </HonestNotice>
    </section>
  );
}
