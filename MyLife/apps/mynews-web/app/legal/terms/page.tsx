import type { Metadata } from 'next';
import { readWebLegalContext } from '@/lib/capabilities';
import { LegalDoc } from '../LegalDoc';

// Rendered per request so the document reflects THIS deployment's capabilities
// (payments rail, contact channels) instead of the frozen unconfigured bundle.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Terms of Service | MyNews',
  description: 'The agreement between you and MyNews for using the service.',
};

export default function TermsPage() {
  return <LegalDoc doc={readWebLegalContext().legal.terms} />;
}
