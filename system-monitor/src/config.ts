import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "./utils/logger.js";
import type { MonitorConfig } from "./types.js";

const ConfigSchema = z.object({
  polling: z
    .object({
      intervalMs: z.number().min(1000).max(300000).default(10000),
      processSnapshotCount: z.number().min(5).max(100).default(30),
    })
    .default({}),
  thresholds: z
    .object({
      cpu: z
        .object({
          warnPercent: z.number().min(1).max(100).default(80),
          criticalPercent: z.number().min(1).max(100).default(95),
          sustainedSeconds: z.number().min(0).max(600).default(30),
        })
        .default({}),
      memory: z
        .object({
          warnPercent: z.number().min(1).max(100).default(80),
          criticalPercent: z.number().min(1).max(100).default(90),
          pressureLevel: z
            .enum(["normal", "warn", "critical"])
            .default("warn"),
        })
        .default({}),
      disk: z
        .object({
          warnPercent: z.number().min(1).max(100).default(85),
          criticalPercent: z.number().min(1).max(100).default(95),
          volumes: z.array(z.string()).default(["/"]),
        })
        .default({}),
    })
    .default({}),
  cooldown: z
    .object({
      minSecondsBetweenReports: z.number().min(0).default(300),
      aggregateWindowSeconds: z.number().min(0).default(60),
      maxReportsPerDay: z.number().min(1).default(20),
    })
    .default({}),
  notifications: z
    .object({
      enabled: z.boolean().default(true),
      sound: z.string().default("Funk"),
    })
    .default({}),
  reports: z
    .object({
      outputDir: z
        .string()
        .default("/Users/trey/Desktop/Apps/docs/reports"),
      namingPrefix: z.string().default("REPORT-system-monitor"),
    })
    .default({}),
  history: z
    .object({
      logDir: z.string().default("logs"),
      maxFileSizeMB: z.number().min(1).default(50),
      maxFiles: z.number().min(1).default(10),
      flushIntervalMs: z.number().min(1000).default(60000),
    })
    .default({}),
});

export function loadConfig(): MonitorConfig {
  const configPath = resolve(
    process.env.SYSTEM_MONITOR_CONFIG ?? "config/monitor.json",
  );
  logger.info(`Loading config from ${configPath}`);

  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      logger.warn("Config file not found, using defaults");
    } else {
      throw err;
    }
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    logger.error("Invalid config:", result.error.format());
    process.exit(1);
  }

  return result.data as MonitorConfig;
}
