/**
 * MK-002 inbound policy enforcement -- red-team matrix for the pure evaluator.
 *
 * A malicious-but-paired peer is the threat model: it has completed the
 * handshake and may even be encrypted, but it tries to write rows it is not
 * entitled to. Every fixture below must be rejected with the correct reason.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateInboundChange,
  type InboundSessionAuth,
  type InboundChangeFacts,
} from '../protocol/inbound-policy';

const personalSession: InboundSessionAuth = {
  peerRevoked: false,
  peerAuthorized: true,
  sessionScope: 'personal_replica',
  sasVerified: true,
};

const workspaceSession: InboundSessionAuth = {
  peerRevoked: false,
  peerAuthorized: true,
  sessionScope: 'shared_workspace',
  sasVerified: true,
};

/** A well-formed, allowable change for the personal-replica notes module. */
function okFacts(overrides: Partial<InboundChangeFacts> = {}): InboundChangeFacts {
  return {
    operation: 'INSERT',
    claimedModuleId: 'notes',
    resolvedModuleId: 'notes',
    moduleEnabled: true,
    moduleScopeCap: 'personal_replica',
    moduleIsSensitive: false,
    moduleRequiresSasForShare: false,
    incomingUpdatedAt: '2026-06-11T00:00:00.000Z',
    tombstoneDeletedAt: null,
    ...overrides,
  };
}

