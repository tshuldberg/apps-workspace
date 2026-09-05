import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createVehicle, getVehicles, getVehicleById } from '@mylife/car';
import type { FuelType } from '@mylife/car';
import { getAdapter } from '@/lib/db';
import { formatMiles, shellStyles } from '../ui';

const FUEL_TYPES: FuelType[] = ['gas', 'diesel', 'electric', 'hybrid'];

export default async function CarVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string | string[] }>;
}) {
  const params = await searchParams;
  const vehicleId = Array.isArray(params.vehicleId) ? params.vehicleId[0] : params.vehicleId;
  const db = getAdapter();
  const vehicles = getVehicles(db);
  const selectedVehicle = vehicleId ? getVehicleById(db, vehicleId) : vehicles[0] ?? null;

  async function addVehicle(formData: FormData) {
    'use server';

    try {
      const make = String(formData.get('make') ?? '').trim();
      const model = String(formData.get('model') ?? '').trim();
      if (!make || !model) {
        return;
      }

      createVehicle(getAdapter(), crypto.randomUUID(), {
        name: String(formData.get('name') ?? '').trim() || `${make} ${model}`,
        make,
        model,
        year: Number(formData.get('year') ?? new Date().getFullYear()),
        odometer: Number(formData.get('odometer') ?? 0),
        fuelType: String(formData.get('fuelType') ?? 'gas'),
      });
    } finally {
      revalidatePath('/car');
      revalidatePath('/car/vehicles');
    }
  }

  return (
    <div style={shellStyles.page}>
      <section style={shellStyles.hero}>
        <div style={shellStyles.heroTop}>
          <div>
            <div style={shellStyles.eyebrow}>MyCar Vehicles</div>
            <h1 style={shellStyles.title}>Garage management on desktop</h1>
            <p style={shellStyles.subtitle}>
              Add a vehicle, scan the full roster, and keep one detail panel visible while you work.
            </p>
          </div>
        </div>
        <nav style={shellStyles.nav}>
          <Link href="/car" style={shellStyles.navLink}>Hub</Link>
          <Link href="/car/vehicles" style={shellStyles.navLinkActive}>Vehicles</Link>
          <Link href="/car/service" style={shellStyles.navLink}>Service</Link>
          <Link href="/car/fuel" style={shellStyles.navLink}>Fuel</Link>
          <Link href="/car/trips" style={shellStyles.navLink}>Trips</Link>
          <Link href="/car/documents" style={shellStyles.navLink}>Documents</Link>
          <Link href="/car/reminders" style={shellStyles.navLink}>Reminders</Link>
          <Link href="/car/settings" style={shellStyles.navLink}>Settings</Link>
        </nav>
      </section>

      <div style={shellStyles.split}>
        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Add vehicle</h2>
          <form action={addVehicle} style={shellStyles.list}>
            <div style={shellStyles.row}>
              <input name="name" placeholder="Nickname" style={shellStyles.input} />
              <input name="make" placeholder="Make" style={shellStyles.input} />
              <input name="model" placeholder="Model" style={shellStyles.input} />
              <input name="year" placeholder="Year" style={shellStyles.input} />
              <input name="odometer" placeholder="Odometer" style={shellStyles.input} />
              <select name="fuelType" defaultValue="gas" style={shellStyles.input}>
                {FUEL_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <button type="submit" style={shellStyles.button}>Save vehicle</button>
          </form>

          <h2 style={shellStyles.sectionTitle}>Vehicle grid</h2>
          <div style={shellStyles.row}>
            {vehicles.length === 0 ? (
              <div style={shellStyles.empty}>No vehicles yet.</div>
            ) : vehicles.map((vehicle) => (
              <Link key={vehicle.id} href={`/car/vehicles?vehicleId=${vehicle.id}`} style={{ ...shellStyles.listCard, textDecoration: 'none' }}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{vehicle.name}</div>
                <div style={shellStyles.line}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </div>
                <div style={shellStyles.line}>
                  {formatMiles(vehicle.odometer)} · {vehicle.fuelType}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Detail panel</h2>
          {selectedVehicle ? (
            <div style={shellStyles.list}>
              <div style={shellStyles.listCard}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{selectedVehicle.name}</div>
                <div style={shellStyles.line}>
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </div>
                <div style={shellStyles.line}>
                  {formatMiles(selectedVehicle.odometer)} · {selectedVehicle.fuelType}
                </div>
              </div>
            </div>
          ) : (
            <div style={shellStyles.empty}>Select a vehicle card to inspect its summary.</div>
          )}
        </section>
      </div>
    </div>
  );
}
