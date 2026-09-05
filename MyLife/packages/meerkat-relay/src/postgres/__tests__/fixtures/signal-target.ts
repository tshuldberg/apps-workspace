import { writeFileSync } from 'node:fs';

const readyFile = process.env.MEERKAT_SIGNAL_READY_FILE;
const receivedFile = process.env.MEERKAT_SIGNAL_RECEIVED_FILE;

if (!readyFile || !receivedFile) throw new Error('Signal fixture paths are required');

writeFileSync(readyFile, String(process.pid));
process.on('SIGTERM', () => {
  writeFileSync(receivedFile, 'SIGTERM');
  process.exit(0);
});

setInterval(() => {}, 1_000);
