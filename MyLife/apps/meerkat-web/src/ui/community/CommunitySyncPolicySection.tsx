// Community sync-policy section (Plan 27 P4, item 13). WEB twin of
// apps/meerkat/app/(root)/components/CommunitySyncPolicySection.tsx. The owner
// picks the transport policy (one signed revisePolicy revision); a member sees it
// read-only plus an honest notice when the owner last changed it. Every value
// comes from the real signed descriptor + the observed ledger; nothing here
// claims a change a signed descriptor did not make.

import { useMemo, useState } from 'react';
import { communityTransportPolicy, getCommunity, type CommunityTransportPolicy } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  TRANSPORT_POLICY_LABELS,
  TRANSPORT_POLICY_MEANINGS,
  formatPolicyChangeNotice,
  getLatestPolicyChange,
} from '../../lib/policy-history';
import { HonestNotice } from '../shell/HonestNotice';

const POLICY_ORDER: CommunityTransportPolicy[] = ['any', 'local_preferred', 'local_only'];

export function CommunitySyncPolicySection({
  communityId,
  isOwner,
}: {
  communityId: string;
  isOwner: boolean;
}): React.ReactElement | null {
  const m = useMeerkat();
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stored = useMemo(() => {
    void tick;
    return getCommunity(m.db, communityId);
  }, [m.db, communityId, tick]);
  const current: CommunityTransportPolicy | null = stored ? communityTransportPolicy(stored.descriptor) : null;
  const latestChange = useMemo(() => {
    void tick;
    return getLatestPolicyChange(m.db, communityId);
  }, [m.db, communityId, tick]);

  if (!current) return null;

  const onPick = (policy: CommunityTransportPolicy): void => {
    if (policy === current) return;
    const result = m.setCommunityTransportPolicy(communityId, policy);
    if (!result.ok) { setError(result.error); return; }
    setError(null);
    setTick((t) => t + 1);
  };

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Sync policy</h3>
      <p className="mk-muted" style={{ marginTop: 0 }}>How members of this community are allowed to connect.</p>
      {isOwner ? (
        <div className="mk-publish-chip-row">
          {POLICY_ORDER.map((policy) => (
            <button
              key={policy}
              type="button"
              className={`mk-publish-chip ${policy === current ? 'is-active' : ''}`}
              onClick={() => onPick(policy)}
            >
              {TRANSPORT_POLICY_LABELS[policy]}
            </button>
          ))}
        </div>
      ) : (
        <div className="mk-settings-status">
          <span className="mk-label">{TRANSPORT_POLICY_LABELS[current]}</span>
        </div>
      )}
      <p className="mk-muted">{TRANSPORT_POLICY_MEANINGS[current]}</p>
      {error && <div className="mk-box is-error" role="alert">{error}</div>}
      {latestChange ? (
        <HonestNotice>{formatPolicyChangeNotice(latestChange)}</HonestNotice>
      ) : (
        <HonestNotice>
          Changing this re-signs the community. Members apply the new policy when they next receive
          the updated community, not instantly.
        </HonestNotice>
      )}
    </section>
  );
}
