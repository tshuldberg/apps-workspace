'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchProperties, fetchSchedulesForProperty, fetchCostEntriesForProperty,
  doCreateProperty, doDeleteProperty,
} from '../actions';
import { getLifetimeCosts } from '@mylife/homes';
import type { Property, PropertyType, OwnershipType } from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};

interface PropertyStats {
  taskCount: number;
  totalSpent: number;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<Record<string, PropertyStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [ownershipType, setOwnershipType] = useState<OwnershipType>('own');

  const load = useCallback(async () => {
    try {
      setError(null);
      const props = await fetchProperties();
      setProperties(props);
      const s: Record<string, PropertyStats> = {};
      for (const p of props) {
        const [scheds, costs] = await Promise.all([
          fetchSchedulesForProperty(p.id),
          fetchCostEntriesForProperty(p.id),
        ]);
        s[p.id] = { taskCount: scheds.length, totalSpent: getLifetimeCosts(costs) };
      }
      setStats(s);
    } catch {
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.toLowerCase();
    return properties.filter(
      (p) => p.name.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q),
    );
  }, [properties, search]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await doCreateProperty(crypto.randomUUID(), {
        name: name.trim(), address: address.trim() || undefined,
        city: city.trim() || undefined, state: state.trim() || undefined,
        propertyType, ownershipType,
      });
      setName(''); setAddress(''); setCity(''); setState('');
      setShowAdd(false);
      setLoading(true);
      void load();
    } catch { /* display inline later */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property and all associated data?')) return;
    try {
      await doDeleteProperty(id);
      setLoading(true);
      void load();
    } catch { /* */ }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...GLASS_CARD, height: 100, opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 48 }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Something went wrong</p>
        <button type="button" onClick={() => { setLoading(true); void load(); }} style={{
          background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
        }}>Retry</button>
      </div>
    );
  }

  if (properties.length === 0 && !showAdd) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>🏘️</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>No properties yet</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px' }}>
          Add your first home or rental to start managing everything in one place.
        </p>
        <button type="button" onClick={() => setShowAdd(true)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
        }}>Add Property</button>
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', width: '100%',
    fontSize: 14,
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search properties..."
          style={{ ...inputStyle, maxWidth: 320 }}
        />
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>
          {showAdd ? 'Cancel' : '+ Add Property'}
        </button>
      </div>

      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Property name *" style={inputStyle} />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" style={inputStyle} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} />
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" style={inputStyle} />
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} style={inputStyle}>
            {['house', 'condo', 'townhouse', 'apartment', 'land'].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value as OwnershipType)} style={inputStyle}>
            <option value="own">Own</option>
            <option value="rent">Rent</option>
          </select>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowAdd(false)} style={{
              background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
            }}>Cancel</button>
            <button type="button" onClick={() => void handleAdd()} disabled={!name.trim()} style={{
              background: name.trim() ? ACCENT : 'var(--border)',
              color: name.trim() ? 'var(--background)' : 'var(--text-tertiary)',
              border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {filtered.map((p) => {
          const s = stats[p.id];
          return (
            <div key={p.id} style={{ ...GLASS_CARD, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
                background: ACCENT, borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Link href={`/homes/properties/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{p.name}</h3>
                  {p.address && (
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                      {p.address}{p.city ? `, ${p.city}` : ''}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <span style={{
                      background: 'var(--glass-strong)', borderRadius: 4,
                      padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    }}>{p.propertyType}</span>
                    <span style={{
                      background: 'var(--glass-strong)', borderRadius: 4,
                      padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    }}>{p.ownershipType === 'own' ? 'Owner' : 'Renter'}</span>
                  </div>
                  {s && (
                    <p style={{ margin: '8px 0 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {s.taskCount} tasks | ${Math.round(s.totalSpent / 100).toLocaleString()} spent
                    </p>
                  )}
                </Link>
                <button type="button" onClick={() => void handleDelete(p.id)} style={{
                  background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
                  cursor: 'pointer', fontSize: 16, padding: 4,
                }} title="Delete property">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && properties.length > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
          No properties match "{search}"
        </p>
      )}
    </div>
  );
}
