# Module Proposal: MyCreate

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `create`
**Table prefix:** `ct_`
**Tier:** Pro (premium)
**Target module number:** #38
**Date:** 2026-04-20
**Demographic pull:** Ages 12-35 (strongest), creator economy participants

---

## Executive Summary

The creator economy has 200M+ participants globally. Teens identify as "creators" more than any prior generation. Yet no privacy-first tool exists to track creative projects, build a private portfolio, log skill progression, or journal the creative process. Current tools are either public platforms (Instagram, TikTok, Behance) or professional project management (Notion, Trello) that don't understand the creative journey.

MyCreate is a private creative journal: track projects from idea to completion, build skill trees, log your creative process, and maintain a portfolio that belongs to YOU.

**Positioning sentence:** *Instagram shows what you made. MyCreate remembers how you grew.*

---

## Why This Module

1. **200M+ creator economy participants.** Teens and young adults create art, music, video, writing, code, crafts -- and have nowhere private to track their journey.
2. **Creative process matters more than output.** No tool captures the iteration, learning, failure, and growth between public posts.
3. **Portfolio ownership.** Behance, Dribbble, ArtStation are owned by Adobe/others. Creators lose everything if a platform shuts down or changes terms.
4. **Skill progression is motivating.** Seeing your own growth over months/years keeps creators going through plateaus.
5. **Cross-module heavy.** Music (production), budget (equipment/commissions), habits (creative practice), journal (artistic reflection), friends (collaborators).
6. **Youth magnet.** Gen Z's "I'm a creator" identity is THE strongest self-concept for ages 14-25.

---

## Full Feature Set

### Core: Project Tracker

- **New project:** Title, type (art, music, video, writing, code, craft, photo, design, game dev, other), description
- **Project stages:** Idea -> Planning -> In Progress -> Revising -> Complete -> Archived
- **Progress journal:** Log entries per project: what you did today, roadblocks, breakthroughs
- **Estimated vs actual time:** How long you thought it'd take vs reality
- **Deadline tracking:** Self-imposed or external deadlines
- **Revision tracking:** Version notes ("V1: rough sketch, V2: inked, V3: colored")
- **Inspiration references:** Save images, links, notes that inspired this project
- **Tools used:** What software/hardware/materials for this project
- **Collaboration notes:** Who contributed what
- **Outcome logging:** Published where? Sold? Exhibited? Shared with whom?
- **Satisfaction rating:** How do you feel about the result? (revisit after 3 months)

### Core: Creative Log / Daily Practice

- **Daily creative log:** What creative work did you do today? (even 5 minutes counts)
- **Practice timer:** Track creative practice sessions with focused timer
- **Streak tracking:** Days of creative practice in a row (gentle, not punishing)
- **Medium tracking:** What medium are you working in today? (drawing, writing, music, code, etc.)
- **Energy/flow log:** Did you hit flow state? Was it a grind? Quick note.
- **Output log:** Rough count of what was produced (words written, sketches done, minutes of video)
- **Monthly summary:** Auto-generated creative activity summary
- **Dry spell awareness:** "It's been 14 days since you created anything" -- gentle, supportive nudge

### Core: Skill Tree

- **Skills inventory:** List your creative skills (e.g., watercolor, character design, mixing, video editing, TypeScript)
- **Proficiency levels:** Beginner -> Developing -> Competent -> Proficient -> Expert (self-assessed)
- **Learning milestones:** Key moments of progress per skill
- **Courses/tutorials completed:** What you studied to improve (links to Classes module)
- **Before/after comparisons:** Side-by-side progress photos over months/years
- **Practice hours per skill:** How much time invested in each
- **Goals per skill:** "Be comfortable with oil painting by December"
- **Tool proficiency:** Software/hardware skill tracking (Photoshop, Blender, After Effects, etc.)
- **Technique notes:** Things you've learned about your craft (private wiki)

### Core: Portfolio Builder

- **Add portfolio pieces:** Upload/reference finished work with metadata
- **Project photos:** Multiple images per piece (process shots, final, detail)
- **Categorize:** By medium, by year, by project, by skill demonstrated
- **Private by default:** Portfolio is for YOUR reference unless you generate a share link
- **Shareable portfolio page:** Generate a temporary public link for applications/clients (optional, user-controlled)
- **Artist statement:** Private draft space for bio/statement
- **Commission portfolio:** Separate section for client-ready examples
- **Export:** Generate a PDF portfolio for applications

### Core: Equipment & Materials

