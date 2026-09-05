/**
 * Host BYO-domain rung (Plan 20, Phase 5.2). The advanced public path.
 *
 * Honesty: a generated Caddyfile + a printed wss://<domain> URL is NOT proof of
 * reachability. The returned URL is a candidate only, and the steps must require
 * an off-host verification before the card/QR is shared.
 */

import { describe, it, expect } from 'vitest';
import { generateDomainConfig } from '../domain';

const TEMPLATE = [
  '{$RELAY_DOMAIN} {',
  '\treverse_proxy relay:8787 {',
  '\t\theader_up X-Forwarded-For {remote_host}',
  '\t}',
  '}',
].join('\n');

describe('generateDomainConfig', () => {
  it('fills the domain placeholder and re-homes the upstream to the local relay port', () => {
    const cfg = generateDomainConfig({ domain: 'relay.ada.example', relayPort: 8790, template: TEMPLATE });
    expect(cfg.caddyfile).toContain('relay.ada.example {');
    expect(cfg.caddyfile).not.toContain('{$RELAY_DOMAIN}');
    expect(cfg.caddyfile).toContain('reverse_proxy 127.0.0.1:8790');
    expect(cfg.caddyfile).not.toContain('relay:8787');
    expect(cfg.candidatePublicUrl).toBe('wss://relay.ada.example');
  });

  it('defaults the upstream port to 8787 and lowercases the domain', () => {
    const cfg = generateDomainConfig({ domain: 'Relay.Example.COM', template: TEMPLATE });
    expect(cfg.domain).toBe('relay.example.com');
    expect(cfg.caddyfile).toContain('127.0.0.1:8787');
  });

  it('rejects a URL, a port, or a junk hostname', () => {
    expect(() => generateDomainConfig({ domain: 'https://relay.example', template: TEMPLATE })).toThrow();
    expect(() => generateDomainConfig({ domain: 'relay.example:8787', template: TEMPLATE })).toThrow();
    expect(() => generateDomainConfig({ domain: 'not a domain', template: TEMPLATE })).toThrow();
  });

  it('requires an OFF-HOST verification step before sharing (never claims reachable)', () => {
    const cfg = generateDomainConfig({ domain: 'relay.ada.example', template: TEMPLATE });
    const last = cfg.steps[cfg.steps.length - 1];
    expect(last.title).toMatch(/off-host/i);
    expect(last.detail).toMatch(/off-host round-trip/i);
    // Load-bearing honesty phrasing about desktop-hosted lifecycle.
    expect(cfg.steps.some((s) => /only while this app is open/i.test(s.detail))).toBe(true);
  });

  it('reads the real deploy/Caddyfile template when none is injected', () => {
    const cfg = generateDomainConfig({ domain: 'relay.ada.example' });
    expect(cfg.caddyfile).toContain('relay.ada.example {');
    expect(cfg.caddyfile).toContain('127.0.0.1:8787');
    expect(cfg.caddyfile).not.toContain('{$RELAY_DOMAIN}');
  });
});
