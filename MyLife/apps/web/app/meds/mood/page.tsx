'use client';

import { fetchMoodPageData } from '../actions';
import { DonutCard } from '../charts';
import {
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsSectionTitle,
  formatClinicalDate,
  useMedsLoader,
} from '../ui';

type MoodData = Awaited<ReturnType<typeof fetchMoodPageData>>;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function moodColor(pleasantness: string | null) {
  if (pleasantness === 'pleasant') return '#30D158';
  if (pleasantness === 'unpleasant') return '#FFB4AB';
  if (pleasantness === 'neutral') return '#FFB877';
  return 'rgba(53,52,58,0.9)';
}

export default function MoodPage() {
  const { data, loading, error } = useMedsLoader(fetchMoodPageData, []);

  if (loading) {
    return <MedsLoadingState label="Loading mood correlation…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load mood analytics.'} />;
  }

  const monthGroups = MONTH_LABELS.map((label, index) => ({
    label,
    entries: data.calendar.filter((entry) => Number(entry.date.slice(5, 7)) === index + 1),
  }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-D"
        title="Mood correlation"
        description="A year heatmap, activity and medication correlation panels, and a recent emotional timeline shaped by the clinical dashboard shell."
        actions={
          <>
            <MedsChip tone="cyan">{data.trends.averageScore.toFixed(1)} avg score</MedsChip>
            <MedsChip tone="warning">{data.trends.totalEntries} entries</MedsChip>
          </>
        }
      />

      <MedsPanel tone="cyan">
        <MedsSectionTitle label="Year heatmap" title={`${data.year} mood calendar`} />
        <div className="meds-grid-4">
          {monthGroups.map((month) => (
            <div key={month.label} className="meds-stack">
              <span className="meds-label">{month.label}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                {month.entries.map((entry) => (
                  <div
                    key={entry.date}
                    title={`${entry.date} ${entry.dominantMood ?? 'No data'}`}
                    style={{
                      height: 18,
                      borderRadius: 6,
                      background: moodColor(entry.pleasantness),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </MedsPanel>

      <div className="meds-grid-2">
        <DonutCard
          label="Activities"
          title="Contribution breakdown"
          data={data.correlations.activities.slice(0, 6).map((item) => ({
            name: item.activity,
            value: item.sampleSize,
            color: item.direction === 'positive' ? '#30D158' : item.direction === 'negative' ? '#FFB4AB' : '#FFB877',
          }))}
          centerLabel={`${data.correlations.activities.length} activities`}
        />

        <MedsPanel tone="accent">
          <MedsSectionTitle label="Medication impact" title="Mood vs medication" />
          <div className="meds-list">
            {data.correlations.medications.slice(0, 6).map((item) => (
              <div key={item.medicationId} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{item.medicationName}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    Before {item.beforeAverage?.toFixed(1) ?? 'n/a'} · after {item.afterAverage?.toFixed(1) ?? 'n/a'}
                  </span>
                </div>
                <MedsChip tone={item.direction === 'improved' ? 'success' : item.direction === 'declined' ? 'danger' : 'warning'}>
                  {item.direction}
                </MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>
      </div>

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Top activities" title="Activity correlations" />
          <div className="meds-list">
            {data.correlations.activities.slice(0, 8).map((item) => (
              <div key={item.activity} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{item.activity}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    Avg score {item.averageScore.toFixed(1)} · intensity {item.averageIntensity.toFixed(1)}
                  </span>
                </div>
                <MedsChip tone={item.direction === 'positive' ? 'success' : item.direction === 'negative' ? 'danger' : 'warning'}>
                  {item.direction}
                </MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>

        <MedsPanel>
          <MedsSectionTitle label="Timeline" title="Recent mood entries" />
          <div className="meds-list">
            {data.entries.slice(0, 12).map((entry) => (
              <div key={entry.id} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{entry.mood}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    {formatClinicalDate(entry.recordedAt)} · intensity {entry.intensity}/5
                  </span>
                  {entry.notes ? <span style={{ color: 'rgba(214,195,181,0.66)', fontSize: 12 }}>{entry.notes}</span> : null}
                </div>
                <MedsChip tone={entry.pleasantness === 'pleasant' ? 'success' : entry.pleasantness === 'unpleasant' ? 'danger' : 'warning'}>
                  {entry.pleasantness}
                </MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>
      </div>
    </div>
  );
}
