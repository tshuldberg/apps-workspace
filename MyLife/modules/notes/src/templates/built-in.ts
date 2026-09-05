/**
 * Built-in starter templates for MyNotes.
 * These are seeded on first V2 migration run.
 */

export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  body: string;
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: 'builtin-meeting-notes',
    name: 'Meeting Notes',
    description: 'Structure for capturing meeting outcomes and action items',
    icon: '🤝',
    body: `# Meeting Notes - {{date}}

## Attendees
-

## Agenda
1.

## Discussion


## Action Items
- [ ]
- [ ]
- [ ]
`,
  },
  {
    id: 'builtin-project-plan',
    name: 'Project Plan',
    description: 'Outline a project with goals, milestones, and resources',
    icon: '📋',
    body: `# Project Plan

## Overview


## Goals
1.
2.
3.

## Milestones
| Milestone | Target Date | Status |
|-----------|------------|--------|
|           |            |        |

## Timeline


## Resources

`,
  },
  {
    id: 'builtin-weekly-review',
    name: 'Weekly Review',
    description: 'Reflect on wins, challenges, and set next week goals',
    icon: '📊',
    body: `# Weekly Review - {{date}}

## Wins
-

## Challenges
-

## Lessons Learned
-

## Next Week Goals
- [ ]
- [ ]
- [ ]

## Gratitude
-
`,
  },
  {
    id: 'builtin-daily-standup',
    name: 'Daily Standup',
    description: 'Quick status update with yesterday, today, and blockers',
    icon: '🧍',
    body: `# Standup - {{day}}, {{date}}

## Yesterday
-

## Today
-

## Blockers
-
`,
  },
  {
    id: 'builtin-reading-notes',
    name: 'Reading Notes',
    description: 'Capture key ideas and thoughts from books or articles',
    icon: '📖',
    body: `# Reading Notes

## Title:
## Author:

## Key Ideas
1.
2.
3.

## Quotes
>

## My Thoughts


## Rating: /5
`,
  },
  {
    id: 'builtin-decision-log',
    name: 'Decision Log',
    description: 'Document decisions with context, options, and rationale',
    icon: '⚖️',
    body: `# Decision Log - {{date}}

## Context


## Options
1. **Option A:**
2. **Option B:**
3. **Option C:**

## Pros / Cons
| Option | Pros | Cons |
|--------|------|------|
| A      |      |      |
| B      |      |      |

## Decision


## Rationale

`,
  },
  {
    id: 'builtin-bug-report',
    name: 'Bug Report',
    description: 'Structured bug report with reproduction steps',
    icon: '🐛',
    body: `# Bug Report

## Summary


## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior


## Environment
- OS:
- Version:
- Device:

## Screenshots / Logs

`,
  },
  {
    id: 'builtin-cornell-notes',
    name: 'Cornell Notes',
    description: 'Cornell method with cues, notes, and summary sections',
    icon: '🎓',
    body: `# Cornell Notes - {{date}}

## Topic:

---

| Cues / Questions | Notes |
|-----------------|-------|
|                 |       |
|                 |       |
|                 |       |
|                 |       |

---

## Summary

`,
  },
];
