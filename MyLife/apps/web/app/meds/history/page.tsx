'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchHistoryPageData } from '../actions';
import {
  MedsChip,
  MedsEmptyState,
  MedsErrorState,
  MedsLoadingState,
  MedsMetricCard,
  MedsPageLead,
  MedsPageWrap,
  MedsPanel,
  MedsProgress,
  MedsSectionTitle,
  formatClinicalDate,
  formatPercent,
  formatShortDate,
  useMedsLoader,
} from '../ui';

type HistoryPageData = Awaited<ReturnType<typeof fetchHistoryPageData>>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const PERIOD_OPTIONS = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: 'month', label: 'Month', days: null },
] as const;

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const [year, monthValue] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthValue - 1, 1));
}

function shiftMonth(month: string, offset: number) {
  const [year, monthValue] = month.split('-').map(Number);
  const next = new Date(year, monthValue - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function aggregateDayStatus(day: HistoryPageData['calendar'][number]) {
  const statuses = day.meds.map((item) => item.status).filter((value) => value !== 'none');
  if (statuses.length === 0) {
    return 'none';
  }
  if (statuses.every((value) => value === 'taken' || value === 'late')) {
    return statuses.some((value) => value === 'late') ? 'late' : 'taken';
  }
  if (statuses.every((value) => value === 'missed')) {
    return 'missed';
  }
  return 'partial';
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'cyan' {
  if (status === 'taken') {
    return 'success';
  }
  if (status === 'late' || status === 'partial') {
    return 'warning';
  }
  if (status === 'missed' || status === 'skipped') {
    return 'danger';
  }
  return 'cyan';
}

function statusColor(status: string) {
  if (status === 'taken') {
    return 'rgba(48,209,88,0.62)';
  }
  if (status === 'late') {
    return 'rgba(255,184,119,0.76)';
  }
  if (status === 'missed') {
    return 'rgba(255,69,58,0.7)';
  }
  if (status === 'partial') {
    return 'rgba(6,182,212,0.46)';
  }
  return 'rgba(53,52,58,0.82)';
}

export default function HistoryPage() {
  const [month, setMonth] = useState(currentMonthKey());
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]['key']>('30d');
  const [medicationFilter, setMedicationFilter] = useState('all');
  const { data, loading, error } = useMedsLoader(() => fetchHistoryPageData(month), [month]);

  const filteredLogs = useMemo(() => {
    if (!data) {
      return [];
    }

    let next = data.recentLogs;
    if (medicationFilter !== 'all') {
      next = next.filter((item) => item.medicationId === medicationFilter);
    }

    const periodConfig = PERIOD_OPTIONS.find((item) => item.key === period);
    if (periodConfig?.days) {
      const cutoff = Date.now() - periodConfig.days * 24 * 60 * 60 * 1000;
      next = next.filter((item) => new Date(item.scheduledTime).getTime() >= cutoff);
    }

    return next;
  }, [data, medicationFilter, period]);

  const calendarCells = useMemo(() => {
    if (!data) {
      return [];
    }

    const [year, monthValue] = month.split('-').map(Number);
    const leading = new Date(year, monthValue - 1, 1).getDay();
    return [
      ...Array.from({ length: leading }, () => null),
      ...data.calendar,
    ];
  }, [data, month]);

  const summary = useMemo(() => {
    const taken = filteredLogs.filter((item) => item.status === 'taken').length;
    const late = filteredLogs.filter((item) => item.status === 'late').length;
    const missed = filteredLogs.filter((item) => item.status === 'skipped').length;
    const total = taken + late + missed;

    return {
      taken,
      late,
      missed,
      total,
      adherence: total > 0 ? Math.round(((taken + late) / total) * 100) : data?.overall.overallAdherence30d ?? 100,
    };
  }, [data, filteredLogs]);

  if (loading) {
    return <MedsLoadingState label="Loading dose history…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load dose history.'} />;
  }

  return (
    <MedsPageWrap>
      <div style={{ display: 'grid', gap: 24 }}>
        <MedsPageLead
          eyebrow="Phase 8 / P8-D"
          title="Dose history"
          description="Review adherence from the monthly heatmap downward: high-level scorecards, per-medication reliability, and the detailed dose ledger used for export workflows."
          actions={
            <>
              <button type="button" className="meds-action-secondary" onClick={() => setMonth((current) => shiftMonth(current, -1))}>
                Previous month
              </button>
              <input
                type="month"
                className="meds-inline-field"
                style={{ width: 180 }}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
              <button type="button" className="meds-action-secondary" onClick={() => setMonth((current) => shiftMonth(current, 1))}>
                Next month
              </button>
              <Link href="/meds/export" className="meds-action">
                Export report
              </Link>
            </>
          }
        />

        <div className="meds-grid-4">
          <MedsMetricCard label="Adherence" value={formatPercent(summary.adherence)} note={`${monthLabel(month)} view`} icon="timeline" tone="gold" />
          <MedsMetricCard label="Taken" value={summary.taken + summary.late} note={`${summary.late} late but completed`} icon="check_circle" tone="success" />
          <MedsMetricCard label="Missed" value={summary.missed} note={`${filteredLogs.length} tracked logs`} icon="warning" tone="danger" />
          <MedsMetricCard label="Active meds" value={data.overall.activeMedications} note={`${data.overall.totalMedications} total medications`} icon="medication" tone="cyan" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) 380px', gap: 18 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <MedsPanel>
              <MedsSectionTitle
                label="Calendar heatmap"
                title={monthLabel(month)}
                action={
                  <div className="meds-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <MedsChip tone="success">Taken</MedsChip>
                    <MedsChip tone="warning">Late / partial</MedsChip>
                    <MedsChip tone="danger">Missed</MedsChip>
                  </div>
                }
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {WEEKDAYS.map((day) => (
                  <span key={day} style={{ color: 'rgba(214,195,181,0.56)', fontSize: 12, textAlign: 'center' }}>
                    {day}
                  </span>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  gap: 8,
                }}
              >
                {calendarCells.map((cell, index) => {
                  if (!cell) {
                    return <div key={`empty-${index}`} style={{ minHeight: 84 }} />;
                  }

                  const status = aggregateDayStatus(cell);
                  const completed = cell.meds.filter((item) => item.status === 'taken' || item.status === 'late').length;
                  const actionable = cell.meds.filter((item) => item.status !== 'none').length;

                  return (
                    <div
                      key={cell.date}
                      className="meds-calendar-cell"
                      title={cell.meds.map((item) => `${item.name}: ${item.status}`).join(' | ')}
                      style={{ background: statusColor(status) }}
                    >
                      <div className="meds-row" style={{ justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: 14 }}>{new Date(cell.date).getDate()}</strong>
                        <MedsChip tone={statusTone(status)}>{status}</MedsChip>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12 }}>
                        {actionable === 0 ? 'No scheduled doses' : `${completed}/${actionable} complete`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </MedsPanel>

            <MedsPanel tone="muted">
              <MedsSectionTitle
                label="Dose ledger"
                title="Recent logs"
                action={
                  <div className="meds-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    {PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className="meds-pill-button"
                        style={{
                          background: period === option.key ? 'rgba(201,137,77,0.18)' : 'rgba(53,52,58,0.84)',
                          color: period === option.key ? '#FFB877' : 'rgba(214,195,181,0.72)',
                        }}
                        onClick={() => setPeriod(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                }
              />

              <div className="meds-row" style={{ marginBottom: 18 }}>
                <select
                  className="meds-select"
                  style={{ maxWidth: 280 }}
                  value={medicationFilter}
                  onChange={(event) => setMedicationFilter(event.target.value)}
                >
                  <option value="all">All medications</option>
                  {data.medications.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredLogs.length === 0 ? (
                <MedsEmptyState
                  title="No dose logs for this filter"
                  description="Adjust the medication filter or change the selected month to inspect a different adherence window."
                  icon="history"
                />
              ) : (
                <table className="meds-table">
                  <thead>
                    <tr>
                      <th>Medication</th>
                      <th>Scheduled</th>
                      <th>Status</th>
                      <th>Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="meds-stack">
                            <strong style={{ color: '#F0F0F5', fontSize: 14 }}>{item.medicationName}</strong>
                            {item.notes ? (
                              <span style={{ color: 'rgba(214,195,181,0.62)', fontSize: 12 }}>{item.notes}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>{formatClinicalDate(item.scheduledTime)}</td>
                        <td>
                          <MedsChip tone={statusTone(item.status)}>{item.status}</MedsChip>
                        </td>
                        <td>{item.actualTime ? formatClinicalDate(item.actualTime) : 'Not recorded'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </MedsPanel>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <MedsPanel tone="accent">
              <MedsSectionTitle label="Per medication" title="Adherence breakdown" />
              {data.medications.length === 0 ? (
                <MedsEmptyState
                  title="No active medications"
                  description="Once active prescriptions exist, this panel will show 30-day adherence and recent dose completion for each medication."
                  icon="medication"
                />
              ) : (
                <div className="meds-list">
                  {data.medications.map((item) => (
                    <div key={item.id} className="meds-stack">
                      <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: 15 }}>{item.name}</strong>
                        <span style={{ color: '#FFB877', fontSize: 13, fontWeight: 700 }}>
                          {formatPercent(item.stats.rate)}
                        </span>
                      </div>
                      <MedsProgress value={item.stats.rate} color="#22D3EE" />
                      <div className="meds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(214,195,181,0.68)', fontSize: 12 }}>
                          {item.stats.totalTaken} taken · {item.stats.totalLate} late · {item.stats.totalMissed} missed
                        </span>
                        <span style={{ color: 'rgba(214,195,181,0.52)', fontSize: 12 }}>
                          {item.recentLogs.length} recent events
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </MedsPanel>

            <MedsPanel>
              <MedsSectionTitle label="Operational notes" title="Clinical context" />
              <div className="meds-list">
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>Mood entries in 30d</span>
                  <strong>{data.overall.moodEntries30d}</strong>
                </div>
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>Symptom logs in 30d</span>
                  <strong>{data.overall.symptomEntries30d}</strong>
                </div>
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>Average mood score</span>
                  <strong>
                    {data.overall.averageMoodScore == null ? 'No data' : data.overall.averageMoodScore.toFixed(1)}
                  </strong>
                </div>
                <div className="meds-divider" />
                <Link href="/meds/medications" className="meds-action-secondary" style={{ justifyContent: 'center' }}>
                  Review prescriptions
                </Link>
              </div>
            </MedsPanel>
          </div>
        </div>
      </div>
    </MedsPageWrap>
  );
}
