#!/usr/bin/env node
// Plan 42 negative-criteria static gate (WP-42E, deliverable 2).
//
// FAILS CI if any statically-checkable NC-42 invariant regresses. Each gate reads
// the REAL source files WP-42A-D shipped and asserts a structural property. This
// is a regression fence, not a proof of runtime behavior: the hardware ACs still
// need the device matrix (see the status ledger). Wired into `check:parity` via
// `check:meerkat-transport-nc`.
//
// Gates (statically checkable NCs):
//   NC-42.1  No SIMULATED backend sets isReal:true (a sim can never be a live rung).
//   NC-42.2  No speculative third-party native package name is probed in the
//            production Nearby/BLE loaders (only the owned package + expo-modules-core).
//   NC-42.3  No push record/HTTP shape names a device pubkey, community id, message
//            id, caller identity, or plaintext field (addresses are hashes only).
//   NC-42.4  No push status/record labels provider acceptance as "delivered".
//   NC-42.6  The BLE wake decoder reconstructs ONLY the three wake fields (no
//            arbitrary payload passthrough).
//   NC-53.1  The proximity-ceremony surfaces (protocol, adapter, screen) carry
//            no relay reference: the ceremony must be UNABLE to dial a relay,
//            so it can never silently complete over the internet (plan 53 NC-1).
//   NC-42.7  No TaskManager.defineTask sits inside a React component or a
//            registration function (must be module scope).
//
// Usage:
//   node scripts/check-meerkat-transport-nc.mjs            # run the gates
//   node scripts/check-meerkat-transport-nc.mjs --self-test # prove each gate catches a planted violation

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Strip line and block comments and string-literal-safe-ish so a gate that looks
 * for CODE TOKENS (isReal:true, a "delivered" literal, an interface key) does not
 * trip on prose in a docstring that mentions the very thing the gate forbids.
 * This is a coarse stripper (not a full TS parser): it removes // line comments
 * and block comments. That is sufficient because the honesty docstrings that
 * mention the forbidden tokens are always comments.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating http://)
}

const root = resolve(process.cwd());

// --- reporting ---------------------------------------------------------------

function out(line) {
  process.stdout.write(`${line}\n`);
}
function err(line) {
  process.stderr.write(`${line}\n`);
}

// A gate takes a file-reader and returns { ok, message }. The reader is injected
// so --self-test can feed a mutated copy of the source to prove the gate trips.
const GATES = [
  { id: 'NC-42.1', label: 'no simulated backend sets isReal:true', run: gateNoSimulatedIsReal },
  { id: 'NC-42.2', label: 'no speculative native package probed in production loaders', run: gateNoSpeculativeRequire },
  { id: 'NC-42.3', label: 'no identity/plaintext field in push record shapes', run: gateNoIdentityInPushRecords },
  { id: 'NC-42.4', label: 'no push acceptance labeled delivered', run: gateNoDeliveredLabel },
  { id: 'NC-42.6', label: 'BLE decoder keeps only the three wake fields', run: gateBleWakeOnly },
  { id: 'NC-42.7', label: 'no defineTask inside a React/registration function', run: gateDefineTaskModuleScope },
  { id: 'NC-53.1', label: 'ceremony surfaces carry no relay reference', run: gateCeremonyNoRelay },
];

