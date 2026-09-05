import { LegalDocView } from '../components/LegalDocView';
import { getMyNewsRuntimeLegalContent } from '../data/runtime-capabilities';

export default function GuidelinesScreen() {
  return <LegalDocView doc={getMyNewsRuntimeLegalContent().guidelines} />;
}
