# Module Proposal: MyClasses

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `classes`
**Table prefix:** `cs_`
**Tier:** Free (student acquisition hook) or Pro
**Target module number:** #35
**Date:** 2026-04-20
**Demographic pull:** Ages 12-22 (core), lifelong learners to 60+

---

## Executive Summary

Every student needs a personal academic tracker. Nothing privacy-first exists. School-provided tools (Canvas, Google Classroom, Blackboard) are surveillance systems owned by the institution. They track engagement, flag "at-risk" students to administrators, and the student has zero ownership of their own academic record. MyClasses gives students their own private academic journal: class schedule, grades, assignments, study time, teacher notes, and GPA tracking that belongs to THEM.

**Positioning sentence:** *Google Classroom works for your school. MyClasses works for you.*

---

## Why This Module

1. **Universal need, zero good options.** Every student ages 12-22 needs this daily. Saturn (schedule-sharing app) had massive traction before shutting down.
2. **School tools are institutional surveillance.** Canvas tracks time-on-page, click patterns, submission timestamps, and shares it with administrators. Students have no control.
3. **Cross-module natural.** Flash (study material), notes, habits (study habits), mood (academic stress correlation), budget (textbook costs).
4. **Lifelong learning extension.** Not just K-12/college: online courses, certifications, professional development, language learning.
5. **Business flywheel.** Tutors pay 25-40% commission to Wyzant/Varsity Tutors. A tutor SaaS at $29/mo + 5% with built-in student matching is the same Resy wedge.

---

## Full Feature Set

### Core: Class Schedule

- **Semester planner:** Add classes with day/time, room, building, professor/teacher
- **Visual weekly schedule:** Color-coded block view of your week
- **Multiple schedules:** Fall, Spring, Summer, Quarter system support
- **Class details:** Syllabus notes, required materials, grading breakdown
- **Room/building mapping:** Quick reference for where to go
- **Office hours:** Track professor/TA office hours and locations
- **Schedule conflicts:** Detect and flag time overlaps
- **Calendar sync:** Export schedule to system calendar
- **Commute time:** Optional travel-between-classes estimates

### Core: Assignment Tracker

- **Add assignments:** Title, class, type (homework, essay, project, quiz, exam, lab, presentation)
- **Due dates with reminders:** Configurable alerts (1 day, 3 days, 1 week before)
- **Priority system:** Low, medium, high, critical
- **Status workflow:** Not started -> In progress -> Submitted -> Graded
- **Estimated time:** How long you think it'll take
- **Actual time:** How long it actually took (for future estimation)
- **Recurring assignments:** Weekly problem sets, daily readings
- **Group project tracking:** Who's responsible for what
- **Submission notes:** Where to submit, file format, special instructions
- **Late policy tracker:** Know the penalty before deciding to be late
- **Dependency tracking:** "Can't start essay until lab report is done"

### Core: Grade Tracker

- **Grade entry:** Per-assignment grade tracking
- **Running GPA:** Auto-calculated, weighted by credit hours
- **Cumulative GPA:** Track across semesters/years
- **Grade prediction:** "If I get X on the final, my grade will be Y"
- **Grade trends:** Are you improving or slipping? By class, by semester.
- **Category weighting:** "Exams 40%, homework 30%, participation 20%, final 10%"
- **Target grades:** "I need a B+ in this class" -- what does that require?
- **Credit hour tracking:** Total credits completed, in progress, remaining for degree
- **Dean's list tracking:** Are you on track for honors?
- **Grade distribution notes:** Private assessment of grading difficulty per class

### Core: Study Tools

- **Study timer:** Pomodoro (25/5), custom intervals, or free-form timer
- **Study session log:** What you studied, how long, how productive (1-5)
- **Subject time allocation:** Are you spending proportional time on each class?
- **Study location tracker:** Where do you study best? (library, dorm, coffee shop)
- **Exam prep planner:** Countdown to exam with daily study goals
- **Study group log:** Who you studied with, what you covered
- **Focus quality notes:** "Couldn't focus today because..." private reflection
- **Weekly study summary:** Total hours, distribution, productivity average
- **Streak tracking:** Study streak (optional, gentle, not punishing)