- **Tool inventory:** Camera, tablet, DAW, brushes, paints, fabrics, 3D printer, etc.
- **Software subscriptions:** Creative Cloud, Procreate, Logic Pro, etc. (links to Subs/Budget)
- **Wishlist:** Equipment you want to buy next
- **Equipment reviews:** Private notes on gear you own (what works, what doesn't)
- **Material costs per project:** Track materials used and their cost
- **Workspace photos:** Document your creative space evolution

### Advanced: Client/Commission Tracking

- **Client list:** People who've commissioned or hired you
- **Commission log:** What, when, price, status (inquiry -> quote -> accepted -> in progress -> delivered -> paid)
- **Pricing notes:** What you charged and whether it was fair
- **Testimonial collection:** Client feedback (private reference)
- **Revenue tracking:** Creative income over time (links to Budget)
- **Invoice notes:** What you invoiced, payment status

### Advanced: Inspiration & References

- **Mood board:** Save images, colors, textures, links that inspire you
- **Artist inspiration list:** Creators who influence your work
- **Style notes:** What you're drawn to aesthetically, how your style is evolving
- **Reference library:** Organized by category (anatomy, architecture, nature, typography, etc.)
- **Book/course library:** Resources you've used for learning

### Advanced: Creative Challenges

- **Challenge tracking:** Inktober, NaNoWriMo, 100DaysOfCode, 365 Photos, etc.
- **Daily challenge log:** Check off each day with notes/output
- **Personal challenges:** Self-created challenge goals
- **Challenge history:** Past challenges completed/abandoned
- **Challenge stats:** Completion rate, longest streak

### Advanced: Year-in-Review

- **Annual creative summary:** Projects completed, skills developed, practice hours, income earned
- **Growth visualization:** Before/after skill progression across the year
- **Most productive months:** When were you most creative?
- **Medium breakdown:** Where did your creative time go?
- **Breakthrough moments:** Self-flagged moments of significant growth
- **Shareable card:** "My year in creation" summary image

---

## Data Model

```
ct_projects
  id, title, type (art|music|video|writing|code|craft|photo|design|game_dev|other),
  description_md, status (idea|planning|in_progress|revising|complete|archived),
  priority, deadline, estimated_hours, actual_hours,
  tools_used (json), collaborators (json),
  outcome_notes, published_url, satisfaction_rating,
  cover_photo_id, inspiration_refs (json),
  started_at, completed_at, created_at, updated_at

ct_progress_entries
  id, project_id, date, notes_md, hours_spent,
  milestone (bool), milestone_name, roadblock,
  breakthrough, mood, photo_ids (json), created_at

ct_daily_log
  id, date, mediums_worked (json), duration_minutes,
  flow_state (bool), energy_level, output_notes,
  project_ids (json), notes_md, created_at

ct_skills
  id, name, category (visual|audio|writing|code|craft|performance|other),
  proficiency (beginner|developing|competent|proficient|expert),
  started_learning, hours_practiced,
  milestones (json), goals_md, technique_notes_md,
  created_at, updated_at

ct_portfolio_pieces
  id, project_id (nullable), title, description_md,
  medium, year_created, photo_ids (json),
  categories (json), is_commission, client_name,
  is_shareable, created_at

ct_equipment
  id, name, type (hardware|software|material|tool),
  brand, model, purchase_date, purchase_price_cents,
  condition, notes_md, photo_id, wishlist (bool),
  subscription_monthly_cents, created_at

ct_commissions
  id, client_name, description_md, price_cents,
  status (inquiry|quoted|accepted|in_progress|delivered|paid|cancelled),
  deadline, started_at, delivered_at, paid_at,
  testimonial_md, notes_md, created_at, updated_at

ct_challenges
  id, name, type (inktober|nanowrimo|100days|custom),
  description, start_date, end_date, total_days,
  completed_days, status (active|completed|abandoned),
  daily_entries (json), notes_md, created_at

ct_inspiration
  id, type (image|link|artist|color|texture|quote),
  title, source_url, notes_md, photo_id,
  tags (json), mood_board_id, created_at

ct_photos
  id, project_id, portfolio_id, equipment_id,
  kind (process|final|detail|reference|setup),
  local_uri, caption, taken_at, created_at

ct_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Project tracker: CRUD, stages, progress journal, tools | 2-3 |
| P2 | Daily creative log + practice timer + streaks | 1-2 |
| P3 | Skill tree: inventory, proficiency, milestones, goals | 2 |
| P4 | Portfolio builder: pieces, categories, shareable link | 2-3 |
| P5 | Equipment + materials inventory + costs | 1 |
| P6 | Client/commission tracking + revenue | 1-2 |
| P7 | Inspiration, challenges, references | 1-2 |
| P8 | Year-in-review + growth visualization | 1-2 |
| P9 | Cross-module (music, budget, habits, friends, journal, classes) | 2 |
| **Total P0-P9** | | **~15-20 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Music** | Music production projects, instrument practice tracking |
| **Budget** | Equipment spending, commission income, material costs |
| **Habits** | Daily creative practice as a habit |
| **Friends** | Collaborators, creative partners, accountability buddies |
| **Journal** | Artistic reflections, creative block processing |
| **Classes** | Courses taken to improve skills |
| **Notes** | Technique documentation, project planning |
| **Words** | Writing projects tracked here, vocabulary for writers |

---

## Competitor Analysis

| Tool | What It Does | Why It Falls Short |
|------|-------------|-------------------|
| Behance/Dribbble | Public portfolio | Public-only, Adobe-owned, no process tracking |
| Notion | Project management | Generic, no creative-specific features, complex |
| Procreate/Photoshop | Creation tools | Make things, don't track the journey |
| ArtStation | Portfolio hosting | Public, career-focused, no practice/skill tracking |
| Instagram | Sharing art | Social media, not a journal, algorithm-driven |
| Skillshare/Domestika | Learning | Course platforms, not personal progress trackers |
| Forest (focus app) | Timer | Generic focus, not creative-specific |

**Gap:** No private tool combines project management + skill progression + practice journaling + portfolio building for creators.

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Creative magenta #D946EF, brush orange #F97316, maker teal #14B8A6
2. **Scope breadth:** All creative mediums in one module, or should writing/music have their own? Recommend: one module, filterable by medium. Writing is already partially in Words/Voice/Journal.
3. **Portfolio sharing privacy model?** Temporary links (expire after 30 days), permanent links (revocable), or no sharing at all? Recommend: temporary links with explicit generation + revocation.
4. **Commission tracking overlap with Budget?** Keep simple here (creative focus) and link to Budget for the money side? Recommend yes.
5. **AI-assisted skill assessment?** Photo comparison of early vs recent work? Recommend: no AI. Self-assessment is the point. The growth is visible to the creator.
6. **Free or Pro?** Recommend Pro. The daily log could be free as a hook.
