import { describe, expect, it } from 'vitest';
import { DESK_ERROR_CODES, deskErrorMessage } from '../(root)/lib/desk-errors';

describe('deskErrorMessage', () => {
  it('has plain copy for every desk error code', () => {
    for (const code of DESK_ERROR_CODES) {
      const copy = deskErrorMessage(code);
      expect(copy.message.length, code).toBeGreaterThan(10);
      expect(copy.message, code).not.toContain('\u2014');
    }
  });

  it('routes no-profile to registration', () => {
    expect(deskErrorMessage('no-profile').action).toBe('register');
  });

  it('marks refreshable states', () => {
    for (const code of ['not-open', 'rev-conflict', 'stale', 'base-mismatch']) {
      expect(deskErrorMessage(code).action, code).toBe('refresh');
    }
  });

  it('never treats collapsed as an error code', () => {
    expect(DESK_ERROR_CODES).not.toContain('collapsed');
  });

  it('carries the real cap message from the server detail', () => {
    const copy = deskErrorMessage('cap-exceeded', 'Your cap is 12 open suggestions.');
    expect(copy.message).toContain('Your cap is 12 open suggestions.');
  });

  it('appends detail for unknown and unlisted codes', () => {
    expect(deskErrorMessage('unknown', 'row missing').message).toContain('row missing');
    const unlisted = deskErrorMessage('quota-melted', 'try later');
    expect(unlisted.message).toContain('Something went wrong.');
    expect(unlisted.message).toContain('try later');
  });

  it('does not leak detail into codes with exact copy', () => {
    const copy = deskErrorMessage('bad-signature', 'internal trace');
    expect(copy.message).not.toContain('internal trace');
  });
});
