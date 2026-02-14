# Automation Hub

This is a standalone automation workspace adjacent to, but independent from, `shiphawk-dev`.

Primary path: `/Users/trey/Desktop/Apps/SH/automation-hub`

## Purpose

- Centralize MCP tool contracts, job specs, and approval policy.
- Automate email review into task proposals.
- Plan due dates against calendar load and PM dependencies.
- Detect gantt drift and prepare response drafts plus voice review queues.

## Independence Rules

- No code dependency on `shiphawk-dev`.
- Optional reference to `shiphawk-dev` is read-only and only for context/QA.
- All runtime state and outputs stay inside this project.

## Layout

- `config/runtime.example.yaml`: provider + connector settings.
- `config/channel_adapters.example.yaml`: channel adapter map (email/calendar/reminders/messages/superwhisper).
- `policies/approval_policy.yaml`: action gating rules.
- `pm_mcp_interface.yaml`: PM/Gantt MCP tool contract.
- `schemas/canonical_task.schema.json`: shared task model.
- `jobs/`: scheduled job specs.
- `docs/channel_matrix.md`: current vs bridge vs future channel capabilities.
- `state/`: sync cursors and execution state.
- `runs/`: generated run outputs.
- `src/`: TypeScript runtime (CLI, job execution, approval gate, adapters).

## Job Specs

- `jobs/01_email_triage.yaml`
- `jobs/02_calendar_due_date_planner.yaml`
- `jobs/03_gantt_drift_voice_queue.yaml`
- `jobs/04_unified_channel_consolidation.yaml`

## Provider Agnostic Operation

- OpenAI: Responses API background jobs + MCP/connectors.
- Claude: headless or Agent SDK + MCP.
- Shared behavior: same tools, same schema, same approval gates.

## Runtime Setup

1. Install dependencies:
   - `npm install`
2. Optional: copy `config/runtime.example.yaml` to `config/runtime.yaml` and fill credentials.
   - If missing, runtime falls back to `config/runtime.example.yaml`.
3. Run the first executable job in dry-run mode:
   - `npm run job:email-triage:dry-run`
4. Run with write approvals enabled:
   - `npm run job:email-triage -- --approve-writes`

## Current Implementation Status

- Executable TypeScript CLI for `jobs/01_email_triage.yaml`.
- Approval gating enforced through `policies/approval_policy.yaml`.
- Outputs generated to `runs/<run_id>/...` from the job output templates.
- Mock adapters provided for email/calendar/PM until MCP connectors are wired.

## Next Implementation Steps

1. Replace mock adapters with MCP clients (`email-mcp`, `calendar-mcp`, `pm-mcp`).
2. Add additional runners for jobs 02-04.
3. Add unit tests for extraction, approval gate, and dedupe behavior.
4. Add end-to-end checks in CI with `npm run typecheck` + dry-run job smoke test.
