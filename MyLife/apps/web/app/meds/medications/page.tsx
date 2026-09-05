'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  doCreateMedicationExtended,
  doLogDoseV2,
  doUpdateMedication,
  fetchDashboardData,
  fetchPrescriptionListData,
} from '../actions';
import {
  MedsChip,
  MedsEmptyState,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsProgress,
  MedsSectionTitle,
  MedsSymbol,
  formatClinicalDate,
  formatShortDate,
  frequencyLabel,
  useMedsLoader,
} from '../ui';

type PrescriptionData = Awaited<ReturnType<typeof fetchPrescriptionListData>>;
type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;
type ScheduledDose = DashboardData['summary']['todaySchedule'][number];

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
] as const;

type VisibilityFilter = (typeof FILTER_OPTIONS)[number]['key'];

type MedicationGroup = 'prescription' | 'supplement';

// Mirrors modules/meds SUPPLEMENT_NOTE_TAG. Kept local so the meds module
// barrel does not need a new export wired for a small client-side label.
const SUPPLEMENT_NOTE_TAG = '[supplement]';

function classifyGroup(notes: string | null): MedicationGroup {
  return (notes ?? '').trimStart().startsWith(SUPPLEMENT_NOTE_TAG) ? 'supplement' : 'prescription';
}

const FREQUENCY_SLOT_HINTS: Record<string, string[]> = {
  daily: ['08:00'],
  twice_daily: ['08:00', '20:00'],
  weekly: ['08:00'],
  as_needed: [],
  custom: [],
};

