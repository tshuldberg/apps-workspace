/**
 * Deployment-contract guard (Plan 39 reconciliation): the community node's public-submit
 * session gate builds its verify endpoint from SESSION_VERIFY_URL via
 * personaSessionVerifyEndpoint. Both the canonical BASE form and the older `<base>/persona`
 * ops-doc form must resolve to exactly `<base>/persona/session/verify` -- never a doubled
 * `/persona/persona/...`, which would fail every public submit closed on a healthy service.
 */
import { describe, expect, it } from 'vitest';
import {
  personaSessionVerifyEndpoint,
  PERSONA_SESSION_VERIFY_ROUTE,
} from '../persona-service-http';

describe('personaSessionVerifyEndpoint (SESSION_VERIFY_URL contract)', () => {
  it('resolves the canonical base form to the absolute verify route', () => {
    expect(personaSessionVerifyEndpoint('https://accounts.example')).toBe(
      'https://accounts.example/persona/session/verify',
    );
  });

  it('tolerates the legacy `<base>/persona` form without doubling the segment', () => {
    expect(personaSessionVerifyEndpoint('https://accounts.example/persona')).toBe(
      'https://accounts.example/persona/session/verify',
    );
  });

  it('strips trailing slashes on both forms', () => {
    expect(personaSessionVerifyEndpoint('https://accounts.example/')).toBe(
      'https://accounts.example/persona/session/verify',
    );
    expect(personaSessionVerifyEndpoint('https://accounts.example/persona/')).toBe(
      'https://accounts.example/persona/session/verify',
    );
  });

  it('is case-insensitive on the tolerated /persona suffix', () => {
    expect(personaSessionVerifyEndpoint('https://accounts.example/Persona')).toBe(
      'https://accounts.example/persona/session/verify',
    );
  });

  it('returns undefined for blank/unset input so the caller reports not-configured (fail closed)', () => {
    expect(personaSessionVerifyEndpoint(undefined)).toBeUndefined();
    expect(personaSessionVerifyEndpoint(null)).toBeUndefined();
    expect(personaSessionVerifyEndpoint('')).toBeUndefined();
    expect(personaSessionVerifyEndpoint('   ')).toBeUndefined();
  });

  it('the two documented forms are interchangeable (no drift between bins)', () => {
    expect(personaSessionVerifyEndpoint('https://accounts.example')).toBe(
      personaSessionVerifyEndpoint('https://accounts.example/persona'),
    );
    expect(PERSONA_SESSION_VERIFY_ROUTE).toBe('/persona/session/verify');
  });
});