### Core: Teacher/Professor Notes

- **Per-teacher profiles:** Name, subject, email, office location, office hours
- **Teaching style notes:** "Lectures fast," "Uses the book," "Loves class participation"
- **Grading personality:** "Harsh grader," "Gives partial credit," "Loves detail"
- **Recommendation potential:** Would this professor write you a good rec letter?
- **Private notes:** Things to remember about each teacher's preferences
- **Rating:** Personal 1-5 rating (private, never shared)

### Advanced: Degree Planning

- **Degree requirements:** Map out required courses for your major/minor
- **Prerequisite tracking:** What do you need before you can take X?
- **Remaining requirements:** What classes are left?
- **Semester planning:** Plan future semesters in advance
- **Alternative paths:** "If I add a minor in X, I need these additional classes"
- **Transfer credit tracking:** Credits from other institutions
- **AP/IB credit:** Track test scores and credit equivalencies

### Advanced: Applications & Testing

- **Test score tracking:** SAT, ACT, GRE, GMAT, LSAT, MCAT, AP exams
- **College application tracker:** Schools applied to, deadlines, status, decisions
- **Scholarship tracker:** Applied, deadlines, amounts, status
- **Letter of rec tracker:** Who you asked, status, due dates
- **Essay tracker:** Which essays for which applications, drafts, final versions
- **Financial aid:** FAFSA status, aid packages, comparison

### Advanced: Lifelong Learning

- **Online courses:** Coursera, Udemy, edX, Khan Academy, Skillshare tracking
- **Certifications:** Professional certs with expiration dates and renewal requirements
- **Skills inventory:** What you've learned and proficiency levels
- **Conference/workshop log:** Professional development events attended
- **Reading for learning:** Books read for professional growth (links to Books module)
- **Language learning:** Progress in language study (links to Words module)
- **Mentor notes:** Key advice and guidance from mentors

### Settings & Privacy

- **All data local.** School never sees this. Parents never see this (unless student shares).
- **No institutional integration.** We don't connect to Canvas/Blackboard/etc. This is YOUR record.
- **Export:** Full data export for portfolio/resume building
- **Import:** Manual only (no school system integration by design)
- **Biometric lock:** Optional extra security for grade data

---

## Data Model

