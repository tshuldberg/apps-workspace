# Hub Backup & Restore -- UI/UX Implementation Prompt

**Screen:** Backup & Restore (local archive, cloud sync, system restore)
**Route:** `apps/mobile/app/(hub)/backup.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/backup_restore/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/backup.tsx` (8.5 KB) |
| Auto-backup hook | `apps/mobile/hooks/use-auto-backup.ts` |
| Database provider | `apps/mobile/components/DatabaseProvider.tsx` (triggers auto-backup on init) |
| DB package | `packages/db/` (@mylife/db, SQLite file management) |
| File export | `expo-file-system` + `expo-sharing` for .mylife file export |
| File import | `expo-document-picker` for .mylife/.sqlite file import |

**Notes:**
- Export format: the .mylife file is a renamed SQLite database. Use `expo-file-system` to copy the DB file and `expo-sharing` to present the share sheet.
- Import: use `expo-document-picker` to select files, then copy into the app's document directory and run migrations.
- "MyLife Cloud" sync toggle and history should connect to whatever cloud backup service is implemented (currently may be placeholder).
- System Restore requires listing available snapshots. Auto-backup creates timestamped copies that can be listed from the file system.
- Archive integrity (AES encryption) is aspirational in the Stitch design. Note if encryption is not yet implemented.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent, glass morphism)

Component: MyLife Backup & Restore (local export, cloud sync, restore from snapshot)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/backup.tsx

Build the MyLife backup and restore screen. This is a settings sub-screen with three distinct zones: local archive management, cloud sync status, and system restore. Uses card-based sections with clear visual hierarchy.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- primary: #ffb877 / #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- error: #ffb4ab
- error-container: #93000a

LAYOUT:

1. TOP APP BAR (fixed)

2. PAGE HEADER
   - Title: "Backup & Restore" (4xl extrabold tracking-tight on-surface)
   - Subtitle: "ARCHIVE STATUS: PROTECTED" (xs uppercase tracking-widest on-surface-variant)

3. LOCAL ARCHIVE SECTION
   - Card: bg-surface-container-low, p-8, rounded-lg
   - Header icon: archive (primary, filled)
   - Title: "Local Archive" (xl bold)
   - Description: "Manage your primary SQLite library. Export for manual cold storage or import an existing backup file." (sm on-surface-variant)
   - Action buttons (vertical stack, gap-3):
     a. "Export .mylife" -- primary gradient pill button (from-primary to-primary-container), on-primary text, bold, full-width, centered, with download icon
     b. "Import Database" -- glass button (rgba(255,255,255,0.04) + border border-white/10), on-surface text, full-width, centered, with upload icon

4. CLOUD SYNC SECTION
   - Card: bg-surface-container-high (elevated), p-8, rounded-lg
   - Header: "MyLife Cloud" title (xl bold) + toggle switch (right, amber when on with "LIVE" badge)
   - Sync history sub-section:
     - Header: "SYNC HISTORY" label (xs uppercase tracking-widest on-surface-variant) + "LIVE" badge (primary bg, on-primary text, 10px bold uppercase pill)
     - History items:
       - "Automatic Snapshot -- 2 mins ago" (with clock icon)
       - "Manual Backup -- Yesterday, 22:40" (with backup icon)
   - CTA: "Sync Now" button (glass pill, centered, with sync icon, primary text)

5. SYSTEM RESTORE SECTION
   - Card: bg-surface-container-low, p-8, rounded-lg, with subtle error tint (border border-error/10)
   - Warning icon: restore (error/amber)
   - Title: "System Restore" (xl bold)
   - Warning text: "Rolling back to a previous state will overwrite all current local data. This action is irreversible once committed." (sm on-surface-variant, relaxed leading)
   - Restore point selector:
     - Label: "SELECT RESTORE POINT" (xs uppercase tracking-widest on-surface-variant)
     - Dropdown/picker: bg-surface-container-lowest, rounded-lg, border border-white/5, on-surface text
     - Shows snapshot name + date (e.g., "Vault_Snapshot_2023_10_24.db")
   - CTA: "RESTORE DATA" button (bg-error-container, text-on-error-container, full-width pill, bold uppercase tracking-widest, shadow-lg)
   - Two-step confirmation required

6. ARCHIVE INTEGRITY SECTION (partial, bottom of scroll)
   - Title: "Archive Integrity" (lg bold)
   - Status: "Your library is currently encrypted with 256-bit AES protection." (sm on-surface-variant)
   - Shield icon with lock badge

7. BOTTOM NAV (Settings tab active)

INTERACTIONS:
- Export button triggers file share sheet with the .mylife SQLite file
- Import button opens file picker for .mylife/.sqlite files
- Cloud sync toggle enables/disables cloud backup
- Sync Now triggers immediate cloud backup with progress indicator
- Restore requires two-step confirmation dialog
- Restore point picker shows available local and cloud snapshots

DESIGN RULES:
- System Restore section uses subtle error tinting to signal danger
- Export/Import are the primary actions, visually prominent
- Cloud section is elevated (surface-container-high) to indicate active status
- Use standard Obsidian Noir glass and tonal layering
```
