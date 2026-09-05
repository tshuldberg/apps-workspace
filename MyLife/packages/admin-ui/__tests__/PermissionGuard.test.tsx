import { describe, it, expect } from 'vitest';
import { PermissionGuard } from '../src/PermissionGuard';
import type { PermissionGuardProps } from '../src/PermissionGuard';

describe('PermissionGuard', () => {
  it('exports a function component', () => {
    expect(typeof PermissionGuard).toBe('function');
  });

  it('has correct prop interface', () => {
    // Type-level check: ensure the props type is correctly shaped
    const props: PermissionGuardProps = {
      children: null,
      allowedRoles: ['admin', 'manager'],
      currentRole: 'admin',
      fallback: null,
    };
    expect(props.allowedRoles).toContain('admin');
    expect(props.currentRole).toBe('admin');
  });

  it('returns children when role matches', () => {
    const result = PermissionGuard({
      children: 'allowed',
      allowedRoles: ['admin', 'manager'],
      currentRole: 'admin',
    });
    expect(result).toBe('allowed');
  });

  it('returns fallback when role does not match', () => {
    const result = PermissionGuard({
      children: 'allowed',
      allowedRoles: ['admin'],
      currentRole: 'viewer',
      fallback: 'denied',
    });
    expect(result).toBe('denied');
  });

  it('returns null when role does not match and no fallback', () => {
    const result = PermissionGuard({
      children: 'allowed',
      allowedRoles: ['admin'],
      currentRole: 'viewer',
    });
    expect(result).toBeNull();
  });
});
