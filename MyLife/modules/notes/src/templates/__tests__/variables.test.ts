import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { expandVariables, buildVariableMap } from '../variables';
import { BUILT_IN_TEMPLATES } from '../built-in';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../../definition';
import {
  createTemplate,
  getTemplates,
  deleteTemplate,
  updateTemplate,
  incrementTemplateUseCount,
  seedBuiltInTemplates,
} from '../../db/crud';

describe('expandVariables', () => {
  const fixedDate = new Date(2026, 2, 22, 14, 30); // Mar 22, 2026 14:30
  const vars = buildVariableMap(fixedDate);

  it('expands {{date}} to ISO date', () => {
    expect(expandVariables('Today is {{date}}', vars)).toBe('Today is 2026-03-22');
  });

  it('expands {{time}} to HH:MM', () => {
    expect(expandVariables('Now: {{time}}', vars)).toBe('Now: 14:30');
  });

  it('expands {{day}} to day name', () => {
    expect(expandVariables('{{day}}', vars)).toBe('Sunday');
  });

  it('expands {{month}} to month name', () => {
    expect(expandVariables('{{month}}', vars)).toBe('March');
  });

  it('expands {{year}} to year', () => {
    expect(expandVariables('{{year}}', vars)).toBe('2026');
  });

  it('leaves unknown variables as literal text', () => {
    expect(expandVariables('{{unknown}}', vars)).toBe('{{unknown}}');
  });

  it('returns body unchanged when no variables', () => {
    expect(expandVariables('No variables here', vars)).toBe('No variables here');
  });

  it('expands multiple variables in one string', () => {
    const result = expandVariables('{{day}}, {{date}} at {{time}}', vars);
    expect(result).toBe('Sunday, 2026-03-22 at 14:30');
  });
});

describe('buildVariableMap', () => {
  it('builds a variable map with all expected keys', () => {
    const vars = buildVariableMap();
    expect(vars).toHaveProperty('date');
    expect(vars).toHaveProperty('time');
    expect(vars).toHaveProperty('day');
    expect(vars).toHaveProperty('month');
    expect(vars).toHaveProperty('year');
  });
});

describe('BUILT_IN_TEMPLATES', () => {
  it('contains 8 templates', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(8);
  });

  it('all have required fields', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.body).toBeTruthy();
    }
  });
});

// Template CRUD tests

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('seedBuiltInTemplates', () => {
  it('seeds 8 built-in templates', () => {
    seedBuiltInTemplates(testDb.adapter, BUILT_IN_TEMPLATES);
    const templates = getTemplates(testDb.adapter);
    expect(templates.filter((t) => t.isBuiltIn)).toHaveLength(8);
  });
});

describe('incrementTemplateUseCount', () => {
  it('increments use count', () => {
    createTemplate(testDb.adapter, 'tpl1', { name: 'Test', body: '' });
    incrementTemplateUseCount(testDb.adapter, 'tpl1');
    incrementTemplateUseCount(testDb.adapter, 'tpl1');
    const templates = getTemplates(testDb.adapter);
    const tpl = templates.find((t) => t.id === 'tpl1');
    expect(tpl!.useCount).toBe(2);
  });
});

describe('updateTemplate', () => {
  it('updates template fields', () => {
    createTemplate(testDb.adapter, 'tpl2', { name: 'Old', body: 'old body' });
    const updated = updateTemplate(testDb.adapter, 'tpl2', { name: 'New', description: 'desc', icon: '🎯' });
    expect(updated!.name).toBe('New');
    expect(updated!.description).toBe('desc');
    expect(updated!.icon).toBe('🎯');
  });

  it('returns null for non-existent template', () => {
    expect(updateTemplate(testDb.adapter, 'nope', { name: 'x' })).toBeNull();
  });
});

describe('deleteTemplate', () => {
  it('does not delete built-in templates', () => {
    seedBuiltInTemplates(testDb.adapter, BUILT_IN_TEMPLATES);
    deleteTemplate(testDb.adapter, 'builtin-meeting-notes');
    const templates = getTemplates(testDb.adapter);
    expect(templates.find((t) => t.id === 'builtin-meeting-notes')).toBeTruthy();
  });
});
