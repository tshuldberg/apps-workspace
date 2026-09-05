import Link from 'next/link';
import { createCertificationAction } from '../../../actions';
import {
  CLASSES_ACCENT,
  ClassesFormSection,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';

export default function AddCertificationPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href="/classes/lifelong/certifications"
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to certifications
      </Link>
      <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Add credential</h1>

      <form action={createCertificationAction} style={{ display: 'grid', gap: 20 }}>
        <ClassesFormSection title="Identity" description="Name is required. Issuer is recommended.">
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              placeholder="AWS Solutions Architect — Associate"
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Issuer')}
              <input
                type="text"
                name="issuer"
                placeholder="Amazon Web Services"
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Category')}
              <input
                type="text"
                name="category"
                placeholder="Cloud / Language / Project mgmt…"
                style={textInputStyle}
              />
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Validity" description="Dates power expiry alerts and the wallet color-code.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Issued at')}
              <input type="date" name="issued_at" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Expires at')}
              <input type="date" name="expires_at" style={textInputStyle} />
            </div>
          </div>
          <div>
            {fieldLabel('Renewal reminder (days before expiry)')}
            <input
              type="number"
              name="renewal_reminder_days"
              min={0}
              placeholder="60"
              style={textInputStyle}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Verification" description="Optional links so future-you can prove it.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Credential ID')}
              <input
                type="text"
                name="credential_id"
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Credential URL')}
              <input
                type="url"
                name="credential_url"
                placeholder="https://…"
                style={textInputStyle}
              />
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Notes" description="Anything you want to remember about this credential.">
          <textarea
            name="notes_md"
            rows={4}
            placeholder="Markdown supported."
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
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
            Add credential
          </button>
          <Link href="/classes/lifelong/certifications" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
