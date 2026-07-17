import { execFile } from "node:child_process";
import type { AlertAggregation, NotificationConfig } from "../types.js";
import { logger } from "../utils/logger.js";

function escapeQuotes(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function sendNotification(
  aggregation: AlertAggregation,
  config: NotificationConfig,
): Promise<void> {
  if (!config.enabled) return;

  const maxSeverity = aggregation.alerts.some((a) => a.severity === "critical")
    ? "Critical"
    : "Warning";

  const messages = aggregation.alerts
    .map((a) => a.message)
    .slice(0, 3)
    .join(", ");

  const subtitle = escapeQuotes(maxSeverity);
  const body = escapeQuotes(messages);
  const sound = escapeQuotes(config.sound);

  const script = `display notification "${body}" with title "System Monitor" subtitle "${subtitle}" sound name "${sound}"`;

  return new Promise((resolve) => {
    execFile(
      "/usr/bin/osascript",
      ["-e", script],
      { timeout: 5000 },
      (err) => {
        if (err) {
          logger.error("Notification failed:", err.message);
        }
        resolve();
      },
    );
  });
}
