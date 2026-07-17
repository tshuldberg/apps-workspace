# system-monitor Data Models & Architecture Diagrams

Generated: 2026-02-09

---

## 1. Entity Relationship Diagram (Data Types)

This erDiagram captures every TypeScript interface in `src/types.ts` plus the Zod config schema from `src/config.ts`. Relationships show how snapshots compose into aggregations and how config governs thresholds.

```mermaid
erDiagram
    MonitorConfig {
        PollingConfig polling
        ThresholdConfig thresholds
        CooldownConfig cooldown
        NotificationConfig notifications
        ReportConfig reports
        HistoryConfig history
    }

    PollingConfig {
        number intervalMs "default 10000"
        number processSnapshotCount "default 30"
    }

    ThresholdConfig {
        CpuThreshold cpu
        MemoryThreshold memory
        DiskThreshold disk
    }

    CpuThreshold {
        number warnPercent "default 80"
        number criticalPercent "default 95"
        number sustainedSeconds "default 30"
    }

    MemoryThreshold {
        number warnPercent "default 80"
        number criticalPercent "default 90"
        PressureLevel pressureLevel "default warn"
    }

    DiskThreshold {
        number warnPercent "default 85"
        number criticalPercent "default 95"
        string_array volumes "default root"
    }

    CooldownConfig {
        number minSecondsBetweenReports "default 300"
        number aggregateWindowSeconds "default 60"
        number maxReportsPerDay "default 20"
    }

    NotificationConfig {
        boolean enabled "default true"
        string sound "default Funk"
    }

    ReportConfig {
        string outputDir
        string namingPrefix
    }

    HistoryConfig {
        string logDir
        number maxFileSizeMB "default 50"
        number maxFiles "default 10"
        number flushIntervalMs "default 60000"
    }

    SystemSnapshot {
        string timestamp
        CpuSnapshot cpu
        MemorySnapshot memory
        DiskSnapshot disk
        ProcessInfo_array topProcesses
    }

    CpuSnapshot {
        string timestamp
        number userPercent
        number systemPercent
        number idlePercent
        number totalUsedPercent
        number_tuple loadAvg "1m 5m 15m"
    }

    MemorySnapshot {
        string timestamp
        number totalBytes
        number usedBytes
        number freeBytes
        number usedPercent
        number wiredBytes
        number compressedBytes
        PressureLevel pressureLevel "normal warn critical"
    }

    DiskSnapshot {
        string timestamp
        DiskVolume_array volumes
    }

    DiskVolume {
        string filesystem
        string mountPoint
        number totalGB
        number usedGB
        number availGB
        number usedPercent
    }

    ProcessInfo {
        number pid
        string command
        number cpuPercent
        number memoryMB
    }

    Alert {
        MetricType metric "cpu memory disk"
        AlertSeverity severity "warn critical"
        number value
        number threshold
        string message
        string timestamp
        string sustainedSince "optional"
    }

    AlertAggregation {
        Alert_array alerts
        SystemSnapshot snapshot
        string windowStart
        string windowEnd
    }

    HistoryEntry {
        string ts
        number cpu
        number mem
        string memP "n w c"
        number dsk
        number load
    }

    MonitorConfig ||--|| PollingConfig : "has"
    MonitorConfig ||--|| ThresholdConfig : "has"
    MonitorConfig ||--|| CooldownConfig : "has"
    MonitorConfig ||--|| NotificationConfig : "has"
    MonitorConfig ||--|| ReportConfig : "has"
    MonitorConfig ||--|| HistoryConfig : "has"
    ThresholdConfig ||--|| CpuThreshold : "has"
    ThresholdConfig ||--|| MemoryThreshold : "has"
    ThresholdConfig ||--|| DiskThreshold : "has"
    SystemSnapshot ||--|| CpuSnapshot : "contains"
    SystemSnapshot ||--|| MemorySnapshot : "contains"
    SystemSnapshot ||--|| DiskSnapshot : "contains"
    SystemSnapshot ||--o{ ProcessInfo : "contains 0..N"
    DiskSnapshot ||--|{ DiskVolume : "contains"
    AlertAggregation ||--|{ Alert : "aggregates"
    AlertAggregation ||--|| SystemSnapshot : "captures"
    SystemSnapshot ||--|| HistoryEntry : "compresses to"
```

---

## 2. System Architecture Flowchart (Monitoring Pipeline)

This flowchart shows the runtime data flow from process startup through collection, evaluation, and output stages. Each box maps to a source file.