```
cs_semesters
  id, name (e.g. "Fall 2026"), start_date, end_date,
  institution, credit_hours, gpa, is_current, created_at

cs_classes
  id, semester_id, name, code (e.g. "CS 101"), section,
  credits, day_times (json), room, building,
  teacher_id, category_weights (json),
  current_grade, target_grade, color, notes_md,
  created_at, updated_at

cs_teachers
  id, name, title, department, email, office_location,
  office_hours (json), teaching_style_notes, grading_notes,
  rec_potential, rating, notes_md, created_at

cs_assignments
  id, class_id, title, type, description_md,
  due_at, submitted_at, graded_at,
  status (not_started|in_progress|submitted|graded),
  priority, estimated_minutes, actual_minutes,
  grade, max_grade, weight, is_recurring,
  group_members (json), submission_notes,
  created_at, updated_at

cs_study_sessions
  id, class_id, started_at, duration_minutes,
  location, productivity_rating, focus_notes,
  companion_ids (json), topics_covered (json),
  created_at

cs_tests
  id, name (SAT|ACT|AP|GRE|GMAT|custom), score,
  max_score, date_taken, notes_md, created_at

cs_applications
  id, institution, program, type (college|grad|job|scholarship),
  deadline, status (researching|applying|submitted|accepted|rejected|waitlisted),
  decision_date, notes_md, essay_ids (json),
  financial_package_notes, created_at, updated_at

cs_degree_requirements
  id, degree_name, institution, required_courses (json),
  completed_courses (json), remaining_credits,
  expected_graduation, notes_md, created_at

cs_certifications
  id, name, issuer, earned_date, expiry_date,
  renewal_requirements, status (active|expired|in_progress),
  notes_md, created_at

cs_online_courses
  id, platform, course_name, instructor, url,
  started_at, completed_at, progress_percent,
  rating, certificate_earned, notes_md, created_at

cs_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Class schedule + semester planner + calendar sync | 2-3 |
| P2 | Assignment tracker + due dates + reminders + status | 2-3 |
| P3 | Grade tracker + GPA calculator + predictions | 1-2 |
| P4 | Study tools: timer, session log, productivity tracking | 2 |
| P5 | Teacher profiles + notes | 1 |
| P6 | Degree planning + requirements mapping | 2 |
| P7 | Applications + testing + scholarships | 2 |
| P8 | Lifelong learning: online courses, certs, skills | 1-2 |
| P9 | Cross-module integration (flash, notes, habits, mood, budget, friends) | 2 |
| **Total P0-P9** | | **~16-20 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Flash** | Study cards linked to specific classes, exam prep decks |
| **Notes** | Class notes organized per course |
| **Habits** | Study habits, attendance streaks, reading consistency |
| **Mood** | Academic stress correlation, exam anxiety tracking |
| **Budget** | Textbook costs, tuition tracking, scholarship management |
| **Friends** | Study groups, classmates, lab partners |
| **Journal** | "How I'm feeling about school" reflections |
| **Calendar** | Class times, assignment due dates, exam dates |
| **Words** | Language learning progress for language courses |

---

## Business Flywheel (The Resy Pattern)

### Tutor/Teacher SaaS (Year 2-3)

**Incumbent problem:** Wyzant takes 25% commission. Varsity Tutors takes 40%. Independent tutors pay $50-200/mo for scheduling + student management tools.

**The wedge:**
- MyLife Tutor Platform: $29/mo + 5% per session (vs 25-40% commission)
- Built-in student matching: MyClasses users seeking help in specific subjects matched to tutors
- Scheduling, session notes, progress tracking, payment via Stripe Connect
- Student CRM with academic context (the tutor sees what the student is working on, with student permission)
- Privacy: student controls what the tutor sees. Tutor can't access grades/notes without explicit sharing.

**Why Wyzant/Varsity can't match:** Their entire business model is the commission. Dropping to 5% kills their revenue. They'd need to rebuild as a SaaS company, which means a different company.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| "Just use Google Calendar + Sheets" objection | Medium | Those don't have GPA calc, grade prediction, study analytics, or cross-module integration |
| Schools block app usage during class | Low | Module works offline; data entry can happen after class |
| Cheating concerns (sharing assignment answers) | Low | No sharing features. This is a personal tracker, not a collaboration tool. |
| Data sensitivity (grades, teacher notes) | Medium | Device-only storage, optional biometric lock |
| Age 12 and under COPPA | Low | All data local, never transmitted. Legal review needed. |

---

## Open Questions (Founder Input Needed)

1. **Free or Pro?** FREE makes the strongest case for student acquisition. Every student 12-22 would use this. Counter: study tools are a premium feature in competitors. Recommend FREE for basic (schedule + assignments + grades), Pro for advanced (study timer, GPA prediction, applications, certifications).
2. **Module accent color?** Suggestions: Academic blue #3B82F6, fresh green #22C55E (growth/learning), amber #F59E0B (achievement)
3. **Minimum age?** 12 is reasonable for schedule + assignments. Under 12 could use it but may not need it. Recommend 12+.
4. **School system integration?** Some users will want to sync with Canvas/Google Classroom. Recommend: never. The privacy story breaks if we connect to institutional systems. Users enter data manually. This IS the feature.
5. **Parent visibility?** Should there be an optional "share with parent" feature? Recommend: no. The student owns their data. If a parent wants to see grades, they can use the school's portal.
6. **Naming:** "MyClasses" vs "MySchool" vs "MyLearn" vs "MyStudy"? Each implies different scope.
