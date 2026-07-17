# system-monitor Timeline

## 2026-02-08 — Initial Build

**Session:** Project creation and full implementation

**Changes:**
- Created project structure with TypeScript, Zod config validation
- Implemented CPU, memory, and disk collectors parsing `top`, `vm_stat`, `memory_pressure`, and `df` output
- Built alert evaluator with sustained-breach tracking (CPU), pressure-level detection (memory), and aggregate windowing
- Added markdown report generator with process snapshots
- Added native macOS notification support via osascript
- Built JSONL history logger with buffered flush and file rotation
- Created launchd plist for 24/7 background operation with low-priority scheduling
- Created install/uninstall scripts

**Key decisions:**
- Used `top -l 1 -n 0` (single call) for both CPU and memory data, avoiding duplicate process spawns
- Process list collection (`top -l 2`) deferred until alert triggers — expensive call only runs when needed
- Sustained-seconds requirement for CPU prevents false alarms from brief compile bursts
- Aggregate window (60s) combines multiple metric breaches into a single report
