import { describe, it, expect } from 'vitest';
import { parseMagicFill } from '../parser';

describe('parseMagicFill', () => {
  it('parses "Read 30 minutes every day" as timed daily', () => {
    const r = parseMagicFill('Read 30 minutes every day');
    expect(r.habitType).toBe('timed');
    expect(r.frequency).toBe('daily');
    expect(r.targetCount).toBe(1800);
    expect(r.name).toMatch(/Read/i);
  });

  it('parses "Drink 8 glasses of water" as measurable', () => {
    const r = parseMagicFill('Drink 8 glasses of water');
    expect(r.habitType).toBe('measurable');
    expect(r.targetCount).toBe(8);
    expect(r.unit).toBe('glass');
    expect(r.name).toMatch(/Drink/i);
  });

  it('parses "Meditate 15min Mon Wed Fri morning" with specific days and time', () => {
    const r = parseMagicFill('Meditate 15min Mon Wed Fri morning');
    expect(r.habitType).toBe('timed');
    expect(r.frequency).toBe('specific_days');
    expect(r.specificDays).toEqual(expect.arrayContaining(['mon', 'wed', 'fri']));
    expect(r.timeOfDay).toBe('morning');
    expect(r.targetCount).toBe(900);
  });

  it('parses "Learning guitar 15min 4x/week"', () => {
    const r = parseMagicFill('Learning guitar 15min 4x/week');
    expect(r.habitType).toBe('timed');
    expect(r.frequency).toBe('weekly');
    expect(r.targetCount).toBe(900);
  });

  it('parses "Walk 10000 steps daily" as measurable', () => {
    const r = parseMagicFill('Walk 10000 steps daily');
    expect(r.habitType).toBe('measurable');
    expect(r.targetCount).toBe(10000);
    expect(r.unit).toBe('step');
    expect(r.frequency).toBe('daily');
  });

  it('parses "No sugar" as negative', () => {
    const r = parseMagicFill('No sugar');
    expect(r.habitType).toBe('negative');
    expect(r.name).toMatch(/sugar/i);
  });

  it('parses "Don\'t smoke" as negative', () => {
    const r = parseMagicFill("Don't smoke");
    expect(r.habitType).toBe('negative');
  });

  it('parses "1 hour workout" as timed with 3600s', () => {
    const r = parseMagicFill('1 hour workout');
    expect(r.habitType).toBe('timed');
    expect(r.targetCount).toBe(3600);
  });

  it('parses "Write 500 words" as measurable', () => {
    const r = parseMagicFill('Write 500 words');
    expect(r.habitType).toBe('measurable');
    expect(r.targetCount).toBe(500);
    expect(r.unit).toBe('word');
  });

  it('parses "morning stretch" with time of day', () => {
    const r = parseMagicFill('morning stretch');
    expect(r.timeOfDay).toBe('morning');
  });

  it('parses "Journal before bed" as evening', () => {
    const r = parseMagicFill('Journal before bed');
    expect(r.timeOfDay).toBe('evening');
  });

  it('parses "Plank weekdays" with weekday schedule', () => {
    const r = parseMagicFill('Plank weekdays');
    expect(r.frequency).toBe('specific_days');
    expect(r.specificDays).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
  });

  it('parses "Yoga weekends" with weekend schedule', () => {
    const r = parseMagicFill('Yoga weekends');
    expect(r.frequency).toBe('specific_days');
    expect(r.specificDays).toEqual(['sat', 'sun']);
  });

  it('parses "3 times a week running" as weekly', () => {
    const r = parseMagicFill('3 times a week running');
    expect(r.frequency).toBe('weekly');
  });

  it('returns empty name and 0 confidence for empty string', () => {
    const r = parseMagicFill('');
    expect(r.name).toBe('');
    expect(r.confidence).toBe(0);
  });

  it('returns standard type for simple text like "Floss"', () => {
    const r = parseMagicFill('Floss');
    expect(r.habitType).toBe('standard');
    expect(r.name).toBe('Floss');
  });

  it('confidence increases with more extracted fields', () => {
    const simple = parseMagicFill('Floss');
    const rich = parseMagicFill('Read 30 minutes every day morning');
    expect(rich.confidence).toBeGreaterThan(simple.confidence);
  });

  it('parses "45min daily" as timed', () => {
    const r = parseMagicFill('45min daily');
    expect(r.habitType).toBe('timed');
    expect(r.targetCount).toBe(2700);
    expect(r.frequency).toBe('daily');
  });
});
