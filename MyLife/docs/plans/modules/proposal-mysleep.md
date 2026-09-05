# Module Proposal: MySleep

**Status:** Proposal - architecture-reviewed
**Module ID candidate:** `sleep`
**Table prefix:** `sl_`
**Tier:** Premium
**Target module number:** #39
**Date:** 2026-04-20
**Demographic pull:** Universal (ages 12-70), strongest 14-35 (most sleep-deprived demographics)

---

## Executive Summary

Sleep apps are a $3B/yr market dominated by subscription-heavy tools (Calm $70/yr, Sleep Cycle $40/yr, Pillow $5/mo) that all require microphone access, motion sensor access, or a $300+ wearable. MySports-style problem: they're all optimizing for engagement metrics and recurring revenue, not for actually helping you sleep better.

MySleep is a privacy-first sleep journal: track sleep manually (no mic, no sensors, no wearable required), log dreams, identify patterns, and correlate sleep quality with the rest of your life. Works offline. Respects your privacy. Doesn't listen to you while you sleep.

Initial hub rollout should stay hidden until a dedicated UIUX and release-state decision is made. Foundation work should scaffold routes and host wiring without surfacing the module in discover, sidebar, or default bootstrap flows.

**Positioning sentence:** *Sleep Cycle listens to you all night. MySleep listens to what you tell it in the morning.*

---

## Why This Module

1. **Universal need.** Everyone sleeps. 35%+ of adults are sleep-deprived. Teens average 6.5 hours (need 8-10).
2. **Existing apps are creepy.** Sleep Cycle uses your microphone all night. Pillow tracks motion. Both upload to servers. Both charge $40-70/yr.
3. **Manual tracking works.** Research shows simple sleep diaries (CBT-I protocol) are more effective for improving sleep than sensor-based tracking.
4. **Dream journaling is huge and unserved.** No good privacy-first dream journal exists. People desperately want to record and search their dreams.
5. **Cross-module correlation is the killer feature.** "Sleep quality correlates with mood" or "consistent wind-down habits lead to better nights" -- this is uniquely possible in a hub app.
6. **Zero hardware dependency.** No watch, no sensor, no microphone. Just you and a quick morning log.

---

## Full Feature Set

### Core: Sleep Log

- **Bedtime + wake time:** When you got in bed, when you fell asleep (estimate), when you woke up
- **Sleep duration:** Auto-calculated
- **Sleep quality:** 1-5 simple rating each morning
- **Wake-ups:** How many times you woke up during the night
- **Sleep latency:** How long to fall asleep (estimate)
- **Alarm used:** Yes/no, what time, snooze count
- **Wake feeling:** Refreshed, groggy, exhausted, energized (quick select)
- **Nap logging:** Time, duration, intentional vs accidental
- **Notes:** Free-form morning notes ("couldn't sleep because neighbor's music")

### Core: Dream Journal

- **Dream log:** Write down dreams immediately upon waking
- **Dream rating:** Vivid, mundane, nightmare, lucid, recurring
- **Dream themes:** Tag recurring themes (flying, falling, water, school, work, people)
- **People in dreams:** Who appeared? (links to Friends module)
- **Emotion in dream:** Happy, anxious, scared, confused, peaceful, excited
- **Lucidity tracking:** Were you aware you were dreaming?
- **Dream symbols/patterns:** Personal dream dictionary over time
- **Recurring dreams:** Flag and track patterns
- **Dream search:** Full-text search through all dreams
- **Dream art:** Attach sketches/images of dream scenes

### Core: Sleep Patterns & Insights

- **Weekly sleep average:** Hours per night this week vs target
- **Sleep consistency score:** How consistent are your bed/wake times?
- **Weekend vs weekday:** Sleep debt comparison
- **Sleep debt calculator:** Cumulative deficit over days/weeks
- **Optimal sleep window:** Based on your data, when do you sleep best?
- **Trend charts:** Sleep quality over weeks/months, duration trends
- **Seasonal patterns:** Do you sleep differently in winter vs summer?
- **Best nights:** What conditions correlate with your best sleep?
- **Worst nights:** What conditions correlate with poor sleep?

