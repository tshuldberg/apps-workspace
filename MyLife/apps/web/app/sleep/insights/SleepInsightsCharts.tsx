'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type SleepInsightsChartPoint = {
  label: string;
  value: number | null;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ color?: string; name?: string; value?: string | number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipLabel}>{label}</div>
      {payload.map((item) => (
        <div key={item.name} style={styles.tooltipRow}>
          <span
            style={{
              ...styles.tooltipDot,
              background: item.color ?? '#A78BFA',
            }}
          />
          <span>{item.name}</span>
          <strong style={{ marginLeft: 'auto' }}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function SleepInsightsLineChart({
  emptyLabel,
  points,
  targetValue,
  title,
  valueLabel,
  yDomain,
}: {
  emptyLabel: string;
  points: SleepInsightsChartPoint[];
  targetValue?: number;
  title: string;
  valueLabel: string;
  yDomain?: [number | 'auto', number | 'auto'];
}) {
  const data = points.map((point) => ({
    label: point.label,
    value: point.value,
  }));
  const hasValues = data.some((point) => typeof point.value === 'number');

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        {targetValue !== undefined ? (
          <span style={styles.pill}>Target {targetValue}h</span>
        ) : null}
      </div>
      {!hasValues ? (
        <div style={styles.empty}>{emptyLabel}</div>
      ) : (
        <div style={styles.chartWrap}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={22}
                tick={{ fill: 'rgba(240,240,245,0.55)', fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={yDomain}
                tick={{ fill: 'rgba(240,240,245,0.55)', fontSize: 12 }}
                tickLine={false}
              />
              {targetValue !== undefined ? (
                <ReferenceLine
                  stroke="rgba(255,255,255,0.62)"
                  strokeDasharray="6 6"
                  y={targetValue}
                />
              ) : null}
              <Tooltip content={<ChartTooltip />} />
              <Line
                connectNulls
                dataKey="value"
                dot={{ fill: '#A78BFA', r: 4, stroke: '#0E0E13', strokeWidth: 2 }}
                isAnimationActive={false}
                name={valueLabel}
                stroke="#A78BFA"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

const styles = {
  card: {
    display: 'grid',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 20,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  pill: {
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.14)',
    color: '#E9DDFF',
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  chartWrap: {
    width: '100%',
    height: 280,
  },
  empty: {
    display: 'grid',
    minHeight: 220,
    placeItems: 'center',
    borderRadius: 16,
    background: 'rgba(10,10,15,0.36)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    textAlign: 'center',
  },
  tooltip: {
    display: 'grid',
    gap: 8,
    minWidth: 160,
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(10,10,15,0.94)',
    color: 'var(--text)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
  },
  tooltipLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  tooltipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text)',
    fontSize: 13,
  },
  tooltipDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
} as const;
