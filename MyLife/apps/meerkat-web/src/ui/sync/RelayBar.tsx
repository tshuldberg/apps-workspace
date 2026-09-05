// RelayBar: set the relay URL the web node joins for a manual session. Web
// Meerkat is relay-only (no LAN in the browser), so this is the only transport
// configuration. Self-contained so Settings (slice 5) can reuse it. Honesty:
// the relay only ever sees the phrase-derived rendezvous token and ciphertext.

import { useState } from 'react';
import { parseConnectionCard } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';

const RELAY_DEPLOY_GUIDE_URL =
  'https://github.com/tshuldberg/MyLife/blob/main/docs/guides/deploy-a-meerkat-relay.md';

export function RelayBar(): React.ReactElement {
  const m = useMeerkat();
  const [draft, setDraft] = useState(m.relayUrl);
  const [mode, setMode] = useState<'have' | 'deploy'>('have');
  const trimmed = draft.trim();
  // Accept a Meerkat connection card OR a bare ws(s):// URL (AC-5). The card is
  // only a transport address; the codec rejects non-ws(s) schemes.
  const card = parseConnectionCard(trimmed);
  const relay = card?.relay ?? '';
  const valid = card !== null;
  const insecure = relay.startsWith('ws://');
  const dirty = relay !== m.relayUrl;
  const hostedPaymentRequired = m.hostedAccess.relayRequiresPayment(relay || trimmed);
  const hasHostedAccess = m.hostedAccess.entitlementToken !== null;
  const canSave = valid && dirty && (!hostedPaymentRequired || hasHostedAccess);

  return (
    <div className="mk-relay-bar">
      <div className="mk-muted mk-relay-help">
        Meerkat needs a connection server to sync from the web. It only ever sees encrypted data,
        never your messages, so anyone can run one. A connection server is a zero-knowledge meeting
        point; the paid tier ($4.99/mo) adds capacity, backup, public reach, and always-on history,
        not a different meeting point.
      </div>
      <div className="mk-relay-mode-row">
        <Button
          small
          variant={mode === 'have' ? 'primary' : 'ghost'}
          onClick={() => setMode('have')}
          type="button"
        >
          I have a server URL
        </Button>
        <Button
          small
          variant={mode === 'deploy' ? 'primary' : 'ghost'}
          onClick={() => setMode('deploy')}
          type="button"
        >
          Deploy my own
        </Button>
      </div>
      {mode === 'deploy' && (
        <div className="mk-box mk-relay-guide">
          Deploy a small zero-knowledge connection server on Render or Fly, then paste the wss:// URL here.{' '}
          <a href={RELAY_DEPLOY_GUIDE_URL} target="_blank" rel="noreferrer">
            Open the deploy guide
          </a>
        </div>
      )}
      <TextField
        label="Connection server URL"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={
          mode === 'deploy'
            ? 'Paste the wss:// URL from your new server'
            : 'Paste a Meerkat connection card or wss:// URL'
        }
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Connection server URL"
      />
      <Button onClick={() => m.setRelayUrl(relay)} disabled={!canSave}>
        Save
      </Button>
      {m.relayUrl === '' && (
        <div className="mk-muted mk-relay-empty">
          No connection server set. Web Meerkat needs one for manual sessions. Paste a wss:// URL from your community, or
          deploy your own.
        </div>
      )}
      {insecure && (
        <div className="mk-box">
          ws:// works only for local testing. A hosted browser connection needs wss://.
        </div>
      )}
      {trimmed.length > 0 && !valid && (
        <div className="mk-box is-error" role="alert">
          That doesn't look like a Meerkat connection card or a ws:// / wss:// URL. Ask the host to resend it.
        </div>
      )}
      {hostedPaymentRequired && !hasHostedAccess && (
        <div className="mk-box is-error" role="alert">
          The hosted Meerkat connection server requires an active subscription. Paste your own or a
          community server URL to use web without paid hosted access.
        </div>
      )}
    </div>
  );
}
