export type WaterSource = 'manual' | 'quick_add' | 'healthkit';

export interface WaterEntry {
  id: string;
  date: string;
  amountMl: number;
  source: WaterSource;
  createdAt: string;
}

export interface WaterDayTotal {
  date: string;
  totalMl: number;
  entryCount: number;
}

export interface WeeklyWaterTotals {
  days: WaterDayTotal[];
  goalMl: number;
}
