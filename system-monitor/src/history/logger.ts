import { createWriteStream, statSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { WriteStream } from "node:fs";
import type { SystemSnapshot, HistoryEntry, HistoryConfig } from "../types.js";
import { logger } from "../utils/logger.js";

export class HistoryLogger {
  private buffer: HistoryEntry[] = [];
  private stream: WriteStream;
  private flushTimer: NodeJS.Timeout;
  private logDir: string;
  private logFile: string;
  private maxFileSizeBytes: number;
  private maxFiles: number;

  constructor(config: HistoryConfig) {
    this.logDir = resolve(config.logDir);
    this.logFile = join(this.logDir, "history.jsonl");
    this.maxFileSizeBytes = config.maxFileSizeMB * 1024 * 1024;
    this.maxFiles = config.maxFiles;

    mkdirSync(this.logDir, { recursive: true });
    this.stream = createWriteStream(this.logFile, { flags: "a" });

    this.flushTimer = setInterval(() => {
      this.flush();
    }, config.flushIntervalMs);
    this.flushTimer.unref();
  }

  append(snapshot: SystemSnapshot): void {
    this.buffer.push(this.compress(snapshot));
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const lines = this.buffer.map((e) => JSON.stringify(e)).join("\n") + "\n";
    this.stream.write(lines);
    this.buffer = [];
    this.checkRotation();
  }

  stop(): void {
    clearInterval(this.flushTimer);
    this.flush();
    this.stream.end();
  }

  private compress(snapshot: SystemSnapshot): HistoryEntry {
    return {
      ts: snapshot.timestamp,
      cpu: Math.round(snapshot.cpu.totalUsedPercent * 10) / 10,
      mem: Math.round(snapshot.memory.usedPercent * 10) / 10,
      memP: snapshot.memory.pressureLevel[0],
      dsk: snapshot.disk.volumes[0]?.usedPercent ?? 0,
      load: Math.round(snapshot.cpu.loadAvg[0] * 100) / 100,
    };
  }

  private checkRotation(): void {
    try {
      if (!existsSync(this.logFile)) return;
      const stats = statSync(this.logFile);
      if (stats.size < this.maxFileSizeBytes) return;

      logger.info(`Rotating history log (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      this.stream.end();

      // Shift existing rotated files
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const from = join(this.logDir, `history.${i}.jsonl`);
        const to = join(this.logDir, `history.${i + 1}.jsonl`);
        if (existsSync(from)) {
          if (i + 1 > this.maxFiles) {
            // oldest file, just let it be overwritten
          }
          renameSync(from, to);
        }
      }

      renameSync(this.logFile, join(this.logDir, "history.1.jsonl"));
      this.stream = createWriteStream(this.logFile, { flags: "a" });
    } catch (err) {
      logger.error("Log rotation failed:", err);
    }
  }
}