describe('evaluateInboundChange (MK-002)', () => {
  it('allows a well-formed change at the session scope', () => {
    expect(evaluateInboundChange(personalSession, okFacts())).toEqual({ allowed: true });
  });

  it('allows INSERT, UPDATE, and DELETE', () => {
    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
      expect(evaluateInboundChange(personalSession, okFacts({ operation })).allowed).toBe(true);
    }
  });

  it('allows a shared-workspace change for a shareable module in a workspace session', () => {
    expect(
      evaluateInboundChange(
        workspaceSession,
        okFacts({ moduleScopeCap: 'shared_workspace' }),
      ),
    ).toEqual({ allowed: true });
  });

  // --- revocation + authorization ------------------------------------------

  it('rejects everything from a revoked peer (even otherwise-valid changes)', () => {
    const d = evaluateInboundChange({ ...personalSession, peerRevoked: true }, okFacts());
    expect(d).toEqual({ allowed: false, reason: 'peer_revoked' });
  });

  it('revocation takes precedence over authorization', () => {
    const d = evaluateInboundChange(
      { peerRevoked: true, peerAuthorized: false, sessionScope: 'personal_replica', sasVerified: true },
      okFacts(),
    );
    expect(d.reason).toBe('peer_revoked');
  });

  it('rejects a peer that is not a member / not paired', () => {
    const d = evaluateInboundChange({ ...workspaceSession, peerAuthorized: false }, okFacts());
    expect(d).toEqual({ allowed: false, reason: 'peer_not_authorized' });
  });

  // --- structural / foreign-module -----------------------------------------

  it('rejects an unknown table (no owning module)', () => {
    const d = evaluateInboundChange(personalSession, okFacts({ resolvedModuleId: null }));
    expect(d).toEqual({ allowed: false, reason: 'unknown_table' });
  });

  it('rejects a foreign-module smuggle (table belongs to a different module than claimed)', () => {
    const d = evaluateInboundChange(
      personalSession,
      okFacts({ claimedModuleId: 'notes', resolvedModuleId: 'meds' }),
    );
    expect(d).toEqual({ allowed: false, reason: 'module_mismatch' });
  });

  it('rejects a change for a module that is not enabled locally', () => {
    const d = evaluateInboundChange(personalSession, okFacts({ moduleEnabled: false }));
    expect(d).toEqual({ allowed: false, reason: 'module_disabled' });
  });

  it('rejects unsupported operations', () => {
    const d = evaluateInboundChange(personalSession, okFacts({ operation: 'DROP TABLE' }));
    expect(d).toEqual({ allowed: false, reason: 'invalid_operation' });
  });

  // --- scope enforcement (the core out-of-scope cases) ---------------------

  it('rejects inbound writes for a module with no declared policy (fail closed)', () => {
    const d = evaluateInboundChange(personalSession, okFacts({ moduleScopeCap: null }));
    expect(d).toEqual({ allowed: false, reason: 'scope_device_local' });
  });

  it('rejects inbound writes for a device_local module', () => {
    const d = evaluateInboundChange(personalSession, okFacts({ moduleScopeCap: 'device_local' }));
    expect(d).toEqual({ allowed: false, reason: 'scope_device_local' });
  });

  it('rejects a shared_workspace push for a module capped at personal_replica', () => {
    // The signature MK-002 escalation: sp_bets stays personal_replica even if
    // a peer tries to replicate it into a shared workspace.
    const d = evaluateInboundChange(
      workspaceSession,
      okFacts({ claimedModuleId: 'sports', resolvedModuleId: 'sports', moduleScopeCap: 'personal_replica' }),
    );
    expect(d).toEqual({ allowed: false, reason: 'scope_exceeds_cap' });
  });

  it('allows a personal_replica change on a personal session even when the cap is higher', () => {
    const d = evaluateInboundChange(personalSession, okFacts({ moduleScopeCap: 'shared_workspace' }));
    expect(d.allowed).toBe(true);
  });

  // --- tombstone / no-resurrection -----------------------------------------

  it('rejects resurrecting a tombstoned row with an older or equal write', () => {
    const older = evaluateInboundChange(
      personalSession,
      okFacts({ operation: 'INSERT', incomingUpdatedAt: '2026-06-10T00:00:00.000Z', tombstoneDeletedAt: '2026-06-11T00:00:00.000Z' }),
    );
    expect(older).toEqual({ allowed: false, reason: 'tombstoned' });

    const equal = evaluateInboundChange(
      personalSession,
      okFacts({ operation: 'UPDATE', incomingUpdatedAt: '2026-06-11T00:00:00.000Z', tombstoneDeletedAt: '2026-06-11T00:00:00.000Z' }),
    );
    expect(equal).toEqual({ allowed: false, reason: 'tombstoned' });
  });

  it('rejects resurrecting a tombstoned row when the incoming write has no timestamp', () => {
    const d = evaluateInboundChange(
      personalSession,
      okFacts({ operation: 'INSERT', incomingUpdatedAt: null, tombstoneDeletedAt: '2026-06-11T00:00:00.000Z' }),
    );
    expect(d).toEqual({ allowed: false, reason: 'tombstoned' });
  });

  it('allows a strictly newer re-creation of a tombstoned row', () => {
    const d = evaluateInboundChange(
      personalSession,
      okFacts({ operation: 'INSERT', incomingUpdatedAt: '2026-06-12T00:00:00.000Z', tombstoneDeletedAt: '2026-06-11T00:00:00.000Z' }),
    );
    expect(d.allowed).toBe(true);
  });

  it('does not tombstone-block a DELETE of an already-tombstoned row', () => {
    const d = evaluateInboundChange(
      personalSession,
      okFacts({ operation: 'DELETE', incomingUpdatedAt: null, tombstoneDeletedAt: '2026-06-11T00:00:00.000Z' }),
    );
    expect(d.allowed).toBe(true);
  });

  // --- SAS gate (MK-017) ----------------------------------------------------

  it('rejects a sensitive module at shared_workspace from an un-SAS-verified peer', () => {
    const d = evaluateInboundChange(
      { ...workspaceSession, sasVerified: false },
      okFacts({ moduleScopeCap: 'shared_workspace', moduleIsSensitive: true }),
    );
    expect(d).toEqual({ allowed: false, reason: 'sas_unverified' });
  });

  it('allows a sensitive module at shared_workspace once the peer is SAS-verified', () => {
    const d = evaluateInboundChange(
      { ...workspaceSession, sasVerified: true },
      okFacts({ moduleScopeCap: 'shared_workspace', moduleIsSensitive: true }),
    );
    expect(d).toEqual({ allowed: true });
  });

  it('does not require SAS for a non-sensitive module at shared_workspace', () => {
    const d = evaluateInboundChange(
      { ...workspaceSession, sasVerified: false },
      okFacts({ moduleScopeCap: 'shared_workspace', moduleIsSensitive: false }),
    );
    expect(d).toEqual({ allowed: true });
  });

  it('does not require SAS for a sensitive module on personal own-device sync', () => {
    const d = evaluateInboundChange(
      { ...personalSession, sasVerified: false },
      okFacts({ moduleIsSensitive: true }),
    );
    expect(d).toEqual({ allowed: true });
  });

  it('scope cap is still enforced before the SAS gate (cap rejection wins)', () => {
    // A sensitive module capped at personal_replica pushed into a workspace is a
    // scope violation, reported as such regardless of SAS state.
    const d = evaluateInboundChange(
      { ...workspaceSession, sasVerified: false },
      okFacts({ moduleScopeCap: 'personal_replica', moduleIsSensitive: true }),
    );
    expect(d).toEqual({ allowed: false, reason: 'scope_exceeds_cap' });
  });

  // requiresSasForShare: the SAS gate without isSensitive's per-entity encryption
  // (the community trust-root fix). Treated identically to moduleIsSensitive.

  it('rejects a requiresSasForShare module at shared_workspace from an un-SAS-verified peer', () => {
    const d = evaluateInboundChange(
      { ...workspaceSession, sasVerified: false },
      okFacts({ moduleScopeCap: 'shared_workspace', moduleIsSensitive: false, moduleRequiresSasForShare: true }),
    );
    expect(d).toEqual({ allowed: false, reason: 'sas_unverified' });
  });

  it('allows a requiresSasForShare module at shared_workspace once the peer is SAS-verified', () => {
    const d = evaluateInboundChange(
      { ...workspaceSession, sasVerified: true },
      okFacts({ moduleScopeCap: 'shared_workspace', moduleIsSensitive: false, moduleRequiresSasForShare: true }),
    );
    expect(d).toEqual({ allowed: true });
  });

  it('does not require SAS for a requiresSasForShare module on personal own-device sync', () => {
    const d = evaluateInboundChange(
      { ...personalSession, sasVerified: false },
      okFacts({ moduleIsSensitive: false, moduleRequiresSasForShare: true }),
    );
    expect(d).toEqual({ allowed: true });
  });
});
