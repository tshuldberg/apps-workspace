# MyClasses — Module Audit

**ID:** classes | **Prefix:** cs_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Own your academic life

## User Value
- Track classes, teachers, assignments, tests, and grades in one private gradebook.
- Degree programs and requirement satisfaction so students can see progress toward a diploma.
- Application tracker (college, internship, grad school) with task lists.
- Study sessions with Pomodoro and a time tracker that is not a SaaS subscription.
- Lifelong learning: standardized tests, online courses, certifications, learning goals.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Schedule + classes + semesters | modules/classes/src/db/schema.ts (cs_classes, cs_semesters) | shipped |
| Assignments engine + tests | modules/classes/src/engine/assignment-engine.ts | shipped |
| Grade engine | modules/classes/src/engine/grade-engine.ts | shipped |
| Degree program + requirement satisfaction | modules/classes/src/engine/degree-engine.ts, db (cs_degree_programs, cs_requirements, cs_requirement_satisfactions) | shipped |
| Schedule conflict detection | modules/classes/src/engine/schedule-conflict.ts | shipped |
| Pomodoro engine | modules/classes/src/engine/pomodoro-engine.ts | shipped |
| Time tracker | modules/classes/src/engine/time-tracker.ts | shipped |
| Commute planner | modules/classes/src/engine/commute.ts | shipped |
| Office hours | modules/classes/src/engine/office-hours.ts | shipped |
| Applications engine (college/internship) | modules/classes/src/engine/applications-engine.ts, db (cs_applications, cs_application_tasks) | shipped |
| Lifelong learning (certs, courses, tests, goals) | modules/classes/src/db/schema.ts (cs_standardized_tests, cs_online_courses, cs_certifications, cs_learning_goals) | shipped |
| Calendar sync | modules/classes/src/engine/calendar-sync.ts | shipped |
| Export/import | modules/classes/src/engine/export-import.ts | shipped |

## Data Model
- Academic core: cs_classes, cs_semesters, cs_teachers, cs_assignments, cs_study_sessions, cs_standardized_tests.
- Degree planning: cs_degree_programs, cs_requirements, cs_requirement_satisfactions.
- Application pipeline: cs_applications, cs_application_tasks.
- Lifelong: cs_certifications, cs_online_courses, cs_learning_goals.
- cs_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(classes)/ -- index, class/, teacher/, assignment/, assignments, grades, tests, study, degree/, applications/, lifelong/, settings.
- Web: apps/web/app/classes/ -- page, class/, teacher/, assignments/, tests/, grades/, study/, degree/, applications/, import/, export/, lifelong/, settings/, actions.ts, ui.tsx, data.ts.

## Distinctive / Moat-worthy
- Academic tracker plus applications pipeline plus lifelong learning plus Pomodoro in one free module (competitors split these across 3-4 apps).
- Degree requirement satisfaction model (not just GPA) is unusual in consumer apps.
- Schedule conflict detection across classes + commute + office hours.
- Private by default: no school-issued account or LMS integration required.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- Not present in COMPETITIVE-MATRIX.md (module added post-matrix). Recommend adding a Classes row in next matrix refresh.

## Investor-facing hook
MyClasses is the only free, local-first academic planner that carries a student from high school through grad applications and lifelong learning without handing data to a school district or ed-tech vendor.
