import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createFuelLog,
  getAveragePricePerGallon,
  getFuelLogsByVehicle,
  getVehicles,
} from '@mylife/car';
import { getAdapter } from '@/lib/db';
import { formatCurrencyCents, shellStyles } from '../ui';

export default function CarFuelPage() {
  const db = getAdapter();
  const vehicles = getVehicles(db);
  const selectedVehicle = vehicles[0] ?? null;
  const fuelLogs = selectedVehicle ? getFuelLogsByVehicle(db, selectedVehicle.id) : [];
  const totalFuel = fuelLogs.reduce((sum, item) => sum + item.costCents, 0);
  const avgPrice = getAveragePricePerGallon(fuelLogs);

  async function addFuel(formData: FormData) {
    'use server';

    const vehicleId = String(formData.get('vehicleId') ?? '');
    if (!vehicleId) {
      return;
    }

    try {
      createFuelLog(getAdapter(), crypto.randomUUID(), vehicleId, {
        gallons: Number(formData.get('gallons') ?? 0),
        costCents: Math.round(Number(formData.get('cost') ?? 0) * 100),
        odometerAt: Number(formData.get('odometer') ?? 0),
        loggedAt: new Date().toISOString(),
        station: String(formData.get('station') ?? '').trim() || undefined,
        isFullTank: true,
      });
    } finally {
      revalidatePath('/car');
      revalidatePath('/car/fuel');
    }
  }

  return (
    <div style={shellStyles.page}>
      <section style={shellStyles.hero}>
        <div style={shellStyles.heroTop}>
          <div>
            <div style={shellStyles.eyebrow}>MyCar Fuel</div>
            <h1 style={shellStyles.title}>Fuel economy and cost analysis</h1>
            <p style={shellStyles.subtitle}>
              Log a fill-up, then keep price and spend context visible without leaving the page.
            </p>
          </div>
        </div>
        <nav style={shellStyles.nav}>
          <Link href="/car" style={shellStyles.navLink}>Hub</Link>
          <Link href="/car/vehicles" style={shellStyles.navLink}>Vehicles</Link>
          <Link href="/car/service" style={shellStyles.navLink}>Service</Link>
          <Link href="/car/fuel" style={shellStyles.navLinkActive}>Fuel</Link>
          <Link href="/car/trips" style={shellStyles.navLink}>Trips</Link>
          <Link href="/car/documents" style={shellStyles.navLink}>Documents</Link>
          <Link href="/car/reminders" style={shellStyles.navLink}>Reminders</Link>
          <Link href="/car/settings" style={shellStyles.navLink}>Settings</Link>
        </nav>
      </section>

      <div style={shellStyles.metricGrid}>
        <div style={shellStyles.metricCard}>
          <div style={shellStyles.metricValue}>{formatCurrencyCents(totalFuel)}</div>
          <div style={shellStyles.metricLabel}>Fuel spend</div>
        </div>
        <div style={shellStyles.metricCard}>
          <div style={shellStyles.metricValue}>{avgPrice ? avgPrice.toFixed(2) : '--'}</div>
          <div style={shellStyles.metricLabel}>Avg $ / gal</div>
        </div>
      </div>

      <section style={shellStyles.section}>
        <h2 style={shellStyles.sectionTitle}>Add fuel log</h2>
        <form action={addFuel} style={shellStyles.list}>
          <input type="hidden" name="vehicleId" value={selectedVehicle?.id ?? ''} />
          <div style={shellStyles.row}>
            <input name="gallons" placeholder="Gallons" style={shellStyles.input} />
            <input name="cost" placeholder="Cost in dollars" style={shellStyles.input} />
            <input name="odometer" placeholder="Odometer" style={shellStyles.input} />
            <input name="station" placeholder="Station" style={shellStyles.input} />
          </div>
          <button type="submit" style={shellStyles.button}>Save fuel log</button>
        </form>
      </section>

      <section style={shellStyles.section}>
        <h2 style={shellStyles.sectionTitle}>Fuel log</h2>
        <div style={shellStyles.list}>
          {fuelLogs.length === 0 ? (
            <div style={shellStyles.empty}>No fuel logs yet.</div>
          ) : fuelLogs.map((item) => (
            <div key={item.id} style={shellStyles.listCard}>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.gallons.toFixed(1)} gal</div>
              <div style={shellStyles.line}>
                {item.loggedAt.slice(0, 10)} · {formatCurrencyCents(item.costCents)} · {item.odometerAt.toLocaleString()} mi
              </div>
              <div style={shellStyles.line}>{item.station ?? 'Station not saved'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
