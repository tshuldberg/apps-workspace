// Debug aid for the six-file collection hang (errors_log 2026-04-19 Partial).
//
// Injected into vitest fork workers via poolOptions.forks.execArgv
// ['--require', .../loadlog.cjs]. Patches Module._load so every CJS require
// (vitest externalizes react-native / expo packages to CJS, which is exactly
// the suspect class) appends enter/exit lines to /tmp/mobile-loadlog.txt.
// The last "[load>]" without a matching "[load<]" is the module that hangs.

const Module = require('module');
const fs = require('fs');

const LOG = process.env.MOBILE_LOADLOG_FILE || '/tmp/mobile-loadlog.txt';
const origLoad = Module._load;
let depth = 0;

function log(line) {
  try {
    fs.appendFileSync(LOG, line);
  } catch {
    // best effort
  }
}

log(`\n===== fork ${process.pid} start ${new Date().toISOString()} =====\n`);

Module._load = function patchedLoad(request, parent, isMain) {
  const pad = '  '.repeat(Math.min(depth, 20));
  log(`${pad}[load>] ${request}\n`);
  depth += 1;
  const started = Date.now();
  try {
    return origLoad.call(this, request, parent, isMain);
  } finally {
    depth -= 1;
    const ms = Date.now() - started;
    if (ms > 50) {
      log(`${pad}[load<] ${request} ${ms}ms\n`);
    } else {
      log(`${pad}[load<] ${request}\n`);
    }
  }
};

// RPC traffic tap: tinypool's forks channel rides Node IPC (process.send +
// 'message'). Logging both directions shows the last request the worker
// sent and whether the master ever answered — the lost message IS the bug.
function describeRpc(payload) {
  try {
    const seen = JSON.stringify(payload, (key, value) => {
      if (typeof value === 'string' && value.length > 120) {
        return `${value.slice(0, 120)}…(${value.length})`;
      }
      return value;
    });
    return seen.length > 600 ? `${seen.slice(0, 600)}…` : seen;
  } catch {
    return String(payload);
  }
}

const origSend = process.send ? process.send.bind(process) : null;
if (origSend) {
  process.send = function patchedSend(message, ...rest) {
    log(`[rpc>] ${describeRpc(message)}\n`);
    return origSend(message, ...rest);
  };
}

process.on('message', (message) => {
  log(`[rpc<] ${describeRpc(message)}\n`);
});
