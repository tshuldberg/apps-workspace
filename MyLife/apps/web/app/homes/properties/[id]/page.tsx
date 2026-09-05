'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchProperty, doUpdateProperty, doDeleteProperty,
  fetchSchedulesForProperty, doCreateSchedule, doUpdateSchedule,
  fetchCostEntriesForProperty, doCreateCostEntry, doDeleteCostEntry,
  fetchPoliciesForProperty,
  fetchDocumentsForProperty,
  fetchRoomsForProperty, fetchItemsForRoom, doCreateRoom,
  fetchAppliancesForProperty, doCreateAppliance, doDeleteAppliance,
} from '../../actions';
import {
  calculateScheduleStatus, sortByUrgency, getTaskTypeLabel, markComplete,
  getCostSummary, getLifetimeCosts,
  getActivePolicies, getExpiringPolicies, checkCoverageGaps,
  getPropertyInventoryValue, getWarrantyStatus, getAppliancesNeedingAttention,
} from '@mylife/homes';
import type {
  Property, MaintenanceSchedule, CostEntry, InsurancePolicy,
  HomeDocument, Room, InventoryItem, Appliance,
  PropertyType, OwnershipType, TaskType, CostCategory,
  ApplianceCategory, ScheduleStatus,
} from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};
const INPUT: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, width: '100%',
};

type Tab = 'overview' | 'maintenance' | 'costs' | 'insurance' | 'documents' | 'inventory' | 'appliances';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'costs', label: 'Costs' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'documents', label: 'Documents' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'appliances', label: 'Appliances' },
];

function cents(v: number) { return `$${Math.round(Math.abs(v) / 100).toLocaleString()}`; }

const STATUS_COLORS: Record<string, string> = {
  overdue: 'var(--danger)', due_soon: ACCENT, ok: 'var(--success)', unknown: 'var(--text-tertiary)',
};

