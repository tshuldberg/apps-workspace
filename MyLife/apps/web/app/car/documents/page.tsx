import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createInsuranceDocument,
  createPolicy,
  createRegDocument,
  createRegistration,
  getDocumentsByPolicy,
  getPoliciesByVehicle,
  getRegDocumentsByRegistration,
  getRegistrationByVehicle,
  getVehicles,
} from '@mylife/car';
import { getAdapter } from '@/lib/db';
import { shellStyles } from '../ui';

export default function CarDocumentsPage() {
  const db = getAdapter();
  const vehicles = getVehicles(db);
  const selectedVehicle = vehicles[0] ?? null;
  const policies = selectedVehicle ? getPoliciesByVehicle(db, selectedVehicle.id) : [];
  const registration = selectedVehicle ? getRegistrationByVehicle(db, selectedVehicle.id) : null;
  const insuranceDocs = policies.flatMap((policy) => getDocumentsByPolicy(db, policy.id));
  const registrationDocs = registration ? getRegDocumentsByRegistration(db, registration.id) : [];

  async function addDocument(formData: FormData) {
    'use server';

    if (!selectedVehicle) {
      return;
    }

    const mode = String(formData.get('mode') ?? 'insurance');
    const label = String(formData.get('label') ?? '').trim();
    const provider = String(formData.get('provider') ?? '').trim();
    const imageUri = String(formData.get('imageUri') ?? '').trim() || 'local://document';
    if (!label) {
      return;
    }

    try {
      if (mode === 'insurance') {
        const existingPolicy = getPoliciesByVehicle(getAdapter(), selectedVehicle.id)[0];
        if (existingPolicy) {
          createInsuranceDocument(getAdapter(), crypto.randomUUID(), {
            policyId: existingPolicy.id,
            label,
            imageUri,
          });
        } else {
          const policyId = crypto.randomUUID();
          createPolicy(getAdapter(), policyId, {
            vehicleId: selectedVehicle.id,
            provider: provider || 'Insurance Provider',
          });
          createInsuranceDocument(getAdapter(), crypto.randomUUID(), {
            policyId,
            label,
            imageUri,
          });
        }
      } else {
        const existingRegistration = getRegistrationByVehicle(getAdapter(), selectedVehicle.id);
        const registrationId = existingRegistration?.id ?? crypto.randomUUID();
        if (!existingRegistration) {
          createRegistration(getAdapter(), registrationId, {
            vehicleId: selectedVehicle.id,
            regState: provider || undefined,
          });
        }
        createRegDocument(getAdapter(), crypto.randomUUID(), {
          registrationId,
          label,
          imageUri,
        });
      }
    } finally {
      revalidatePath('/car/documents');
    }
  }

  return (
    <div style={shellStyles.page}>
      <section style={shellStyles.hero}>
        <div style={shellStyles.heroTop}>
          <div>
            <div style={shellStyles.eyebrow}>MyCar Documents</div>
            <h1 style={shellStyles.title}>Document vault with local records</h1>
            <p style={shellStyles.subtitle}>
              Store insurance and registration attachments in one place and keep the latest coverage metadata nearby.
            </p>
          </div>
        </div>
        <nav style={shellStyles.nav}>
          <Link href="/car" style={shellStyles.navLink}>Hub</Link>
          <Link href="/car/vehicles" style={shellStyles.navLink}>Vehicles</Link>
          <Link href="/car/service" style={shellStyles.navLink}>Service</Link>
          <Link href="/car/fuel" style={shellStyles.navLink}>Fuel</Link>
          <Link href="/car/trips" style={shellStyles.navLink}>Trips</Link>
          <Link href="/car/documents" style={shellStyles.navLinkActive}>Documents</Link>
          <Link href="/car/reminders" style={shellStyles.navLink}>Reminders</Link>
          <Link href="/car/settings" style={shellStyles.navLink}>Settings</Link>
        </nav>
      </section>

      <section style={shellStyles.section}>
        <h2 style={shellStyles.sectionTitle}>Add document</h2>
        <form action={addDocument} style={shellStyles.list}>
          <div style={shellStyles.row}>
            <select name="mode" defaultValue="insurance" style={shellStyles.input}>
              <option value="insurance">Insurance</option>
              <option value="registration">Registration</option>
            </select>
            <input name="label" placeholder="Document label" style={shellStyles.input} />
            <input name="provider" placeholder="Provider or state" style={shellStyles.input} />
            <input name="imageUri" placeholder="Local URI" style={shellStyles.input} />
          </div>
          <button type="submit" style={shellStyles.button}>Save document</button>
        </form>
      </section>

      <div style={shellStyles.split}>
        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Insurance</h2>
          <div style={shellStyles.list}>
            {policies.length === 0 ? (
              <div style={shellStyles.empty}>No insurance policy records yet.</div>
            ) : policies.map((policy) => (
              <div key={policy.id} style={shellStyles.listCard}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{policy.provider}</div>
                <div style={shellStyles.line}>{policy.coverageType} · expires {policy.endDate ?? 'not set'}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Stored files</h2>
          <div style={shellStyles.list}>
            {[...insuranceDocs, ...registrationDocs].length === 0 ? (
              <div style={shellStyles.empty}>No document records yet.</div>
            ) : [...insuranceDocs, ...registrationDocs].map((doc) => (
              <div key={doc.id} style={shellStyles.listCard}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{doc.label ?? doc.documentType}</div>
                <div style={shellStyles.line}>{doc.documentType} · local record</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
