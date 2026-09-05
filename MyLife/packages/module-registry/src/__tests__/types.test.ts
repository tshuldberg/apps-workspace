import { describe, expect, it } from 'vitest';
import { MODULE_IDS, MODULE_METADATA } from '../constants';
import { ModuleDefinitionSchema, ModuleIdSchema } from '../types';

describe('types schemas', () => {
  it('accepts every known module id', () => {
    for (const id of MODULE_IDS) {
      expect(ModuleIdSchema.parse(id)).toBe(id);
    }
  });

  it('rejects unknown module id values', () => {
    expect(() => ModuleIdSchema.parse('unknown-module')).toThrow();
  });

  it('accepts every entry in MODULE_METADATA', () => {
    for (const id of MODULE_IDS) {
      const parsed = ModuleDefinitionSchema.parse(MODULE_METADATA[id]);
      expect(parsed.id).toBe(id);
    }
  });

  it('rejects invalid accentColor values', () => {
    const invalid = {
      ...MODULE_METADATA.books,
      accentColor: 'orange',
    };

    expect(() => ModuleDefinitionSchema.parse(invalid)).toThrow();
  });

  it('accepts optional migration fields when valid', () => {
    const withMigrations = {
      ...MODULE_METADATA.books,
      schemaVersion: 2,
      migrations: [
        {
          version: 1,
          description: 'Create initial tables',
          up: ['CREATE TABLE test (id INTEGER);'],
          down: ['DROP TABLE test;'],
        },
      ],
    };

    const parsed = ModuleDefinitionSchema.parse(withMigrations);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.migrations?.[0]?.version).toBe(1);
  });

  it('rejects invalid migration versions', () => {
    const invalid = {
      ...MODULE_METADATA.books,
      migrations: [
        {
          version: 0,
          description: 'Invalid migration version',
          up: ['SELECT 1;'],
          down: ['SELECT 0;'],
        },
      ],
    };

    expect(() => ModuleDefinitionSchema.parse(invalid)).toThrow();
  });
});
