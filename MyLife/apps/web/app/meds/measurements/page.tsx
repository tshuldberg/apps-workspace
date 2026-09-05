'use client';

import Link from 'next/link';
import { fetchVitalsHubData } from '../actions';
import { RadialScore, TinySparkline } from '../charts';
import {
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsSectionTitle,
  MedsSymbol,
  formatClinicalDate,
  formatShortDate,
  formatPercent,
  useMedsLoader,
} from '../ui';

type VitalsData = Awaited<ReturnType<typeof fetchVitalsHubData>>;

function VitalsTile({
  title,
  value,
  note,
  href,
  color,
  trend,
}: {
  title: string;
  value: string;
  note: string;
  href: string;
  color: string;
  trend: Array<{ label: string; value: number }>;
}) {
  return (
    <MedsPanel tone="muted">
      <div className="meds-stack">
        <div className="meds-row" style={{ justifyContent: 'space-between' }}>
          <span className="meds-label">{title}</span>
          <Link href={href} style={{ color, fontSize: 13, fontWeight: 700 }}>
            Drill down
          </Link>
        </div>
        <strong style={{ fontSize: 32, letterSpacing: '-0.05em', color }}>{value}</strong>
        <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>{note}</span>
        <TinySparkline data={trend} dataKey="value" color={color} />
      </div>
    </MedsPanel>
  );
}

export default function MeasurementsPage() {
  const { data, loading, error } = useMedsLoader(fetchVitalsHubData, []);

  if (loading) {
    return <MedsLoadingState label="Loading vitals hub…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load the vitals hub.'} />;
  }

  const latestBP = data.tiles.bp.at(-1);
  const latestGlucose = data.tiles.glucose.at(-1);
  const latestInsulin = data.tiles.insulin.at(-1);
  const latestWeight = data.tiles.weight.at(-1);
  const latestHeartRate = data.tiles.heartRate.at(-1);
  const latestTemperature = data.tiles.temperature.at(-1);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-B"
        title="Vitals hub"
        description="The vitals surface uses the clinical dashboard shell to cluster blood pressure, glucose, insulin, weight, heart rate, and temperature into one operational canvas."
        actions={
          <>
            <MedsChip tone="cyan">{formatPercent(data.tiles.glucoseStats.inRange)} in range</MedsChip>
            <Link href="/meds/bp" className="meds-action">
              <MedsSymbol name="monitor_heart" size={18} color="#0E0E13" />
              BP analytics
            </Link>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="meds-grid-3">
            <VitalsTile
              title="Blood pressure"
              value={latestBP ? `${latestBP.systolic}/${latestBP.diastolic} mmHg` : 'No data'}
              note={latestBP ? formatClinicalDate(latestBP.measuredAt) : 'No recent readings'}
              href="/meds/bp"
              color="#22D3EE"
              trend={data.tiles.bp.slice(-14).map((item) => ({ label: item.measuredAt, value: item.systolic }))}
            />
            <VitalsTile
              title="Glucose"
              value={latestGlucose ? `${latestGlucose.value} ${latestGlucose.unit}` : 'No data'}
              note={latestGlucose ? `${latestGlucose.rangeStatus.replace(/_/g, ' ')} · ${formatClinicalDate(latestGlucose.measuredAt)}` : 'No recent readings'}
              href="/meds/glucose"
              color="#22D3EE"
              trend={data.tiles.glucose.slice(-18).map((item) => ({ label: item.measuredAt, value: item.value }))}
            />
            <VitalsTile
              title="Insulin"
              value={latestInsulin ? `${latestInsulin.units} IU` : 'No data'}
              note={latestInsulin ? `${latestInsulin.doseCategory} · ${formatClinicalDate(latestInsulin.administeredAt)}` : 'No recent doses'}
              href="/meds/insulin"
              color="#FFB877"
              trend={data.tiles.dailyInsulinTotals.map((item) => ({ label: item.date, value: item.total }))}
            />
            <VitalsTile
              title="Weight"
              value={latestWeight ? `${latestWeight.value} ${latestWeight.unit}` : 'No data'}
              note={latestWeight ? formatClinicalDate(latestWeight.measuredAt) : 'Track weight trends'}
              href="/meds/measurements"
              color="#8BCFF0"
              trend={data.tiles.weight.slice(-14).map((item) => ({ label: item.measuredAt, value: Number(item.value) }))}
            />
            <VitalsTile
              title="Heart rate"
              value={latestHeartRate ? `${latestHeartRate.value} ${latestHeartRate.unit}` : 'No data'}
              note={latestHeartRate ? formatClinicalDate(latestHeartRate.measuredAt) : 'Resting average pending'}
              href="/meds/measurements"
              color="#22D3EE"
              trend={data.tiles.heartRate.slice(-14).map((item) => ({ label: item.measuredAt, value: Number(item.value) }))}
            />
            <VitalsTile
              title="Temperature"
              value={latestTemperature ? `${latestTemperature.value} ${latestTemperature.unit}` : 'No data'}
              note={latestTemperature ? formatClinicalDate(latestTemperature.measuredAt) : 'Track fever risk'}
              href="/meds/measurements"
              color="#FFB877"
              trend={data.tiles.temperature.slice(-14).map((item) => ({ label: item.measuredAt, value: Number(item.value) }))}
            />
          </div>

          <MedsPanel>
            <MedsSectionTitle label="Recent events" title="Clinical timeline" />
            <div className="meds-list">
              {data.events.map((event) => (
                <div key={event.id} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 999, background: event.type === 'Insulin' ? '#FFB877' : '#22D3EE', marginTop: 6 }} />
                    <div className="meds-stack">
                      <strong style={{ fontSize: 15 }}>{event.title}</strong>
                      <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>
                        {event.type} · {formatClinicalDate(event.at)}
                      </span>
                    </div>
                  </div>
                  <Link href={event.href} style={{ color: '#FFB877', fontSize: 13, fontWeight: 700 }}>
                    Open
                  </Link>
                </div>
              ))}
            </div>
          </MedsPanel>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <MedsPanel tone="cyan">
            <MedsSectionTitle label="Wellness" title="Composite status" />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RadialScore
                value={data.wellness.composite}
                color="#22D3EE"
                label={data.wellness.trend}
                secondary={data.wellness.isConfident ? 'Confidence high' : 'Confidence building'}
              />
            </div>
          </MedsPanel>

          <MedsPanel tone="accent">
            <MedsSectionTitle label="Time in range" title="Glucose stability" />
            <div className="meds-list">
              <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>In range</span>
                <strong>{formatPercent(data.tiles.glucoseStats.inRange)}</strong>
              </div>
              <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>High</span>
                <strong>{formatPercent(data.tiles.glucoseStats.high + data.tiles.glucoseStats.veryHigh)}</strong>
              </div>
              <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>Low</span>
                <strong>{formatPercent(data.tiles.glucoseStats.low + data.tiles.glucoseStats.veryLow)}</strong>
              </div>
            </div>
          </MedsPanel>

          <MedsPanel>
            <MedsSectionTitle label="Daily insulin" title="14-day totals" />
            <div className="meds-list">
              {data.tiles.dailyInsulinTotals.slice(-6).reverse().map((item) => (
                <div key={item.date} className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <span>{formatShortDate(item.date)}</span>
                  <strong>{item.total} IU</strong>
                </div>
              ))}
            </div>
          </MedsPanel>
        </div>
      </div>
    </div>
  );
}
