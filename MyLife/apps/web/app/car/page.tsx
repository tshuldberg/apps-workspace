'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Vehicle } from '@mylife/car';
import { fetchVehicles, fetchVehicleCount } from './actions';

/* Use CSS custom properties from globals.css instead of hardcoded hex */

export default function CarPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vs, count] = await Promise.all([fetchVehicles(), fetchVehicleCount()]);
      setVehicles(vs as Vehicle[]);
      setVehicleCount(count as number);
    } catch (err) {
      console.error('Failed to load car data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">MyCar</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  const navItems = [
    { href: '/car/garage', label: 'Garage', icon: '\uD83D\uDE97', desc: `${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}` },
    { href: '/car/reminders', label: 'Reminders', icon: '\uD83D\uDD14', desc: 'Maintenance schedules' },
    { href: '/car/trips', label: 'Trips', icon: '\uD83D\uDCCD', desc: 'Mileage and IRS tracking' },
    { href: '/car/expenses', label: 'Expenses', icon: '\uD83D\uDCB0', desc: 'Fuel and cost tracking' },
    { href: '/car/settings', label: 'Settings', icon: '\u2699\uFE0F', desc: 'Units and preferences' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">MyCar</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''} in your garage
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}>
          <p className="text-4xl mb-3">{'\uD83D\uDE97'}</p>
          <p className="font-medium mb-1">Your garage awaits</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Add your first vehicle to start tracking maintenance and fuel
          </p>
          <Link
            href="/car/garage"
            className="inline-block rounded-lg px-6 py-3 font-semibold text-white no-underline"
            style={{ backgroundColor: 'var(--accent-car)' }}
          >
            Go to Garage
          </Link>
        </div>
      ) : (
        <>
          {/* Vehicle summary cards */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/car/garage/${v.id}`}
                className="rounded-xl border p-4 no-underline transition-colors hover:border-indigo-500/30"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)', color: 'inherit' }}
              >
                <p className="font-medium">{v.name}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {v.year} {v.make} {v.model}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {v.odometer.toLocaleString()} mi
                </p>
              </Link>
            ))}
          </div>

          {/* Navigation grid */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border p-4 no-underline transition-colors hover:border-indigo-500/30"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)', color: 'inherit' }}
              >
                <span className="text-2xl">{item.icon}</span>
                <p className="font-medium mt-2">{item.label}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
