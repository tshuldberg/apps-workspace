// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  parseBody,
  EntitlementRevokeSchema,
  ActorIssueSchema,
  BundleIssueSchema,
  FriendDeleteSchema,
  ShareEventCreateSchema,
} from '../api-validation';
import type { z } from 'zod';

/** Build a Request from an arbitrary JSON body. */
function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Arbitrary that generates values guaranteed to NOT satisfy a required
 * string field (wrong types, empty strings, whitespace-only).
 */
const invalidStringArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('   '),
  fc.integer(),
  fc.boolean(),
  fc.constant([]),
  fc.constant({}),
);

/** Registry of schemas paired with arbitraries that produce invalid bodies. */
const SCHEMA_INVALID_CASES: {
  name: string;
  schema: z.ZodTypeAny;
  invalidBodyArb: fc.Arbitrary<unknown>;
}[] = [
  {
    name: 'EntitlementRevokeSchema',
    schema: EntitlementRevokeSchema,
    invalidBodyArb: fc.oneof(
      // Missing signature entirely
      fc.record({ reason: fc.string() }),
      // Empty signature
      fc.record({ signature: fc.constant('') }),
      // Whitespace-only signature
      fc.record({ signature: fc.constant('   ') }),
      // Wrong type for signature
      fc.record({ signature: invalidStringArb }),
      // Non-object bodies
      fc.constant(null),
      fc.string(),
      fc.integer(),
      fc.constant([]),
    ),
  },
  {
    name: 'ActorIssueSchema',
    schema: ActorIssueSchema,
    invalidBodyArb: fc.oneof(
      // Missing userId
      fc.constant({}),
      // Empty userId
      fc.record({ userId: fc.constant('') }),
      // Whitespace-only userId
      fc.record({ userId: fc.constant('   ') }),
      // Wrong type for userId
      fc.record({ userId: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)) }),
      // Non-object bodies
      fc.constant(null),
      fc.string(),
      fc.constant([]),
    ),
  },
  {
    name: 'BundleIssueSchema',
    schema: BundleIssueSchema,
    invalidBodyArb: fc.oneof(
      // Missing required fields
      fc.constant({}),
      fc.record({ bundleId: fc.string() }), // missing eventId
      fc.record({ eventId: fc.string() }), // missing bundleId
      // Empty required fields
      fc.record({ bundleId: fc.constant(''), eventId: fc.constant('') }),
      // Wrong type for expiresInSeconds
      fc.record({
        bundleId: fc.constant('b'),
        eventId: fc.constant('e'),
        expiresInSeconds: fc.oneof(
          fc.constant(-1),
          fc.constant(0),
          fc.constant('notanumber'),
        ),
      }),
      // Non-object bodies
      fc.constant(null),
      fc.integer(),
    ),
  },
  {
    name: 'FriendDeleteSchema',
    schema: FriendDeleteSchema,
    invalidBodyArb: fc.oneof(
      // Missing friendUserId
      fc.constant({}),
      fc.record({ userId: fc.string() }),
      // Empty friendUserId
      fc.record({ friendUserId: fc.constant('') }),
      // Wrong type
      fc.record({ friendUserId: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)) }),
      // Non-object bodies
      fc.constant(null),
      fc.constant([]),
    ),
  },
  {
    name: 'ShareEventCreateSchema',
    schema: ShareEventCreateSchema,
    invalidBodyArb: fc.oneof(
      // Missing required fields
      fc.constant({}),
      // Invalid objectType enum
      fc.record({
        objectType: fc.constant('invalid_type'),
        objectId: fc.constant('id'),
        visibility: fc.constant('public'),
      }),
      // Invalid visibility enum
      fc.record({
        objectType: fc.constant('generic'),
        objectId: fc.constant('id'),
        visibility: fc.constant('invalid_vis'),
      }),
      // Empty objectId
      fc.record({
        objectType: fc.constant('generic'),
        objectId: fc.constant(''),
        visibility: fc.constant('public'),
      }),
      // Non-object bodies
      fc.constant(null),
      fc.string(),
    ),
  },
];

describe('Property 26: API input validation', () => {
  for (const { name, schema, invalidBodyArb } of SCHEMA_INVALID_CASES) {
    it(`${name}: random invalid body always returns 400 validation error`, () => {
      fc.assert(
        fc.asyncProperty(invalidBodyArb, async (body) => {
          const result = await parseBody(makeRequest(body), schema);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.response.status).toBe(400);
            const json = await result.response.json();
            expect(json.error).toBeDefined();
          }
        }),
        { numRuns: 50 },
      );
    });
  }

  it('non-JSON request body returns 400 for any schema', () => {
    const schemas = [
      EntitlementRevokeSchema,
      ActorIssueSchema,
      BundleIssueSchema,
      FriendDeleteSchema,
      ShareEventCreateSchema,
    ];

    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...schemas),
        async (schema) => {
          const badRequest = new Request('http://localhost/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not valid json {{{',
          });
          const result = await parseBody(badRequest, schema);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.response.status).toBe(400);
          }
        },
      ),
    );
  });
});
