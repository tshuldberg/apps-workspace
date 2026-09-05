import { describe, it, expect, vi } from 'vitest';
import { ModuleRegistry } from '../registry';
import { MODULE_IDS, FREE_MODULES, MODULE_METADATA } from '../constants';
import type { ModuleDefinition } from '../types';

const BOOKS_DEF: ModuleDefinition = MODULE_METADATA.books;
const FAST_DEF: ModuleDefinition = MODULE_METADATA.fast;

describe('ModuleRegistry', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  describe('register + get', () => {
    it('registers and retrieves a module', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      expect(reg.get('books')).toEqual(BOOKS_DEF);
    });

    it('overwrites a previous registration', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      const updated = { ...BOOKS_DEF, tagline: 'Updated' };
      reg.register(updated);
      expect(reg.get('books')!.tagline).toBe('Updated');
    });

    it('returns undefined for unregistered module', () => {
      const reg = new ModuleRegistry();
      expect(reg.get('books')).toBeUndefined();
    });

    it('throws on invalid module definition', () => {
      const reg = new ModuleRegistry();
      const invalid = {
        ...BOOKS_DEF,
        accentColor: 'not-a-hex',
      } as ModuleDefinition;

      expect(() => reg.register(invalid)).toThrow();
      expect(reg.size).toBe(0);
    });

    it('getAll returns all registered modules', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.register(FAST_DEF);
      expect(reg.getAll()).toHaveLength(2);
    });

    it('tracks size correctly', () => {
      const reg = new ModuleRegistry();
      expect(reg.size).toBe(0);
      reg.register(BOOKS_DEF);
      expect(reg.size).toBe(1);
      reg.register(FAST_DEF);
      expect(reg.size).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Enable / Disable
  // ─────────────────────────────────────────────────────────────────────────

  describe('enable / disable', () => {
    it('enables a registered module', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.enable('books');
      expect(reg.isEnabled('books')).toBe(true);
    });

    it('enable is a no-op for unregistered module', () => {
      const reg = new ModuleRegistry();
      reg.enable('books');
      expect(reg.isEnabled('books')).toBe(false);
    });

    it('enable is a no-op if already enabled', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.enable('books');
      reg.enable('books'); // should not throw or double-add
      expect(reg.getEnabled()).toHaveLength(1);
    });

    it('disables an enabled module', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.enable('books');
      reg.disable('books');
      expect(reg.isEnabled('books')).toBe(false);
    });

    it('disable is a no-op if already disabled', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      expect(() => reg.disable('books')).not.toThrow();
    });

    it('getEnabled returns only enabled modules', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.register(FAST_DEF);
      reg.enable('books');
      const enabled = reg.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe('books');
    });

    it('getEnabledIds returns a Set of enabled IDs', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.register(FAST_DEF);
      reg.enable('books');
      reg.enable('fast');
      const ids = reg.getEnabledIds();
      expect(ids.size).toBe(2);
      expect(ids.has('books')).toBe(true);
      expect(ids.has('fast')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Subscribe / Notify
  // ─────────────────────────────────────────────────────────────────────────

  describe('subscribe / notify', () => {
    it('calls listener on enable', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      const listener = vi.fn();
      reg.subscribe(listener);
      reg.enable('books');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('calls listener on disable', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.enable('books');
      const listener = vi.fn();
      reg.subscribe(listener);
      reg.disable('books');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('does not call listener for no-op enable', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      reg.enable('books');
      const listener = vi.fn();
      reg.subscribe(listener);
      reg.enable('books'); // already enabled
      expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const reg = new ModuleRegistry();
      reg.register(BOOKS_DEF);
      const listener = vi.fn();
      const unsub = reg.subscribe(listener);
      unsub();
      reg.enable('books');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('MODULE_IDS matches metadata entries', () => {
      expect(MODULE_IDS).toHaveLength(Object.keys(MODULE_METADATA).length);
      expect(MODULE_IDS).toContain('create');
      expect(MODULE_IDS).toContain('payments');
    });

    it('FREE_MODULES includes fast', () => {
      expect(FREE_MODULES).toContain('fast');
      expect(FREE_MODULES).toHaveLength(FREE_MODULES.length);
      // Verify known free modules are present
      expect(FREE_MODULES).toContain('fast');
      expect(FREE_MODULES).toContain('journal');
      expect(FREE_MODULES).toContain('mood');
      expect(FREE_MODULES).toContain('notes');
      expect(FREE_MODULES).toContain('voice');
    });

    it('MODULE_METADATA has an entry for every MODULE_ID', () => {
      for (const id of MODULE_IDS) {
        expect(MODULE_METADATA[id]).toBeDefined();
        expect(MODULE_METADATA[id].id).toBe(id);
      }
      expect(MODULE_METADATA.payments.storageType).toBe('supabase');
      expect(MODULE_METADATA.payments.requiresAuth).toBe(true);
    });

    it('all metadata entries have required fields', () => {
      for (const id of MODULE_IDS) {
        const mod = MODULE_METADATA[id];
        expect(mod.name).toBeTruthy();
        expect(mod.tagline).toBeTruthy();
        expect(mod.icon).toBeTruthy();
        expect(mod.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(['free', 'premium']).toContain(mod.tier);
        expect(mod.navigation.tabs.length).toBeGreaterThan(0);
      }
    });
  });
});
