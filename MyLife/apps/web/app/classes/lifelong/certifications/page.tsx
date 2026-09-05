import Link from 'next/link';
import { loadCertificationsView } from '../../data';
import {
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
} from '../../ui';
import { CertCard } from '../ui';

export default async function CertificationsListPage() {
  let view;
  try {
    view = loadCertificationsView();
  } catch (err) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Certifications"
          title="Certifications"
          body="We hit a snag loading your certifications."
        />
        <ClassesEmptyPanel
          title="Wallet unavailable"
          body={String(err)}
          actionHref="/classes/lifelong"
          actionLabel="Back to lifelong"
        />
      </div>
    );
  }

  if (view.rows.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Certifications"
          title="Your credentials wallet"
          body="Track AWS, CFA, PMP, language certs, and anything else worth keeping receipts for."
          actionHref="/classes/lifelong/certifications/add"
          actionLabel="Add credential"
        />
        <ClassesEmptyPanel
          title="No certifications yet"
          body="Log professional credentials so renewals and expirations never sneak up."
          actionHref="/classes/lifelong/certifications/add"
          actionLabel="Add a credential"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Certifications"
        title="Credentials wallet"
        body="Issued, expiring, and renewal-due. Color-coded so you spot the urgent ones first."
        actionHref="/classes/lifelong/certifications/add"
        actionLabel="Add credential"
      />

      <ClassesMetricRow
        items={[
          { label: 'Total', value: String(view.rows.length) },
          { label: 'Expiring soon', value: String(view.expiring_soon.length) },
        ]}
      />

      <ClassesSection title="All certifications">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {view.rows.map((cert) => (
            <Link
              key={cert.id}
              href={`/classes/lifelong/certifications/${cert.id}`}
              style={{ textDecoration: 'none' }}
            >
              <CertCard cert={cert} />
            </Link>
          ))}
        </div>
      </ClassesSection>
    </div>
  );
}
