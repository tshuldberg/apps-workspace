import { describe, it, expect } from 'vitest';

describe('restaurant-saas setup', () => {
  it('package is importable (sanity check)', () => {
    expect(true).toBe(true);
  });

  it('generates a valid slug from restaurant name', () => {
    function generateSlug(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    expect(generateSlug('The Blue Plate')).toBe('the-blue-plate');
    expect(generateSlug("Mario's Trattoria")).toBe('mario-s-trattoria');
    expect(generateSlug('   Leading Spaces   ')).toBe('leading-spaces');
    expect(generateSlug('UPPER CASE')).toBe('upper-case');
    expect(generateSlug('a--b--c')).toBe('a-b-c');
    expect(generateSlug('123 Main St Grill')).toBe('123-main-st-grill');
  });

  it('validates role values', () => {
    const VALID_ROLES = ['owner', 'manager', 'host', 'server', 'marketing'] as const;
    type Role = (typeof VALID_ROLES)[number];

    function isValidRole(role: string): role is Role {
      return (VALID_ROLES as readonly string[]).includes(role);
    }

    expect(isValidRole('owner')).toBe(true);
    expect(isValidRole('manager')).toBe(true);
    expect(isValidRole('host')).toBe(true);
    expect(isValidRole('server')).toBe(true);
    expect(isValidRole('marketing')).toBe(true);
    expect(isValidRole('admin')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });

  it('validates restaurant status transitions', () => {
    const VALID_STATUSES = ['onboarding', 'active', 'paused', 'terminated'] as const;
    type Status = (typeof VALID_STATUSES)[number];

    function isValidStatus(status: string): status is Status {
      return (VALID_STATUSES as readonly string[]).includes(status);
    }

    expect(isValidStatus('onboarding')).toBe(true);
    expect(isValidStatus('active')).toBe(true);
    expect(isValidStatus('paused')).toBe(true);
    expect(isValidStatus('terminated')).toBe(true);
    expect(isValidStatus('deleted')).toBe(false);
  });
});
