# Competitor Features: Flashcard & Study Apps

Comprehensive feature analysis of leading flashcard and study platforms, organized by application.

---

## 1. Quizlet

**Market Position:** 60M+ MAU, ~$139M revenue. The dominant consumer flashcard platform, recently pivoted heavily toward AI-powered study tools.

### Card Creation

- **Text cards:** Create flashcards with terms and definitions (or custom fields).
- **Image support:** Add images to cards (Plus only for custom uploads; free users can use Quizlet's built-in image suggestions).
- **Audio support:** Add audio clips to flashcards.
- **Auto-complete definitions:** Quizlet suggests definitions as you type terms.
- **Magic Notes (AI):** Upload handwritten notes, PDFs, or typed documents and AI automatically generates flashcard sets (~85% accuracy).
- **Bulk import:** Paste tab/comma/dash-separated text to create cards in bulk. Supports copy-paste from spreadsheets and documents.
- **Rich text formatting:** Basic formatting for card content.

### Study Modes

- **Flashcards:** Traditional card flipping with shuffle and text-to-speech options.
- **Learn:** Adaptive study mode that adjusts question difficulty based on performance. Starts with multiple-choice, progresses to written answers as confidence increases. Creates a personalized study plan per set.
- **Test:** Generates a practice test with multiple-choice, written, true/false, and matching questions. Configurable question types and count.
- **Match:** Race against the clock to match terms with definitions. Drag-and-drop gameplay format.
- **Gravity:** Gamified study mode where terms fall like asteroids; type the correct answer before they reach the bottom.
- **Write:** Type answers to test recall (now integrated into Learn mode).
- **Spell:** Audio-based spelling practice (now integrated into Learn mode).

### AI Features

- **Q-Chat AI Tutor:** Conversational AI tutor that provides personalized explanations, adapts to the student's level, and answers follow-up questions about study material.
- **AI Practice Tests:** Generates full-length practice exams from uploaded notes or flashcard sets, simulating real exam conditions with varied question types.
- **Smart Grading:** AI recognizes synonymous answers and partial credit, not just exact text matches.
- **Teach Me:** AI-driven mode where the system teaches concepts interactively.
- **Quiz Me:** AI generates questions on the fly to test understanding.
- **Apply My Knowledge:** AI creates application-based questions that test deeper understanding.
- **Practice with Sentences:** AI generates contextual sentences using vocabulary terms.

### Classroom & Collaboration

- **Quizlet Live:** Real-time collaborative classroom game. Teacher creates a session from any study set, students join via code. Teams work together to match terms and definitions. Configurable for team or individual mode.
- **Blast:** Classroom asteroid-shooting game. Students individually blast asteroids containing correct term/definition matches. Adjustable speed, choices, and duration.
- **Checkpoint:** Quiz mode with music and animations for classroom engagement.
- **Study Groups:** Invite friends to join shared study sessions, see who is actively studying, and track group progress in real time.
- **Class Progress (Teacher):** Dashboard showing which students have started/completed study sessions and who needs encouragement.
- **Sharing:** Share sets via email, Google Classroom, Remind, Microsoft Teams, or direct link. Students can share via email, Facebook, or X.
- **Folders:** Organize study sets into folders and subfolders.
- **Course-Powered Quizlet:** Organize and share study materials by institution and course for classmate collaboration.

### Expert Solutions & Homework Help

- **Textbook Solutions:** Step-by-step solutions for 14,000+ popular textbooks, written and verified by subject-matter experts.
- **AI Homework Chat:** After viewing expert solutions, engage Q-Chat to dig deeper into problems with conversational AI.
- **Subject Coverage:** Math, science, engineering, business, social sciences, and more.

### Analytics & Progress

- **Learn mode progress:** Tracks mastery percentage per set, shows terms not yet mastered.
- **Spaced repetition scheduling:** Optimizes review intervals based on performance.
- **Study streaks:** Tracks consecutive days of study activity.
- **Break reminders:** Built-in notifications to take study breaks.

### Import & Export

- **Import:** Paste text with configurable delimiters (tab, comma, dash for term/definition; semicolon or newline for rows). No native file upload for free users.
- **Export:** Copy text of terms and definitions (website only). No image export due to copyright restrictions.
- **No native Anki import/export.**

### Platform Support

- **iOS app** (4.8-star App Store rating)
- **Android app** (4.6-star Google Play rating)
- **Web** (Chrome, Safari, Firefox, Edge)
- **Cross-device sync** (account-based)

### Accessibility

- Screen reader support
- Keyboard navigation
- High contrast mode
- Text-to-speech (built-in, 18+ languages)
- Adjustable card sizes

### Pricing

| Tier | Price | Key Features |
|------|-------|--------------|
| **Free** | $0 | Limited to 8 study sets, basic flashcard creation, access to community sets, ad-supported, 5 Learn rounds per set, 1 Test per set |
| **Quizlet Plus** | $7.99/mo or $35.99/yr | Unlimited sets, 20 Learn rounds/mo, 3 practice tests/mo, custom image/audio uploads, offline access, ad-free, smart grading |
| **Quizlet Plus Unlimited** | $44.99/yr | Everything in Plus + unlimited Learn rounds, unlimited practice tests |
| **Quizlet Teacher** | Varies | Class Progress dashboard, Quizlet Live, Blast, Checkpoint, classroom management tools |

---

## 2. Anki

**Market Position:** ~40K iOS downloads/month, ~$10.8M/yr iOS revenue. The power-user standard for spaced repetition, open source, with a massive add-on ecosystem. Dominant among medical students, language learners, and serious long-term memorizers.

### Card Creation

- **Note types (built-in):**
  - **Basic:** Front/back card with a single direction.
  - **Basic (and reversed card):** Automatically generates both forward and reverse cards from one note.
  - **Basic (optional reversed card):** Generates a reverse card only if the "Add Reverse" field is filled.
  - **Basic (type in the answer):** Shows a text input field on the front; user types the answer before revealing.
  - **Cloze:** Fill-in-the-blank cards with `{{c1::text}}` syntax. Supports multiple cloze deletions per note, nested cloze deletions (since v2.1.56).
  - **Image Occlusion:** Native support (since v23.10). Overlay shapes on images to hide regions; tests recall of hidden areas. Ideal for anatomy, diagrams, maps.
- **Custom note types:** Create unlimited custom note types with arbitrary fields.
- **Card templates:** HTML/CSS-based templates for full control over card appearance. Supports conditional fields, multiple card templates per note type.
- **Rich media:** Images, audio, video, and LaTeX/MathJax equations on cards.
- **Text-to-speech:** Built-in TTS and add-on support (HyperTTS, AwesomeTTS) for AI-generated speech.
- **Tags:** Hierarchical tagging system for organizing cards across decks.
- **Flags:** Color-coded flags (red, orange, green, blue, pink, turquoise, purple) for marking cards during review.
- **Fields:** Unlimited custom fields per note type (e.g., extra context, source, hints).

### Study & Review

- **Spaced repetition algorithms:**
  - **SM-2 (legacy):** SuperMemo 2-based algorithm, Anki's original scheduler.
  - **FSRS (Free Spaced Repetition Scheduler):** Machine learning-based algorithm (native since v23.10) that analyzes personal review history to optimize intervals. Tracks Retrievability, Stability, and Difficulty per card.
- **Review ratings:** Again, Hard, Good, Easy (4-button rating after each card).
- **Learning steps:** Configurable learning steps for new cards (e.g., 1m, 10m before graduating to review).
- **Lapse handling:** Configurable re-learning steps when a review card is forgotten. Leech detection auto-suspends or tags cards that are repeatedly forgotten.
- **Daily limits:** Configurable daily new card limit and review card limit per deck.
- **Burying:** Automatically delay sibling cards (other cards from the same note) to the next day to prevent interference.
- **Suspending:** Temporarily remove cards from review without deleting them.

### Deck Management

- **Hierarchical decks:** Unlimited nesting with parent/child deck structure (e.g., `Medicine::Cardiology::Arrhythmias`).
- **Filtered decks:** Dynamic decks that pull cards matching search criteria. Used for cramming, previewing, catching up on backlogs, or studying specific tags.
- **Custom study sessions:** Quick-create filtered decks for targeted review (increase today's new card limit, review ahead, study by tag, study by card state).
- **Deck options groups:** Share scheduling settings across multiple decks.

### Browser & Search

- **Card browser:** Spreadsheet-like interface for viewing, searching, editing, and bulk-modifying cards.
- **Powerful search syntax:** Search by field content, tags, deck, card state (new/learning/review/suspended/buried), flags, due date, ease factor, interval, and more.
- **Batch editing:** Select multiple cards and change deck, tags, note type, reschedule, suspend, delete, or reposition.
- **Sidebar:** Quick access to decks, tags, flags, card states, and saved searches.

### Statistics & Analytics

- **Built-in statistics:**
  - Card counts by state (new, learning, young, mature, suspended, buried)
  - Reviews per day (bar chart)
  - Review time per day
  - Intervals distribution
  - Answer buttons breakdown (Again/Hard/Good/Easy percentages)
  - Card ease distribution
  - Hourly breakdown of review performance
  - Future due cards forecast
- **Deck-level and collection-level stats.**
- **Add-on statistics:** Review Heatmap (GitHub-style activity visualization), Study Time Stats, More Overview Stats, Progress Stats, and many more via the add-on ecosystem.

### Add-on Ecosystem

- **1,600+ add-ons** available on AnkiWeb, written by the community.
- **Popular add-ons:**
  - Review Heatmap (GitHub-style study activity visualization)
  - Image Occlusion Enhanced (advanced image occlusion before native support)
  - HyperTTS / AwesomeTTS (AI text-to-speech)
  - Advanced Browser (enhanced card browser)
  - Beautify Anki (themes and visual customization)
  - Colorful Tags (tag color coding)
  - Sticky Searches (persistent search filters)
  - Incremental Reading
  - Batch editing tools
  - Gamification add-ons
  - Custom scheduling add-ons
- **Add-on development:** Python-based add-on API with access to Anki's internals.

### Import & Export

- **Import formats:**
  - `.apkg` (Anki package, single deck with media)
  - `.colpkg` (collection package, entire collection with scheduling)
  - CSV/TSV text files (configurable field mapping)
  - Mnemosyne 2.0 `.db` files
  - SuperMemo `.xml` files
- **Export formats:**
  - `.apkg` (with or without scheduling data and media)
  - `.colpkg` (full collection backup)
  - Plain text (CSV/TSV)
- **Shared decks:** Browse and download community-shared decks on AnkiWeb (thousands of pre-made decks covering languages, medicine, law, history, and more).

### Sync & Platform Support

- **AnkiWeb:** Free cloud sync service for syncing cards, media, and progress across devices.
- **Anki Desktop:** Windows, macOS, Linux (free, open source, GPL-3.0).
- **AnkiMobile (iOS):** $24.99 one-time purchase (primary revenue source for development).
- **AnkiDroid (Android):** Free, open source (community-maintained).
- **AnkiWeb (browser):** Basic web-based review interface (free).

### Pricing

| Platform | Price | Notes |
|----------|-------|-------|
| **Desktop** (Win/Mac/Linux) | Free | Open source, GPL-3.0 |
| **AnkiDroid** (Android) | Free | Open source, community-maintained |
| **AnkiMobile** (iOS) | $24.99 (one-time) | Sole revenue source for lead developer |
| **AnkiWeb** (sync + web review) | Free | Cloud sync included at no cost |

---

## 3. Brainscape

**Market Position:** Millions of learners, backed by cognitive science research. Differentiated by its Confidence-Based Repetition (CBR) system and curated content marketplace.

### Card Creation

- **Question-and-answer format:** Cards are structured as Q&A pairs (not just term/definition).
- **Rich media:** Text formatting, images, sounds, and animated GIFs on cards.
- **AI Copilot:** AI assistant that improves cards one at a time with options like "Answer this card," "Elaborate," and "Add Mnemonic."
- **AI flashcard generation:** Upload PowerPoints, PDFs, Word docs, Excel files, videos, and photos to auto-generate flashcard sets. Bulk creation of hundreds of cards in seconds.
- **Import:** CSV, text files, Excel, Word docs. Also supports import from Anki and Quizlet decks.
- **Manual creation:** Standard editor with text formatting and media attachment.

### Study Modes & Spaced Repetition

- **Confidence-Based Repetition (CBR):** Proprietary algorithm. After revealing each answer, rate confidence from 1 to 5. Lower-rated cards repeat more frequently; higher-rated cards appear at increasing intervals.
- **Adaptive intervals:** Calculates optimal repetition timing personalized to individual study patterns, whether studying daily for 45 minutes or every few days for 3 minutes.
- **Active recall:** Every card requires active retrieval before seeing the answer.
- **Metacognition:** Self-assessment builds awareness of knowledge gaps.
- **Reverse cards:** Study cards in both directions (Pro only).
- **Bookmarked cards:** Save specific cards for focused review (Pro only).
- **Reset stats:** Clear progress and start fresh on any deck (Pro only).

### Organization

- **Classes and decks:** Hierarchical organization. A "class" contains multiple "decks" (like chapters within a subject).
- **Card movement:** Easily move cards between decks.
- **Knowledge Genome:** Brainscape's master library organized into 16 major subject categories.

### Content Library

- **Brainscape-Certified decks:** Expert-vetted flashcard sets created by publishers, professors, and subject-matter experts. Covers standardized tests, professional certifications, language learning, and academic subjects.
- **Certified language courses:** Chinese, French, Spanish, Japanese (JLPT N5), Medical Spanish.
- **User-generated content:** Billions of cards from educators, students, and professionals worldwide.
- **Publisher partnerships:** Licensed content from educational publishers.

### Collaboration & Sharing

- **Free sharing links:** Share classes publicly or privately via link.
- **Email invitations:** Invite specific users to access your content.
- **Editing permissions:** Configurable role-based access for collaborative card creation. Crowdsource content completion with teams or students.
- **Private content:** Make classes private (Pro only). See private content shared with you (Pro only).

### Analytics & Progress

- **Mastery percentage:** Overall mastery score per class/deck, consistently within 3% of actual exam scores.
- **Learner dashboard:** Track time spent studying, cards studied, and mastery progression.
- **Per-student tracking:** For educators/organizations, view individual learner progress with time-stamped study data.
- **Study reminders:** Customizable notifications to build study habits.
- **Persistence metrics:** Track study consistency over time.

### Monetization for Creators

- **Earnings dashboard:** Monthly tracking of studier count and revenue from content.
- **Paid sharing links:** Sell access to premium content.
- **Access code reselling:** Generate and sell access codes for content bundles.
- **Publisher integration:** License content for institutional distribution.

### Import & Export

- **Import:** CSV, text files, Excel (.xlsx), Word (.docx), photos. Also imports from Anki and Quizlet.
- **Export:** Time-stamped study data for learner reporting. No native card export to standard formats for free users.

### Platform Support

- **iOS app** (native)
- **Android app** (native)
- **Web app** (full-featured browser editor and study interface)
- **Cross-device sync** (automatic)

### Pricing

| Tier | Price | Key Features |
|------|-------|--------------|
| **Free** | $0 | Unlimited card creation, import, sharing, spaced repetition study, AI features, study reminders |
| **Pro Monthly** | $19.99/mo | Unlimited AI generation, all certified content, all user-generated content, images/sounds on cards, bookmarks, reverse cards, private content, reset stats |
| **Pro Semi-Annual** | $59.99/6mo | Same as Pro Monthly |
| **Pro Annual** | $95.99/yr | Same as Pro Monthly |
| **Pro Lifetime** | $199.99 (one-time) | Same as Pro, permanent access |

---

## 4. StudySmarter (Vaia)

**Market Position:** Millions of students globally. Rebranded from StudySmarter to Vaia in the US. AI-powered all-in-one study platform targeting university and school students. Backed by 250M+ learning materials and European EdTech leadership.

### Card Creation

- **Manual flashcard creation:** Create text-based flashcards with a built-in editor.
- **AI flashcard generation:** Upload lecture slides, PDFs, or notes and AI automatically creates complete flashcard sets in seconds.
- **Multiple-choice format:** Cards support multiple-choice question format in addition to standard Q&A.
- **Image support:** Add images and sketches to flashcards.
- **Templates:** Pre-built templates for different card formats.

### Study Modes

- **Flashcard review:** Three learning modes for flashcard study (standard review, spaced repetition, and timed practice).
- **Spaced repetition:** Science-backed algorithm optimizes review intervals for long-term retention.
- **Active recall:** Cards test retrieval before showing answers.
- **Mock exams:** AI generates unlimited practice exams from study materials with instant feedback and grading.
- **AI Homework Scanner:** Take photos of homework problems and receive instant AI-generated explanations (math and general subjects).

### AI Features

- **AI Explanations:** Generate concise breakdowns of any topic on demand, covering 40+ subjects.
- **Exam AI:** Tests knowledge and provides targeted feedback to improve answers.
- **AI Study Companion:** Adapts to individual learning style and creates tailored study plans.
- **AI-generated summaries:** Automatically summarize uploaded documents and notes.
- **Personalized learning paths:** AI analyzes study behavior and performance to recommend what to study next.

### Notes & Content

- **Note creation:** Rich text editor with highlighting, annotation, and formatting tools.
- **Document upload:** Import PDFs, lecture slides, and documents as study materials.
- **Study Sets:** Organize all materials (flashcards, notes, documents) into themed collections.
- **Textbook Solutions:** Step-by-step solutions from thousands of popular textbooks.
- **Community content:** Access millions of user-created flashcard sets and study materials.
- **Expert explanations:** Pre-written explanations across 40+ subjects (Biology, Chemistry, Math, Psychology, History, and more).

### Study Planning & Organization

- **AI Study Planner:** Automatically creates personalized study plans with calendar integration, tracking goals and deadlines.
- **Smart To-Do List:** Dynamic task list that updates based on study progress and upcoming exams.
- **Study reminders:** Push notifications for scheduled study sessions.
- **Goal setting:** Set daily/weekly study targets and track completion.

### Social & Collaboration

- **Study Groups:** Create or join groups where classmates share materials and study together.
- **Anonymous Q&A:** Ask questions visible only to fellow students in the same course; answers are anonymous.
- **Material sharing:** Share flashcards, notes, and study sets with classmates.
- **Community library:** Browse and use millions of shared study materials from other students.

### Analytics & Progress

- **Study analytics dashboard:** Visualize study time, sessions completed, and progress over time.
- **Subject-level tracking:** See mastery and progress per subject/topic.
- **Streak tracking:** Monitor consecutive days of study activity.
- **Gamification:** Badges, streaks, and progress milestones to maintain motivation.

### Import & Export

- **Import:** Upload PDFs, PowerPoints, Word documents, images. AI converts them into study materials.
- **Export:** CSV export of flashcards (Premium only).
- **No native Anki/Quizlet import format support.**

### Platform Support

- **iOS app** (App Store)
- **Android app** (Google Play)
- **Web app** (browser-based, full feature parity)
- **Cross-device sync** (automatic, account-based)
- **Offline mode** (Premium only)

### Accessibility

- Available in multiple languages (English, German, Spanish, and more)
- Dark mode support

### Pricing

| Tier | Price | Key Features |
|------|-------|--------------|
| **Free** | $0 | Flashcards, notes, AI explanations, mock exams, spaced repetition, study planner, community content, study groups, analytics |
| **Premium** | ~$6.49-$8.99/mo or ~$17.99-$63.99/yr (regional pricing varies) | Offline mode, ad-free experience, CSV export, enhanced AI features |

### Additional Services

- **Job board:** Student career resources and internship listings.
- **Student deals:** Discounts and promotions for students.
- **Degree finder:** Tool for exploring academic programs.
- **Magazine:** Educational content and study tips.

---

## Cross-App Feature Comparison Matrix

| Feature | Quizlet | Anki | Brainscape | StudySmarter/Vaia |
|---------|---------|------|------------|-------------------|
| **Spaced Repetition** | Basic (adaptive Learn mode) | Advanced (SM-2 + FSRS) | CBR (1-5 confidence) | Basic (built-in) |
| **AI Card Generation** | Magic Notes (Plus) | Via add-ons only | AI Copilot | AI from uploads |
| **AI Tutor** | Q-Chat | No | No | AI Explanations |
| **Image Occlusion** | No | Native (v23.10+) | No | No |
| **Cloze Deletion** | No | Native (nested support) | No | No |
| **Custom Card Templates** | No (fixed format) | Full HTML/CSS control | No | No |
| **Rich Media (img/audio/video)** | Yes (images Plus-only uploads) | Yes (all free) | Yes (images/sounds Pro) | Yes (images free) |
| **Text-to-Speech** | Built-in | Via add-ons | No | No |
| **Offline Mode** | Plus only | Always offline-capable | Yes (native) | Premium only |
| **Classroom Games** | Live, Blast, Checkpoint | No | No | No |
| **Textbook Solutions** | 14,000+ textbooks (Plus) | No | No | Thousands of textbooks |
| **Community Content** | Millions of sets | Thousands of shared decks | Billions of cards + Certified | Millions of sets |
| **Collaboration** | Study Groups, sharing, classes | No (single-user) | Classes, sharing, roles | Study Groups, anonymous Q&A |
| **Add-on/Plugin System** | No | 1,600+ add-ons | No | No |
| **Notes & Summaries** | No (cards only) | No (cards only) | No (cards only) | Yes (full note editor) |
| **Mock Exams** | AI Practice Tests (Plus) | No | No | Unlimited (free) |
| **Study Planner** | No | No | Study reminders | AI Study Planner (free) |
| **Analytics Depth** | Basic (mastery %) | Deep (20+ chart types) | Mastery %, time, per-student | Dashboard, streaks |
| **Open Source** | No | Yes (GPL-3.0) | No | No |
| **Desktop App** | No (web only) | Yes (Win/Mac/Linux) | No (web only) | No (web only) |
| **Price Floor** | Free (limited) | Free (desktop + Android) | Free (limited) | Free (generous) |
| **Premium Price** | $35.99/yr | $24.99 one-time (iOS only) | $95.99/yr or $199.99 lifetime | ~$17.99-$63.99/yr |
