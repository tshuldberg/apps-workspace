import { run } from "../utils/exec.js";
import type { ProcessInfo } from "../types.js";

export async function collectTopProcesses(count: number): Promise<ProcessInfo[]> {
  const output = await run("/usr/bin/top", [
    "-l", "2",
    "-n", String(count),
    "-o", "cpu",
    "-stats", "pid,command,cpu,mem",
  ], 10000);

  // Use second sample (after the blank line separating samples)
  const sections = output.split(/\n\n+/);
  const lastSection = sections[sections.length - 1] || output;

  const processes: ProcessInfo[] = [];
  const lines = lastSection.trim().split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s+([\d.]+)\s+([\d.]+[BKMGT][+-]?)\s*$/);
    if (!match) continue;

    const pid = parseInt(match[1], 10);
    const command = match[2].trim();
    const cpuPercent = parseFloat(match[3]);
    const memoryMB = parseMemToMB(match[4]);

    processes.push({ pid, command, cpuPercent, memoryMB });
  }

  return processes;
}

function parseMemToMB(s: string): number {
  const clean = s.replace(/[+-]$/, "");
  const match = clean.match(/^([\d.]+)([BKMGT])/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const toMB: Record<string, number> = {
    B: 1 / (1024 * 1024),
    K: 1 / 1024,
    M: 1,
    G: 1024,
    T: 1024 * 1024,
  };
  return val * (toMB[unit] ?? 0);
}
