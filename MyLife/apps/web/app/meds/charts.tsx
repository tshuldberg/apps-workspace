'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MD_ACCENT, MD_ACCENT_LIGHT, MD_CHROME_GOLD_LIGHT, MD_TEXT, MD_TEXT_SECONDARY, withAlpha } from '@mylife/meds';
import { MedsEmptyState, MedsPanel, MedsSectionTitle, formatShortDate } from './ui';

type ChartDatum = Record<string, string | number | null>;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: string | number }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="meds-tooltip">
      {label != null ? (
        <div style={{ fontSize: 12, color: MD_TEXT_SECONDARY, marginBottom: 8 }}>{String(label)}</div>
      ) : null}
      <div style={{ display: 'grid', gap: 6 }}>
        {payload.map((item) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: item.color ?? MD_ACCENT_LIGHT,
              }}
            />
            <span style={{ color: MD_TEXT, fontSize: 13 }}>{item.name}</span>
            <strong style={{ marginLeft: 'auto', fontSize: 13 }}>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TinySparkline({
  data,
  dataKey,
  color = MD_ACCENT_LIGHT,
}: {
  data: ChartDatum[];
  dataKey: string;
  color?: string;
}) {
  if (data.length === 0) {
    return <div style={{ height: 40 }} />;
  }

  return (
    <div style={{ width: '100%', height: 42 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`spark-${dataKey}-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#spark-${dataKey}-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiLineCard({
  title,
  label,
  data,
  lines,
  xKey = 'label',
  yDomain,
  lowerBand,
  upperBand,
  footer,
}: {
  title: string;
  label?: string;
  data: ChartDatum[];
  lines: Array<{ key: string; name: string; color: string }>;
  xKey?: string;
  yDomain?: [number | 'auto', number | 'auto'];
  lowerBand?: number;
  upperBand?: number;
  footer?: ReactNode;
}) {
  return (
    <MedsPanel>
      <MedsSectionTitle label={label} title={title} />
      {data.length === 0 ? (
        <MedsEmptyState title="No chart data yet" description="Log more readings to render this trend." icon="show_chart" />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={withAlpha(MD_TEXT_SECONDARY, 0.08)} vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: withAlpha(MD_TEXT_SECONDARY, 0.6), fontSize: 12 }}
                  tickFormatter={(value) => typeof value === 'string' && value.includes('T') ? formatShortDate(value) : String(value)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: withAlpha(MD_TEXT_SECONDARY, 0.6), fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={yDomain}
                />
                {lowerBand != null && upperBand != null ? (
                  <ReferenceArea y1={lowerBand} y2={upperBand} fill={withAlpha(MD_ACCENT, 0.1)} />
                ) : null}
                <Tooltip content={<ChartTooltip />} />
                {lines.map((line) => (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.name}
                    stroke={line.color}
                    dot={false}
                    strokeWidth={3}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {footer}
        </div>
      )}
    </MedsPanel>
  );
}

export function DonutCard({
  title,
  label,
  data,
  centerLabel,
}: {
  title: string;
  label?: string;
  data: Array<{ name: string; value: number; color: string }>;
  centerLabel?: string;
}) {
  return (
    <MedsPanel>
      <MedsSectionTitle label={label} title={title} />
      {data.length === 0 || data.every((item) => item.value === 0) ? (
        <MedsEmptyState title="Nothing to segment yet" description="Once more events are logged this breakdown will appear." icon="donut_large" />
      ) : (
        <div className="meds-grid-2" style={{ alignItems: 'center' }}>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  stroke="none"
                  paddingAngle={3}
                >
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {centerLabel ? (
              <div style={{ display: 'grid', gap: 2 }}>
                <span className="meds-label">Summary</span>
                <strong style={{ fontSize: 28, letterSpacing: '-0.05em' }}>{centerLabel}</strong>
              </div>
            ) : null}
            {data.map((item) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: item.color }} />
                <span style={{ color: MD_TEXT_SECONDARY, fontSize: 13 }}>{item.name}</span>
                <strong style={{ marginLeft: 'auto', fontSize: 13, color: MD_TEXT }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </MedsPanel>
  );
}

export function ScatterCard({
  title,
  label,
  data,
  xKey,
  yKey,
  xName,
  yName,
  color = MD_ACCENT_LIGHT,
}: {
  title: string;
  label?: string;
  data: ChartDatum[];
  xKey: string;
  yKey: string;
  xName: string;
  yName: string;
  color?: string;
}) {
  return (
    <MedsPanel>
      <MedsSectionTitle label={label} title={title} />
      {data.length === 0 ? (
        <MedsEmptyState title="No correlation points" description="More linked events are needed before this scatter plot can render." icon="scatter_plot" />
      ) : (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={withAlpha(MD_TEXT_SECONDARY, 0.08)} />
              <XAxis
                type="number"
                dataKey={xKey}
                name={xName}
                tick={{ fill: withAlpha(MD_TEXT_SECONDARY, 0.6), fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey={yKey}
                name={yName}
                tick={{ fill: withAlpha(MD_TEXT_SECONDARY, 0.6), fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
              <Scatter data={data} fill={color} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </MedsPanel>
  );
}

export function RadialScore({
  value,
  label,
  color = MD_CHROME_GOLD_LIGHT,
  size = 168,
  secondary,
}: {
  value: number;
  label: string;
  color?: string;
  size?: number;
  secondary?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const angle = safeValue * 3.6;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(circle at center, rgba(14,14,19,1) 48%, transparent 49%),
          conic-gradient(${color} ${angle}deg, ${withAlpha(MD_CHROME_GOLD_LIGHT, 0.14)} ${angle}deg 360deg)`,
      }}
    >
      <div style={{ textAlign: 'center', display: 'grid', gap: 4 }}>
        <strong style={{ fontSize: 38, letterSpacing: '-0.05em', color }}>{safeValue}</strong>
        <span className="meds-label">{label}</span>
        {secondary ? <span style={{ fontSize: 12, color: MD_TEXT_SECONDARY }}>{secondary}</span> : null}
      </div>
    </div>
  );
}

