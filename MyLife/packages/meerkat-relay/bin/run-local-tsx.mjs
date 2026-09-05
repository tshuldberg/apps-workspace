import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const FORWARDED_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGQUIT'];

export async function runLocalTsx(relativeEntry) {
  const tsxCli = require.resolve('tsx/cli');
  const entry = fileURLToPath(new URL(relativeEntry, import.meta.url));
  const child = spawn(
    process.execPath,
    [tsxCli, entry, ...process.argv.slice(2)],
    { env: process.env, stdio: 'inherit' },
  );
  let forwardedSignal;
  const handlers = new Map();

  for (const signal of FORWARDED_SIGNALS) {
    const handler = () => {
      forwardedSignal ??= signal;
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  const result = await new Promise((resolve) => {
    let spawnError;
    child.once('error', (error) => {
      spawnError = error;
    });
    child.once('close', (status, signal) => resolve({ error: spawnError, signal, status }));
  });

  for (const [signal, handler] of handlers) process.off(signal, handler);

  if (result.error) {
    process.stdout.write(`${JSON.stringify({
      event: 'fatal',
      reason: 'cli_spawn_failed',
      detail: result.error.message,
    })}\n`);
    process.exitCode = 1;
    return;
  }
  const terminationSignal = forwardedSignal ?? result.signal;
  if (terminationSignal) {
    process.kill(process.pid, terminationSignal);
    return;
  }
  process.exitCode = result.status ?? 1;
}
