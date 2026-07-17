# MyWorkouts — Product & Technical Design

> **Created:** 2026-02-20
> **Status:** Approved
> **Repo:** github.com/tshuldberg/MyWorkouts

## Product Vision

MyWorkouts is a personalized workout companion that solves the #1 problem with existing workout apps: pacing and control. Users interact with an anatomical body map to discover exercises, watch coach-led video workouts, and control everything hands-free with voice commands. The app records your sessions so you (or your coach) can review and correct form later.

### Key Differentiators
- **Voice-first workout experience** — start, stop, speed up, slow down, next exercise — all voice-controlled
- **Interactive body map** — tap any muscle group to see targeted exercises across categories
- **Coach-paced video** — workouts feel like you're training alongside a real coach
- **Form recording** — camera records you during workouts for later review/correction
- **Audio cues** — spoken instructions so you never need to look at the screen mid-rep

### Monetization
- Free tier: Body map, exercise library, workout player, voice commands, workout builder, progress tracking
- Premium tier ($10/mo annual): Form recording, coach review portal, personalized plans
- Payments: RevenueCat (iOS/Android subscriptions) + Stripe (web)

## Core Features

| # | Feature | Tier | Description |
|---|---------|------|-------------|
| 1 | Interactive Body Map | Free | 3D/2D human body — tap muscle groups to filter exercises |
| 2 | Exercise Library | Free | Categorized exercises (Cardio, Strength, Mobility, Fascia, Recovery) with coach videos |
| 3 | Workout Player | Free | Video playback with audio cues, rep/set counters, rest timers |
| 4 | Voice Commands | Free | "Pause", "Resume", "Slower", "Faster", "Skip", "Repeat" — hands-free control |
| 5 | Workout Builder | Free | Create custom routines from exercise library |
| 6 | User Profiles & Auth | Free | Account, preferences, workout history |
| 7 | Form Recording | Premium | Camera records user during workout, saves for review |
| 8 | Coach Review Portal | Premium | Coach can view client recordings and leave timestamped feedback |
| 9 | Personalized Plans | Premium | Coach-curated workout programs (multi-week progressions) |
| 10 | Progress Tracking | Free | Workout history, streaks, volume tracking |
| 11 | Subscription & Payments | — | RevenueCat (mobile) + Stripe (web) |

## Technical Architecture

### Monorepo Structure
```
MyWorkouts/                          (Turborepo monorepo)
├── apps/
│   ├── mobile/                      (Expo — React Native, iOS + Android)
│   │   ├── app/                     (Expo Router — file-based routing)
│   │   ├── components/
│   │   └── features/
│   ├── web/                         (Next.js 15 — App Router)
│   │   ├── app/
│   │   ├── components/
│   │   └── features/
│   └── coach-portal/                (Next.js — coach review dashboard)
├── packages/
│   ├── shared/                      (Cross-platform business logic)
│   │   ├── src/
│   │   │   ├── types/               (Shared TypeScript types)
│   │   │   ├── voice/               (Voice command parser + grammar)
│   │   │   ├── workout/             (Workout engine — timers, sets, reps)
│   │   │   ├── body-map/            (Muscle group data + exercise mappings)
│   │   │   └── utils/
│   │   └── package.json
│   ├── ui/                          (Shared UI components — body map, player controls)
│   ├── supabase/                    (Database types, migrations, edge functions)
│   └── config/                      (Shared configs — ESLint, TypeScript, Tailwind)
├── supabase/                        (Supabase project config + migrations)
├── turbo.json
├── package.json
└── CLAUDE.md
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Monorepo | Turborepo + pnpm | Fast builds, shared packages |
| Mobile | Expo SDK 52 + Expo Router | File-based routing, camera/mic APIs, OTA updates |
| Web | Next.js 15 (App Router) | SSR marketing pages + full web app |
| Styling | NativeWind (Tailwind for RN) + Tailwind CSS (web) | Shared design tokens |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) | TypeScript SDK, RLS, fast to ship |
| Video Hosting | Supabase Storage + CDN | Coach videos with adaptive streaming |
| User Recordings | Supabase Storage (private buckets) | Form recordings, coach access via RLS |
| Voice | Web Speech API (web) + expo-speech (mobile) + custom parser | No external service needed |
| Payments | RevenueCat (iOS/Android) + Stripe (web) | Unified subscription management |
| State | Zustand | Lightweight, TypeScript-first |
| Body Map | SVG-based (react-native-svg + web SVG) | Tap regions map to muscle groups |

## Data Model

### Core Tables

**users**: id, email, display_name, avatar_url, subscription_tier, coach_id, created_at

**exercises**: id, name, description, category (enum), muscle_groups (text[]), video_url, thumbnail_url, difficulty (enum), audio_cues (jsonb), is_premium, created_at

**workouts**: id, title, description, creator_id, difficulty (enum), exercises (jsonb), estimated_duration, is_premium, created_at

**workout_sessions**: id, user_id, workout_id, started_at, completed_at, exercises_completed (jsonb), voice_commands_used (jsonb), pace_adjustments (jsonb)

**form_recordings**: id, session_id, video_url, exercise_id, timestamp_start, timestamp_end, coach_feedback (jsonb), created_at

**workout_plans**: id, title, coach_id, weeks (jsonb), is_premium, created_at

**subscriptions**: id, user_id, plan (enum), provider (enum), external_id, status (enum), expires_at

### Enums
- **category**: cardio, strength, mobility, fascia, recovery, flexibility, balance
- **muscle_groups**: chest, back, shoulders, biceps, triceps, forearms, core, quads, hamstrings, glutes, calves, hip_flexors, neck, full_body
- **difficulty**: beginner, intermediate, advanced

## Voice Command System

```
Voice Input → Speech-to-Text (platform native) → Command Parser → Action Dispatch
```

Command grammar (fuzzy matching):
- Playback: "pause", "stop", "resume", "play", "start"
- Pacing: "slower", "faster", "speed up", "slow down", "normal speed"
- Navigation: "next", "skip", "previous", "back", "repeat"
- Info: "what exercise", "how many reps", "how much time"
- Recording: "start recording", "stop recording"

Parser lives in `packages/shared/src/voice/` — platform-agnostic, tested with unit tests.

## Feature-Based Build Order

| Phase | Feature | Dependencies |
|-------|---------|-------------|
| F1 | Project scaffold + monorepo + CI | None |
| F2 | Auth + user profiles | F1 |
| F3 | Exercise library + body map | F1 |
| F4 | Workout player (video + audio cues) | F2, F3 |
| F5 | Voice command system | F4 |
| F6 | Workout builder | F3 |
| F7 | Form recording | F4 |
| F8 | Progress tracking | F4 |
| F9 | Subscription + payments | F2 |
| F10 | Coach review portal | F7, F9 |
| F11 | Personalized workout plans | F6, F9 |
| F12 | Marketing site + App Store listings | F9 |

## Coach Partner Context

The coach partner has a masters degree and extensive private coaching experience. Key insight from initial conversation:

> "The pacing is the most trouble I have going along with a workout... none of them have [good pacing control]. It's basically play, go, stop — super clunky. You have to touch the thing and you're working out with weights in your hands. It needs to be all voice command."

This drives the voice-first architecture as the primary differentiator. The coach will film all exercise demonstration videos, providing authentic, high-quality content that can't be replicated by competitors.
