'use client';

import Link from 'next/link';
import { fetchWeatherPageData } from '../actions';
import { ScatterCard } from '../charts';
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
  formatMaybeNumber,
  useMedsLoader,
} from '../ui';

type WeatherPageData = Awaited<ReturnType<typeof fetchWeatherPageData>>;

function temperatureLabel(value: number | null) {
  if (value == null) {
    return 'No data';
  }

  const fahrenheit = Math.round((value * 9) / 5 + 32);
  return `${fahrenheit}°F`;
}

export default function WeatherPage() {
  const { data, loading, error } = useMedsLoader(fetchWeatherPageData, []);

  if (loading) {
    return <MedsLoadingState label="Loading weather trigger analytics…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load weather analytics.'} />;
  }

  const current = data.insights.latestSnapshot ?? data.weatherHistory[0] ?? null;
  const topAlert = data.insights.alerts[0] ?? null;
  const scatterSets = [
    {
      id: 'pressure',
      title: 'Pressure vs symptom severity',
      data: data.insights.points
        .filter((item) => item.pressure != null)
        .map((item) => ({ pressure: item.pressure ?? 0, severity: item.severity })),
      xKey: 'pressure',
      yKey: 'severity',
      xName: 'Pressure (mb)',
      yName: 'Severity',
      color: '#22D3EE',
    },
    {
      id: 'temperature',
      title: 'Temperature vs symptom severity',
      data: data.insights.points
        .filter((item) => item.temperature != null)
        .map((item) => ({ temperature: item.temperature ?? 0, severity: item.severity })),
      xKey: 'temperature',
      yKey: 'severity',
      xName: 'Temperature (C)',
      yName: 'Severity',
      color: '#FFB877',
    },
    {
      id: 'humidity',
      title: 'Humidity vs symptom severity',
      data: data.insights.points
        .filter((item) => item.humidity != null)
        .map((item) => ({ humidity: item.humidity ?? 0, severity: item.severity })),
      xKey: 'humidity',
      yKey: 'severity',
      xName: 'Humidity (%)',
      yName: 'Severity',
      color: '#8BCFF0',
    },
    {
      id: 'wind',
      title: 'Wind speed vs symptom severity',
      data: data.insights.points
        .filter((item) => item.wind != null)
        .map((item) => ({ wind: item.wind ?? 0, severity: item.severity })),
      xKey: 'wind',
      yKey: 'severity',
      xName: 'Wind (km/h)',
      yName: 'Severity',
      color: '#30D158',
    },
  ] as const;

  return (
    <MedsPageWrap>
      <div style={{ display: 'grid', gap: 24 }}>
        <MedsPageLead
          eyebrow="Phase 8 / P8-D"
          title="Weather triggers"
          description="Environmental volatility stays readable in one surface: live conditions up front, scatter-based symptom correlations below, and trigger alerts stacked in operational order."
          actions={
            <>
              <MedsChip tone="cyan">{data.insights.points.length} linked snapshots</MedsChip>
              <Link href="/meds/pain" className="meds-action-secondary">
                <MedsSymbol name="healing" size={18} />
                Open symptom logs
              </Link>
            </>
          }
        />

        {topAlert ? (
          <MedsPanel tone={topAlert.level === 'high' ? 'danger' : topAlert.level === 'medium' ? 'accent' : 'muted'}>
            <div className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                <MedsSymbol
                  name={topAlert.level === 'high' ? 'warning' : 'cloud_alert'}
                  size={22}
                  color={topAlert.level === 'high' ? '#FFB4AB' : '#FFB877'}
                />
                <div className="meds-stack">
                  <span className="meds-label">Forecast trigger</span>
                  <strong style={{ fontSize: 18 }}>{topAlert.title}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>{topAlert.detail}</span>
                </div>
              </div>
              <MedsChip tone={topAlert.level === 'high' ? 'danger' : topAlert.level === 'medium' ? 'warning' : 'cyan'}>
                {topAlert.level}
              </MedsChip>
            </div>
          </MedsPanel>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 360px', gap: 18 }}>
          <MedsPanel tone="muted" style={{ minHeight: 340, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at top right, rgba(34,211,238,0.16), transparent 28%), radial-gradient(circle at bottom left, rgba(201,137,77,0.18), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent)',
              }}
            />
            <div style={{ position: 'relative', display: 'grid', gap: 18 }}>
              <MedsSectionTitle label="Current conditions" title={current?.weatherDescription ?? 'Awaiting latest weather snapshot'} />
              <div className="meds-grid-4">
                <MedsMetricCard
                  label="Temperature"
                  value={current ? temperatureLabel(current.temperatureC) : 'No data'}
                  note={current ? `${formatMaybeNumber(current.temperatureC, 'C')} recorded` : 'Capture conditions to activate'}
                  icon="thermostat"
                  tone="gold"
                />
                <MedsMetricCard
                  label="Pressure"
                  value={formatMaybeNumber(current?.pressureMb, 'mb')}
                  note={
                    current?.pressureChange3h != null
                      ? `${current.pressureChange3h > 0 ? '+' : ''}${formatMaybeNumber(current.pressureChange3h, 'mb')} over 3h`
                      : 'No pressure delta'
                  }
                  icon="airwave"
                  tone="cyan"
                />
                <MedsMetricCard
                  label="Humidity"
                  value={formatMaybeNumber(current?.humidityPercent, '%')}
                  note={current ? formatClinicalDate(current.capturedAt) : 'No recent capture'}
                  icon="humidity_percentage"
                  tone="cyan"
                />
                <MedsMetricCard
                  label="Wind"
                  value={formatMaybeNumber(current?.windSpeedKmh, 'km/h')}
                  note={current ? `Code ${current.weatherCode ?? 'N/A'}` : 'No wind sample'}
                  icon="air"
                  tone="success"
                />
              </div>
              <div style={{ color: 'rgba(214,195,181,0.78)', fontSize: 14, maxWidth: 720 }}>
                {data.insights.profile?.description ??
                  'Once enough linked symptom logs exist, this panel will surface a personalized pressure, humidity, or temperature trigger profile.'}
              </div>
            </div>
          </MedsPanel>

          <div style={{ display: 'grid', gap: 18 }}>
            <MedsPanel tone="accent">
              <MedsSectionTitle label="Correlation profile" title="Top factors" />
              {data.insights.correlations.length === 0 ? (
                <MedsEmptyState
                  title="Not enough linked events yet"
                  description="Link symptom logs to captured weather snapshots and this factor stack will score itself."
                  icon="analytics"
                />
              ) : (
                <div className="meds-list">
                  {data.insights.correlations.map((item) => (
                    <div key={item.factor} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="meds-stack">
                        <strong style={{ fontSize: 15, textTransform: 'capitalize' }}>{item.factor}</strong>
                        <span style={{ color: 'rgba(214,195,181,0.68)', fontSize: 12 }}>
                          {item.sampleSize} linked samples · {item.multiplier}x symptom multiplier
                        </span>
                      </div>
                      <MedsChip tone={Math.abs(item.coefficient) >= 0.4 ? 'danger' : Math.abs(item.coefficient) >= 0.25 ? 'warning' : 'cyan'}>
                        {item.coefficient.toFixed(3)}
                      </MedsChip>
                    </div>
                  ))}
                </div>
              )}
            </MedsPanel>

            <MedsPanel>
              <MedsSectionTitle label="Linking" title="Tracked symptom-weather links" />
              {data.links.length === 0 ? (
                <MedsEmptyState
                  title="No links captured"
                  description="Weather links are created automatically when pain, mood, or digestive symptoms are logged near a recorded weather snapshot."
                  icon="link"
                />
              ) : (
                <div className="meds-list">
                  {data.links.slice(0, 8).map((item) => (
                    <div key={item.id} className="meds-row" style={{ justifyContent: 'space-between' }}>
                      <div className="meds-stack">
                        <strong style={{ fontSize: 14 }}>Symptom link #{item.id.slice(-6)}</strong>
                        <span style={{ color: 'rgba(214,195,181,0.68)', fontSize: 12 }}>
                          Snapshot {item.weatherSnapshotId.slice(-6)} · symptom {item.symptomLogId.slice(-6)}
                        </span>
                      </div>
                      <span style={{ color: 'rgba(214,195,181,0.62)', fontSize: 12 }}>{formatClinicalDate(item.createdAt)}</span>
                    </div>
                  ))}
                  <div className="meds-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <Link href="/meds/pain" className="meds-action-secondary">
                      Pain
                    </Link>
                    <Link href="/meds/fodmap" className="meds-action-secondary">
                      Digestive
                    </Link>
                    <Link href="/meds/mood" className="meds-action-secondary">
                      Mood
                    </Link>
                  </div>
                </div>
              )}
            </MedsPanel>
          </div>
        </div>

        <div className="meds-grid-2">
          {scatterSets.map((chart) => (
            <ScatterCard
              key={chart.id}
              title={chart.title}
              label="Trigger correlation"
              data={chart.data}
              xKey={chart.xKey}
              yKey={chart.yKey}
              xName={chart.xName}
              yName={chart.yName}
              color={chart.color}
            />
          ))}
        </div>

        <MedsPanel>
          <MedsSectionTitle label="Alert timeline" title="Recent trigger intelligence" />
          {data.insights.alerts.length === 0 ? (
            <MedsEmptyState
              title="No trigger alerts generated"
              description="Environmental alerts will appear once recent weather and symptom history line up strongly enough."
              icon="cloud"
            />
          ) : (
            <div className="meds-list">
              {data.insights.alerts.map((item) => (
                <div key={item.id} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="meds-row" style={{ alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        marginTop: 6,
                        background: item.level === 'high' ? '#FF453A' : item.level === 'medium' ? '#FFB877' : '#22D3EE',
                      }}
                    />
                    <div className="meds-stack">
                      <strong style={{ fontSize: 15 }}>{item.title}</strong>
                      <span style={{ color: 'rgba(214,195,181,0.74)', fontSize: 13 }}>{item.detail}</span>
                    </div>
                  </div>
                  <MedsChip tone={item.level === 'high' ? 'danger' : item.level === 'medium' ? 'warning' : 'cyan'}>
                    {item.level}
                  </MedsChip>
                </div>
              ))}
            </div>
          )}
        </MedsPanel>
      </div>
    </MedsPageWrap>
  );
}
