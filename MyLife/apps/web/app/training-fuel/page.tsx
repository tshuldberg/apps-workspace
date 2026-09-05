import Link from 'next/link';
import { fetchTrainingFuelReport } from './actions';

const T = {
  bg: '#131318',
  surface: '#1B1B20',
  surfaceHigh: '#2A292F',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  dim: '#9F8E81',
  accent: '#FFB877',
  green: '#30D158',
  info: '#8BCFF0',
  border: 'rgba(255,255,255,0.08)',
};

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: T.accent }}>{value}</div>
      <div style={{ fontSize: 11, color: T.dim, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 }}>
        {label}
      </div>
      {hint ? <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

export default async function TrainingFuelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range === '30' ? 30 : 7;
  const report = await fetchTrainingFuelReport(range);

  const anyEnabled = report.workoutsEnabled || report.nutritionEnabled || report.medsEnabled;

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', color: T.text }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Training + Fuel</h1>
        <div style={{ fontSize: 13.5, color: T.textSecondary, marginTop: 4 }}>
          One report across workouts, food, and doses. Your data, composed.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[7, 30].map((r) => (
            <Link
              key={r}
              href={`/training-fuel?range=${r}`}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${report.rangeDays === r ? T.accent : T.border}`,
                background: report.rangeDays === r ? 'rgba(255,184,119,0.14)' : 'transparent',
                color: report.rangeDays === r ? T.accent : T.textSecondary,
              }}
            >
              Last {r} days
            </Link>
          ))}
        </div>
      </header>

      {!anyEnabled ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, color: T.textSecondary }}>
          Enable Workouts, Nutrition, or Meds in <Link href="/discover" style={{ color: T.info }}>Discover</Link> and
          this report will fill in from your real activity.
        </div>
      ) : (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            {report.workoutsEnabled ? (
              <>
                <Tile label="Training days" value={`${report.trainingDays} / ${report.rangeDays}`} />
                <Tile label="Current streak" value={`${report.currentStreak}d`} />
                <Tile
                  label="Volume"
                  value={report.totalVolume > 0 ? `${(report.totalVolume / 1000).toFixed(1)}k` : '0'}
                  hint="weight x reps, recorded sets"
                />
              </>
            ) : null}
            {report.nutritionEnabled ? (
              <>
                <Tile
                  label="Avg calories"
                  value={report.avgCalories !== null ? `${report.avgCalories}` : 'no logs'}
                  hint={report.calorieGoal !== null ? `goal ${Math.round(report.calorieGoal)}` : 'no goal set'}
                />
                <Tile
                  label="Avg protein"
                  value={report.avgProtein !== null ? `${report.avgProtein} g` : 'no logs'}
                />
                {report.calorieAdherencePct !== null ? (
                  <Tile
                    label="Calorie adherence"
                    value={`${report.calorieAdherencePct}%`}
                    hint="logged days within 10% of goal"
                  />
                ) : null}
              </>
            ) : null}
            {report.medsEnabled && report.medsAdherencePct !== null ? (
              <Tile label="Dose adherence" value={`${report.medsAdherencePct}%`} hint="of logged doses" />
            ) : null}
          </section>

          <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr 1fr',
                gap: 0,
                padding: '10px 16px',
                fontSize: 11,
                color: T.dim,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span>Day</span>
              <span>Trained</span>
              <span>Calories</span>
              <span>Protein</span>
              <span>Doses</span>
            </div>
            {report.days
              .slice()
              .reverse()
              .map((day) => (
                <div
                  key={day.date}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr 1fr',
                    padding: '10px 16px',
                    fontSize: 13.5,
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span style={{ color: T.textSecondary }}>{dayLabel(day.date)}</span>
                  <span style={{ color: day.trained ? T.green : T.dim }}>
                    {report.workoutsEnabled ? (day.trained ? 'Yes' : 'Rest') : '-'}
                  </span>
                  <span style={{ color: day.kcal !== null ? T.text : T.dim }}>
                    {day.kcal !== null ? `${day.kcal}` : '-'}
                  </span>
                  <span style={{ color: day.proteinG !== null ? T.text : T.dim }}>
                    {day.proteinG !== null ? `${day.proteinG} g` : '-'}
                  </span>
                  <span style={{ color: day.dosesLogged !== null ? T.text : T.dim }}>
                    {day.dosesLogged !== null ? `${day.dosesTaken}/${day.dosesLogged}` : '-'}
                  </span>
                </div>
              ))}
          </section>

          <div style={{ marginTop: 14, fontSize: 12, color: T.dim, lineHeight: 1.7 }}>
            {!report.workoutsEnabled ? 'Workouts is disabled, so training columns are empty. ' : ''}
            {!report.nutritionEnabled ? 'Nutrition is disabled, so fuel columns are empty. ' : ''}
            {!report.medsEnabled ? 'Meds is disabled, so the dose column is empty. ' : ''}
            A dash means nothing was logged that day; this report never fills gaps with invented numbers.
          </div>
        </>
      )}

      <nav style={{ marginTop: 24, display: 'flex', gap: 16 }}>
        <Link href="/" style={{ color: T.textSecondary, fontSize: 13 }}>
          &larr; Today
        </Link>
        <Link href="/workouts/progress" style={{ color: T.textSecondary, fontSize: 13 }}>
          Workout progress
        </Link>
        <Link href="/nutrition/trends" style={{ color: T.textSecondary, fontSize: 13 }}>
          Nutrition trends
        </Link>
      </nav>
    </main>
  );
}
