import { useEffect, useState, useSyncExternalStore } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { subscribeInvitationIntent, clearInvitationIntent, getInvitationIntent, saveInvitationIntent, INVITATION_SAVED_COPY } from '../../lib/invitation-intent-core';
import { InvitePreviewSheet } from './InvitePreviewSheet';
import { Button } from '../shell/Button';

export function InvitationResume({ ready }: { ready: boolean }) {
  const m = useMeerkat();
  const [link, setLink] = useState(() => getInvitationIntent(m.db));
  const [previewing, setPreviewing] = useState(false);
  const state = useSyncExternalStore(m.db.subscribePersistence, m.db.getPersistenceState);
  useEffect(() => subscribeInvitationIntent(() => setLink(getInvitationIntent(m.db))), [m.db]);
  useEffect(() => {
    const receive = () => {
      // Fragment-only handoff keeps the invitation out of HTTP request URLs.
      let incoming: string;
      try { incoming = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!saveInvitationIntent(m.db, incoming)) return;
      setLink(incoming);
      void m.db.flush().catch(() => undefined);
    };
    receive();
    window.addEventListener('hashchange', receive);
    return () => window.removeEventListener('hashchange', receive);
  }, [m.db]);
  if (!link) return null;
  const dismiss = () => {
    clearInvitationIntent(m.db, link);
    void m.db.flush().catch(() => undefined);
    setLink(null);
    setPreviewing(false);
    // Do not reopen a completed/discarded URL on reload.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  return <>
    {ready && !previewing && <aside className="mk-card" aria-label="Saved invitation">
      <p>{!state.pending ? INVITATION_SAVED_COPY : 'Your invitation is pending in this tab. Keep it open until browser saving succeeds.'}</p>
      <Button onClick={() => setPreviewing(true)}>Return to your invitation</Button>
      <Button variant="ghost" onClick={dismiss}>Discard invitation</Button>
    </aside>}
    {ready && previewing && <InvitePreviewSheet link={link} onClose={() => setPreviewing(false)} onJoined={dismiss} />}
  </>;
}