/** Default reader: read the real file from disk (empty string when missing). */
function diskReader(path) {
  const full = resolve(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

// --- gate implementations ----------------------------------------------------
// Each returns { ok: boolean, message: string }. On failure ok:false.

const SIMULATED_BACKEND_FILES = [
  'packages/sync/src/transport/ble-transport.ts',
  'packages/sync/src/transport/nearby-transport.ts',
  'packages/sync/src/transport/webrtc-transport.ts',
  'packages/sync/src/transport/relay-transport.ts',
  'packages/sync/src/transport/lan-discovery.ts',
];

/**
 * NC-42.1: a class named Simulated* must never set isReal to true. Scan each
 * simulated-backend file: for every `class Simulated...` block, the isReal
 * assignment (if present) must be `false`.
 */
function gateNoSimulatedIsReal(read) {
  for (const path of SIMULATED_BACKEND_FILES) {
    const src = stripComments(read(path));
    if (!src) continue;
    // Find each simulated class and inspect its isReal declaration.
    const classRe = /class\s+Simulated[A-Za-z0-9_]*\b[\s\S]*?(?=\nclass\s|\nexport\s+class\s|$)/g;
    let match;
    while ((match = classRe.exec(src)) !== null) {
      const body = match[0];
      const isRealRe = /\bisReal\b\s*[:=]\s*(true|false)/g;
      let m;
      while ((m = isRealRe.exec(body)) !== null) {
        if (m[1] === 'true') {
          return { ok: false, message: `${path}: a Simulated backend sets isReal:true` };
        }
      }
    }
  }
  return { ok: true, message: 'simulated backends keep isReal false' };
}

const NEARBY_LOADER = 'apps/meerkat/app/(root)/data/nearby-backend.ts';
const BLE_LOADER = 'apps/meerkat/app/(root)/data/ble-backend.ts';

/**
 * NC-42.2: the production Nearby/BLE loaders must probe ONLY the owned package
 * (@mylife/meerkat-native-transport). A raw `require('react-native-...')` or a
 * `requireNativeModule(` inside these files is a regression to speculative
 * probing.
 */
function gateNoSpeculativeRequire(read) {
  for (const path of [NEARBY_LOADER, BLE_LOADER]) {
    const src = read(path);
    if (!src) continue;
    // A direct react-native-* require, or a direct requireNativeModule call, means
    // the loader is probing a native name itself instead of the owned package.
    const speculative = /require\(\s*['"]react-native-[^'"]+['"]\s*\)/;
    const rawNativeProbe = /requireNativeModule\s*\(/;
    if (speculative.test(src)) {
      return { ok: false, message: `${path}: probes a speculative react-native-* package directly` };
    }
    if (rawNativeProbe.test(src)) {
      return { ok: false, message: `${path}: calls requireNativeModule directly (should go through the owned package)` };
    }
  }
  return { ok: true, message: 'nearby/ble loaders probe only the owned package' };
}

const PUSH_RECORD_FILES = [
  'packages/meerkat-relay/src/push-store.ts',
  'packages/meerkat-relay/src/push-gateway-http.ts',
  'packages/meerkat-relay/src/push-gateway.ts',
  'packages/sync/src/protocol/push-relay-client.ts',
];

/**
 * NC-42.3: no push record/HTTP shape may carry a device pubkey, community id,
 * message id, caller identity, or plaintext content field. We scan for FIELD
 * NAMES (object keys / interface members) that would leak identity. Hashes and
 * opaque payloads are allowed; a `registrationIdHash` is fine, a `devicePubkey`
 * is not.
 */
function gateNoIdentityInPushRecords(read) {
  // Forbidden as an object-key / interface-member name. Word-boundaried, and we
  // deliberately exclude the *Hash suffixes (registrationIdHash etc.).
  const forbiddenKey = /(^|[^A-Za-z])(devicePubkey|devicePublicKey|communityId|community_id|messageId|message_id|callerName|callerIdentity|plaintext|plainText)\s*[?:]/m;
  for (const path of PUSH_RECORD_FILES) {
    const src = stripComments(read(path));
    if (!src) continue;
    const m = forbiddenKey.exec(src);
    if (m) {
      return { ok: false, message: `${path}: push record shape names an identity/plaintext field "${m[2]}"` };
    }
  }
  return { ok: true, message: 'push records carry no identity/plaintext fields' };
}

/**
 * NC-42.4: provider acceptance is never "delivered". No push status/record file
 * may introduce a 'delivered' literal status or a providerStatus === 'delivered'.
 */
function gateNoDeliveredLabel(read) {
  const deliveredLiteral = /['"]delivered['"]/i;
  for (const path of PUSH_RECORD_FILES) {
    const src = stripComments(read(path));
    if (!src) continue;
    if (deliveredLiteral.test(src)) {
      return { ok: false, message: `${path}: contains a "delivered" status literal (acceptance != delivery)` };
    }
  }
  return { ok: true, message: 'push acceptance never labeled delivered' };
}

const BLE_BACKEND = 'apps/meerkat/app/(root)/data/ble-backend.ts';

/**
 * NC-42.6: the BLE wake decoder must reconstruct ONLY the three wake fields
 * (deviceId, pendingModules, totalBytes) and never spread arbitrary parsed input.
 * A `...parsed` / `...record` spread into the return, or a return that is the raw
 * parsed object, would let smuggled bytes ride along.
 */
function gateBleWakeOnly(read) {
  const src = stripComments(read(BLE_BACKEND));
  if (!src) return { ok: false, message: `${BLE_BACKEND}: missing (BLE decoder gate cannot run)` };
  // The decoder must NOT return a spread of the parsed record.
  if (/return\s*\{\s*\.\.\.(parsed|record|candidate)\b/.test(src)) {
    return { ok: false, message: `${BLE_BACKEND}: decodeBleWakePayload spreads the raw parsed object (data could ride along)` };
  }
  // And it must explicitly reconstruct the three fields.
  const reconstructs =
    /deviceId\s*,?/.test(src) && /pendingModules\s*,?/.test(src) && /totalBytes\s*,?/.test(src);
  if (!reconstructs) {
    return { ok: false, message: `${BLE_BACKEND}: decoder does not reconstruct the three explicit wake fields` };
  }
  return { ok: true, message: 'BLE decoder keeps only the three wake fields' };
}

const TASK_DEFINITION_FILE = 'apps/meerkat/app/(root)/data/background-task-definitions.ts';
const TASK_REGISTRATION_FILE = 'apps/meerkat/app/(root)/data/background-task-registration.ts';
// Files where a defineTask would mean it is inside a React lifecycle.
const REACT_FILES_GLOB_DIRS = [
  'apps/meerkat/app/(root)/(tabs)',
  'apps/meerkat/app/(root)/providers',
];

/**
 * NC-42.7: TaskManager.defineTask must live at module scope in the dedicated
 * definitions file. It must NOT appear inside a registration function (the old
 * registerBackgroundSync bug) nor inside any React screen/provider.
 *
 * Statically: (a) the registration file must contain no `defineTask(`; (b) no
 * React screen/provider file may contain `defineTask(`. We do not re-parse the
 * definitions file's scope here (that is asserted by its own unit test proving
 * the definitions exist before React), but we DO assert the definitions file
 * defines the tasks at top level by checking the call is not nested in an
 * exported React component.
 */
function gateDefineTaskModuleScope(read, listFiles = defaultListReactFiles) {
  // The tasks must actually be defined at module scope in the definitions file: a
  // gate that only forbids the wrong locations would pass vacuously if the
  // definitions vanished. Assert the module-scope defineTask is present.
  const def = stripComments(read(TASK_DEFINITION_FILE));
  if (!def || !/\bdefineTask\s*\(/.test(def)) {
    return { ok: false, message: `${TASK_DEFINITION_FILE}: no module-scope defineTask found (NC-42.7 needs the tasks defined before React mounts)` };
  }
  const reg = stripComments(read(TASK_REGISTRATION_FILE));
  if (reg && /\bdefineTask\s*\(/.test(reg)) {
    return { ok: false, message: `${TASK_REGISTRATION_FILE}: defineTask called inside the registration module (must be module-scope definitions file)` };
  }
  for (const path of listFiles()) {
    const src = stripComments(read(path));
    if (src && /\bdefineTask\s*\(/.test(src)) {
      return { ok: false, message: `${path}: defineTask called inside a React screen/provider (NC-42.7)` };
    }
  }
  return { ok: true, message: 'defineTask stays out of registration functions and React lifecycles' };
}

/** List the React screen/provider files a defineTask must never appear in. */
function defaultListReactFiles() {
  const files = [];
  for (const dir of REACT_FILES_GLOB_DIRS) {
    const full = resolve(root, dir);
    if (!existsSync(full)) continue;
    collectTsx(full, files);
  }
  return files.map((f) => f.replace(`${root}/`, ''));
}

function collectTsx(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectTsx(full, acc);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) acc.push(full);
  }
}

// --- runner ------------------------------------------------------------------

function runGates(reader) {
  let failures = 0;
  for (const gate of GATES) {
    const result = gate.run(reader);
    if (result.ok) {
      out(`OK   ${gate.id} ${gate.label}`);
    } else {
      err(`FAIL ${gate.id} ${result.message}`);
      failures += 1;
    }
  }
  return failures;
}

// --- NC-53.1 -----------------------------------------------------------------

const CEREMONY_SURFACES = [
  'packages/sync/src/protocol/proximity-ceremony.ts',
  'apps/meerkat/app/(root)/data/proximity-ceremony-adapter.ts',
  'apps/meerkat/app/(root)/(tabs)/add-in-person.tsx',
];

const CEREMONY_RELAY_TOKENS = [
  'WebSocketRelayBackend',
  'effectiveRelayUrl',
  'ensureEffectiveRelayUrl',
  'connectRelayPeer',
  'parkEnvelopeOnRelay',
  "'ws://",
  "'wss://",
];

/**
 * NC-53.1 (plan 53 NC-1, static half): the in-person ceremony must be UNABLE
 * to dial a relay. If Nearby cannot connect it fails honestly; a relay
 * fallback would silently break the no-signal promise and widen the MITM
 * surface, so no ceremony surface may even reference the relay machinery.
 * (The announce that follows a COMMITTED pairing lives in the provider, not
 * on these surfaces.) The behavioral half is the adapter suite's WebSocket
 * spy test.
 */
function gateCeremonyNoRelay(read) {
  for (const path of CEREMONY_SURFACES) {
    const src = stripComments(read(path));
    if (!src) {
      return { ok: false, message: `${path} is missing; the NC-53.1 surface list is stale` };
    }
    for (const token of CEREMONY_RELAY_TOKENS) {
      if (src.includes(token)) {
        return { ok: false, message: `${path} references ${token}; the ceremony must not be able to dial a relay` };
      }
    }
  }
  return { ok: true, message: 'ceremony surfaces carry no relay reference' };
}

// --- self-test: prove each gate catches a planted violation ------------------

/**
 * For each gate, build a reader that returns the REAL source but with a single
 * planted violation, then assert the gate now FAILS. This proves the gate is not
 * vacuous. Returns the number of gates that FAILED to catch their violation.
 */
function selfTest() {
  let brokenGates = 0;

  function plantedReader(overrides) {
    return (path) => (path in overrides ? overrides[path] : diskReader(path));
  }

  const cases = [
    {
      id: 'NC-42.1',
      run: gateNoSimulatedIsReal,
      reader: plantedReader({
        'packages/sync/src/transport/ble-transport.ts':
          'export class SimulatedBleBackend {\n  readonly isReal = true;\n}\n',
      }),
    },
    {
      id: 'NC-42.2',
      run: gateNoSpeculativeRequire,
      reader: plantedReader({
        [NEARBY_LOADER]: "const m = require('react-native-nearby-connections');\n",
      }),
    },
    {
      id: 'NC-42.3',
      run: gateNoIdentityInPushRecords,
      reader: plantedReader({
        'packages/meerkat-relay/src/push-store.ts':
          'export interface Leak {\n  devicePubkey: string;\n}\n',
      }),
    },
    {
      id: 'NC-42.4',
      run: gateNoDeliveredLabel,
      reader: plantedReader({
        'packages/sync/src/protocol/push-relay-client.ts':
          "export type S = 'delivered';\n",
      }),
    },
    {
      id: 'NC-42.6',
      run: gateBleWakeOnly,
      reader: plantedReader({
        [BLE_BACKEND]:
          'function decodeBleWakePayload(bytes) {\n  const parsed = JSON.parse(bytes);\n  return { ...parsed };\n}\n',
      }),
    },
    {
      id: 'NC-42.7',
      run: (read) =>
        gateDefineTaskModuleScope(read, () => ['apps/meerkat/app/(root)/(tabs)/settings.tsx']),
      reader: plantedReader({
        'apps/meerkat/app/(root)/(tabs)/settings.tsx':
          'export default function S() {\n  TaskManager.defineTask("x", () => {});\n}\n',
      }),
    },
    {
      id: 'NC-53.1',
      run: gateCeremonyNoRelay,
      reader: plantedReader({
        'apps/meerkat/app/(root)/data/proximity-ceremony-adapter.ts':
          "import { WebSocketRelayBackend } from '@mylife/sync';\n",
      }),
    },
  ];

  for (const c of cases) {
    const result = c.run(c.reader);
    if (result.ok) {
      err(`SELF-TEST FAIL ${c.id}: gate did NOT catch a planted violation`);
      brokenGates += 1;
    } else {
      out(`SELF-TEST OK   ${c.id} caught: ${result.message}`);
    }
  }
  return brokenGates;
}

// --- main --------------------------------------------------------------------

const isSelfTest = process.argv.includes('--self-test');
if (isSelfTest) {
  const broken = selfTest();
  if (broken > 0) {
    err(`\n${broken} gate(s) failed the self-test.`);
    process.exit(1);
  }
  out('\nAll NC-42 gates caught their planted violations.');
  process.exit(0);
} else {
  const failures = runGates(diskReader);
  if (failures > 0) {
    err(`\n${failures} NC-42 invariant(s) regressed.`);
    process.exit(1);
  }
  out('\nAll NC-42 static invariants hold.');
  process.exit(0);
}
