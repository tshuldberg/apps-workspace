import type { ServerZoneLoad } from './types';

export interface ZoneInput {
  zone: string;
  activeCovers: number;
  capacity: number;
  lastCheckTouchMinutes: number[];
}

export function calculateZoneLoad(input: ZoneInput): ServerZoneLoad {
  const loadPercent = input.capacity > 0 ? Math.round((input.activeCovers / input.capacity) * 100) : 0;
  const avgResponse = input.lastCheckTouchMinutes.length > 0
    ? input.lastCheckTouchMinutes.reduce((a, b) => a + b, 0) / input.lastCheckTouchMinutes.length
    : 0;

  let status: ServerZoneLoad['status'] = 'green';
  if (loadPercent > 85 || avgResponse > 8) status = 'red';
  else if (loadPercent > 65 || avgResponse > 5) status = 'yellow';

  return {
    zone: input.zone,
    activeCovers: input.activeCovers,
    capacity: input.capacity,
    loadPercent,
    avgResponseMinutes: Math.round(avgResponse * 10) / 10,
    status,
  };
}

export function getZoneColor(status: ServerZoneLoad['status']): string {
  switch (status) {
    case 'green': return '#30D158';
    case 'yellow': return '#FFB877';
    case 'red': return '#DC2626';
  }
}
