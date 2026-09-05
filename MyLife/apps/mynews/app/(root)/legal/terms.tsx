import { LegalDocView } from '../components/LegalDocView';
import { getMyNewsRuntimeLegalContent } from '../data/runtime-capabilities';

export default function TermsScreen() {
  return <LegalDocView doc={getMyNewsRuntimeLegalContent().terms} />;
}
