import { LegalDocView } from '../components/LegalDocView';
import { getMyNewsRuntimeLegalContent } from '../data/runtime-capabilities';

export default function PrivacyScreen() {
  return <LegalDocView doc={getMyNewsRuntimeLegalContent().privacy} />;
}
