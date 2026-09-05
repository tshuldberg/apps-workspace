import type { DinerExportData } from './types';

export function generateJsonExport(data: DinerExportData): string {
  return JSON.stringify(data, null, 2);
}

export function generateCsvExport(data: DinerExportData): string {
  const headers = ['Restaurant', 'Date', 'Party Size', 'Status'];
  const rows = data.reservations.map((r) =>
    [r.restaurantName, r.date, String(r.partySize), r.status].map(escapeCsv).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function getExportFilename(format: 'json' | 'csv'): string {
  const date = new Date().toISOString().split('T')[0];
  return `mylife-dining-export-${date}.${format}`;
}
