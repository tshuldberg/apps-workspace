import { friendPublicationStatus } from '../../lib/friend-publication-core';
// AddFriendOverlay (Plan 31 P5 T5.1/T5.3, web twin of the mobile add-friend
// screen). The People flow's "+" opens this. It shows ZERO transport
// configuration: your friend code (big, copyable, QR-rendered) + a code input.
// Resolution goes through the provider's publishFriendCode / pairWithFriendCode,
// which dial the health-gated effectiveRelayUrl choke point internally (TC-2:
// this surface never reads the raw relay setting key and shows no server-URL
// input). When no relay resolves, the surface renders the real
// ConnectionStatusCard probe state under ONE honest static line -- no roadmap
// promise (NC-3). Full manual connection control stays in Settings, reachable
// from the Me/nav.
//
// QR SCAN: web has no maintained dependency-free getUserMedia QR path in-repo, so
// this is paste-only (the "What works today" page says so). Your OWN code still
// renders as a QR for a friend's phone to scan.

import { useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import {
  ADD_FRIEND_IN_PERSON_WEB_LINE,
  ADD_FRIEND_NEEDS_SERVER_LINE,
  isPlausibleFriendCode,
  resolveAddFriendRelay,
} from '../../lib/add-friend-core';
import { buildContactEnvelope } from '../../lib/invite-envelope-core';
import { INSTALL_URL } from '../../lib/install-url';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { CopyRow } from '../shell/CopyRow';
import { TextField } from '../shell/Field';
import { QrCodeSvg } from '../theme/QrCodeSvg';
import { ConnectionStatusCard } from '../sync/ConnectionStatusCard';

export function AddFriendOverlay(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState<'publish' | 'add' | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [publishedCode, setPublishedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!publishedCode || expiresAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [publishedCode, expiresAt]);
  const publication = friendPublicationStatus(expiresAt, now);


  // Resolve a dialable relay ONLY through the health-gated choke point (TC-2).
  // canResolve flips the surface from the ConnectionStatusCard fallback to the
  // add/publish form once the card's real /healthz probe caches a reachable
  // server. Read on every render (a cheap synchronous db read).
  const { canResolve } = useMemo(
    () => resolveAddFriendRelay(m.db),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.db, m.revision, note],
  );

  const displayCode = publishedCode ?? m.friendCode;

  const publish = (): void => {
    setBusy('publish');
    setNote(null);
    m.publishFriendCode((receipt) => { setExpiresAt(receipt.expiresAt); setNow(Date.now()); })
      .then((code) => {
        setPublishedCode(code);
        setNote({ kind: 'ok', text: 'Friend code published for a short time on this connection server.' });
      })
      .catch((error: unknown) => {
        setNote({ kind: 'error', text: error instanceof Error ? error.message : 'Could not publish your friend code.' });
      })
      .finally(() => setBusy(null));
  };

  const addFriend = (): void => {
    const code = codeInput.trim();
    if (code.length === 0) return;
    if (!isPlausibleFriendCode(code)) {
      setNote({ kind: 'error', text: 'That is not a valid friend code. Check for typos.' });
      return;
    }
    setBusy('add');
    setNote(null);
    m.pairWithFriendCode(code)
      .then((result) => {
        if (!result.ok) {
          setNote({ kind: 'error', text: result.error });
          return;
        }
        setCodeInput('');
        setNote({
          kind: 'ok',
          text: `Friend added: ${result.device.displayName}. Compare the safety code before sharing sensitive spaces.`,
        });
      })
      .catch((error: unknown) => {
        setNote({ kind: 'error', text: error instanceof Error ? error.message : 'Could not resolve that friend code.' });
      })
      .finally(() => setBusy(null));
  };

  return (
    <Modal title="Add friend" onClose={close}>
      <div className="mk-add-friend">
        <section className="mk-card" aria-label="Your friend code">
          <h2 className="mk-h2">Your friend code</h2>
          <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>Publish before sharing. Each publication can be used once; the connection server controls its expiry.</p>
          {publishedCode && !publication.expired ? <>
          <div className="mk-invite-qr">
            <QrCodeSvg value={displayCode} size={180} />
          </div>
          <CopyRow value={displayCode} label="Copy code" />
          {/* Ready-to-text contact card: install + add-friend steps wrapped
              around the code so it works for someone new to Meerkat. */}
          <CopyRow
            value={buildContactEnvelope({
              displayName: m.displayName,
              friendCode: displayCode,
              installUrl: INSTALL_URL,
            })}
            label="Copy contact message"
          />
          <p className="mk-muted">{publication.text}</p>
          </> : <p className="mk-muted">{publishedCode ? publication.text : 'Not published in this session. Publish my code below to create a shareable QR.'}</p>}
        </section>

        {/* Plan 53: no browser can run the nearby-radio ceremony; say so plainly
            (AC-6) and keep QR + friend codes as this surface's real paths. */}
        <section className="mk-card" aria-label="Add in person">
          <h2 className="mk-h2">Add in person</h2>
          <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>{ADD_FRIEND_IN_PERSON_WEB_LINE}</p>
        </section>

        {canResolve ? (
          <>
            <section className="mk-card" aria-label="Let friends find you">
              <h2 className="mk-h2">Let friends find you</h2>
              <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
                Publishing puts an encrypted record on the connection server for a short time so a friend can
                resolve it. The server cannot read the record; the secret half that decrypts it travels only
                inside the code you share.
              </p>
              <Button variant="ghost" onClick={publish} disabled={busy !== null}>
                {busy === 'publish' ? 'Publishing...' : 'Publish my code'}
              </Button>
            </section>

            <section className="mk-card" aria-label="Add a friend">
              <h2 className="mk-h2">Add a friend</h2>
              <TextField
                label="Friend code"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                placeholder="MEER-XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button onClick={addFriend} disabled={busy !== null || codeInput.trim().length === 0}>
                {busy === 'add' ? 'Resolving...' : 'Add friend'}
              </Button>
            </section>
          </>
        ) : (
          <section className="mk-card" aria-label="Connection needed">
            <p className="mk-muted" style={{ fontWeight: 700 }}>{ADD_FRIEND_NEEDS_SERVER_LINE}</p>
            <ConnectionStatusCard />
          </section>
        )}

        {note ? (
          <div className={`mk-box ${note.kind === 'ok' ? 'is-success' : 'is-error'}`} role="status">
            {note.text}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
