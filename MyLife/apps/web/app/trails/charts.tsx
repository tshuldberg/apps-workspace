'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACCENT, ACCENT_LIGHT, INFO, TEXT, TEXT_SEC, TEXT_TER, WARNING, weatherTone } from './ui';

export function RecordingsTrendChart({
  data,
}: {
  data: Array<{ label: string; distance: number; elevation: number }>;
}) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="distanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT_LIGHT} stopOpacity={0.42} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INFO} stopOpacity={0.24} />
              <stop offset="100%" stopColor={INFO} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" stroke={TEXT_TER} tickLine={false} axisLine={false} />
          <YAxis stroke={TEXT_TER} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: 'rgba(19,19,24,0.96)',
              border: 'none',
              borderRadius: 16,
              boxShadow: '0 18px 32px rgba(0,0,0,0.28)',
            }}
            labelStyle={{ color: TEXT_SEC }}
            itemStyle={{ color: TEXT }}
          />
          <Area
            type="monotone"
            dataKey="distance"
            stroke={ACCENT_LIGHT}
            strokeWidth={2}
            fill="url(#distanceFill)"
            name="Distance km"
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke={INFO}
            strokeWidth={2}
            fill="url(#elevationFill)"
            name="Elevation m"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeatherForecastChart({
  data,
}: {
  data: Array<{ label: string; temperature: number; precipitation: number; condition: string }>;
}) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" stroke={TEXT_TER} tickLine={false} axisLine={false} />
          <YAxis stroke={TEXT_TER} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: 'rgba(19,19,24,0.96)',
              border: 'none',
              borderRadius: 16,
              boxShadow: '0 18px 32px rgba(0,0,0,0.28)',
            }}
            labelStyle={{ color: TEXT_SEC }}
            itemStyle={{ color: TEXT }}
          />
          <Bar dataKey="temperature" radius={[14, 14, 6, 6]} name="Temperature">
            {data.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={weatherTone(entry.condition)} />
            ))}
          </Bar>
          <Bar dataKey="precipitation" radius={[14, 14, 6, 6]} fill={WARNING} name="Precip %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
