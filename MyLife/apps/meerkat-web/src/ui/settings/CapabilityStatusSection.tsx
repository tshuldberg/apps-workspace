// CapabilityStatusSection (Plan 31 P5 T5.4): the web "What works today" surface,
// wired into the Me/Settings overlay (the web has no separate Me screen; Settings
// is the Me destination). Renders the shared capability-status list (the web twin
// of the mobile source, locked in lockstep by the parity guard) with an honest
// live/partial/pending pill per capability. Honest by construction: the DM and
// default-server statuses derive from the real web flags, so nothing here can
// claim a capability is live while its flag is off.

import { getCapabilityStatus, type CapabilityLevel } from '../../lib/capability-status';

const STATUS_LABEL: Record<CapabilityLevel, string> = {
  live: 'Live',
  partial: 'Partial',
  pending: 'Not built yet',
};

const STATUS_PILL: Record<CapabilityLevel, string> = {
  live: 'is-success',
  partial: 'is-warning',
  pending: 'is-idle',
};

export function CapabilityStatusSection(): React.ReactElement {
  const entries = getCapabilityStatus();
  return (
    <section className="mk-settings-section mk-capability-status" aria-label="What works today">
      <h2 className="mk-h2">What works today</h2>
      <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
        An honest map of what Meerkat can and cannot do right now.
      </p>
      {entries.map((entry) => (
        <div key={entry.id} className="mk-capability-row">
          <div className="mk-capability-main">
            <div className="mk-member-name">{entry.title}</div>
            <div className="mk-muted" style={{ fontSize: 12.5 }}>{entry.line}</div>
          </div>
          <span className={`mk-pill ${STATUS_PILL[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
        </div>
      ))}
    </section>
  );
}
