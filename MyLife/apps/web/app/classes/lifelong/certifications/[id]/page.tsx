import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCertification } from '../../../data';
import {
  deleteCertificationAction,
  updateCertificationAction,
} from '../../../actions';
import {
  BORDER,
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesFormSection,
  SURFACE,
  SURFACE_ELEVATED,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';
import {
  bucketCertExpiry,
  expiryColor,
  expiryLabel,
  formatDate,
} from '../../ui';

export default async function CertificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let cert;
  try {
    cert = loadCertification(id);
  } catch {
    cert = null;
  }
  if (!cert) notFound();

  const bucket = bucketCertExpiry(cert.expires_at);
  const color = expiryColor(bucket);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href="/classes/lifelong/certifications"
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to certifications
      </Link>

      <header
        style={{
          display: 'grid',
          gap: 12,
          padding: 24,
          borderRadius: 20,
          border: `1px solid ${CLASSES_ACCENT_BORDER}`,
          background: SURFACE,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>{cert.name}</h1>
            <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
              {[cert.issuer, cert.category].filter(Boolean).join(' · ') ||
                'Credential'}
            </div>
          </div>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${color}`,
              color,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {expiryLabel(cert.expires_at)}
          </span>
        </div>
        {cert.credential_url ? (
          <a
            href={cert.credential_url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ fontSize: 13, color: CLASSES_ACCENT }}
          >
            Verify credential →
          </a>
        ) : null}
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <Cell label="Issued" value={formatDate(cert.issued_at)} />
        <Cell label="Expires" value={formatDate(cert.expires_at)} />
        <Cell label="Credential ID" value={cert.credential_id ?? '—'} />
        <Cell
          label="Renewal reminder"
          value={
            cert.renewal_reminder_days
              ? `${cert.renewal_reminder_days}d before expiry`
              : '—'
          }
        />
      </div>

      {cert.notes_md ? (
        <section
          style={{
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            padding: 16,
            color: TEXT_SECONDARY,
            whiteSpace: 'pre-wrap',
            fontSize: 14,
            lineHeight: '20px',
          }}
        >
          {cert.notes_md}
        </section>
      ) : null}

      <form action={updateCertificationAction} style={{ display: 'grid', gap: 16 }}>
        <input type="hidden" name="id" value={cert.id} />
        <ClassesFormSection title="Edit credential" description="Update issuer, dates, renewal cadence.">
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              defaultValue={cert.name}
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Issuer')}
              <input
                type="text"
                name="issuer"
                defaultValue={cert.issuer ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Category')}
              <input
                type="text"
                name="category"
                defaultValue={cert.category ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Issued at')}
              <input
                type="date"
                name="issued_at"
                defaultValue={cert.issued_at?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Expires at')}
              <input
                type="date"
                name="expires_at"
                defaultValue={cert.expires_at?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Credential ID')}
              <input
                type="text"
                name="credential_id"
                defaultValue={cert.credential_id ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Credential URL')}
              <input
                type="url"
                name="credential_url"
                defaultValue={cert.credential_url ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('Renewal reminder (days before expiry)')}
            <input
              type="number"
              name="renewal_reminder_days"
              min={0}
              defaultValue={cert.renewal_reminder_days ?? ''}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Notes')}
            <textarea
              name="notes_md"
              rows={4}
              defaultValue={cert.notes_md ?? ''}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              ...pillLinkStyle(true),
              cursor: 'pointer',
              border: `1px solid ${CLASSES_ACCENT}`,
            }}
          >
            Save changes
          </button>
          <Link href="/classes/lifelong/certifications" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteCertificationAction}>
        <input type="hidden" name="id" value={cert.id} />
        <button
          type="submit"
          style={{
            ...pillLinkStyle(false),
            cursor: 'pointer',
            color: 'var(--danger, #FFB4AB)',
            border: '1px solid var(--danger, #FFB4AB)',
          }}
        >
          Delete credential
        </button>
      </form>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        background: SURFACE_ELEVATED,
        padding: 14,
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
