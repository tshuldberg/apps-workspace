'use client';

import Link from 'next/link';
import { fetchDashboardData } from './actions';
import { RadialScore, TinySparkline } from './charts';
import {
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsProgress,
  MedsSectionTitle,
  MedsSymbol,
  bpTone,
  formatClinicalDate,
  formatPercent,
  formatShortDate,
  frequencyLabel,
  glucoseTone,
  useMedsLoader,
} from './ui';

type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;

function DashboardVitals({ data }: { data: DashboardData }) {
  return (
    <div className="meds-grid-3">
      {data.vitalsGrid.slice(0, 3).map((card) => {
        const color =
          card.id === 'bp'
            ? bpTone(card.tone)
            : card.id === 'glucose'
              ? glucoseTone(card.tone)
              : '#22D3EE';

        return (
          <MedsPanel key={card.id} tone={card.id === 'glucose' ? 'cyan' : 'muted'}>
            <div className="meds-stack">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span className="meds-label">{card.label}</span>
                <Link href={card.href} style={{ color, fontSize: 12, fontWeight: 700 }}>
                  Open
                </Link>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontSize: 34, letterSpacing: '-0.05em', color }}>
                  {card.value}
                  {card.unit ? <span style={{ fontSize: 15, color: 'rgba(214,195,181,0.7)', marginLeft: 8 }}>{card.unit}</span> : null}
                </strong>
                <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>
                  {card.trend.length > 0 ? `${card.trend.length} recent readings` : 'Waiting for readings'}
                </span>
              </div>
              <TinySparkline data={card.trend} dataKey="value" color={color} />
            </div>
          </MedsPanel>
        );
      })}
    </div>
  );
}

