# system-monitor

macOS system monitor daemon that runs 24/7 in the background, watches for CPU/memory/disk spikes, and generates detailed reports when thresholds are breached.

## Features

- **Threshold-based alerting** — configurable warn/critical levels for CPU, memory, and disk
- **Smart spike detection** — CPU alerts require sustained breach (default 30s) to avoid false alarms
- **Detailed reports** — markdown reports with full process list showing what's consuming resources
- **Native notifications** — macOS notification center alerts on spike detection
- **History logging** — JSONL trend data for long-term analysis (~770 KB/day)
- **Cooldown system** — prevents report spam during sustained high usage (5-min cooldown, 20/day cap)

## Quick Start

```bash
npm install
npm run build
npm run install-daemon   # installs + starts background monitoring
```

## Usage

```bash
# Dev mode (foreground, with debug output)
DEBUG=1 npm run dev

# Background daemon
npm run install-daemon     # install + start
npm run uninstall-daemon   # stop + remove

# Check status
launchctl print gui/$(id -u)/com.trey.system-monitor

# View logs
tail -f logs/daemon-stderr.log

# View history
tail logs/history.jsonl
```

## Reports

When a threshold is breached, a report is generated at:
```
/Users/trey/Desktop/Apps/docs/reports/REPORT-system-monitor-YYYY-MM-DD.md
```

Reports include:
- Which metric(s) triggered and at what values
- Full system state (CPU, memory breakdown, disk, load average)
- Top 20 processes sorted by CPU and by memory

## Configuration

Edit `config/monitor.json` to tune thresholds:

| Setting | Default | Description |
|---------|---------|-------------|
| `thresholds.cpu.warnPercent` | 80 | CPU usage warning threshold |
| `thresholds.cpu.criticalPercent` | 95 | CPU usage critical threshold |
| `thresholds.cpu.sustainedSeconds` | 30 | How long CPU must stay above warn before alerting |
| `thresholds.memory.warnPercent` | 80 | Memory usage warning threshold |
| `thresholds.memory.criticalPercent` | 90 | Memory usage critical threshold |
| `thresholds.disk.warnPercent` | 85 | Disk usage warning threshold |
| `polling.intervalMs` | 10000 | How often to check (milliseconds) |
| `cooldown.minSecondsBetweenReports` | 300 | Minimum seconds between reports |
| `cooldown.maxReportsPerDay` | 20 | Maximum reports per day |

## Resource Usage

- ~30-50 MB RAM (Node.js baseline)
- ~1% of one CPU core (100ms every 10s for system commands)
- ~770 KB/day disk for history logs (rotated at 50 MB)