```mermaid
flowchart LR
    subgraph BOOTSTRAP["Bootstrap (index.ts)"]
        A1[Load Config\nconfig.ts + Zod] --> A2[Create MonitorLoop\nloop.ts]
        A2 --> A3[Register SIGINT/SIGTERM\nGraceful Shutdown]
    end

    subgraph DAEMON["Daemon Loop (loop.ts)"]
        B1[setInterval\npolling.intervalMs] --> B2[poll]
    end

    subgraph COLLECTORS["Collectors (collectors/)"]
        C1["top -l 1 -n 0\ncpu.ts"] --> C4[CpuSnapshot]
        C2["top output + memory_pressure\nmemory.ts"] --> C5[MemorySnapshot]
        C3["df -h\ndisk.ts"] --> C6[DiskSnapshot]
        C7["top -l 2 -o cpu\nprocesses.ts"] --> C8[ProcessInfo array]
    end

    subgraph EVALUATION["Alert Evaluation (alert/evaluator.ts)"]
        D1{Check CPU\nSustained Breach?}
        D2{Check Memory\nPercent or Pressure?}
        D3{Check Disk\nPer Volume?}
        D4[Aggregate Window\nCollect Alerts]
        D5{Cooldown?\nDaily Cap?}
        D6[Flush AlertAggregation]
    end

    subgraph OUTPUTS["Outputs"]
        E1["Markdown Report\nalert/reporter.ts\ndocs/reports/REPORT-*.md"]
        E2["macOS Notification\nalert/notifier.ts\nosascript"]
        E3["JSONL History\nhistory/logger.ts\nlogs/history.jsonl"]
    end

    subgraph LAUNCHD["launchd Agent"]
        F1[com.system-monitor.plist\nKeepAlive + RunAtLoad]
    end

    BOOTSTRAP --> DAEMON
    B2 --> C1
    B2 --> C2
    B2 --> C3
    C4 --> D1
    C5 --> D2
    C6 --> D3
    D1 --> D4
    D2 --> D4
    D3 --> D4
    D4 --> D5
    D5 -->|suppressed| B1
    D5 -->|allowed| D6
    D6 --> C7
    C8 --> E1
    D6 --> E2
    B2 --> E3
    LAUNCHD -.->|manages| BOOTSTRAP

    style BOOTSTRAP fill:#1a1a2e,stroke:#e94560,color:#eee
    style DAEMON fill:#16213e,stroke:#0f3460,color:#eee
    style COLLECTORS fill:#0f3460,stroke:#53a8b6,color:#eee
    style EVALUATION fill:#1a1a2e,stroke:#e94560,color:#eee
    style OUTPUTS fill:#16213e,stroke:#53a8b6,color:#eee
    style LAUNCHD fill:#0f3460,stroke:#e94560,color:#eee
```

---

## 3. Minimal Entity Diagram (Quick Reference)

Compact version showing only the core data flow entities and their primary relationships.

```mermaid
erDiagram
    MonitorConfig ||--|| ThresholdConfig : governs
    MonitorConfig ||--|| CooldownConfig : governs

    SystemSnapshot ||--|| CpuSnapshot : has
    SystemSnapshot ||--|| MemorySnapshot : has
    SystemSnapshot ||--|| DiskSnapshot : has
    SystemSnapshot ||--o{ ProcessInfo : has

    AlertAggregation ||--|{ Alert : contains
    AlertAggregation ||--|| SystemSnapshot : references

    SystemSnapshot ||--|| HistoryEntry : compresses-to

    CpuSnapshot {
        number totalUsedPercent
        number_tuple loadAvg
    }

    MemorySnapshot {
        number usedPercent
        PressureLevel pressureLevel
    }

    DiskSnapshot {
        DiskVolume_array volumes
    }

    Alert {
        MetricType metric
        AlertSeverity severity
        number value
    }

    HistoryEntry {
        number cpu
        number mem
        number dsk
    }
```

---

## Key Architectural Notes

1. **Single top invocation:** CPU and memory collectors share a single `top -l 1` call per poll cycle. Process list collection (`top -l 2`) only runs when an alert fires (expensive operation deferred).

2. **Sustained breach tracking:** CPU alerts require the threshold to be exceeded for `sustainedSeconds` continuously. The evaluator tracks `cpuBreachStart` and resets it when CPU drops below warn level.

3. **Three-tier suppression:** Alerts pass through (a) aggregate window collection (60s default), (b) cooldown timer (300s between reports), and (c) daily cap (20 reports/day).

4. **History compression:** Full `SystemSnapshot` objects are compressed to minimal `HistoryEntry` records (6 fields vs ~20+) before JSONL logging. Memory pressure is reduced to a single character (`n`/`w`/`c`).

5. **Log rotation:** JSONL files rotate at 50 MB by default, keeping up to 10 rotated files (`history.1.jsonl` through `history.10.jsonl`).

6. **No shell execution:** All system commands use `execFile()` (not shell-based execution) to prevent injection. Commands use hardcoded absolute paths (`/usr/bin/top`, `/bin/df`, `//usr/bin/memory_pressure`).
