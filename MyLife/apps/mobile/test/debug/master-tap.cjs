// Master-side IPC tap. Preload into the vitest MAIN process:
//   node --require ./test/debug/master-tap.cjs ../../node_modules/vitest/vitest.mjs run ...
// Wraps child_process.fork so every spawned worker's channel logs both
// directions to /tmp/mobile-mastertap.txt. Lets us tell apart:
//   worker->master loss  (request never arrives)
//   handler never replies (request arrives, no response sent)
//   master->worker loss  (response sent, never received by worker)

const cp = require('child_process');
const fs = require('fs');

const LOG = process.env.MOBILE_MASTERTAP_FILE || '/tmp/mobile-mastertap.txt';

function log(line) {
  try {
    fs.appendFileSync(LOG, line);
  } catch {
    // best effort
  }
}

function describe(message) {
  try {
    let text;
    if (Buffer.isBuffer(message)) {
      text = message.toString('utf8');
    } else if (message && message.type === 'Buffer' && Array.isArray(message.data)) {
      text = Buffer.from(message.data).toString('utf8');
    } else {
      text = JSON.stringify(message);
    }
    text = String(text).replace(/[^\x20-\x7E]/g, '|');
    const method = (text.match(/m"\|([a-zA-Z]+)"/) || [])[1] || '';
    const id = (text.match(/i"\|([A-Za-z0-9_-]{21})/) || [])[1] || '';
    return `${method || '?'} ${id || '?'} :: ${text.slice(0, 160)}`;
  } catch (err) {
    return `describe-failed ${err}`;
  }
}

log(`\n===== master ${process.pid} start ${new Date().toISOString()} =====\n`);

const origFork = cp.fork;
cp.fork = function patchedFork(...args) {
  const child = origFork.apply(this, args);
  log(`[fork] pid=${child.pid}\n`);

  child.on('message', (message) => {
    log(`[m<w] ${describe(message)}\n`);
  });

  const origSend = child.send.bind(child);
  child.send = function patchedSend(message, ...rest) {
    log(`[m>w] ${describe(message)}\n`);
    return origSend(message, ...rest);
  };

  return child;
};
