import { loadConfig } from "./config.js";
import { MonitorLoop } from "./loop.js";
import { logger } from "./utils/logger.js";

async function main() {
  logger.info("Starting system-monitor daemon...");

  const config = loadConfig();
  const loop = new MonitorLoop(config);

  const shutdown = () => {
    logger.info("Shutting down...");
    loop.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  loop.start();
  logger.info(
    `Monitoring started (interval: ${config.polling.intervalMs}ms, ` +
    `CPU warn: ${config.thresholds.cpu.warnPercent}%, ` +
    `MEM warn: ${config.thresholds.memory.warnPercent}%, ` +
    `DISK warn: ${config.thresholds.disk.warnPercent}%)`,
  );
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