const TASK_TYPES: TaskType[] = [
  'hvac_filter', 'hvac_service', 'gutter_cleaning', 'roof_inspection',
  'smoke_detector', 'water_heater_flush', 'dryer_vent', 'pest_control',
  'exterior_paint', 'lawn_mower_service', 'window_cleaning',
  'plumbing_inspection', 'appliance_service', 'chimney_sweep', 'custom',
];

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  // Sub-data
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [documents, setDocuments] = useState<HomeDocument[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomItems, setRoomItems] = useState<Record<string, InventoryItem[]>>({});
  const [appliances, setAppliances] = useState<Appliance[]>([]);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editType, setEditType] = useState<PropertyType>('house');
  const [editOwnership, setEditOwnership] = useState<OwnershipType>('own');

  const load = useCallback(async () => {
    try {
      setError(null);
      const prop = await fetchProperty(id);
      if (!prop) { setError('Property not found'); setLoading(false); return; }
      setProperty(prop);
      setEditName(prop.name); setEditAddress(prop.address ?? '');
      setEditType(prop.propertyType); setEditOwnership(prop.ownershipType);

      const [scheds, c, pols, docs, rms, apps] = await Promise.all([
        fetchSchedulesForProperty(id),
        fetchCostEntriesForProperty(id),
        fetchPoliciesForProperty(id),
        fetchDocumentsForProperty(id),
        fetchRoomsForProperty(id),
        fetchAppliancesForProperty(id),
      ]);
      setSchedules(scheds); setCosts(c); setPolicies(pols);
      setDocuments(docs); setRooms(rms); setAppliances(apps);

      const items: Record<string, InventoryItem[]> = {};
      for (const r of rms) { items[r.id] = await fetchItemsForRoom(r.id); }
      setRoomItems(items);
    } catch {
      setError('Failed to load property');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveEdit = async () => {
    try {
      await doUpdateProperty(id, {
        name: editName.trim(), address: editAddress.trim() || null,
        propertyType: editType, ownershipType: editOwnership,
      });
      setEditing(false); void load();
    } catch { /* */ }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this property and all associated data?')) return;
    try { await doDeleteProperty(id); router.push('/homes/properties'); } catch { /* */ }
  };

  if (loading) {
    return <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...GLASS_CARD, height: 100, opacity: 0.5 }} />
      <div style={{ display: 'flex', gap: 8 }}>{TABS.map((t) => <div key={t.key} style={{ ...GLASS_CARD, height: 36, width: 80, opacity: 0.3 }} />)}</div>
      <div style={{ ...GLASS_CARD, height: 200, opacity: 0.5 }} />
    </div>;
  }

  if (error || !property) {
    return (
      <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 48 }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>{error ?? 'Property not found'}</p>
        <button type="button" onClick={() => router.push('/homes/properties')} style={{
          background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
        }}>Back to Properties</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{property.name}</h1>
          {property.address && (
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 15 }}>
              {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? `, ${property.state}` : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{property.propertyType}</span>
            <span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{property.ownershipType === 'own' ? 'Owner' : 'Renter'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setEditing(!editing)} style={{
            background: 'var(--glass-strong)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>{editing ? 'Cancel' : 'Edit'}</button>
          <button type="button" onClick={() => void handleDelete()} style={{
            background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)',
            borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>Delete</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--glass)', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? 'var(--glass-strong)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text-secondary)',
            border: 'none', borderRadius: 8, padding: '8px 14px',
            fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab property={property} editing={editing}
        editName={editName} editAddress={editAddress} editType={editType} editOwnership={editOwnership}
        setEditName={setEditName} setEditAddress={setEditAddress} setEditType={setEditType} setEditOwnership={setEditOwnership}
        onSave={handleSaveEdit} schedules={schedules} costs={costs} documents={documents} />}
      {tab === 'maintenance' && <MaintenanceTab schedules={schedules} propertyId={id} onRefresh={load} />}
      {tab === 'costs' && <CostsTab costs={costs} propertyId={id} onRefresh={load} />}
      {tab === 'insurance' && <InsuranceTab policies={policies} ownershipType={property.ownershipType as 'own' | 'rent'} />}
      {tab === 'documents' && <DocumentsTab documents={documents} />}
      {tab === 'inventory' && <InventoryTab rooms={rooms} roomItems={roomItems} propertyId={id} onRefresh={load} />}
      {tab === 'appliances' && <AppliancesTab appliances={appliances} propertyId={id} onRefresh={load} />}
    </div>
  );
}

// ── Overview Tab ──
function OverviewTab({ property, editing, editName, editAddress, editType, editOwnership, setEditName, setEditAddress, setEditType, setEditOwnership, onSave, schedules, costs, documents }: {
  property: Property; editing: boolean;
  editName: string; editAddress: string; editType: PropertyType; editOwnership: OwnershipType;
  setEditName: (v: string) => void; setEditAddress: (v: string) => void; setEditType: (v: PropertyType) => void; setEditOwnership: (v: OwnershipType) => void;
  onSave: () => void; schedules: MaintenanceSchedule[]; costs: CostEntry[]; documents: HomeDocument[];
}) {
  const lifetime = getLifetimeCosts(costs);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {editing && (
        <div style={{ ...GLASS_CARD, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" style={INPUT} />
          <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Address" style={INPUT} />
          <select value={editType} onChange={(e) => setEditType(e.target.value as PropertyType)} style={INPUT}>
            {['house', 'condo', 'townhouse', 'apartment', 'land'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={editOwnership} onChange={(e) => setEditOwnership(e.target.value as OwnershipType)} style={INPUT}>
            <option value="own">Own</option><option value="rent">Rent</option>
          </select>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onSave} style={{
              background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Tasks</p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{schedules.length}</p>
        </div>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total Spent</p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{cents(lifetime)}</p>
        </div>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Documents</p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{documents.length}</p>
        </div>
      </div>
      {property.yearBuilt && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Built in {property.yearBuilt}</p>}
      {property.sqft && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{property.sqft.toLocaleString()} sq ft</p>}
    </div>
  );
}

// ── Maintenance Tab ──
function MaintenanceTab({ schedules, propertyId, onRefresh }: { schedules: MaintenanceSchedule[]; propertyId: string; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('custom');
  const [interval, setIntervalVal] = useState('3');
  const [dueDate, setDueDate] = useState('');

  const rows = useMemo(() => {
    const withStatus = schedules.map((s) => ({ ...s, status: calculateScheduleStatus(s.nextDueDate) }));
    return sortByUrgency(withStatus) as (MaintenanceSchedule & { status: ScheduleStatus })[];
  }, [schedules]);

  const handleAdd = async () => {
    try {
      await doCreateSchedule(crypto.randomUUID(), {
        propertyId, taskType, intervalMonths: parseInt(interval) || 3,
        nextDueDate: dueDate || undefined,
      });
      setShowAdd(false); onRefresh();
    } catch { /* */ }
  };

  const handleComplete = async (s: MaintenanceSchedule & { status: string }) => {
    try {
      const result = markComplete(s);
      await doUpdateSchedule(s.id, { lastCompletedDate: result.lastCompletedDate, nextDueDate: result.nextDueDate, snoozeDays: 0, snoozeCount: 0 });
      onRefresh();
    } catch { /* */ }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
        }}>{showAdd ? 'Cancel' : '+ Add Task'}</button>
      </div>
      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} style={{ ...INPUT, width: 'auto' }}>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{getTaskTypeLabel(t, null)}</option>)}
          </select>
          <input type="number" value={interval} onChange={(e) => setIntervalVal(e.target.value)} placeholder="Months" min="1" style={{ ...INPUT, width: 100 }} />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...INPUT, width: 'auto' }} />
          <button type="button" onClick={() => void handleAdd()} style={{
            background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
          }}>Save</button>
        </div>
      )}
      {rows.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No maintenance tasks for this property</p>
      ) : rows.map((s) => (
        <div key={s.id} style={{ ...GLASS_CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderLeft: `3px solid ${STATUS_COLORS[s.status] ?? 'var(--text-tertiary)'}` }}>
          <div>
            <p style={{ margin: 0, fontWeight: 500 }}>{getTaskTypeLabel(s.taskType, s.taskTypeCustom)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: STATUS_COLORS[s.status] ?? 'var(--text-tertiary)' }}>
              {s.nextDueDate?.slice(0, 10) ?? 'No date'} · Every {s.intervalMonths}mo
            </p>
          </div>
          <button type="button" onClick={() => void handleComplete(s)} style={{
            background: 'transparent', color: 'var(--success)', border: '1px solid var(--success)',
            borderRadius: 4, padding: '4px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12,
          }}>Done</button>
        </div>
      ))}
    </div>
  );
}

