import type { Metadata } from 'next';
import { readWebLegalContext } from '@/lib/capabilities';
import { LegalDoc } from '../LegalDoc';

// Rendered per request so the document reflects THIS deployment's capabilities
// (payments rail, contact channels) instead of the frozen unconfigured bundle.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy Policy | MyNews',
  description: 'What data MyNews collects, why, and the choices you have.',
};

export default function PrivacyPage() {
  return <LegalDoc doc={readWebLegalContext().legal.privacy} />;
}
