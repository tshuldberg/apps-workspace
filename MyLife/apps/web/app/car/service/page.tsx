import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createMaintenance,
  getActiveSchedules,
  getMaintenanceByVehicle,
  getVehicles,
} from '@mylife/car';
import type { MaintenanceType } from '@mylife/car';
import { getAdapter } from '@/lib/db';
import { formatCurrencyCents, formatMiles, shellStyles } from '../ui';

const SERVICE_TYPES: MaintenanceType[] = [
  'oil_change',
  'tire_rotation',
  'brakes',
  'battery',
  'inspection',
  'wash',
  'other',
];

export default function CarServicePage() {
  const db = getAdapter();
  const vehicles = getVehicles(db);
  const selectedVehicle = vehicles[0] ?? null;
  const maintenance = selectedVehicle ? getMaintenanceByVehicle(db, selectedVehicle.id) : [];
  const schedules = selectedVehicle ? getActiveSchedules(db, selectedVehicle.id) : [];

  async function addService(formData: FormData) {
    'use server';

    const vehicleId = String(formData.get('vehicleId') ?? '');
    if (!vehicleId) {
      return;
    }

    try {
      createMaintenance(getAdapter(), crypto.randomUUID(), vehicleId, {
        type: String(formData.get('type') ?? 'oil_change'),
        performedAt: String(formData.get('performedAt') ?? new Date().toISOString()),
        description: String(formData.get('description') ?? '').trim() || undefined,
        costCents: formData.get('cost')
          ? Math.round(Number(formData.get('cost')) * 100)
          : undefined,
        odometerAt: formData.get('odometer')
          ? Number(formData.get('odometer'))
          : undefined,
      });
    } finally {
      revalidatePath('/car');
      revalidatePath('/car/service');
    }
  }

  return (
    <div style={shellStyles.page}>
      <section style={shellStyles.hero}>
        <div style={shellStyles.heroTop}>
          <div>
            <div style={shellStyles.eyebrow}>MyCar Service</div>
            <h1 style={shellStyles.title}>Service history and schedule side by side</h1>
            <p style={shellStyles.subtitle}>
              Log a maintenance event, then keep upcoming schedules visible in the adjacent panel.
            </p>
          </div>
        </div>
        <nav style={shellStyles.nav}>
          <Link href="/car" style={shellStyles.navLink}>Hub</Link>
          <Link href="/car/vehicles" style={shellStyles.navLink}>Vehicles</Link>
          <Link href="/car/service" style={shellStyles.navLinkActive}>Service</Link>
          <Link href="/car/fuel" style={shellStyles.navLink}>Fuel</Link>
          <Link href="/car/trips" style={shellStyles.navLink}>Trips</Link>
          <Link href="/car/documents" style={shellStyles.navLink}>Documents</Link>
          <Link href="/car/reminders" style={shellStyles.navLink}>Reminders</Link>
          <Link href="/car/settings" style={shellStyles.navLink}>Settings</Link>
        </nav>
      </section>

      <div style={shellStyles.split}>
        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Add service</h2>
          <form action={addService} style={shellStyles.list}>
            <input type="hidden" name="vehicleId" value={selectedVehicle?.id ?? ''} />
            <div style={shellStyles.row}>
              <select name="type" defaultValue="oil_change" style={shellStyles.input}>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input name="performedAt" placeholder="Performed at ISO" style={shellStyles.input} />
              <input name="description" placeholder="Description" style={shellStyles.input} />
              <input name="cost" placeholder="Cost in dollars" style={shellStyles.input} />
              <input name="odometer" placeholder="Odometer" style={shellStyles.input} />
            </div>
            <button type="submit" style={shellStyles.button}>Save service</button>
          </form>

          <h2 style={shellStyles.sectionTitle}>History</h2>
          <div style={shellStyles.list}>
            {maintenance.length === 0 ? (
              <div style={shellStyles.empty}>No service records yet.</div>
            ) : maintenance.map((item) => (
              <div key={item.id} style={shellStyles.listCard}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.type.replaceAll('_', ' ')}</div>
                <div style={shellStyles.line}>
                  {item.performedAt.slice(0, 10)}
                  {item.odometerAt !== null ? ` · ${formatMiles(item.odometerAt)}` : ''}
                </div>
                <div style={shellStyles.line}>{formatCurrencyCents(item.costCents)}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Maintenance schedule</h2>
          <div style={shellStyles.list}>
            {schedules.length === 0 ? (
              <div style={shellStyles.empty}>No active schedules yet.</div>
            ) : schedules.map((schedule) => (
              <div key={schedule.id} style={shellStyles.listCard}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                  {schedule.serviceTypeCustom || schedule.serviceType.replaceAll('_', ' ')}
                </div>
                <div style={shellStyles.line}>
                  {schedule.nextDueOdometer ? `${schedule.nextDueOdometer.toLocaleString()} mi` : 'No mileage due'}
                  {schedule.nextDueDate ? ` · ${schedule.nextDueDate}` : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