### Core: Sleep Environment & Factors

- **Pre-sleep activities:** What you did before bed (screen time, reading, exercise, eating, alcohol, caffeine)
- **Last caffeine time:** When was your last coffee/tea/soda?
- **Last meal time:** When did you last eat?
- **Alcohol:** Drinks consumed (known sleep disruptor)
- **Exercise:** Did you work out today? When? (links to Workouts)
- **Screen cutoff:** When did you stop looking at screens?
- **Room conditions:** Temperature, light level, noise level, air quality (subjective)
- **Supplements/sleep aids:** Melatonin, magnesium, etc. (links to Meds module)
- **Stress level:** Evening stress rating
- **Bed partner/pet disturbances:** Track disruptions (private, non-judgmental)

### Core: Sleep Goals

- **Target sleep hours:** What you're aiming for
- **Target bedtime:** When you want to be asleep by
- **Target wake time:** When you want to wake up
- **Consistency goal:** Same bed/wake time +-30 minutes
- **Sleep hygiene habits:** Checklist of good practices
- **Progress tracking:** Are you meeting your goals this week?
- **Bedtime reminder:** Optional notification at your target wind-down time
- **Gentle accountability:** Weekly summary of goal adherence (non-punishing)

### Advanced: Sleep Science Integration

- **CBT-I diary format:** Export in standard Cognitive Behavioral Therapy for Insomnia diary format (for sharing with therapist)
- **Sleep efficiency:** Time asleep / time in bed ratio (CBT-I metric)
- **Sleep restriction tracking:** If doing CBT-I, track restricted sleep window
- **Chronotype assessment:** Morning lark vs night owl (based on natural patterns)
- **Circadian rhythm map:** Your natural energy/alertness curve through the day
- **Jet lag tracker:** When traveling, track adjustment to new timezone
- **Shift work mode:** For irregular schedules, track sleep relative to work shifts

### Advanced: Cross-Life Correlations

- **Sleep vs mood:** Automatic correlation with Mood module data
- **Sleep vs habits:** Bedtime routine adherence and hygiene habits vs sleep quality
- **Sleep vs health context:** Opt-in bridge into Health summaries without merging schemas
- **Sleep vs diet:** How late eating or caffeine affects your sleep from MySleep's own factor logging
- **Sleep vs stress:** Work/school stress vs sleep quality
- **Sleep vs productivity:** Next-day energy and focus correlation

### Advanced: Year-in-Review

- **Annual sleep summary:** Average duration, quality, best/worst months
- **Total hours slept:** "You spent 2,920 hours sleeping this year"
- **Dream statistics:** Most common themes, lucid dream count, nightmare frequency
- **Improvement tracking:** How sleep changed from January to December
- **Best streak:** Longest run of good sleep
- **Shareable card:** Sleep health summary (optional)

---

## Data Model

