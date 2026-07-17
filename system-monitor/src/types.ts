// ─── Config ─────────────────────────────────────────────────────

export interface MonitorConfig {
  polling: PollingConfig;
  thresholds: ThresholdConfig;
  cooldown: CooldownConfig;
  notifications: NotificationConfig;
  reports: ReportConfig;
  history: HistoryConfig;
}

export interface PollingConfig {
  intervalMs: number;
  processSnapshotCount: number;
}

export interface ThresholdConfig {
  cpu: CpuThreshold;
  memory: MemoryThreshold;
  disk: DiskThreshold;
}

export interface CpuThreshold {
  warnPercent: number;
  criticalPercent: number;
  sustainedSeconds: number;
}

export interface MemoryThreshold {
  warnPercent: number;
  criticalPercent: number;
  pressureLevel: PressureLevel;
}

export interface DiskThreshold {
  warnPercent: number;
  criticalPercent: number;
  volumes: string[];
}

export interface CooldownConfig {
  minSecondsBetweenReports: number;
  aggregateWindowSeconds: number;
  maxReportsPerDay: number;
}

export interface NotificationConfig {
  enabled: boolean;
  sound: string;
}

export interface ReportConfig {
  outputDir: string;
  namingPrefix: string;
}

export interface HistoryConfig {
  logDir: string;
  maxFileSizeMB: number;
  maxFiles: number;
  flushIntervalMs: number;
}

// ─── Metrics ────────────────────────────────────────────────────

export interface CpuSnapshot {
  timestamp: string;
  userPercent: number;
  systemPercent: number;
  idlePercent: number;
  totalUsedPercent: number;
  loadAvg: [number, number, number];
}

export type PressureLevel = "normal" | "warn" | "critical";

export interface MemorySnapshot {
  timestamp: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  wiredBytes: number;
  compressedBytes: number;
  pressureLevel: PressureLevel;
}

export interface DiskSnapshot {
  timestamp: string;
  volumes: DiskVolume[];
}

export interface DiskVolume {
  filesystem: string;
  mountPoint: string;
  totalGB: number;
  usedGB: number;
  availGB: number;
  usedPercent: number;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  cpuPercent: number;
  memoryMB: number;
}

export interface SystemSnapshot {
  timestamp: string;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  disk: DiskSnapshot;
  topProcesses: ProcessInfo[];
}

// ─── Alerts ─────────────────────────────────────────────────────

export type AlertSeverity = "warn" | "critical";
export type MetricType = "cpu" | "memory" | "disk";

export interface Alert {
  metric: MetricType;
  severity: AlertSeverity;
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
  sustainedSince?: string;
}

export interface AlertAggregation {
  alerts: Alert[];
  snapshot: SystemSnapshot;
  windowStart: string;
  windowEnd: string;
}

// ─── History ────────────────────────────────────────────────────

export interface HistoryEntry {
  ts: string;
  cpu: number;
  mem: number;
  memP: string;
  dsk: number;
  load: number;
}
