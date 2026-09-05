import { ensureModuleMigrations } from '@/lib/db';
import { CreateTripForm } from './CreateTripForm';

export default function CreateTripPage() {
  ensureModuleMigrations('travel');
  return <CreateTripForm />;
}
