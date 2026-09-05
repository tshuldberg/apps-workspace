import { describe, expect, it } from 'vitest';
import { redactString, scrubEvent } from '../scrub';

describe('redactString', () => {
  it('redacts email addresses', () => {
    expect(redactString('contact chef@example.com now')).toBe('contact [redacted-email] now');
  });

  it('redacts bearer tokens', () => {
    expect(redactString('Authorization: Bearer abc.def-123_XYZ=')).toBe(
      'Authorization: Bearer [redacted-token]',
    );
  });

  it('redacts JWT-shaped tokens (Supabase keys/access tokens)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadpart.signaturepart';
    expect(redactString(`token=${jwt}`)).toBe('token=[redacted-jwt]');
  });

  it('redacts iOS sandbox container paths', () => {
    const p = '/var/mobile/Containers/Data/Application/ABC-123/Documents/x.jpg';
    expect(redactString(`open failed at ${p}`)).toBe(
      'open failed at /var/mobile/Containers/[redacted-path]',
    );
  });

  it('redacts Android app data paths', () => {
    expect(redactString('at /data/user/0/com.bestchef/files/db')).toBe(
      'at /data/[redacted-path]',
    );
  });

  it('redacts macOS home directories', () => {
    expect(redactString('at /Users/alice/proj/file.ts')).toBe('at /Users/[redacted-user]/proj/file.ts');
  });

  it('leaves clean strings untouched', () => {
    expect(redactString('TypeError: cannot read length of undefined')).toBe(
      'TypeError: cannot read length of undefined',
    );
  });
});

describe('scrubEvent', () => {
  it('strips user identity entirely', () => {
    const event = scrubEvent({ user: { id: 'u1', email: 'a@b.com', ip_address: '1.2.3.4' } });
    expect(event.user).toBeUndefined();
  });

  it('strips request, server_name, and device context', () => {
    const event = scrubEvent({
      request: { headers: { cookie: 'secret' } },
      server_name: 'device-name',
      contexts: { device: { name: 'Trey iPhone' }, app: { app_version: '1.0.0' } },
    });
    expect(event.request).toBeUndefined();
    expect(event.server_name).toBeUndefined();
    expect(event.contexts?.device).toBeUndefined();
    // Non-PII context is preserved.
    expect(event.contexts?.app).toEqual({ app_version: '1.0.0' });
  });

  it('redacts the top-level message', () => {
    const event = scrubEvent({ message: 'failed for user chef@example.com' });
    expect(event.message).toBe('failed for user [redacted-email]');
  });

  it('redacts exception values', () => {
    const event = scrubEvent({
      exception: { values: [{ value: 'auth Bearer eyJabc.def.ghi failed' }] },
    });
    expect(event.exception?.values?.[0]?.value).toBe('auth Bearer [redacted-token] failed');
  });

  it('redacts stacktrace frame filename and abs_path', () => {
    const event = scrubEvent({
      exception: {
        values: [
          {
            value: 'boom',
            stacktrace: {
              frames: [
                { filename: '/Users/trey/proj/x.ts', abs_path: '/var/mobile/Containers/Data/App/1/x.ts' },
                { filename: 'app:///bundle.js' },
              ],
            },
          },
        ],
      },
    });
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    expect(frames[0]?.filename).toBe('/Users/[redacted-user]/proj/x.ts');
    expect(frames[0]?.abs_path).toBe('/var/mobile/Containers/[redacted-path]');
    // A clean frame path is untouched.
    expect(frames[1]?.filename).toBe('app:///bundle.js');
  });

  it('deep-redacts string leaves of extra', () => {
    const event = scrubEvent({
      extra: { note: 'sent to chef@example.com', nested: { path: '/Users/bob/x' }, count: 5 },
    });
    expect(event.extra?.note).toBe('sent to [redacted-email]');
    expect((event.extra?.nested as { path: string }).path).toBe('/Users/[redacted-user]/x');
    expect(event.extra?.count).toBe(5);
  });

  it('deep-redacts string leaves of tags', () => {
    const event = scrubEvent({ tags: { fn: 'x', who: 'a@b.com' } });
    expect(event.tags?.who).toBe('[redacted-email]');
    expect(event.tags?.fn).toBe('x');
  });

  it('deep-redacts nested contexts (that survive device deletion)', () => {
    const event = scrubEvent({
      contexts: {
        device: { name: 'Trey iPhone' },
        app: { build: 'ok', extra_path: '/Users/carol/app' },
      },
    });
    expect(event.contexts?.device).toBeUndefined();
    expect((event.contexts?.app as { extra_path: string }).extra_path).toBe(
      '/Users/[redacted-user]/app',
    );
  });

  it('does not throw on a circular extra', () => {
    const circular: Record<string, unknown> = { self: null, email: 'a@b.com' };
    circular.self = circular;
    const event = scrubEvent({ extra: circular });
    expect(event.extra?.email).toBe('[redacted-email]');
  });

  it('redacts breadcrumb messages and string data', () => {
    const event = scrubEvent({
      breadcrumbs: [
        { message: 'navigated for user a@b.com', data: { url: '/Users/bob/x', count: 3 } },
      ],
    });
    expect(event.breadcrumbs?.[0]?.message).toBe('navigated for user [redacted-email]');
    expect(event.breadcrumbs?.[0]?.data?.url).toBe('/Users/[redacted-user]/x');
    // Non-string breadcrumb data is left as-is.
    expect(event.breadcrumbs?.[0]?.data?.count).toBe(3);
  });

  it('is a no-op on an empty event', () => {
    expect(scrubEvent({})).toEqual({});
  });
});
