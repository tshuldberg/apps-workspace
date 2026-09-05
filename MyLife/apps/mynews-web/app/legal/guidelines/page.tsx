import type { Metadata } from 'next';
import { readWebLegalContext } from '@/lib/capabilities';
import { LegalDoc } from '../LegalDoc';

// Rendered per request so the document reflects THIS deployment's capabilities
// (payments rail, contact channels) instead of the frozen unconfigured bundle.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Community Guidelines | MyNews',
  description: 'The rules that keep MyNews a trustworthy place for journalism.',
};

export default function GuidelinesPage() {
  return <LegalDoc doc={readWebLegalContext().legal.guidelines} />;
}
