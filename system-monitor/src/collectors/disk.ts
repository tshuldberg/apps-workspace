import { run } from "../utils/exec.js";
import type { DiskSnapshot, DiskVolume } from "../types.js";

export async function collectDisk(volumes: string[]): Promise<DiskSnapshot> {
  const output = await run("/bin/df", ["-h"]);
  const lines = output.trim().split("\n").slice(1); // skip header
  const volumeSet = new Set(volumes);

  const parsed: DiskVolume[] = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const mountPoint = parts.slice(8).join(" ");
    if (!volumeSet.has(mountPoint)) continue;

    const filesystem = parts[0];
    const totalGB = parseDfSize(parts[1]);
    const usedGB = parseDfSize(parts[2]);
    const availGB = parseDfSize(parts[3]);
    const capacityStr = parts[4];
    const usedPercent = parseInt(capacityStr.replace("%", ""), 10) || 0;

    parsed.push({ filesystem, mountPoint, totalGB, usedGB, availGB, usedPercent });
  }

  return {
    timestamp: new Date().toISOString(),
    volumes: parsed,
  };
}

function parseDfSize(s: string): number {
  const match = s.match(/^([\d.]+)([BKMGTP]i?)$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase().replace("I", "");
  const divisors: Record<string, number> = {
    B: 1024 ** 3,
    K: 1024 ** 2,
    M: 1024,
    G: 1,
    T: 0.001,
  };
  return val / (divisors[unit] ?? 1);
}
