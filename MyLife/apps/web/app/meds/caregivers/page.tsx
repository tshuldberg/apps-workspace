'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  doCreateCaregiverLink,
  doDeleteCaregiverLink,
  doUpdateCaregiverRules,
  fetchCaregiverPageData,
} from '../actions';
import {
  MedsChip,
  MedsEmptyState,
  MedsErrorState,
  MedsLoadingState,
  MedsMetricCard,
  MedsPageLead,
  MedsPageWrap,
  MedsPanel,
  MedsSectionTitle,
  MedsSymbol,
  formatClinicalDate,
  useMedsLoader,
} from '../ui';

type CaregiverPageData = Awaited<ReturnType<typeof fetchCaregiverPageData>>;
type CaregiverRulesDraft = CaregiverPageData['alertConfig'];

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'other', label: 'Other' },
] as const;

const RULE_COPY = {
  missed_dose: {
    title: 'Missed dose escalations',
    description: 'Ping caregivers when a scheduled medication is still unresolved after the grace window.',
    icon: 'pill_off',
  },
  abnormal_bp: {
    title: 'Abnormal blood pressure',
    description: 'Escalate when systolic blood pressure crosses your configured intervention threshold.',
    icon: 'monitor_heart',
  },
  glucose_low: {
    title: 'Low glucose rescue',
    description: 'Notify caregivers when glucose drops below the low threshold and fast help may be needed.',
    icon: 'warning',
  },
  glucose_high: {
    title: 'High glucose follow-up',
    description: 'Alert the support network when readings spike above the high threshold.',
    icon: 'bloodtype',
  },
  missed_check_in: {
    title: 'Missed check-in',
    description: 'Use a longer window for situations where a daily status confirmation is expected.',
    icon: 'schedule',
  },
} satisfies Record<CaregiverRulesDraft['rules'][number]['key'], { title: string; description: string; icon: string }>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function relationshipLabel(value: (typeof RELATIONSHIP_OPTIONS)[number]['value'] | null) {
  return RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? 'Caregiver';
}

function alertTone(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'sent') {
    return 'success';
  }
  if (status === 'pending') {
    return 'warning';
  }
  return 'danger';
}

