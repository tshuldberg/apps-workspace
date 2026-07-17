import os from "node:os";
import { run } from "../utils/exec.js";
import type { MemorySnapshot, PressureLevel } from "../types.js";

const PHYSMEM_REGEX =
  /PhysMem:\s+([\d.]+)([BKMGT])\s+used\s+\((\S+)\s+wired,\s+(\S+)\s+compressor\),\s+([\d.]+)([BKMGT])\s+unused/;

const FREE_PCT_REGEX = /memory free percentage:\s+(\d+)%/;

function parseMemSize(value: string, unit: string): number {
  const num = parseFloat(value);
  const multipliers: Record<string, number> = {
    B: 1,
    K: 1024,
    M: 1024 ** 2,
    G: 1024 ** 3,
    T: 1024 ** 4,
  };
  return num * (multipliers[unit] ?? 1);
}

function parseSizeString(s: string): number {
  const match = s.match(/^([\d.]+)([BKMGT])/);
  if (!match) return 0;
  return parseMemSize(match[1], match[2]);
}

export function parseMemoryFromTop(topOutput: string): Omit<MemorySnapshot, "pressureLevel"> {
  const match = topOutput.match(PHYSMEM_REGEX);
  const totalBytes = os.totalmem();

  if (match) {
    const usedBytes = parseMemSize(match[1], match[2]);
    const wiredBytes = parseSizeString(match[3]);
    const compressedBytes = parseSizeString(match[4]);
    const freeBytes = parseMemSize(match[5], match[6]);

    return {
      timestamp: new Date().toISOString(),
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent: (usedBytes / (usedBytes + freeBytes)) * 100,
      wiredBytes,
      compressedBytes,
    };
  }

  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  return {
    timestamp: new Date().toISOString(),
    totalBytes,
    usedBytes,
    freeBytes,
    usedPercent: (usedBytes / totalBytes) * 100,
    wiredBytes: 0,
    compressedBytes: 0,
  };
}

export async function getPressureLevel(): Promise<PressureLevel> {
  try {
    const output = await run("/usr/bin/memory_pressure", []);
    const match = output.match(FREE_PCT_REGEX);
    if (match) {
      const freePct = parseInt(match[1], 10);
      if (freePct < 10) return "critical";
      if (freePct < 20) return "warn";
    }
    return "normal";
  } catch {
    return "normal";
  }
}

export async function collectMemory(topOutput: string): Promise<MemorySnapshot> {
  const mem = parseMemoryFromTop(topOutput);
  const pressureLevel = await getPressureLevel();
  return { ...mem, pressureLevel };
}
