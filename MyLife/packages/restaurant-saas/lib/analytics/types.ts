export interface DailyMetrics {
  date: string;
  totalCovers: number;
  totalReservations: number;
  noShowCount: number;
  noShowRate: number;
  avgPartySize: number;
  avgTurnTimeMinutes: number;
  revpash: number; // revenue per available seat hour
}

export interface ChannelBreakdown {
  channel: string;
  count: number;
  noShowRate: number;
}

export interface DayPartHeatmap {
  hour: number;
  dayOfWeek: number;
  covers: number;
}

export interface ComparisonPeriod {
  current: number;
  previous: number;
  changePercent: number;
  trend: 'up' | 'down' | 'flat';
}
