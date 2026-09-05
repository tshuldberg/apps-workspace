'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllContractors, doCreateContractor, doToggleFavorite, doDeleteContractor,
} from '../actions';
import { getFavoriteContractors } from '@mylife/homes';
import type { Contractor, Specialty } from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};

const SPECIALTIES: Specialty[] = [
  'general', 'plumbing', 'electrical', 'hvac', 'roofing', 'landscaping',
  'painting', 'pest_control', 'cleaning', 'other',
];

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [specialty, setSpecialty] = useState<Specialty>('general');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setContractors(await fetchAllContractors());
    } catch {
      setError('Failed to load contractors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const favorites = getFavoriteContractors(contractors);
  const filtered = useMemo(() => {
    let list = contractors;
    if (specFilter) list = list.filter((c) => c.specialty === specFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q),
      );
    }
    return list;
  }, [contractors, specFilter, search]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await doCreateContractor(crypto.randomUUID(), {
        name: name.trim(), company: company.trim() || undefined,
        specialty, phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setName(''); setCompany(''); setPhone(''); setEmail('');
      setShowAdd(false); setLoading(true); void load();
    } catch { /* */ }
  };

  const handleFav = async (id: string) => {
    try { await doToggleFavorite(id); void load(); } catch { /* */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this contractor?')) return;
    try { await doDeleteContractor(id); void load(); } catch { /* */ }
  };

  if (loading) {
    return <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      {[1, 2, 3].map((i) => <div key={i} style={{ ...GLASS_CARD, height: 120, opacity: 0.5 }} />)}
    </div>;
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

  if (contractors.length === 0 && !showAdd) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>👷</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Build your team</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px' }}>
          Save your trusted contractors so you always know who to call.
        </p>
        <button type="button" onClick={() => setShowAdd(true)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
        }}>Add Contractor</button>
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, width: '100%',
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Contractors</h2>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>{showAdd ? 'Cancel' : '+ Add Contractor'}</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contractors..." style={{ ...inputStyle, maxWidth: 280 }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setSpecFilter(null)} style={{
            background: !specFilter ? ACCENT : 'var(--glass-strong)',
            color: !specFilter ? 'var(--background)' : 'var(--text-secondary)',
            border: 'none', borderRadius: 999, padding: '5px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12,
          }}>All</button>
          {SPECIALTIES.slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => setSpecFilter(specFilter === s ? null : s)} style={{
              background: specFilter === s ? ACCENT : 'var(--glass-strong)',
              color: specFilter === s ? 'var(--background)' : 'var(--text-secondary)',
              border: 'none', borderRadius: 999, padding: '5px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12,
            }}>{s.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" style={inputStyle} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" style={inputStyle} />
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value as Specialty)} style={inputStyle}>
            {SPECIALTIES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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

      {favorites.length > 0 && !specFilter && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>Favorites</p>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {favorites.map((c) => (
              <ContractorCard key={c.id} contractor={c} onFav={handleFav} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {filtered.filter((c) => !c.isFavorite || specFilter).map((c) => (
          <ContractorCard key={c.id} contractor={c} onFav={handleFav} onDelete={handleDelete} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
          No contractors match your search
        </p>
      )}
    </div>
  );
}

function ContractorCard({ contractor: c, onFav, onDelete }: {
  contractor: Contractor; onFav: (id: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <div style={{
      background: 'var(--glass)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{c.name}</h3>
          {c.company && <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{c.company}</p>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => onFav(c.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16,
          }}>{c.isFavorite ? '❤️' : '🤍'}</button>
          <button type="button" onClick={() => onDelete(c.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 14,
          }}>✕</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{
          background: 'var(--glass-strong)', borderRadius: 4,
          padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        }}>{c.specialty.replace('_', ' ')}</span>
        {c.rating != null && (
          <span style={{ color: 'var(--accent-homes)', fontSize: 13 }}>{'★'.repeat(c.rating)}</span>
        )}
      </div>
      {(c.phone || c.email) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          {c.phone && <span>{c.phone}</span>}
          {c.email && <span>{c.email}</span>}
        </div>
      )}
    </div>
  );
}
