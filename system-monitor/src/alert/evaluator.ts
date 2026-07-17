import type {
  MonitorConfig,
  SystemSnapshot,
  Alert,
  AlertSeverity,
  AlertAggregation,
  PressureLevel,
} from "../types.js";
import { logger } from "../utils/logger.js";

const PRESSURE_LEVELS: Record<PressureLevel, number> = {
  normal: 0,
  warn: 1,
  critical: 2,
};

export class AlertEvaluator {
  private cpuBreachStart: Date | null = null;
  private lastReportTime: Date | null = null;
  private reportsToday = 0;
  private reportDateKey = "";
  private pendingAlerts: Alert[] = [];
  private aggregateWindowStart: Date | null = null;
  private pendingSnapshot: SystemSnapshot | null = null;

  evaluate(
    snapshot: SystemSnapshot,
    config: MonitorConfig,
  ): { aggregation: AlertAggregation | null; suppressed: boolean; reason?: string } {
    const now = new Date();
    const alerts = this.checkThresholds(snapshot, config, now);

    // Reset daily counter on new day
    const dateKey = now.toISOString().slice(0, 10);
    if (dateKey !== this.reportDateKey) {
      this.reportDateKey = dateKey;
      this.reportsToday = 0;
    }

    if (alerts.length === 0) {
      // No active alerts — flush any pending aggregate if window expired
      return this.tryFlushPending(now, config);
    }

    // Daily cap
    if (this.reportsToday >= config.cooldown.maxReportsPerDay) {
      return { aggregation: null, suppressed: true, reason: "daily report cap reached" };
    }

    // Cooldown check
    if (this.lastReportTime) {
      const elapsed = (now.getTime() - this.lastReportTime.getTime()) / 1000;
      if (elapsed < config.cooldown.minSecondsBetweenReports) {
        return { aggregation: null, suppressed: true, reason: `cooldown (${Math.round(config.cooldown.minSecondsBetweenReports - elapsed)}s remaining)` };
      }
    }

    // Add to aggregate window
    if (this.aggregateWindowStart === null) {
      this.aggregateWindowStart = now;
      this.pendingAlerts = alerts;
      this.pendingSnapshot = snapshot;
      logger.info("Aggregate window opened");
      return { aggregation: null, suppressed: false };
    }

    const windowElapsed = (now.getTime() - this.aggregateWindowStart.getTime()) / 1000;
    if (windowElapsed < config.cooldown.aggregateWindowSeconds) {
      // Still within aggregate window — collect alerts
      this.pendingAlerts.push(...alerts);
      this.pendingSnapshot = snapshot; // keep latest snapshot
      return { aggregation: null, suppressed: false };
    }

    // Window expired — flush
    this.pendingAlerts.push(...alerts);
    this.pendingSnapshot = snapshot;
    return this.flushPending(now);
  }

  private tryFlushPending(
    now: Date,
    config: MonitorConfig,
  ): { aggregation: AlertAggregation | null; suppressed: boolean; reason?: string } {
    if (this.pendingAlerts.length === 0 || !this.aggregateWindowStart) {
      return { aggregation: null, suppressed: false };
    }

    const windowElapsed = (now.getTime() - this.aggregateWindowStart.getTime()) / 1000;
    if (windowElapsed >= config.cooldown.aggregateWindowSeconds) {
      return this.flushPending(now);
    }

    return { aggregation: null, suppressed: false };
  }

  private flushPending(now: Date): {
    aggregation: AlertAggregation | null;
    suppressed: boolean;
  } {
    if (this.pendingAlerts.length === 0 || !this.pendingSnapshot) {
      this.resetPending();
      return { aggregation: null, suppressed: false };
    }

    const aggregation: AlertAggregation = {
      alerts: this.deduplicateAlerts(this.pendingAlerts),
      snapshot: this.pendingSnapshot,
      windowStart: this.aggregateWindowStart?.toISOString() ?? now.toISOString(),
      windowEnd: now.toISOString(),
    };

    this.lastReportTime = now;
    this.reportsToday++;
    this.resetPending();

    logger.info(`Flushing ${aggregation.alerts.length} alerts (report #${this.reportsToday} today)`);
    return { aggregation, suppressed: false };
  }