export default function MedsDashboardPage() {
  const { data, loading, error } = useMedsLoader(fetchDashboardData, []);

  if (loading) {
    return <MedsLoadingState label="Loading clinical dashboard…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load the clinical dashboard.'} />;
  }

  const nextDose = data.summary.todaySchedule[0] ?? null;
  const lowSupplyAlert = data.lowSupply[0] ?? null;
  const insightAlert = data.insights.find((item) => item.severity !== 'info') ?? null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / Dashboard"
        title="Clinical dashboard"
        description="Warm gold chrome frames the operational shell. Cyan stays reserved for vitals, trend lines, dose markers, and alert intelligence."
        actions={
          <>
            <Link href="/meds/medications" className="meds-action">
              <MedsSymbol name="medication" size={18} color="#0E0E13" />
              Prescription list
            </Link>
            <Link href="/meds/history" className="meds-action-secondary">
              <MedsSymbol name="history" size={18} />
              Dose history
            </Link>
          </>
        }
      />

      {lowSupplyAlert ? (
        <MedsPanel tone="danger">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div className="meds-row">
              <MedsSymbol name="warning" size={20} color="#FFB4AB" />
              <div className="meds-stack">
                <span className="meds-label">Low supply alert</span>
                <strong style={{ fontSize: 18 }}>{lowSupplyAlert.name}</strong>
                <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>
                  {lowSupplyAlert.daysRemaining} days remaining before refill is due.
                </span>
              </div>
            </div>
            <Link href="/meds/medications" className="meds-action-secondary">
              Order refill
            </Link>
          </div>
        </MedsPanel>
      ) : insightAlert ? (
        <MedsPanel tone="danger">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div className="meds-row">
              <MedsSymbol name="warning" size={20} color="#FFB4AB" />
              <div className="meds-stack">
                <span className="meds-label">Clinical insight</span>
                <strong style={{ fontSize: 18 }}>{insightAlert.title}</strong>
                <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>{insightAlert.description}</span>
              </div>
            </div>
            <Link href="/meds/measurements" className="meds-action-secondary">
              Review metrics
            </Link>
          </div>
        </MedsPanel>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr) 320px',
          gap: 18,
        }}
      >
        <div style={{ display: 'grid', gap: 18 }}>
          <MedsPanel tone="accent">
            <MedsSectionTitle label="Next dose" title={nextDose ? nextDose.medicationName : 'No doses due'} />
            {nextDose ? (
              <div className="meds-stack">
                <strong style={{ fontSize: 42, letterSpacing: '-0.06em', color: '#FFB877' }}>
                  {formatClinicalDate(nextDose.scheduledTime)}
                </strong>
                <span style={{ color: 'rgba(214,195,181,0.78)', fontSize: 14 }}>
                  Status: {nextDose.status.replace(/_/g, ' ')}
                </span>
                <MedsChip tone="warning">{nextDose.dosage ?? 'Dose pending'}</MedsChip>
              </div>
            ) : (
              <div style={{ color: 'rgba(214,195,181,0.78)', fontSize: 14 }}>
                Today’s schedule is clear. Add prescriptions or reminders from the prescription list.
              </div>
            )}
          </MedsPanel>

          <MedsPanel>
            <MedsSectionTitle label="Today" title="Medication timeline" />
            <div className="meds-list">
              {data.summary.todaySchedule.length === 0 ? (
                <div style={{ color: 'rgba(159,142,129,0.9)', fontSize: 13 }}>No scheduled doses for today.</div>
              ) : (
                data.summary.todaySchedule.map((item) => (
                  <div key={`${item.medicationId}-${item.scheduledTime}`} style={{ display: 'grid', gap: 8 }}>
                    <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: item.status === 'taken' ? '#30D158' : item.status === 'pending' ? '#22D3EE' : '#FFB877',
                          marginTop: 6,
                        }}
                      />
                      <div className="meds-stack" style={{ flex: 1 }}>
                        <strong style={{ fontSize: 15 }}>{item.medicationName}</strong>
                        <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>
                          {formatClinicalDate(item.scheduledTime)}
                        </span>
                      </div>
                      <MedsChip tone={item.status === 'taken' ? 'success' : item.status === 'pending' ? 'cyan' : 'warning'}>
                        {item.status}
                      </MedsChip>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MedsPanel>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <DashboardVitals data={data} />

          <div className="meds-grid-2">
            <MedsPanel tone="cyan">
              <div style={{ display: 'grid', gap: 18 }}>
                <MedsSectionTitle label="Wellness" title="Composite score" />
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RadialScore
                    value={data.wellness.composite}
                    color="#22D3EE"
                    label={data.wellness.trend}
                    secondary={data.wellness.isConfident ? 'High confidence' : 'Low confidence'}
                  />
                </div>
                <div className="meds-list">
                  {data.wellness.components.map((component) => (
                    <div key={component.name} className="meds-stack">
                      <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14 }}>{component.name}</span>
                        <strong style={{ color: '#22D3EE' }}>{component.score}</strong>
                      </div>
                      <MedsProgress value={component.score} color="#22D3EE" />
                    </div>
                  ))}
                </div>
              </div>
            </MedsPanel>

            <MedsPanel>
              <MedsSectionTitle label="Insights" title="Correlation signals" />
              <div className="meds-list">
                {data.insights.slice(0, 4).map((item) => (
                  <div key={item.id} className="meds-stack">
                    <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 15 }}>{item.title}</strong>
                      <MedsChip tone={item.severity === 'alert' ? 'danger' : item.severity === 'warning' ? 'warning' : 'cyan'}>
                        {item.severity}
                      </MedsChip>
                    </div>
                    <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>{item.description}</span>
                  </div>
                ))}
              </div>
            </MedsPanel>
          </div>

          <MedsPanel>
            <MedsSectionTitle label="Prescriptions" title="Active medications" action={<Link href="/meds/medications" style={{ color: '#FFB877', fontSize: 13, fontWeight: 700 }}>View all</Link>} />
            <div className="meds-list">
              {data.prescriptions.map((item) => (
                <div key={item.id} className="meds-hover-card meds-row" style={{ alignItems: 'flex-start', padding: '16px 18px', borderRadius: 24, background: 'rgba(31,31,37,0.78)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(6,182,212,0.12)' }}>
                    <MedsSymbol name="medication" color="#22D3EE" />
                  </div>
                  <div className="meds-stack" style={{ flex: 1 }}>
                    <strong style={{ fontSize: 16 }}>{item.name}</strong>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                      {[item.dosage, item.unit].filter(Boolean).join(' ')} · {frequencyLabel(item.frequency)}
                    </span>
                    <MedsProgress value={item.adherenceRate} color="#22D3EE" />
                  </div>
                  <div className="meds-hover-actions" style={{ display: 'grid', gap: 8 }}>
                    <MedsChip tone={item.daysRemaining != null && item.daysRemaining <= 7 ? 'warning' : 'success'}>
                      {item.daysRemaining != null ? `${item.daysRemaining}d left` : 'Stable'}
                    </MedsChip>
                  </div>
                </div>
              ))}
            </div>
          </MedsPanel>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <MedsPanel>
            <MedsSectionTitle label="Adherence" title="Patient snapshot" />
            <div className="meds-list">
              <div className="meds-stack">
                <span className="meds-label">30-day adherence</span>
                <strong style={{ fontSize: 42, letterSpacing: '-0.06em', color: '#22D3EE' }}>
                  {formatPercent(data.overall.overallAdherence30d)}
                </strong>
                <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>
                  {data.summary.activeMedicationCount} active prescriptions · streak {data.summary.adherenceStreak} days
                </span>
              </div>

              <div className="meds-divider" />

              <div className="meds-list">
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>Today progress</span>
                  <strong>
                    {data.summary.todayProgress.taken}/{data.summary.todayProgress.total}
                  </strong>
                </div>
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>Mood entries</span>
                  <strong>{data.overall.moodEntries30d}</strong>
                </div>
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>Symptom logs</span>
                  <strong>{data.overall.symptomEntries30d}</strong>
                </div>
              </div>
            </div>
          </MedsPanel>

          <MedsPanel tone="accent">
            <MedsSectionTitle label="Refills" title="Upcoming supply events" />
            <div className="meds-list">
              {data.lowSupply.length === 0 ? (
                <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>All supplies are comfortably stocked.</span>
              ) : (
                data.lowSupply.slice(0, 4).map((alert) => (
                  <div key={alert.medicationId} className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <div className="meds-stack">
                      <strong style={{ fontSize: 15 }}>{alert.name}</strong>
                      <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                        {alert.daysRemaining} days left · {alert.pillCount} pills remaining
                      </span>
                    </div>
                    <MedsChip tone={alert.daysRemaining <= 3 ? 'danger' : 'warning'}>
                      {alert.daysRemaining}d
                    </MedsChip>
                  </div>
                ))
              )}
            </div>
          </MedsPanel>

          <MedsPanel>
            <MedsSectionTitle label="Appointments" title="Upcoming care" />
            <div className="meds-list">
              {data.appointments.length === 0 ? (
                <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>No upcoming appointments scheduled.</span>
              ) : (
                data.appointments.map((item) => (
                  <div key={item.id} className="meds-stack">
                    <strong style={{ fontSize: 15 }}>{item.title}</strong>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                      {formatClinicalDate(item.scheduledAt)} · {item.providerName ?? item.specialty ?? 'Provider TBD'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </MedsPanel>
        </div>
      </div>

      <MedsPanel>
        <MedsSectionTitle label="Operational focus" title="Clinical command strip" />
        <div className="meds-grid-4">
          {[
            { label: 'Generated', value: formatShortDate(data.generatedAt), note: 'Fresh route render' },
            { label: 'Vitals in range', value: `${data.vitalsGrid.filter((item) => item.tone === 'normal' || item.tone === 'in_range').length}/5`, note: 'Cyan remains data-only' },
            { label: 'Active alerts', value: String(data.summary.alerts.length), note: 'Clinical escalations' },
            { label: 'Top insight', value: data.insights[0]?.title ?? 'No urgent insight', note: 'Most important cue' },
          ].map((item) => (
            <div key={item.label} className="meds-kpi">
              <span className="meds-label">{item.label}</span>
              <strong className="meds-kpi-value" style={{ color: '#FFB877', fontSize: 28 }}>
                {item.value}
              </strong>
              <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </MedsPanel>
    </div>
  );
}
