/**
 * Shared ID generator for the adapter layer.
 *
 * Uses `Math.random()`-based UUID-v4 rather than Node's `crypto.randomUUID()`
 * because the `@mylife/db` package is consumed by the mobile (React Native /
 * Hermes) bundle which does not ship the Node `crypto` module. The same
 * pattern is used by `backup/operations.ts`.
 *
 * The output shape matches RFC 4122 UUID v4 for consistency with any tool
 * that parses IDs. The entropy source is `Math.random()`, so do NOT use
 * these IDs where cryptographic unpredictability is required.
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
