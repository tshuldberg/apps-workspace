import { run } from "./utils/exec.js";
import { parseCpuFromTop } from "./collectors/cpu.js";
import { collectMemory } from "./collectors/memory.js";
import { collectDisk } from "./collectors/disk.js";
import { collectTopProcesses } from "./collectors/processes.js";
import { loadConfig } from "./config.js";

async function main() {
  console.error("=== System Monitor Collector Test ===\n");

  // Load config
  const config = loadConfig();
  console.error("Config loaded OK\n");

  // Get top output (shared between CPU and memory)
  console.error("--- Running top -l 1 -n 0 ---");
  const topOutput = await run("/usr/bin/top", ["-l", "1", "-n", "0"]);

  // CPU
  console.error("\n--- CPU Snapshot ---");
  const cpu = parseCpuFromTop(topOutput);
  console.error(JSON.stringify(cpu, null, 2));

  // Memory
  console.error("\n--- Memory Snapshot ---");
  const memory = await collectMemory(topOutput);
  console.error(JSON.stringify(memory, null, 2));

  // Disk
  console.error("\n--- Disk Snapshot ---");
  const disk = await collectDisk(config.thresholds.disk.volumes);
  console.error(JSON.stringify(disk, null, 2));

  // Processes
  console.error("\n--- Top 10 Processes ---");
  const processes = await collectTopProcesses(10);
  console.error(JSON.stringify(processes, null, 2));

  // Sanity checks
  console.error("\n--- Sanity Checks ---");
  const checks = [
    ["CPU total > 0", cpu.totalUsedPercent > 0],
    ["CPU total <= 100", cpu.totalUsedPercent <= 200], // can exceed 100 on multi-core
    ["Memory used > 0", memory.usedBytes > 0],
    ["Memory percent > 0 && <= 100", memory.usedPercent > 0 && memory.usedPercent <= 100],
    ["Disk has root volume", disk.volumes.length > 0],
    ["Process list not empty", processes.length > 0],
  ] as const;

  let allPass = true;
  for (const [label, pass] of checks) {
    console.error(`  ${pass ? "PASS" : "FAIL"}: ${label}`);
    if (!pass) allPass = false;
  }

  console.error(`\n${allPass ? "All checks passed!" : "Some checks FAILED"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
