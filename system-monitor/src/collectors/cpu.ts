import os from "node:os";
import type { CpuSnapshot } from "../types.js";

const CPU_REGEX = /CPU usage:\s+([\d.]+)% user,\s+([\d.]+)% sys,\s+([\d.]+)% idle/;
const LOAD_REGEX = /Load Avg:\s+([\d.]+),\s+([\d.]+),\s+([\d.]+)/;

export function parseCpuFromTop(topOutput: string): CpuSnapshot {
  const cpuMatch = topOutput.match(CPU_REGEX);
  const loadMatch = topOutput.match(LOAD_REGEX);

  const userPercent = cpuMatch ? parseFloat(cpuMatch[1]) : 0;
  const systemPercent = cpuMatch ? parseFloat(cpuMatch[2]) : 0;
  const idlePercent = cpuMatch ? parseFloat(cpuMatch[3]) : 100;

  const loadAvg: [number, number, number] = loadMatch
    ? [
        parseFloat(loadMatch[1]),
        parseFloat(loadMatch[2]),
        parseFloat(loadMatch[3]),
      ]
    : (os.loadavg() as [number, number, number]);

  return {
    timestamp: new Date().toISOString(),
    userPercent,
    systemPercent,
    idlePercent,
    totalUsedPercent: userPercent + systemPercent,
    loadAvg,
  };
}
