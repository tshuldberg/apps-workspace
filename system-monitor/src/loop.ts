import type { MonitorConfig, SystemSnapshot } from "./types.js";
import { run } from "./utils/exec.js";
import { parseCpuFromTop } from "./collectors/cpu.js";
import { collectMemory } from "./collectors/memory.js";
import { collectDisk } from "./collectors/disk.js";
import { collectTopProcesses } from "./collectors/processes.js";
import { AlertEvaluator } from "./alert/evaluator.js";
import { sendNotification } from "./alert/notifier.js";
import { generateReport } from "./alert/reporter.js";
import { HistoryLogger } from "./history/logger.js";
import { logger } from "./utils/logger.js";

export class MonitorLoop {
  private config: MonitorConfig;
  private timer: NodeJS.Timeout | null = null;
  private evaluator: AlertEvaluator;
  private historyLogger: HistoryLogger;
  private pollCount = 0;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.evaluator = new AlertEvaluator();
    this.historyLogger = new HistoryLogger(config.history);
  }

  start(): void {
    // Initial poll
    this.poll().catch((err) => logger.error("Initial poll failed:", err));

    this.timer = setInterval(() => {
      this.poll().catch((err) => logger.error("Poll failed:", err));
    }, this.config.polling.intervalMs);
    // Do NOT .unref() — this timer is what keeps the daemon process alive
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.historyLogger.stop();
    logger.info("Monitor loop stopped");
  }

  private async poll(): Promise<void> {
    this.pollCount++;
    const isDebug = !!process.env.DEBUG;

    try {
      // 1. Collect system metrics (one top call for CPU + memory)
      const topOutput = await run("/usr/bin/top", ["-l", "1", "-n", "0"]);
      const cpu = parseCpuFromTop(topOutput);
      const memory = await collectMemory(topOutput);
      const disk = await collectDisk(this.config.thresholds.disk.volumes);

      const snapshot: SystemSnapshot = {
        timestamp: new Date().toISOString(),
        cpu,
        memory,
        disk,
        topProcesses: [], // populated on-demand below
      };

      // 2. Log history
      this.historyLogger.append(snapshot);

      if (isDebug && this.pollCount % 6 === 0) {
        logger.debug(
          `Poll #${this.pollCount}: CPU=${cpu.totalUsedPercent.toFixed(1)}% MEM=${memory.usedPercent.toFixed(1)}% (${memory.pressureLevel}) DISK=${disk.volumes[0]?.usedPercent ?? 0}%`,
        );
      }

      // 3. Evaluate thresholds
      const result = this.evaluator.evaluate(snapshot, this.config);

      if (result.suppressed) {
        logger.debug(`Alert suppressed: ${result.reason}`);
        return;
      }

      if (!result.aggregation) return;

      // 4. Collect process list (expensive, only on alert)
      logger.info("Threshold breached — collecting process list...");
      const processes = await collectTopProcesses(
        this.config.polling.processSnapshotCount,
      );
      result.aggregation.snapshot.topProcesses = processes;

      // 5. Generate report
      generateReport(result.aggregation, this.config.reports);

      // 6. Send notification
      await sendNotification(result.aggregation, this.config.notifications);
    } catch (err) {
      logger.error("Poll cycle error:", err);
    }
  }
}