/** Normalize a free-form time entry to HH:MM 24h, or null when unparseable. */
function normalizeTimeSlot(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimeSlots(raw: string): string[] {
  const slots = raw
    .split(/[,\n]/)
    .map((part) => normalizeTimeSlot(part))
    .filter((part): part is string => part != null);
  return Array.from(new Set(slots)).sort();
}

function formatSlotLabel(slot: string): string {
  const normalized = normalizeTimeSlot(slot);
  if (!normalized) return slot;
  const [hours, minutes] = normalized.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatScheduledTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function PrescriptionListPage() {
  const { data, loading, error, setData } = useMedsLoader(fetchPrescriptionListData, []);
  const [todaySchedule, setTodaySchedule] = useState<ScheduledDose[]>([]);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    dosage: '',
    unit: 'mg',
    frequency: 'daily',
    prescriber: '',
    pharmacy: '',
    pillCount: '',
    timeSlots: '',
    group: 'prescription' as MedicationGroup,
  });
  const [saving, setSaving] = useState(false);
  const [pendingDoseIds, setPendingDoseIds] = useState<string[]>([]);

  const loadSchedule = useCallback(async () => {
    try {
      const dashboard = await fetchDashboardData();
      setTodaySchedule(dashboard.summary.todaySchedule);
    } catch {
      setTodaySchedule([]);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const filtered = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.prescriptions.filter((item) => {
      const matchesVisibility =
        visibility === 'all'
          ? true
          : visibility === 'active'
            ? item.isActive
            : !item.isActive;
      const matchesSearch =
        search.trim().length === 0 ||
        item.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        item.prescriber?.toLowerCase().includes(search.trim().toLowerCase()) ||
        item.pharmacy?.toLowerCase().includes(search.trim().toLowerCase());

      return matchesVisibility && matchesSearch;
    });
  }, [data, search, visibility]);

  const focused = filtered.find((item) => item.id === focusId) ?? filtered[0] ?? null;

  const prescriptionItems = useMemo(
    () => filtered.filter((item) => classifyGroup(item.notes) === 'prescription'),
    [filtered],
  );
  const supplementItems = useMemo(
    () => filtered.filter((item) => classifyGroup(item.notes) === 'supplement'),
    [filtered],
  );

  // Doses still owed today: anything not yet taken or skipped. These are the
  // same items the app-wide reminder tray reads via getRegimenSummary.
  const dueToday = useMemo(
    () => todaySchedule.filter((dose) => dose.status === 'pending' || dose.status === 'late'),
    [todaySchedule],
  );
  const completedToday = useMemo(
    () => todaySchedule.filter((dose) => dose.status === 'taken'),
    [todaySchedule],
  );

  async function refresh() {
    const next = await fetchPrescriptionListData();
    setData(next);
  }

  async function handleTakeDose(id: string) {
    const now = new Date().toISOString();
    await doLogDoseV2(`dose-${Date.now()}`, {
      medicationId: id,
      scheduledTime: now,
      actualTime: now,
      status: 'taken',
    });
    await Promise.all([refresh(), loadSchedule()]);
  }

  async function handleTakeScheduledDose(dose: ScheduledDose) {
    if (pendingDoseIds.includes(dose.scheduledTime)) return;
    setPendingDoseIds((current) => [...current, dose.scheduledTime]);
    const now = new Date().toISOString();
    try {
      await doLogDoseV2(`dose-${Date.now()}`, {
        medicationId: dose.medicationId,
        // Log against the slot's canonical scheduled time so the engine marks
        // exactly this checklist item (and its tray entry) done.
        scheduledTime: dose.scheduledTime,
        actualTime: now,
        status: 'taken',
      });
      await Promise.all([refresh(), loadSchedule()]);
    } finally {
      setPendingDoseIds((current) => current.filter((value) => value !== dose.scheduledTime));
    }
  }

  async function handleSkipScheduledDose(dose: ScheduledDose) {
    if (pendingDoseIds.includes(dose.scheduledTime)) return;
    setPendingDoseIds((current) => [...current, dose.scheduledTime]);
    try {
      await doLogDoseV2(`dose-${Date.now()}`, {
        medicationId: dose.medicationId,
        scheduledTime: dose.scheduledTime,
        status: 'skipped',
      });
      await loadSchedule();
    } finally {
      setPendingDoseIds((current) => current.filter((value) => value !== dose.scheduledTime));
    }
  }

  async function handleArchive(id: string) {
    await doUpdateMedication(id, { isActive: false });
    await Promise.all([refresh(), loadSchedule()]);
  }

  async function handleAddPrescription() {
    if (!draft.name.trim()) {
      return;
    }

    const explicitSlots = parseTimeSlots(draft.timeSlots);
    // Fall back to a sensible default slot for schedulable frequencies so a
    // timed dose lands on the due-today checklist even if the user left the
    // time blank. as_needed and custom intentionally stay unscheduled.
    const timeSlots = explicitSlots.length > 0 ? explicitSlots : FREQUENCY_SLOT_HINTS[draft.frequency] ?? [];
    const notes =
      draft.group === 'supplement'
        ? SUPPLEMENT_NOTE_TAG
        : undefined;

    setSaving(true);
    try {
      await doCreateMedicationExtended(`med-${Date.now()}`, {
        name: draft.name.trim(),
        dosage: draft.dosage || undefined,
        unit: draft.unit || undefined,
        frequency: draft.frequency as 'daily' | 'twice_daily' | 'weekly' | 'as_needed' | 'custom',
        prescriber: draft.prescriber || undefined,
        pharmacy: draft.pharmacy || undefined,
        pillCount: draft.pillCount ? Number(draft.pillCount) : undefined,
        timeSlots: timeSlots.length > 0 ? timeSlots : undefined,
        notes,
      });
      setDraft({
        name: '',
        dosage: '',
        unit: 'mg',
        frequency: 'daily',
        prescriber: '',
        pharmacy: '',
        pillCount: '',
        timeSlots: '',
        group: 'prescription',
      });
      await Promise.all([refresh(), loadSchedule()]);
    } finally {
      setSaving(false);
    }
  }

  function renderRegistryPanel(label: string, title: string, items: typeof filtered) {
    const activeCount = items.filter((item) => item.isActive).length;
    return (
      <MedsPanel>
        <MedsSectionTitle
          label={label}
          title={title}
          action={<MedsChip tone="warning">{activeCount} active</MedsChip>}
        />
        {items.length === 0 ? (
          <MedsEmptyState
            icon={label === 'Supplements' ? 'nutrition' : 'medication'}
            title={label === 'Supplements' ? 'No supplements yet' : 'No prescriptions yet'}
            description={
              label === 'Supplements'
                ? 'Mark an item as a supplement when adding it to file it here instead of the prescription registry.'
                : 'Add a medication above to populate the prescription registry.'
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="meds-table">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Refills</th>
                  <th>Adherence</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setFocusId(item.id)}
                      className="meds-hover-card"
                      style={{
                        background: focused?.id === item.id ? 'rgba(31,31,37,0.84)' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            event.stopPropagation();
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, item.id]
                                : current.filter((value) => value !== item.id),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <div className="meds-stack">
                          <strong style={{ fontSize: 15 }}>{item.name}</strong>
                          <span style={{ color: 'rgba(159,142,129,0.92)', fontSize: 12 }}>
                            {item.prescriber ?? item.pharmacy ?? 'No provider info'}
                          </span>
                        </div>
                      </td>
                      <td>{[item.dosage, item.unit].filter(Boolean).join(' ') || 'TBD'}</td>
                      <td>{frequencyLabel(item.frequency)}</td>
                      <td>
                        <MedsChip tone={item.daysRemaining != null && item.daysRemaining <= 7 ? 'warning' : 'success'}>
                          {item.daysRemaining != null ? `${item.daysRemaining} days` : 'Stable'}
                        </MedsChip>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <div className="meds-stack">
                          <span>{item.adherenceRate}%</span>
                          <MedsProgress value={item.adherenceRate} color="#22D3EE" />
                        </div>
                      </td>
                      <td>
                        <div className="meds-hover-actions meds-row">
                          <button
                            type="button"
                            className="meds-icon-button"
                            aria-label={`Take ${item.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleTakeDose(item.id);
                            }}
                          >
                            <MedsSymbol name="check" size={18} />
                          </button>
                          <button
                            type="button"
                            className="meds-icon-button"
                            aria-label={`Archive ${item.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleArchive(item.id);
                            }}
                          >
                            <MedsSymbol name="archive" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MedsPanel>
    );
  }

  if (loading) {
    return <MedsLoadingState label="Loading prescriptions…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load prescriptions.'} />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-A"
        title="Medication list"
        description="A warm gold clinical operations rail on the left, with a bulk-action prescription table and contextual detail panel on the right."
        actions={
          <>
            <button type="button" className="meds-action-secondary">
              <MedsSymbol name="filter_alt" size={18} />
              Filters
            </button>
            <button type="button" className="meds-action" onClick={handleAddPrescription}>
              <MedsSymbol name="add" size={18} color="#0E0E13" />
              Add medication
            </button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 18 }}>
        <MedsPanel tone="muted">
          <MedsSectionTitle label="Filter rail" title="Prescription filters" />
          <div style={{ display: 'grid', gap: 14 }}>
            <input
              className="meds-inline-field"
              value={search}
              placeholder="Search medication, prescriber, pharmacy"
              onChange={(event) => setSearch(event.target.value)}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="meds-pill-button"
                  style={{
                    background: visibility === option.key ? 'rgba(201,137,77,0.18)' : 'rgba(53,52,58,0.84)',
                    color: visibility === option.key ? '#FFB877' : 'rgba(214,195,181,0.74)',
                  }}
                  onClick={() => setVisibility(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="meds-divider" />

            <div className="meds-stack">
              <span className="meds-label">Quick add</span>
              <input
                className="meds-inline-field"
                placeholder="Medication name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
              <div className="meds-grid-2">
                <input
                  className="meds-inline-field"
                  placeholder="Dose"
                  value={draft.dosage}
                  onChange={(event) => setDraft((current) => ({ ...current, dosage: event.target.value }))}
                />
                <input
                  className="meds-inline-field"
                  placeholder="Unit"
                  value={draft.unit}
                  onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
                />
              </div>
              <select
                className="meds-select"
                value={draft.frequency}
                onChange={(event) => setDraft((current) => ({ ...current, frequency: event.target.value }))}
              >
                <option value="daily">Daily</option>
                <option value="twice_daily">Twice daily</option>
                <option value="weekly">Weekly</option>
                <option value="as_needed">As needed</option>
                <option value="custom">Custom</option>
              </select>

              <div style={{ display: 'flex', gap: 8 }}>
                {(['prescription', 'supplement'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="meds-pill-button"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      background: draft.group === option ? 'rgba(201,137,77,0.18)' : 'rgba(53,52,58,0.84)',
                      color: draft.group === option ? '#FFB877' : 'rgba(214,195,181,0.74)',
                    }}
                    onClick={() => setDraft((current) => ({ ...current, group: option }))}
                  >
                    {option === 'prescription' ? 'Prescription' : 'Supplement'}
                  </button>
                ))}
              </div>

              <input
                className="meds-inline-field"
                placeholder="Times of day (e.g. 08:00, 20:00)"
                value={draft.timeSlots}
                onChange={(event) => setDraft((current) => ({ ...current, timeSlots: event.target.value }))}
              />
              <span style={{ color: 'rgba(159,142,129,0.92)', fontSize: 11 }}>
                Optional. 24h times build today&apos;s checklist and reminders. Leave blank to use the frequency default.
              </span>
              <input
                className="meds-inline-field"
                placeholder="Prescriber"
                value={draft.prescriber}
                onChange={(event) => setDraft((current) => ({ ...current, prescriber: event.target.value }))}
              />
              <input
                className="meds-inline-field"
                placeholder="Pharmacy"
                value={draft.pharmacy}
                onChange={(event) => setDraft((current) => ({ ...current, pharmacy: event.target.value }))}
              />
              <input
                className="meds-inline-field"
                placeholder="Pills remaining"
                type="number"
                value={draft.pillCount}
                onChange={(event) => setDraft((current) => ({ ...current, pillCount: event.target.value }))}
              />
              <button type="button" className="meds-action" onClick={handleAddPrescription} disabled={saving}>
                <MedsSymbol name="medication" size={18} color="#0E0E13" />
                {saving ? 'Saving…' : 'Create prescription'}
              </button>
            </div>
          </div>
        </MedsPanel>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 314px', gap: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            {selectedIds.length > 0 ? (
              <MedsPanel tone="cyan">
                <div className="meds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div className="meds-row">
                    <MedsChip tone="cyan">{selectedIds.length} selected</MedsChip>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                      Bulk actions are available for the current filtered prescription set.
                    </span>
                  </div>
                  <div className="meds-row">
                    <button type="button" className="meds-icon-button" aria-label="Export selection">
                      <MedsSymbol name="ios_share" size={18} />
                    </button>
                    <button type="button" className="meds-icon-button" aria-label="Archive selection">
                      <MedsSymbol name="inventory_2" size={18} />
                    </button>
                  </div>
                </div>
              </MedsPanel>
            ) : null}

            <MedsPanel tone="accent">
              <MedsSectionTitle
                label="Due today"
                title={dueToday.length > 0 ? `${dueToday.length} dose${dueToday.length === 1 ? '' : 's'} remaining` : 'All caught up'}
                action={
                  <MedsChip tone={dueToday.length > 0 ? 'warning' : 'success'}>
                    {completedToday.length}/{todaySchedule.length} taken
                  </MedsChip>
                }
              />
              {todaySchedule.length === 0 ? (
                <MedsEmptyState
                  icon="event_available"
                  title="No scheduled doses today"
                  description="Add a medication with a time of day above to build today's checklist and reminders."
                />
              ) : dueToday.length === 0 ? (
                <MedsEmptyState
                  icon="task_alt"
                  title="Every dose is handled"
                  description="You have logged all of today's scheduled doses."
                />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                  {dueToday.map((dose) => {
                    const busy = pendingDoseIds.includes(dose.scheduledTime);
                    return (
                      <li
                        key={`${dose.medicationId}-${dose.scheduledTime}`}
                        className="meds-row"
                        style={{
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 18,
                          background: 'rgba(31,31,37,0.7)',
                        }}
                      >
                        <div className="meds-stack" style={{ gap: 2 }}>
                          <strong style={{ fontSize: 15 }}>{dose.medicationName}</strong>
                          <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 12 }}>
                            {formatScheduledTime(dose.scheduledTime)}
                            {dose.dosage ? ` · ${dose.dosage}` : ''}
                            {dose.status === 'late' ? ' · Late' : ''}
                          </span>
                        </div>
                        <div className="meds-row" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="meds-action"
                            disabled={busy}
                            onClick={() => void handleTakeScheduledDose(dose)}
                          >
                            <MedsSymbol name="check_circle" size={18} color="#0E0E13" />
                            {busy ? 'Saving…' : 'Take'}
                          </button>
                          <button
                            type="button"
                            className="meds-action-secondary"
                            disabled={busy}
                            onClick={() => void handleSkipScheduledDose(dose)}
                          >
                            Skip
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </MedsPanel>

            {renderRegistryPanel('Prescription registry', `${prescriptionItems.length} prescriptions`, prescriptionItems)}
            {renderRegistryPanel('Supplements', `${supplementItems.length} supplements`, supplementItems)}
          </div>

          <MedsPanel tone="muted">
            <MedsSectionTitle label="Prescription detail" title={focused?.name ?? 'No selection'} />
            {focused ? (
              <div className="meds-stack" style={{ gap: 16 }}>
                <div className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="meds-stack">
                    <strong style={{ fontSize: 28, letterSpacing: '-0.05em' }}>{focused.name}</strong>
                    <span style={{ color: 'rgba(34,211,238,0.9)', fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                      {frequencyLabel(focused.frequency)}
                    </span>
                  </div>
                  <MedsChip tone={focused.daysRemaining != null && focused.daysRemaining <= 7 ? 'warning' : 'success'}>
                    {focused.isActive ? 'Active' : 'Archived'}
                  </MedsChip>
                </div>

                <div className="meds-grid-2">
                  <MedsPanel tone="base" style={{ padding: 18, borderRadius: 24 }}>
                    <span className="meds-label">Dose</span>
                    <strong style={{ fontSize: 28, letterSpacing: '-0.04em' }}>
                      {[focused.dosage, focused.unit].filter(Boolean).join(' ') || 'TBD'}
                    </strong>
                  </MedsPanel>
                  <MedsPanel tone="base" style={{ padding: 18, borderRadius: 24 }}>
                    <span className="meds-label">Next dose</span>
                    <strong style={{ fontSize: 18, lineHeight: 1.3 }}>{focused.nextDoseAt ? formatClinicalDate(focused.nextDoseAt) : 'Not scheduled'}</strong>
                  </MedsPanel>
                </div>

                <MedsPanel tone="accent" style={{ padding: 18, borderRadius: 24 }}>
                  <div className="meds-stack">
                    <span className="meds-label">Supply analytics</span>
                    <strong style={{ fontSize: 36, letterSpacing: '-0.05em', color: '#FFB877' }}>
                      {focused.daysRemaining != null ? `${focused.daysRemaining} days left` : 'Inventory stable'}
                    </strong>
                    <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>
                      {focused.refillDate
                        ? `Estimated refill by ${formatShortDate(focused.refillDate)}.`
                        : 'Refill cadence will appear after the first supply update.'}
                    </span>
                  </div>
                </MedsPanel>

                <div className="meds-list">
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Adherence</span>
                    <strong>{focused.adherenceRate}%</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Interaction warnings</span>
                    <strong>{focused.interactionCount}</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Provider</span>
                    <strong>{focused.prescriber ?? 'Unassigned'}</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Pharmacy</span>
                    <strong>{focused.pharmacy ?? 'Unassigned'}</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Inventory</span>
                    <strong>{focused.pillCount ?? 'Unknown'}</strong>
                  </div>
                </div>

                <div className="meds-row" style={{ gap: 10 }}>
                  <button type="button" className="meds-action-secondary" onClick={() => void handleTakeDose(focused.id)}>
                    <MedsSymbol name="check_circle" size={18} />
                    Take dose
                  </button>
                  <button type="button" className="meds-action-danger" onClick={() => void handleArchive(focused.id)}>
                    <MedsSymbol name="inventory_2" size={18} color="#FFB4AB" />
                    Archive
                  </button>
                </div>
              </div>
            ) : null}
          </MedsPanel>
        </div>
      </div>
    </div>
  );
}
