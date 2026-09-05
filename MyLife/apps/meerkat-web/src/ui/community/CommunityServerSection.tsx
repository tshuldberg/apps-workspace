// Community server section (Plan 57 W2). WEB twin of
// apps/meerkat/app/(root)/components/CommunityServerSection.tsx. The Realms
// pattern: ONLY the owner ever sees this infrastructure decision; members see
// one honest availability line. Every state here is real: "reachable" comes
// from a live /healthz answer, attaching commits only after the server
// accepted the owner's publish, and removal is the signed community exit that
// a dead server can never block. No online counts, no fake connectivity, ever.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  clearCommunityHost,
  getCommunityHostUrl,
  probeCommunityHosting,
  setCommunityHost,
} from '../../lib/meerkat-data';
import { HonestNotice } from '../shell/HonestNotice';
import { Button } from '../shell/Button';

type ProbeState = 'checking' | 'hosted' | 'server_only' | 'unreachable';

export const COMMUNITY_SERVER_STATE_COPY = {
  deviceOnly: 'Available from members who have it, when a sync connects.',
  hosted: 'Always available via this community’s server.',
  server_only: 'The server answers, but does not confirm hosting this community. Content syncs from members when connected.',
  unreachable: 'This community’s server is not reachable right now. Content syncs from members when connected.',
  checking: 'Checking this community’s server…',
} as const;

export function CommunityServerSection({
  communityId,
  isOwner,
}: {
  communityId: string;
  isOwner: boolean;
}): React.ReactElement {
  const m = useMeerkat();
  const [tick, setTick] = useState(0);
  const [draftUrl, setDraftUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeState>('checking');

  const hostUrl = useMemo(() => {
    void tick;
    return getCommunityHostUrl(m.db, communityId);
  }, [m.db, communityId, tick]);

  const entitlementToken = m.hostedAccess.entitlementToken ?? undefined;

  // Real hosting probe, refreshed whenever the attached host changes. Three
  // honest states: the node CONFIRMS hosting this community, a process answers
  // without confirming it, or nothing answers. Never a fake "available".
  useEffect(() => {
    let cancelled = false;
    if (!hostUrl) return undefined;
    setProbe('checking');
    void probeCommunityHosting(hostUrl, communityId, { entitlementToken })
      .then((verdict) => {
        if (!cancelled) setProbe(verdict);
      })
      .catch(() => {
        if (!cancelled) setProbe('unreachable');
      });
    return () => { cancelled = true; };
  }, [communityId, entitlementToken, hostUrl, tick]);

  const onAttach = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await setCommunityHost(m.db, m.identity, communityId, draftUrl, { entitlementToken });
      if (!result.ok) {
        setNotice(result.detail ? `${result.error} (${result.detail})` : result.error);
        return;
      }
      setDraftUrl('');
      setNotice(null);
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }, [busy, communityId, draftUrl, entitlementToken, m.db, m.identity]);

  const onRemove = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await clearCommunityHost(m.db, m.identity, communityId, { entitlementToken });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice(result.exitRepublished
        ? 'Server removed. The old server recorded the exit; it keeps only sealed data it cannot read.'
        : 'Server removed. The old server could not be reached; it keeps only sealed data it cannot read.');
      setTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }, [busy, communityId, entitlementToken, m.db, m.identity]);

  const availabilityLine = hostUrl
    ? COMMUNITY_SERVER_STATE_COPY[probe]
    : COMMUNITY_SERVER_STATE_COPY.deviceOnly;

  if (!isOwner) {
    return (
      <section className="mk-settings-section">
        <h3 className="mk-settings-section-title">Community server</h3>
        <p className="mk-muted" style={{ marginTop: 0 }}>Where this community lives when everyone is offline.</p>
        {hostUrl ? <code className="mk-mono">{hostUrl}</code> : null}
        <HonestNotice>{availabilityLine}</HonestNotice>
      </section>
    );
  }

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Community server</h3>
      <p className="mk-muted" style={{ marginTop: 0 }}>
        Keep this community available while everyone's devices are asleep.
      </p>
      {hostUrl ? (
        <>
          <code className="mk-mono">{hostUrl}</code>
          <HonestNotice>{availabilityLine}</HonestNotice>
          <Button variant="ghost" onClick={() => { void onRemove(); }} disabled={busy}>
            {busy ? 'Removing…' : 'Remove server'}
          </Button>
        </>
      ) : (
        <>
          <HonestNotice>
            A community server stores only sealed data it cannot read, and serves history to members
            while your devices are asleep. Attach one you run, or one you rent.
          </HonestNotice>
          <input
            className="mk-input"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://your-community-server.example"
            aria-label="Community server address"
            autoComplete="off"
            spellCheck={false}
          />
          <Button onClick={() => { void onAttach(); }} disabled={busy || draftUrl.trim().length === 0}>
            {busy ? 'Verifying…' : 'Verify and attach'}
          </Button>
        </>
      )}
      {notice ? <div className="mk-box is-error" role="alert">{notice}</div> : null}
    </section>
  );
}