```
sl_sleep_entries
  id, date, bedtime, sleep_onset_time, wake_time,
  duration_minutes, quality_rating (1-5),
  wake_count, sleep_latency_minutes,
  alarm_time, snooze_count, wake_feeling,
  notes_md, created_at, updated_at

sl_naps
  id, date, start_time, duration_minutes,
  intentional (bool), quality, notes, created_at

sl_dreams
  id, sleep_entry_id, date, content_md,
  type (normal|vivid|nightmare|lucid|recurring),
  themes (json), people (json), emotions (json),
  is_lucid, is_recurring, recurring_group_id,
  sketch_photo_id, created_at

sl_factors
  id, sleep_entry_id, date,
  last_caffeine_time, last_meal_time,
  alcohol_drinks, exercise_today (bool), exercise_time,
  screen_cutoff_time, room_temp, room_light, room_noise,
  supplements (json), stress_level (1-5),
  pre_sleep_activities (json), notes, created_at

sl_goals
  id, type (duration|bedtime|wake_time|consistency),
  target_value, start_date, end_date,
  is_active, notes, created_at, updated_at

sl_streaks
  id, type (quality_above_3|on_time_bed|target_hours|no_snooze),
  current_count, longest_count, last_date, created_at

sl_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Sleep log: bed/wake times, duration, quality, wake feeling | 2 |
| P2 | Dream journal: log, themes, emotions, search, recurring flags | 2-3 |
| P3 | Factors: pre-sleep activities, caffeine, exercise, environment | 1-2 |
| P4 | Patterns & insights: trends, consistency, optimal window, correlations | 2-3 |
| P5 | Goals + reminders + streaks + accountability | 1-2 |
| P6 | Sleep science: CBT-I format, chronotype, sleep efficiency | 1-2 |
| P7 | Year-in-review + nap tracking + jet lag | 1 |
| P8 | Cross-module integration (mood, habits, health only) | 2 |
| **Total P0-P8** | | **~14-18 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Mood** | Sleep quality vs mood correlation (automatic if both active) |
| **Habits** | Bedtime routine as habit, sleep hygiene checklist, adherence summaries |
| **Health** | Explicit opt-in bridge so health summaries can reference MySleep journal trends without reusing `hl_` tables |

---

## Competitor Analysis

| App | What It Does | Why It Falls Short |
|-----|-------------|-------------------|
| Sleep Cycle | Microphone-based sleep analysis | Listens to you all night. $40/yr. Uploads audio data to servers. |
| Pillow | Apple Watch sleep tracking | Requires $400 watch. Battery drain. Subscription. |
| AutoSleep | Watch-based tracking | Watch-dependent. Complex UI. |
| Calm | Sleep stories + meditation | Entertainment product, not sleep tracking. $70/yr. |
| Sleep Score | Mattress sensor | $150 hardware + subscription. |
| Oura | Ring-based sleep tracking | $300 hardware + $6/mo subscription. |
| RISE | Sleep debt tracking | Good concept but $70/yr and phone-dependent algorithms. |
| Bearable | Symptom + sleep tracking | Generic health tracker, sleep is one feature among many. |

**Gap:** No privacy-first, manual-entry sleep journal with dream tracking, pattern analysis, and cross-life correlation. Everything else requires hardware, microphones, or subscriptions to AI algorithms you can't verify.

---

## The Manual Tracking Advantage

Counter-intuitive insight: **manual sleep logging is clinically more effective than sensor-based tracking** for improving sleep. The CBT-I (Cognitive Behavioral Therapy for Insomnia) protocol -- the gold standard treatment -- uses paper sleep diaries, not wearables. Why:

1. Self-awareness in the morning forces you to reflect on sleep habits
2. No "checking your sleep score" anxiety (orthosomnia -- worrying about sleep data makes sleep worse)
3. Subjective sleep quality matters more than objective sensor data for wellbeing
4. The act of logging factors (caffeine, exercise, stress) creates behavior change

MySleep is built on this clinical foundation. We're not "less than" Sleep Cycle because we lack a microphone. We're *better* because we don't create orthosomnia.

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Deep navy #1E3A5F (nighttime), soft lavender #A78BFA (calming), moon silver #94A3B8
2. **Dream journal prominence:** Is dream tracking a primary feature or a secondary one? Recommend: primary. Dream journaling is the unique differentiator and has a passionate community.
3. **HealthKit/Health Connect integration?** Optional read-only import of Apple Watch/Fitbit sleep data for users who WANT sensor data alongside their manual log? Recommend: optional import in P6+, never required.
4. **Wearable positioning:** How do we message "no wearable needed" without sounding anti-tech? Recommend: "Works with any wearable. Works without one too."
5. **Free or Premium?** Basic sleep log could be free (acquisition hook for health-conscious users). Dream journal + insights + cross-module = premium. Recommend: revisit after hidden-foundation rollout.
6. **Therapist export:** Should we explicitly support CBT-I diary format export for sharing with sleep therapists? Recommend: yes, it's a significant differentiator and low effort.