export default function CaregiversPage() {
  const { data, loading, error, setData } = useMedsLoader(fetchCaregiverPageData, []);
  const [rulesDraft, setRulesDraft] = useState<CaregiverRulesDraft | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    relationship: 'spouse' as (typeof RELATIONSHIP_OPTIONS)[number]['value'],
  });
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setRulesDraft(data.alertConfig);
    }
  }, [data]);

  const stats = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        label: 'Active caregivers',
        value: data.caregivers.filter((item) => item.isActive).length,
        note: `${data.contacts.length} medical contacts on file`,
        icon: 'family_restroom',
        tone: 'gold' as const,
      },
      {
        label: 'Enabled rules',
        value: data.alertConfig.rules.filter((item) => item.enabled).length,
        note: `${data.alertConfig.alertMethod.toUpperCase()} delivery path`,
        icon: 'notification_important',
        tone: 'cyan' as const,
      },
      {
        label: 'Recent alerts',
        value: data.alertHistory.length,
        note: `${data.alertHistory.filter((item) => item.status === 'sent').length} delivered`,
        icon: 'campaign',
        tone: 'warning' as const,
      },
      {
        label: 'Linked medications',
        value: data.medications.length,
        note: `${data.appointments.length} upcoming appointments`,
        icon: 'medication',
        tone: 'success' as const,
      },
    ];
  }, [data]);

  async function refresh() {
    const next = await fetchCaregiverPageData();
    setData(next);
    setRulesDraft(next.alertConfig);
    return next;
  }

  async function handleSaveRules() {
    if (!rulesDraft) {
      return;
    }

    setBusy(true);
    setSaveMessage(null);
    try {
      await doUpdateCaregiverRules(rulesDraft);
      await refresh();
      setSaveMessage('Alert rules saved locally.');
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : 'Unable to save caregiver rules.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCaregiver() {
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      setSaveMessage('Enter a name plus a phone number or email.');
      return;
    }

    setBusy(true);
    setSaveMessage(null);
    try {
      await doCreateCaregiverLink({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        relationship: form.relationship,
      });
      setForm({
        name: '',
        phone: '',
        email: '',
        relationship: 'spouse',
      });
      setShowComposer(false);
      await refresh();
      setSaveMessage('Caregiver connected.');
    } catch (createError) {
      setSaveMessage(createError instanceof Error ? createError.message : 'Unable to create caregiver.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCaregiver(id: string) {
    if (!window.confirm('Remove this caregiver connection?')) {
      return;
    }

    setBusy(true);
    setSaveMessage(null);
    try {
      await doDeleteCaregiverLink(id);
      await refresh();
      setSaveMessage('Caregiver removed.');
    } catch (deleteError) {
      setSaveMessage(deleteError instanceof Error ? deleteError.message : 'Unable to remove caregiver.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <MedsLoadingState label="Loading caregiver management…" />;
  }

  if (error || !data || !rulesDraft) {
    return <MedsErrorState message={error ?? 'Unable to load caregiver management.'} />;
  }

  return (
    <MedsPageWrap>
      <div style={{ display: 'grid', gap: 24 }}>
        <MedsPageLead
          eyebrow="Phase 8 / P8-D"
          title="Caregiver management"
          description="Coordinate who receives escalation alerts, tune thresholds, and keep critical support channels local to the device."
          actions={
            <>
              <MedsChip tone="cyan">{data.alertConfig.alertMethod.toUpperCase()} routing</MedsChip>
              <button type="button" className="meds-action" onClick={() => setShowComposer(true)}>
                <MedsSymbol name="person_add" size={18} color="#0E0E13" />
                Add caregiver
              </button>
            </>
          }
        />

        <div className="meds-grid-4">
          {stats.map((item) => (
            <MedsMetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>

        {saveMessage ? (
          <MedsPanel tone="muted">
            <div className="meds-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(214,195,181,0.82)', fontSize: 14 }}>{saveMessage}</span>
              <button type="button" className="meds-action-secondary" onClick={() => setSaveMessage(null)}>
                Dismiss
              </button>
            </div>
          </MedsPanel>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) 360px', gap: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <MedsPanel>
              <MedsSectionTitle
                label="Trusted contacts"
                title="Active caregivers"
                action={
                  <span style={{ color: 'rgba(214,195,181,0.66)', fontSize: 13 }}>
                    {data.caregivers.filter((item) => item.isActive).length} secure connections
                  </span>
                }
              />
              {data.caregivers.length === 0 ? (
                <MedsEmptyState
                  title="No caregivers connected yet"
                  description="Add a trusted person so missed-dose and abnormal-vitals alerts have somewhere to go."
                  icon="family_restroom"
                />
              ) : (
                <div className="meds-list">
                  {data.caregivers.map((caregiver) => (
                    <div
                      key={caregiver.id}
                      className="meds-hover-card"
                      style={{
                        display: 'grid',
                        gap: 16,
                        padding: 20,
                        borderRadius: 26,
                        background: 'rgba(31,31,37,0.82)',
                      }}
                    >
                      <div className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 20,
                              display: 'grid',
                              placeItems: 'center',
                              background: 'rgba(201,137,77,0.14)',
                              color: '#FFB877',
                              fontWeight: 800,
                            }}
                          >
                            {initials(caregiver.name)}
                          </div>
                          <div className="meds-stack">
                            <strong style={{ fontSize: 18 }}>{caregiver.name}</strong>
                            <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                              {relationshipLabel(caregiver.relationship)}
                            </span>
                          </div>
                        </div>

                        <div className="meds-hover-actions">
                          <button
                            type="button"
                            className="meds-action-secondary"
                            onClick={() => handleDeleteCaregiver(caregiver.id)}
                            disabled={busy}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="meds-grid-2">
                        <div className="meds-stack">
                          <span className="meds-label">Phone</span>
                          <span style={{ color: 'rgba(214,195,181,0.82)', fontSize: 14 }}>
                            {caregiver.phone ?? 'Not shared'}
                          </span>
                        </div>
                        <div className="meds-stack">
                          <span className="meds-label">Email</span>
                          <span style={{ color: 'rgba(214,195,181,0.82)', fontSize: 14 }}>
                            {caregiver.email ?? 'Not shared'}
                          </span>
                        </div>
                      </div>

                      <div className="meds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <MedsChip tone={caregiver.isActive ? 'success' : 'warning'}>
                          {caregiver.isActive ? 'Active' : 'Paused'}
                        </MedsChip>
                        <span style={{ color: 'rgba(214,195,181,0.62)', fontSize: 12 }}>
                          Added {formatClinicalDate(caregiver.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </MedsPanel>

            <MedsPanel tone="muted">
              <MedsSectionTitle label="Escalation log" title="Alert history" />
              {data.alertHistory.length === 0 ? (
                <MedsEmptyState
                  title="No caregiver alerts have fired"
                  description="When thresholds trip, the delivery history will land here with channel, medication, and status details."
                  icon="history"
                />
              ) : (
                <div className="meds-list">
                  {data.alertHistory.map((item) => (
                    <div key={item.id} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            marginTop: 6,
                            background:
                              item.status === 'sent'
                                ? '#30D158'
                                : item.status === 'pending'
                                  ? '#22D3EE'
                                  : '#FFB4AB',
                          }}
                        />
                        <div className="meds-stack">
                          <strong style={{ fontSize: 15 }}>{item.caregiverName}</strong>
                          <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>{item.message}</span>
                          <span style={{ color: 'rgba(214,195,181,0.52)', fontSize: 12 }}>
                            {item.medicationName ?? 'General alert'} · {item.deliveryMethod.toUpperCase()} · {formatClinicalDate(item.sentAt)}
                          </span>
                        </div>
                      </div>
                      <MedsChip tone={alertTone(item.status)}>{item.status}</MedsChip>
                    </div>
                  ))}
                </div>
              )}
            </MedsPanel>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <MedsPanel tone="accent">
              <MedsSectionTitle
                label="Alert rules"
                title="Escalation thresholds"
                action={
                  <button type="button" className="meds-action-secondary" onClick={handleSaveRules} disabled={busy}>
                    Save rules
                  </button>
                }
              />

              <div className="meds-stack">
                <span className="meds-label">Delivery method</span>
                <select
                  className="meds-select"
                  value={rulesDraft.alertMethod}
                  onChange={(event) =>
                    setRulesDraft((current) =>
                      current
                        ? {
                            ...current,
                            alertMethod: event.target.value as CaregiverRulesDraft['alertMethod'],
                          }
                        : current,
                    )
                  }
                >
                  <option value="both">SMS and email</option>
                  <option value="sms">SMS only</option>
                  <option value="email">Email only</option>
                </select>
              </div>

              <div className="meds-list" style={{ marginTop: 16 }}>
                {rulesDraft.rules.map((rule) => (
                  <details
                    key={rule.key}
                    open
                    style={{
                      padding: 18,
                      borderRadius: 22,
                      background: 'rgba(31,31,37,0.72)',
                    }}
                  >
                    <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
                      <div className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 16,
                              display: 'grid',
                              placeItems: 'center',
                              background: 'rgba(6,182,212,0.12)',
                            }}
                          >
                            <MedsSymbol name={RULE_COPY[rule.key].icon} color="#22D3EE" />
                          </div>
                          <div className="meds-stack">
                            <strong style={{ fontSize: 15 }}>{RULE_COPY[rule.key].title}</strong>
                            <span style={{ color: 'rgba(214,195,181,0.68)', fontSize: 12 }}>
                              {RULE_COPY[rule.key].description}
                            </span>
                          </div>
                        </div>
                        <label className="meds-row" style={{ gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(event) =>
                              setRulesDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      rules: current.rules.map((item) =>
                                        item.key === rule.key ? { ...item, enabled: event.target.checked } : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                          <span style={{ color: 'rgba(214,195,181,0.8)', fontSize: 12 }}>Enabled</span>
                        </label>
                      </div>
                    </summary>

                    <div className="meds-grid-2" style={{ marginTop: 16 }}>
                      <div className="meds-stack">
                        <span className="meds-label">Threshold</span>
                        <input
                          type="number"
                          className="meds-inline-field"
                          value={rule.threshold}
                          onChange={(event) =>
                            setRulesDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    rules: current.rules.map((item) =>
                                      item.key === rule.key
                                        ? {
                                            ...item,
                                            threshold: Number(event.target.value || '0'),
                                          }
                                        : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      </div>
                      <div className="meds-stack">
                        <span className="meds-label">Unit</span>
                        <input
                          className="meds-inline-field"
                          value={rule.unit}
                          onChange={(event) =>
                            setRulesDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    rules: current.rules.map((item) =>
                                      item.key === rule.key ? { ...item, unit: event.target.value } : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </MedsPanel>

            <MedsPanel>
              <MedsSectionTitle label="Privacy" title="Local sharing posture" />
              <div className="meds-list">
                <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                  <MedsSymbol name="shield_lock" color="#FFB877" />
                  <div className="meds-stack">
                    <strong style={{ fontSize: 15 }}>On-device routing</strong>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                      Alert rules, thresholds, and contact details stay in the local meds database until an alert is actually dispatched.
                    </span>
                  </div>
                </div>
                <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                  <MedsSymbol name="contact_phone" color="#22D3EE" />
                  <div className="meds-stack">
                    <strong style={{ fontSize: 15 }}>Clinical support graph</strong>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                      {data.contacts.length} provider contacts and {data.appointments.length} upcoming appointments are available to cross-check escalation paths.
                    </span>
                  </div>
                </div>
                <Link href="/meds/settings" className="meds-action-secondary" style={{ justifyContent: 'center' }}>
                  Module settings
                </Link>
              </div>
            </MedsPanel>
          </div>
        </div>
      </div>

      {showComposer ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,10,15,0.76)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            zIndex: 50,
          }}
        >
          <MedsPanel tone="accent" style={{ width: '100%', maxWidth: 560 }}>
            <MedsSectionTitle
              label="New connection"
              title="Add caregiver"
              action={
                <button type="button" className="meds-action-secondary" onClick={() => setShowComposer(false)}>
                  Close
                </button>
              }
            />

            <div className="meds-list">
              <input
                className="meds-inline-field"
                placeholder="Full name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <div className="meds-grid-2">
                <input
                  className="meds-inline-field"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
                <input
                  className="meds-inline-field"
                  placeholder="Email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
              <select
                className="meds-select"
                value={form.relationship}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    relationship: event.target.value as (typeof RELATIONSHIP_OPTIONS)[number]['value'],
                  }))
                }
              >
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="meds-action" onClick={handleCreateCaregiver} disabled={busy}>
                <MedsSymbol name="person_add" size={18} color="#0E0E13" />
                Save caregiver
              </button>
            </div>
          </MedsPanel>
        </div>
      ) : null}
    </MedsPageWrap>
  );
}
