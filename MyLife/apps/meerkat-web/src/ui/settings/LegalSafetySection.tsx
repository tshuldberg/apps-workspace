import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  acceptPublicTerms,
  hasAcceptedPublicTerms,
  publicLegalConfig,
} from '../../lib/public-safety';
import { HonestNotice } from '../shell/HonestNotice';

export function LegalSafetySection(): React.ReactElement {
  const m = useMeerkat();
  const config = publicLegalConfig();
  const [accepted, setAccepted] = useState(() => hasAcceptedPublicTerms(m.db));
  const links = [
    ['Privacy Policy', config.privacyUrl],
    ['Terms of Use', config.termsUrl],
    ['Community Standards', config.standardsUrl],
    ['Safety support and appeals', config.supportUrl],
  ] as const;
  return (
    <section className="mk-settings-section" aria-label="Legal and safety">
      <h3 className="mk-settings-section-title">Legal and safety</h3>
      <p className="mk-muted">
        Public posting requires acceptance of the Terms of Use and Community Standards. Reporting
        and blocking remain available whether or not you post.
      </p>
      <div className="mk-hosted-actions">
        {links.map(([label, url]) => (
          <a key={label} className="mk-btn mk-btn-secondary" href={url || undefined} target="_blank" rel="noreferrer">
            {label}
          </a>
        ))}
      </div>
      {!Object.values(config).every((url) => url.startsWith('https://')) ? (
        <HonestNotice>Policy links are not configured in this build. Public posting stays unavailable.</HonestNotice>
      ) : accepted ? (
        <p className="mk-muted">Terms and Community Standards accepted on this browser.</p>
      ) : (
        <button
          type="button"
          className="mk-btn"
          onClick={() => {
            acceptPublicTerms(m.db);
            void m.db.flush().catch(() => undefined);
            setAccepted(true);
          }}
        >
          I agree to the Terms and Community Standards
        </button>
      )}
    </section>
  );
}
