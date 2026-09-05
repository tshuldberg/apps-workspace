import { describe, it, expect } from 'vitest';
import {
  calculateBillableAmount,
  formatDuration,
  formatCurrency,
  generateTimeReport,
  generateCSV,
} from '../engine';

describe('time-tracking engine', () => {
  describe('calculateBillableAmount', () => {
    it('calculates correctly for 1 hour at $75/hr', () => {
      expect(calculateBillableAmount(3600, 7500)).toBe(7500);
    });

    it('calculates correctly for 1.5 hours at $100/hr', () => {
      expect(calculateBillableAmount(5400, 10000)).toBe(15000);
    });

    it('returns 0 for 0 seconds', () => {
      expect(calculateBillableAmount(0, 7500)).toBe(0);
    });

    it('returns 0 for $0/hr rate', () => {
      expect(calculateBillableAmount(3600, 0)).toBe(0);
    });

    it('handles very short sessions', () => {
      // 30 seconds at $120/hr = $1.00
      expect(calculateBillableAmount(30, 12000)).toBe(100);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds to hours with 2 decimals', () => {
      expect(formatDuration(5400)).toBe('1.50');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD', () => {
      expect(formatCurrency(7500, 'USD')).toBe('$75.00');
    });

    it('formats EUR', () => {
      expect(formatCurrency(5000, 'EUR')).toBe('€50.00');
    });

    it('formats GBP', () => {
      expect(formatCurrency(2500, 'GBP')).toBe('£25.00');
    });
  });

  describe('generateTimeReport', () => {
    const sessions = [
      { habitId: 'h1', startedAt: '2026-03-15T09:00:00', durationSeconds: 9000 },
      { habitId: 'h1', startedAt: '2026-03-16T14:00:00', durationSeconds: 6300 },
      { habitId: 'h2', startedAt: '2026-03-15T10:00:00', durationSeconds: 3600 },
    ];
    const projects = [
      { habitId: 'h1', projectName: 'Website', clientName: 'Acme', hourlyRateCents: 7500, currency: 'USD' },
      { habitId: 'h2', projectName: 'Writing', clientName: null, hourlyRateCents: 0, currency: 'USD' },
    ];

    it('aggregates correctly per project', () => {
      const report = generateTimeReport(sessions, projects, { start: '2026-03-01', end: '2026-03-31' });
      expect(report.projects.length).toBe(2);
      expect(report.projects[0].projectName).toBe('Website');
      expect(report.projects[0].entries.length).toBe(2);
    });

    it('calculates total hours and amount', () => {
      const report = generateTimeReport(sessions, projects, { start: '2026-03-01', end: '2026-03-31' });
      expect(report.totalSeconds).toBe(9000 + 6300 + 3600);
    });

    it('excludes sessions outside date range', () => {
      const report = generateTimeReport(sessions, projects, { start: '2026-03-16', end: '2026-03-31' });
      expect(report.projects[0].entries.length).toBe(1);
    });

    it('returns empty report for no matching sessions', () => {
      const report = generateTimeReport(sessions, projects, { start: '2026-04-01', end: '2026-04-30' });
      expect(report.projects.length).toBe(0);
      expect(report.totalSeconds).toBe(0);
    });
  });

  describe('generateCSV', () => {
    it('produces correct header and data rows', () => {
      const report = generateTimeReport(
        [{ habitId: 'h1', startedAt: '2026-03-15T09:00:00', durationSeconds: 3600 }],
        [{ habitId: 'h1', projectName: 'Web', clientName: 'Acme', hourlyRateCents: 7500, currency: 'USD' }],
        { start: '2026-03-01', end: '2026-03-31' },
      );
      const csv = generateCSV(report);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Project,Client,Date,Start Time,Duration (hours),Hourly Rate,Amount');
      expect(lines[1]).toContain('Web');
      expect(lines[lines.length - 1]).toContain('TOTAL');
    });
  });
});
