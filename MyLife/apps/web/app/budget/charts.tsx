'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Formatter, NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { ACCENT_LIGHT, BORDER, GLASS, INFO, MONEY, TEXT, TEXT_SECONDARY } from './ui';

type Datum = {
  color?: string;
  label: string;
  value: number;
};

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    notation: 'compact',
    style: 'currency',
  }).format(value / 100);
}

function tooltipStyle() {
  return {
    background: 'rgba(19,19,24,0.96)',
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    color: TEXT,
  };
}

function normalizeChartValue(value: ValueType | undefined) {
  if (Array.isArray(value)) {
    return Number(value[0] ?? 0);
  }
  return Number(value ?? 0);
}

const amountFormatter: Formatter<ValueType, NameType> = (value) => [
  formatCompact(normalizeChartValue(value)),
  'Amount',
];

const valueFormatter: Formatter<ValueType, NameType> = (value) => [
  formatCompact(normalizeChartValue(value)),
  'Value',
];

export function BudgetDonutChart({
  data,
  emptyLabel = 'No data',
}: {
  data: Datum[];
  emptyLabel?: string;
}) {
  if (data.length === 0 || data.every((entry) => entry.value <= 0)) {
    return (
      <div
        style={{
          alignItems: 'center',
          color: TEXT_SECONDARY,
          display: 'grid',
          height: 260,
          justifyItems: 'center',
          textAlign: 'center',
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ height: 260, width: '100%' }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            dataKey="value"
            innerRadius={68}
            outerRadius={96}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color ?? ACCENT_LIGHT} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={amountFormatter}
            itemStyle={{ color: TEXT }}
            labelStyle={{ color: TEXT_SECONDARY }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetLineChart({
  color = MONEY,
  data,
}: {
  color?: string;
  data: Datum[];
}) {
  if (data.length === 0) {
    return (
      <div
        style={{
          alignItems: 'center',
          color: TEXT_SECONDARY,
          display: 'grid',
          height: 240,
          justifyItems: 'center',
        }}
      >
        No trend data yet.
      </div>
    );
  }

  return (
    <div style={{ height: 240, width: '100%' }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ bottom: 0, left: -12, right: 0, top: 4 }}>
          <CartesianGrid stroke={GLASS} strokeDasharray="4 8" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: TEXT_SECONDARY, fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: TEXT_SECONDARY, fontSize: 12 }}
            tickFormatter={formatCompact}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={valueFormatter}
            itemStyle={{ color: TEXT }}
            labelStyle={{ color: TEXT_SECONDARY }}
          />
          <Line
            dataKey="value"
            dot={{ fill: color, r: 3 }}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetBarChart({
  color = INFO,
  data,
}: {
  color?: string;
  data: Datum[];
}) {
  if (data.length === 0) {
    return (
      <div
        style={{
          alignItems: 'center',
          color: TEXT_SECONDARY,
          display: 'grid',
          height: 240,
          justifyItems: 'center',
        }}
      >
        No comparison data yet.
      </div>
    );
  }

  return (
    <div style={{ height: 240, width: '100%' }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ bottom: 0, left: -12, right: 0, top: 4 }}>
          <CartesianGrid stroke={GLASS} strokeDasharray="4 8" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: TEXT_SECONDARY, fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: TEXT_SECONDARY, fontSize: 12 }}
            tickFormatter={formatCompact}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={valueFormatter}
            itemStyle={{ color: TEXT }}
            labelStyle={{ color: TEXT_SECONDARY }}
          />
          <Bar dataKey="value" fill={color} radius={[12, 12, 4, 4]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
