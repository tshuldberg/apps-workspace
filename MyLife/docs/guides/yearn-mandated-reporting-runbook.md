# Yearn Mandated-Reporting Runbook (Minor Safety)

**Created:** 2026-07-30 · plan 47 Phase 3 item 3
**Scope:** operational process for reports with reason `underage` and any other apparent child-safety content on Yearn. This document is process only; detection logic and NCMEC transmission code are intentionally absent from the codebase until the founder items below are complete.

## Legal basis, stated honestly

- 18 U.S.C. 2258A obligates an electronic service provider to report apparent child sexual abuse material to the NCMEC CyberTipline and to preserve related material for 90 days after such a report.
- Yearn (operating entity) is NOT yet a registered CyberTipline ESP and has NOT designated a reporter. Until both exist, transmission is impossible by construction: the `transmitted` status is refused by the `yearn-moderation` edge function, by `yearn.advance_safety_escalation`, and by the `safety_escalations_immutability` trigger. A separately authored migration must deliberately enable it.
- This runbook does not constitute legal advice. Counsel review is a founder item.

## What the system does automatically (implemented)

1. A report with reason `underage` immediately hides the reported profile (`moderation_status = 'hidden_pending_review'`), excluding it from discovery, likes, and matches.
2. The same trigger snapshots evidence (report reason, details, profile photo storage paths) into `yearn.safety_escalations` with status `pending_registration`, append-only and service-role only. Evidence rows survive account deletion (`target_user_id` nulls; evidence stays).
3. Any other report reason auto-hides the profile only at 3+ distinct reporters within 24h (dogpile-resistant threshold, `20260730000001`).

## Operator workflow (via the yearn-moderation edge function)

All calls: `POST` to `/functions/v1/yearn-moderation` with `Authorization: Bearer $YEARN_MODERATION_ADMIN_SECRET`.

1. **Triage within 24 hours** of any `underage` report (Community Guidelines SLA): `{"op":"list_escalations","status":"pending_registration"}` then `{"op":"get_report","reportId":...}`.
2. **Assess.** If the profile plausibly belongs to a minor or content is apparent CSAM: keep the profile hidden, apply `{"op":"apply_action","action":"ban",...}`, set the report `actioned`. Do NOT view suspected CSAM more than necessary for the assessment; never download or redistribute it.
3. **Escalate.** Once the entity is a registered ESP with a designated reporter: move the escalation with `{"op":"advance_escalation","status":"ready_for_transmission","operator":...}`. The designated reporter files the CyberTipline report through NCMEC's portal manually; recording `transmitted` in the database requires the separately authored enablement migration (do not work around this).
4. **Preserve.** Do not delete the `safety_escalations` row or referenced storage objects; the DB forbids row deletion. After a CyberTipline filing, preserve referenced material for at least 90 days.
5. **Dismiss** only when the report is clearly mistaken or abusive: `{"op":"advance_escalation","status":"dismissed",...}` plus report status `dismissed` with a resolution note. Unhide with `{"op":"apply_action","action":"unhide",...}` when the profile was auto-hidden.
6. **Law enforcement:** if there is an imminent-danger indication, contact local law enforcement immediately; do not wait on ESP registration.

Every step above lands in the append-only `yearn.moderation_actions` ledger automatically.

## Founder items (open, blocking full activation)

1. Engage counsel; confirm entity identity for NCMEC registration.
2. Register as a CyberTipline ESP; designate and train the reporter.
3. After registration: commission the separately authored migration that permits `ready_for_transmission -> transmitted`, plus the filing evidence fields counsel requires.
4. Deploy `yearn-moderation` with `YEARN_MODERATION_ADMIN_SECRET` set (function fails closed without it).