export function HeatmapMatrix({
  title,
  label,
  cells,
  rows,
  columns,
  valueLabel,
}: {
  title: string;
  label?: string;
  cells: Array<{ row: number; column: number; value: number }>;
  rows: string[];
  columns: string[];
  valueLabel: string;
}) {
  const valueMap = new Map(cells.map((cell) => [`${cell.row}-${cell.column}`, cell.value]));
  const max = Math.max(0, ...cells.map((cell) => cell.value));

  return (
    <MedsPanel>
      <MedsSectionTitle label={label} title={title} />
      {cells.length === 0 ? (
        <MedsEmptyState title="No heatmap data" description="Once more readings are logged this hourly matrix will fill in." icon="grid_view" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `80px repeat(${columns.length}, minmax(0, 1fr))`,
              gap: 8,
              alignItems: 'center',
            }}
          >
            <div />
            {columns.map((column) => (
              <span key={column} style={{ fontSize: 11, color: MD_TEXT_SECONDARY, textAlign: 'center' }}>
                {column}
              </span>
            ))}
            {rows.map((row, rowIndex) => (
              <FragmentRow
                key={row}
                label={row}
                values={columns.map((_, columnIndex) => {
                  const value = valueMap.get(`${rowIndex}-${columnIndex}`) ?? 0;
                  const opacity = max > 0 ? Math.max(0.08, value / max) : 0.08;
                  return {
                    value,
                    opacity,
                    title: `${row} · ${columns[columnIndex]}: ${value} ${valueLabel}`,
                  };
                })}
              />
            ))}
          </div>
        </div>
      )}
    </MedsPanel>
  );
}

function FragmentRow({
  label,
  values,
}: {
  label: string;
  values: Array<{ value: number; opacity: number; title: string }>;
}) {
  return (
    <>
      <span style={{ fontSize: 12, color: MD_TEXT_SECONDARY }}>{label}</span>
      {values.map((item, index) => (
        <div
          key={`${label}-${index}`}
          title={item.title}
          style={{
            height: 28,
            borderRadius: 10,
            background: withAlpha(MD_ACCENT, item.opacity),
          }}
        />
      ))}
    </>
  );
}