  private resetPending(): void {
    this.pendingAlerts = [];
    this.aggregateWindowStart = null;
    this.pendingSnapshot = null;
  }

  private checkThresholds(
    snapshot: SystemSnapshot,
    config: MonitorConfig,
    now: Date,
  ): Alert[] {
    const alerts: Alert[] = [];
    const ts = now.toISOString();

    // CPU — sustained tracking
    const cpuUsed = snapshot.cpu.totalUsedPercent;
    if (cpuUsed >= config.thresholds.cpu.warnPercent) {
      if (!this.cpuBreachStart) {
        this.cpuBreachStart = now;
        logger.debug(`CPU breach started at ${cpuUsed.toFixed(1)}%`);
      }
      const sustained = (now.getTime() - this.cpuBreachStart.getTime()) / 1000;
      if (sustained >= config.thresholds.cpu.sustainedSeconds) {
        const severity: AlertSeverity =
          cpuUsed >= config.thresholds.cpu.criticalPercent ? "critical" : "warn";
        alerts.push({
          metric: "cpu",
          severity,
          value: cpuUsed,
          threshold: severity === "critical"
            ? config.thresholds.cpu.criticalPercent
            : config.thresholds.cpu.warnPercent,
          message: `CPU at ${cpuUsed.toFixed(1)}% for ${Math.round(sustained)}s`,
          timestamp: ts,
          sustainedSince: this.cpuBreachStart.toISOString(),
        });
      }
    } else {
      if (this.cpuBreachStart) {
        logger.debug("CPU breach ended");
      }
      this.cpuBreachStart = null;
    }

    // Memory — percentage or pressure level
    const memUsed = snapshot.memory.usedPercent;
    const memPressure = snapshot.memory.pressureLevel;
    const pressureBreached =
      PRESSURE_LEVELS[memPressure] >=
      PRESSURE_LEVELS[config.thresholds.memory.pressureLevel];

    if (memUsed >= config.thresholds.memory.warnPercent || pressureBreached) {
      const severity: AlertSeverity =
        memUsed >= config.thresholds.memory.criticalPercent || memPressure === "critical"
          ? "critical"
          : "warn";
      alerts.push({
        metric: "memory",
        severity,
        value: memUsed,
        threshold: severity === "critical"
          ? config.thresholds.memory.criticalPercent
          : config.thresholds.memory.warnPercent,
        message: `Memory at ${memUsed.toFixed(1)}% (pressure: ${memPressure})`,
        timestamp: ts,
      });
    }

    // Disk — per volume
    for (const vol of snapshot.disk.volumes) {
      if (vol.usedPercent >= config.thresholds.disk.warnPercent) {
        const severity: AlertSeverity =
          vol.usedPercent >= config.thresholds.disk.criticalPercent ? "critical" : "warn";
        alerts.push({
          metric: "disk",
          severity,
          value: vol.usedPercent,
          threshold: severity === "critical"
            ? config.thresholds.disk.criticalPercent
            : config.thresholds.disk.warnPercent,
          message: `Disk ${vol.mountPoint} at ${vol.usedPercent}%`,
          timestamp: ts,
        });
      }
    }

    return alerts;
  }

  private deduplicateAlerts(alerts: Alert[]): Alert[] {
    const seen = new Map<string, Alert>();
    for (const alert of alerts) {
      const key = `${alert.metric}-${alert.severity}`;
      const existing = seen.get(key);
      // Keep the one with the highest value
      if (!existing || alert.value > existing.value) {
        seen.set(key, alert);
      }
    }
    return Array.from(seen.values());
  }
}
