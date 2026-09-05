import { describe, expect, it } from 'vitest';
import { publishErrorAction, publishErrorMessage } from '../(root)/lib/publish-errors';

describe('publishErrorMessage', () => {
  it('directs no-profile to registration', () => {
    expect(publishErrorMessage('no-profile')).toBe(
      'You need a public profile to publish. Register a handle to continue.',
    );
  });

  it('maps a rev conflict to plain copy', () => {
    expect(publishErrorMessage('rev-conflict')).toContain('newer revision');
  });

  it('maps a bad signature honestly', () => {
    expect(publishErrorMessage('bad-signature')).toContain('verify your signature');
  });

  it('maps a network failure honestly', () => {
    expect(publishErrorMessage('network')).toContain('Could not reach');
  });

  it('appends server detail to an unknown failure', () => {
    expect(publishErrorMessage('unknown', 'server said 503')).toBe(
      'Publishing failed. server said 503',
    );
  });

  it('never fabricates success copy', () => {
    for (const code of [
      'validation',
      'no-profile',
      'bad-signature',
      'rev-conflict',
      'author-mismatch',
      'screen-hold',
      'network',
      'unknown',
    ] as const) {
      expect(publishErrorMessage(code).toLowerCase()).not.toContain('published');
    }
  });
});

describe('publishErrorAction', () => {
  it('routes only no-profile to the register action', () => {
    expect(publishErrorAction('no-profile')).toBe('register');
    for (const code of [
      'validation',
      'bad-signature',
      'rev-conflict',
      'author-mismatch',
      'not-newsroom-member',
      'screen-hold',
      'network',
      'unknown',
    ] as const) {
      expect(publishErrorAction(code)).toBeUndefined();
    }
  });
});
