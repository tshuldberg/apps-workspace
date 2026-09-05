// The doomed middle of the process tree: stands in for the vitest worker that
// spawns a service bin. The test SIGKILLs this process, which is exactly the
// abnormal death (OOM kill, pkill, closed terminal) that used to strand the
// child forever.
//
// The child gets stdio 'ignore' so nothing about its survival depends on a pipe
// that dies with this process.
import { spawn } from 'node:child_process';

const [tsxCli, childPath, statusPath] = process.argv.slice(2);

const child = spawn(process.execPath, [tsxCli, childPath, statusPath], {
  stdio: 'ignore',
});

process.stdout.write(`${JSON.stringify({ event: 'child_spawned', pid: child.pid })}\n`);

// Hold the loop open until the test kills this process.
setInterval(() => {}, 1_000);
