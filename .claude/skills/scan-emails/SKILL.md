---
name: scan-emails
description: Scan an email inbox using macos-hub MCP mail tools, categorize unread messages by type/priority, and build an actionable task list summary. Use when asked to review, triage, or summarize emails.
argument-hint: [account-name]
---

# Scan Emails — Inbox Triage Skill

Scan an email account's inbox, categorize unread messages, and produce a prioritized task list.

## Input

`$ARGUMENTS` — (Optional) The email account name to scan. If omitted, prompt the user to choose.

## Step 1: Identify the Account

1. If `$ARGUMENTS` is provided, use it as the account name.
2. If `$ARGUMENTS` is empty or not provided:
   - Call `list_mailboxes` (macos-hub MCP tool) to discover all available accounts.
   - Present the account list to the user and ask which one to scan.
3. Confirm the account has an INBOX mailbox.

## Step 2: Determine Date Range

Ask the user for a date cutoff, or default to **last 30 days** if they want to proceed quickly.

Accepted formats:
- "last 7 days", "last 30 days", "last 90 days"
- A specific date like "2026-01-01"
- "all" (no date filter — use with caution on large mailboxes)

## Step 3: Fetch Unread Messages

1. Call `list_messages` with:
   - `mailbox`: "INBOX"
   - `account`: the chosen account name
   - `limit`: 200 (fetch a large batch; adjust if the user requests more)
2. Filter the results to only **unread** messages.
3. Filter by the date cutoff from Step 2.
4. If the result set is very large (100+), warn the user and ask whether to proceed or narrow the window.

## Step 4: Fetch Message Details

For each unread message (or a sampled subset if the count exceeds 50):
1. Call `get_message` with the message `id`, `mailbox`, and `account` to retrieve full content.
2. Extract: sender, subject, date, and body preview (first ~500 characters).

**Performance note:** If there are more than 50 unread messages, fetch details for the 50 most recent first, then ask the user if they want to continue with older messages.

## Step 5: Categorize Messages

Assign each message to exactly one category:

| Category | Criteria |
|----------|----------|
| **Action Required** | Requests, approvals, asks, questions directed at the user, items needing a response |
| **Support Cases / Tickets** | Bug reports, support threads, incident alerts, escalations |
| **Calendar / Meetings** | Meeting invites, reschedules, cancellations, agenda updates |
| **FYI / Notifications** | Automated notifications, CI/CD alerts, deploy summaries, status updates that need no action |
| **Newsletters / Marketing** | Marketing emails, promotional content, newsletters, product announcements |
| **Other** | Anything that doesn't fit the above categories |

For each message, also assign a priority:
- **High** — Needs response or action within 24 hours
- **Medium** — Should be addressed this week
- **Low** — Informational, no action needed

## Step 6: Build the Summary

Generate a structured summary with this format:

```markdown
# Email Scan: [Account Name]
**Scanned:** [date range]
**Total unread in INBOX:** [count]
**Messages categorized:** [count]

## Summary
| Category | Count | High | Medium | Low |
|----------|-------|------|--------|-----|
| Action Required | X | X | X | X |
| Support Cases | X | X | X | X |
| Calendar / Meetings | X | X | X | X |
| FYI / Notifications | X | X | X | X |
| Newsletters / Marketing | X | X | X | X |
| Other | X | X | X | X |

## Action Required (High Priority)
1. **[Subject]** — From: [sender] ([date])
   - [1-2 sentence summary of what's needed]

2. **[Subject]** — From: [sender] ([date])
   - [1-2 sentence summary of what's needed]

## Action Required (Medium Priority)
[same format]

## Support Cases / Tickets
[same format, grouped by priority]

## Calendar / Meetings
[same format]

## FYI / Notifications
[condensed — just subject + sender, no detail needed]

## Newsletters / Marketing
[condensed — just subject + sender]

## Other
[condensed — just subject + sender]
```

## Step 7: Present Results

1. Display the full categorized summary to the user.
2. Highlight the top 3-5 most urgent items that need attention.
3. Ask if they want to:
   - Save the report to a file (default: `/Users/trey/Desktop/Apps/docs/reports/REPORT-email-scan-YYYY-MM-DD.md`)
   - Drill into any specific category or message
   - Scan another account

## Important Notes

- **Read-only operation:** The `get_message` tool does NOT change read/unread status. All emails remain unread after scanning.
- **Mail.app must be running:** The macos-hub mail bridge requires Mail.app to be open. If it's not running, inform the user and stop.
- **Privacy:** Email contents are processed in-context only. Do not write full email bodies to files — summaries only.
- **Large mailboxes:** Always paginate. Never try to fetch and process more than 200 messages in a single run without user confirmation.

## Output Checklist

- [ ] Account identified and confirmed
- [ ] Messages fetched and filtered by date + read status
- [ ] Each message categorized with priority
- [ ] Summary table presented
- [ ] High-priority action items highlighted
- [ ] User offered save/drill-down/next-account options
