/**
 * Shared arg parsing + NDJSON emit for the load/soak harness (Plan 44 WP-7B).
 * Std-lib only, matching the synthetics probe idiom (parseArgs/emit), extended to
 * support REPEATABLE flags (e.g. --route) which the probe helper did not need.
 */

/**
 * Parse `--flag value` / `--flag=value` / bare `--flag` into a plain object. A
 * flag that appears more than once collects into an array (repeatable flags like
 * --route). PURE and exported for tests.
 */
export function parseArgs(argv) {
  const out = {};
  const put = (key, value) => {
    if (key in out) {
      if (Array.isArray(out[key])) out[key].push(value);
      else out[key] = [out[key], value];
    } else {
      out[key] = value;
    }
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      put(token.slice(2, eq), token.slice(eq + 1));
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        put(token.slice(2), next);
        i += 1;
      } else {
        put(token.slice(2), 'true');
      }
    }
  }
  return out;
}

/** Normalize a possibly-repeated flag value into an array (0, 1, or many). */
export function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Emit one NDJSON line on stdout, timestamped uniformly. Diagnostics use stderr. */
export function emit(obj) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...obj })}\n`);
}

/** Emit the final verdict line and exit with its code. */
export function emitFinal(obj, exitCode) {
  emit(obj);
  process.exit(exitCode);
}

/** A monotonic high-resolution millisecond clock (immune to wall-clock jumps). */
export function nowMs() {
  return Number(process.hrtime.bigint() / 1000n) / 1000;
}
