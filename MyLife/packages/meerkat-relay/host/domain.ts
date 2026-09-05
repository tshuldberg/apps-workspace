/**
 * Host BYO-domain rung (Plan 20, Phase 5.2). The ADVANCED public path.
 *
 * A user who owns a domain can put their desktop host behind a real TLS edge
 * (Caddy) instead of a tunnel. This module is the pure generator for that path:
 * it fills the existing `deploy/Caddyfile` template with the user's domain +
 * local upstream and returns the ordered DNS/TLS setup steps as structured text.
 *
 * Honesty boundary: generating a Caddyfile and printing a `wss://<domain>` URL
 * is NOT proof the host is reachable. TLS provisioning succeeding at the edge is
 * still an L3 false positive -- inbound 443 may be firewalled/NAT'd. The public
 * URL returned here is a CANDIDATE only; the caller must confirm it with a real
 * OFF-HOST round-trip via `gateReachability` before surfacing a connection card
 * or QR. That requirement is encoded in the returned steps, not just documented.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** The env placeholder Caddy expands in `deploy/Caddyfile`. */
const DOMAIN_PLACEHOLDER = '{$RELAY_DOMAIN}';
/** The template's docker-compose upstream (service name + relay's plain-ws port). */
const TEMPLATE_UPSTREAM = 'relay:8787';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_PATH = join(HERE, '..', 'deploy', 'Caddyfile');

// A pragmatic hostname check: labels of letters/digits/hyphens, at least one dot,
// no scheme, no path, no port. Rejects obvious junk without pretending to be a
// full RFC 1035 validator.
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export interface DomainSetupStep {
  title: string;
  detail: string;
}

export interface DomainConfigInput {
  /** The user's BYO domain, e.g. `relay.ada.example`. */
  domain: string;
  /**
   * The REAL local port the relay bound (from the supervisor's listening event).
   * Caddy reverse-proxies to `127.0.0.1:<relayPort>` on this machine. Default 8787.
   */
  relayPort?: number;
  /** Inject the Caddyfile template text; defaults to reading `deploy/Caddyfile`. */
  template?: string;
}

export interface DomainConfig {
  /** The validated domain. */
  domain: string;
  /** The generated Caddyfile with the domain + local upstream filled in. */
  caddyfile: string;
  /**
   * The wss:// URL this domain WILL serve once DNS + TLS + off-host verification
   * all pass. It is a candidate, not a confirmed-reachable endpoint (see steps).
   */
  candidatePublicUrl: string;
  /** Ordered, human-facing DNS/TLS setup steps for the advanced path. */
  steps: DomainSetupStep[];
}

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`relayPort must be an integer in [1, 65535], got ${String(port)}`);
  }
}

function normalizeDomain(domain: string): string {
  const d = (domain ?? '').trim().replace(/\.$/, '').toLowerCase();
  if (!d) throw new Error('domain is required');
  if (/^https?:\/\//i.test(d) || /^wss?:\/\//i.test(d) || d.includes('/')) {
    throw new Error('domain must be a bare hostname, not a URL');
  }
  if (d.includes(':')) throw new Error('domain must not include a port');
  if (!HOSTNAME_RE.test(d)) throw new Error(`invalid domain: ${d}`);
  return d;
}

function loadTemplate(injected?: string): string {
  if (injected != null) return injected;
  return readFileSync(DEFAULT_TEMPLATE_PATH, 'utf8');
}

/**
 * Generate a Caddyfile + DNS/TLS steps for a user's BYO domain. Substitutes the
 * validated domain for the `{$RELAY_DOMAIN}` placeholder and re-homes the
 * template's docker upstream (`relay:8787`) to the desktop's local relay port,
 * so Caddy runs on the same machine and proxies to the running bin.
 */
export function generateDomainConfig(input: DomainConfigInput): DomainConfig {
  const domain = normalizeDomain(input.domain);
  const relayPort = input.relayPort ?? 8787;
  assertPort(relayPort);

  const template = loadTemplate(input.template);
  const caddyfile = template
    .split(DOMAIN_PLACEHOLDER).join(domain)
    .split(TEMPLATE_UPSTREAM).join(`127.0.0.1:${relayPort}`);

  const candidatePublicUrl = `wss://${domain}`;

  const steps: DomainSetupStep[] = [
    {
      title: 'Point DNS at this computer',
      detail:
        `Create an A record (and an AAAA record if you have IPv6) for ${domain} ` +
        `pointing at this computer's public IP address. DNS changes can take up to ` +
        `an hour to propagate.`,
    },
    {
      title: 'Allow inbound 80 and 443',
      detail:
        `Forward/open TCP 443 (wss traffic) and TCP 80 (the Let's Encrypt ACME ` +
        `HTTP challenge) from your router to this computer. Without inbound 443 the ` +
        `domain will not be reachable no matter what the tools print.`,
    },
    {
      title: 'Run Caddy with this Caddyfile',
      detail:
        `Start Caddy with the generated Caddyfile. Caddy auto-provisions a Let's ` +
        `Encrypt certificate for ${domain} and reverse-proxies both the WebSocket ` +
        `upgrade and GET /healthz to the local relay on 127.0.0.1:${relayPort}. ` +
        `The relay never sees the certificate; TLS lives entirely at this edge.`,
    },
    {
      title: 'Verify reachability from OFF-HOST before sharing',
      detail:
        `A provisioned certificate is NOT proof the domain is reachable: inbound ` +
        `443 may still be blocked. Only share the ${candidatePublicUrl} connection ` +
        `card after a real off-host round-trip confirms reachability. This host is ` +
        `reachable only while this app is open and the computer is awake.`,
    },
  ];

  return { domain, caddyfile, candidatePublicUrl, steps };
}
