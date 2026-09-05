'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchAllActiveProjects, fetchExportAllCSV, fetchSessionsForHabit } from '../actions';
import {
  EmptyState,
  GlassPanel,
  MetricTile,
  PageIntro,
  PrimaryButton,
  SectionHeading,
  SymbolIcon,
  formatCurrency,
  formatDurationMinutes,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, HB_XP, withAlpha } from '@mylife/habits';

type Project = {
  id: string;
  habitId: string;
  projectName: string;
  clientName: string | null;
  hourlyRate: number;
};

type TimedSession = {
  durationSeconds: number;
  startedAt: string;
};

export default function HabitsTimeReportsPage() {
  const [projects, setProjects] = useState<Array<Project & { totalSeconds: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const projectRows = (await fetchAllActiveProjects()) as Project[];
        const nextProjects = await Promise.all(projectRows.map(async (project) => {
          const sessions = ((await fetchSessionsForHabit(project.habitId)) as TimedSession[]) ?? [];
          const totalSeconds = sessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0);
          return { ...project, totalSeconds };
        }));
        setProjects(nextProjects);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load time reports.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const totalSeconds = useMemo(() => projects.reduce((sum, project) => sum + project.totalSeconds, 0), [projects]);
  const totalHours = totalSeconds / 3600;
  const billedTotal = useMemo(
    () => projects.reduce((sum, project) => sum + ((project.totalSeconds / 3600) * project.hourlyRate), 0),
    [projects],
  );

  const chartData = useMemo(() => projects.map((project, index) => ({
    label: project.projectName,
    value: project.totalSeconds,
    color: [HB_ACCENT_LIGHT, '#8BCFF0', HB_STREAK.fire, HB_XP, '#84CC16'][index % 5],
  })), [projects]);

  const handleExport = async () => {
    const csv = await fetchExportAllCSV();
    const blob = new Blob([csv as string], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'myhabits-time-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Time"
        title="Projects, total hours, and export-ready time logs."
        description="View every tracked project in one place, compare where your timed sessions actually go, and export the combined data when you need an external report."
        actions={
          <PrimaryButton onClick={() => void handleExport()}>
            <SymbolIcon color="#0E0E13" filled name="download" size={18} />
            Export CSV
          </PrimaryButton>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <MetricTile detail="across all active projects" label="Focused hours" tone={HB_ACCENT_LIGHT} value={totalHours.toFixed(1)} />
        <MetricTile detail="projects currently reporting time" label="Projects" tone={HB_STREAK.fire} value={String(projects.length)} />
        <MetricTile detail="estimated from project hourly rates" label="Billable value" tone={HB_XP} value={formatCurrency(billedTotal)} />
      </div>

      {error ? <EmptyState body={error} title="Time reports unavailable" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Relative allocation across projects." title="Distribution" />
          {loading ? (
            <div style={{ height: 260, borderRadius: 22, background: withAlpha('#ffffff', 0.04) }} />
          ) : chartData.length === 0 ? (
            <EmptyState body="Create a timed habit project to populate the report." title="No project data yet" />
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} dataKey="value" innerRadius={68} outerRadius={100} paddingAngle={4}>
                    {chartData.map((entry) => (
                      <Cell fill={entry.color} key={entry.label} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none', background: '#15151b', color: 'white' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassPanel>

        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Project list and running totals." title="Projects" />
          <div style={{ display: 'grid', gap: 10 }}>
            {projects.map((project) => (
              <div key={project.id} style={{ padding: 16, borderRadius: 20, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{project.projectName}</div>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{project.clientName ?? 'Personal project'}</div>
                  </div>
                  <div style={{ color: HB_ACCENT_LIGHT, fontWeight: 700 }}>{formatDurationMinutes(project.totalSeconds / 60)}</div>
                </div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>
                  {project.hourlyRate > 0 ? `${formatCurrency((project.totalSeconds / 3600) * project.hourlyRate)} estimated value` : 'No billable rate set'}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
