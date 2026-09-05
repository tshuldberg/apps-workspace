import { buildHostedBoundaryItems, type HostedBoundaryItem } from '../../lib/hosted-boundaries';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { formatBytes } from '../format';
import { HonestNotice } from '../shell/HonestNotice';

export function HostedServicesSection(): React.ReactElement {
  const m = useMeerkat();
  const stats = m.storageStats();
  const items = buildHostedBoundaryItems({
    relayUrl: m.relayUrl,
    hostedRelayUrl: m.hostedAccess.hostedRelayUrl,
    hasHostedRelayEntitlement: m.hostedAccess.entitlementToken !== null,
    localStorageLabel: formatBytes(stats.localBytes),
  });

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Hosted services</h3>
      <div className="mk-hosted-boundaries">
        {items.map((item) => <HostedBoundaryRow key={item.id} item={item} />)}
      </div>
      <HonestNotice>
        The $4.99 app covers private local use. Hosted backup, public reach, always-on community
        history, hosted connection capacity, and hosted file storage are paid services only when they are
        actually connected.
      </HonestNotice>
    </section>
  );
}

function HostedBoundaryRow({ item }: { item: HostedBoundaryItem }): React.ReactElement {
  return (
    <div className="mk-hosted-row">
      <div className="mk-hosted-copy">
        <div className="mk-hosted-title">{item.title}</div>
        <div className="mk-muted mk-hosted-detail">{item.detail}</div>
      </div>
      <span className={`mk-hosted-pill is-${item.state}`}>{item.stateLabel}</span>
    </div>
  );
}
