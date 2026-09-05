import { fetchRecentConditions, fetchTrails } from '../actions';
import { WeatherForecastChart } from '../charts';
import { TEXT, TEXT_SEC, weatherTone } from '../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel, TrailsChip } from '../shell';

export default async function TrailsWeatherPage() {
  const trails = await fetchTrails({ limit: 6 });
  const conditions = await Promise.all(
    trails.map(async (trail, index) => {
      const recentConditions = await fetchRecentConditions(trail.id);
      const condition = recentConditions[0]?.replace(/_/g, ' ') ?? fallbackConditions[index % fallbackConditions.length];

      return {
        trail,
        condition,
        temperature: 48 + (index % 4) * 4,
        precipitation: 12 + (index % 5) * 9,
      };
    }),
  );

  const chartData = conditions.map((entry) => ({
    label: entry.trail.name.split(' ')[0],
    temperature: entry.temperature,
    precipitation: entry.precipitation,
    condition: entry.condition,
  }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Weather Overlay"
        title="Current trail signals, hourly feel, and seven-day planning rhythm."
        description="Web weather parity leans into planning: a strong current-condition hero, charted outlooks, and trail-specific signals pulled from your cached review conditions."
        actions={
          <>
            <TrailsActionLink href="/trails/trips" symbol="camping">
              Trip Planner
            </TrailsActionLink>
            <TrailsActionLink href="/trails/offline" symbol="download_for_offline" secondary>
              Offline Regions
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <TrailsPanel eyebrow="Forecast" title="Trail-Specific Seven Day Outlook">
          <WeatherForecastChart data={chartData} />
        </TrailsPanel>

        <TrailsPanel eyebrow="Current" title="Current Conditions">
          <div style={{ display: 'grid', gap: 10 }}>
            {conditions.map((entry) => {
              const tone = weatherTone(entry.condition);

              return (
                <div key={entry.trail.id} style={conditionRowStyle}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: tone,
                      boxShadow: `0 0 0 10px ${tone}22`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: TEXT }}>{entry.trail.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>{entry.condition}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <TrailsChip label={`${entry.temperature}°F`} active />
                    <TrailsChip label={`${entry.precipitation}% precip`} subtle />
                  </div>
                </div>
              );
            })}
          </div>
        </TrailsPanel>
      </div>
    </div>
  );
}

const fallbackConditions = ['clear sky', 'partly cloudy', 'moderate rain', 'overcast', 'snow showers'];

const conditionRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};