// ── Costs Tab ──
function CostsTab({ costs, propertyId, onRefresh }: { costs: CostEntry[]; propertyId: string; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [cat, setCat] = useState<CostCategory>('maintenance');
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const summary = getCostSummary(costs);
  const lifetime = getLifetimeCosts(costs);

  const handleAdd = async () => {
    if (!desc.trim() || !amt) return;
    try {
      await doCreateCostEntry(crypto.randomUUID(), {
        propertyId, category: cat, description: desc.trim(),
        amountCents: Math.round(parseFloat(amt) * 100),
        vendor: vendor.trim() || undefined, costDate: date,
      });
      setShowAdd(false); setDesc(''); setAmt(''); setVendor(''); onRefresh();
    } catch { /* */ }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>This Month</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{cents(summary.totalCents)}</p>
        </div>
        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Lifetime</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cents(lifetime)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
        }}>{showAdd ? 'Cancel' : '+ Log Cost'}</button>
      </div>
      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={cat} onChange={(e) => setCat(e.target.value as CostCategory)} style={{ ...INPUT, width: 'auto' }}>
            {(['maintenance', 'repair', 'improvement', 'utility', 'other'] as CostCategory[]).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" style={{ ...INPUT, width: 200 }} />
          <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$" min="0" step="0.01" style={{ ...INPUT, width: 100 }} />
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" style={{ ...INPUT, width: 140 }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...INPUT, width: 'auto' }} />
          <button type="button" onClick={() => void handleAdd()} disabled={!desc.trim() || !amt} style={{
            background: desc.trim() && amt ? ACCENT : 'var(--border)',
            color: desc.trim() && amt ? 'var(--background)' : 'var(--text-tertiary)',
            border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
          }}>Save</button>
        </div>
      )}
      {costs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No costs logged for this property</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
            <thead><tr style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Description</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Amount</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}></th>
            </tr></thead>
            <tbody>
              {costs.slice(0, 30).map((c) => (
                <tr key={c.id} style={{ background: 'var(--glass)' }}>
                  <td style={{ padding: '8px 12px', fontSize: 14, color: 'var(--text-secondary)' }}>{c.costDate.slice(0, 10)}</td>
                  <td style={{ padding: '8px 12px' }}><span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{c.category}</span></td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.description}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{cents(c.amountCents)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button type="button" onClick={() => { void doDeleteCostEntry(c.id).then(onRefresh); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Insurance Tab ──
function InsuranceTab({ policies, ownershipType }: { policies: InsurancePolicy[]; ownershipType: 'own' | 'rent' }) {
  const active = getActivePolicies(policies);
  const expiring = getExpiringPolicies(policies, 90);
  const gaps = checkCoverageGaps(policies, ownershipType);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {gaps.length > 0 && (
        <div style={{ ...GLASS_CARD, borderLeft: `3px solid ${ACCENT}` }}>
          <p style={{ margin: 0, fontWeight: 600, color: ACCENT }}>Coverage Gaps</p>
          {gaps.map((g, i) => <p key={i} style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{g}</p>)}
        </div>
      )}
      {expiring.length > 0 && expiring.map((p) => (
        <div key={p.id} style={{ ...GLASS_CARD, borderLeft: '3px solid var(--danger)' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{p.provider} - {p.policyType}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--danger)' }}>Expires {p.endDate.slice(0, 10)}</p>
        </div>
      ))}
      {active.length === 0 && expiring.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No insurance policies yet</p>
      )}
      {active.filter((p) => !expiring.some((e) => e.id === p.id)).map((p) => (
        <div key={p.id} style={GLASS_CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{p.provider}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>#{p.policyNumber} · {p.policyType}</p>
            </div>
            <span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{p.policyType}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Coverage: {cents(p.coverageAmountCents)}</span>
            <span>Deductible: {cents(p.deductibleCents)}</span>
            <span>Premium: {cents(p.annualPremiumCents)}/yr</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {p.startDate.slice(0, 10)} - {p.endDate.slice(0, 10)} {p.autoRenew ? '(auto-renew)' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Documents Tab ──
function DocumentsTab({ documents }: { documents: HomeDocument[] }) {
  if (documents.length === 0) {
    return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No documents stored for this property</p>;
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {documents.map((d) => (
        <div key={d.id} style={{ ...GLASS_CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 500 }}>{d.title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {d.category} · {d.fileType}
              {d.expiryDate ? ` · Expires ${d.expiryDate.slice(0, 10)}` : ''}
            </p>
          </div>
          <span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{d.category}</span>
        </div>
      ))}
    </div>
  );
}

// ── Inventory Tab ──
function InventoryTab({ rooms, roomItems, propertyId, onRefresh }: { rooms: Room[]; roomItems: Record<string, InventoryItem[]>; propertyId: string; onRefresh: () => void }) {
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const allItems = Object.values(roomItems).flat();
  const inventoryValue = getPropertyInventoryValue(allItems);
  const totalValue = inventoryValue.totalEstimatedCents;

  const handleAddRoom = async () => {
    if (!roomName.trim()) return;
    try {
      await doCreateRoom(crypto.randomUUID(), { propertyId, name: roomName.trim() });
      setRoomName(''); setShowAddRoom(false); onRefresh();
    } catch { /* */ }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
          {rooms.length} rooms · {allItems.length} items · Total value: <span style={{ color: ACCENT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{cents(totalValue)}</span>
        </p>
        <button type="button" onClick={() => setShowAddRoom(!showAddRoom)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
        }}>{showAddRoom ? 'Cancel' : '+ Add Room'}</button>
      </div>
      {showAddRoom && (
        <div style={{ ...GLASS_CARD, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Room name" style={{ ...INPUT, flex: 1 }} />
          <button type="button" onClick={() => void handleAddRoom()} disabled={!roomName.trim()} style={{
            background: roomName.trim() ? ACCENT : 'var(--border)',
            color: roomName.trim() ? 'var(--background)' : 'var(--text-tertiary)',
            border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
          }}>Save</button>
        </div>
      )}
      {rooms.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No rooms added yet</p>
      ) : rooms.map((r) => {
        const items = roomItems[r.id] ?? [];
        const isOpen = expanded[r.id] ?? false;
        return (
          <div key={r.id} style={GLASS_CARD}>
            <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [r.id]: !isOpen }))} style={{
              background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer',
              display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: 0,
            }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{items.length} items · {isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && items.length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {items.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                    <span>{item.name} {item.brand ? `(${item.brand})` : ''}</span>
                    <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {item.estimatedValueCents ? cents(item.estimatedValueCents) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {isOpen && items.length === 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>No items in this room</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Appliances Tab ──
function AppliancesTab({ appliances, propertyId, onRefresh }: { appliances: Appliance[]; propertyId: string; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [cat, setCat] = useState<ApplianceCategory>('other');
  const needsAttention = getAppliancesNeedingAttention(appliances);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await doCreateAppliance(crypto.randomUUID(), {
        propertyId, name: name.trim(), brand: brand.trim() || undefined, category: cat,
      });
      setName(''); setBrand(''); setShowAdd(false); onRefresh();
    } catch { /* */ }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13,
        }}>{showAdd ? 'Cancel' : '+ Add Appliance'}</button>
      </div>
      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" style={{ ...INPUT, width: 200 }} />
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand" style={{ ...INPUT, width: 140 }} />
          <select value={cat} onChange={(e) => setCat(e.target.value as ApplianceCategory)} style={{ ...INPUT, width: 'auto' }}>
            {['hvac', 'kitchen', 'laundry', 'bathroom', 'outdoor', 'garage', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={() => void handleAdd()} disabled={!name.trim()} style={{
            background: name.trim() ? ACCENT : 'var(--border)',
            color: name.trim() ? 'var(--background)' : 'var(--text-tertiary)',
            border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
          }}>Save</button>
        </div>
      )}
      {needsAttention.length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--danger)' }}>Needs Attention</p>
          {needsAttention.map((a) => (
            <div key={a.id} style={{ ...GLASS_CARD, marginBottom: 4, borderLeft: '3px solid var(--danger)' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{a.name} {a.brand ? `(${a.brand})` : ''}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--danger)' }}>{a.condition} condition</p>
            </div>
          ))}
        </div>
      )}
      {appliances.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No appliances registered</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {appliances.filter((a) => !needsAttention.some((n) => n.id === a.id)).map((a) => {
            const warranty = getWarrantyStatus(a);
            return (
              <div key={a.id} style={GLASS_CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 500 }}>{a.name}</p>
                    {a.brand && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{a.brand} {a.modelNumber ?? ''}</p>}
                  </div>
                  <button type="button" onClick={() => { void doDeleteAppliance(a.id).then(onRefresh); }} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14,
                  }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <span style={{ background: 'var(--glass-strong)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{a.category}</span>
                  <span style={{
                    background: warranty === 'active' ? 'rgba(48,209,88,0.15)' : warranty === 'expiring_soon' ? 'rgba(217,119,6,0.15)' : 'var(--glass-strong)',
                    color: warranty === 'active' ? 'var(--success)' : warranty === 'expiring_soon' ? ACCENT : 'var(--text-tertiary)',
                    borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                  }}>{warranty}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
