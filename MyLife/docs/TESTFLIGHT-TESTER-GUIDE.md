# MyLife TestFlight Tester Guide

Welcome to the MyLife beta! Thank you for being one of the first people to try this. Your feedback is going to shape the app before it launches publicly.

## What is MyLife?

MyLife is a single app that replaces dozens of everyday apps you probably already use: your budgeting app, your workout tracker, your recipe organizer, your journal, your flashcard app, your period tracker, and more. There are 28 modules inside MyLife, each one designed to compete with (or beat) whatever standalone app you currently use for that purpose.

The big difference: **your data stays on your device.** MyLife stores everything locally on your phone. No cloud accounts, no ads, no data selling, no tracking. You own your data completely.

## What We Need From You

We want honest, comparative feedback. For each module you try, we'd love for you to:

1. **Download the competitor app** listed in this guide (most are free)
2. **Use both apps side by side** for the same task
3. **Tell us where MyLife wins** and where it falls short
4. **Report bugs** using the template at the bottom of this guide

Don't hold back. "This feels worse than [competitor]" is exactly the kind of feedback we need. Specific is better than vague. Screenshots are gold.

## How to Get Started

1. Open MyLife after installing from TestFlight
2. You'll see the Hub dashboard. This is home base.
3. Tap **Discover** to browse all available modules
4. Enable whichever modules interest you. Start with 3-5 that overlap with apps you already use.
5. Each module gets its own section in the sidebar (web) or bottom tabs (mobile)

You don't need to test every module. Pick the ones that match your life and go deep on those.

---

## Module-by-Module Testing Guide

The modules below are listed in our finalization priority order. The ones near the top are the most polished and the most important for launch.

---

### 1. Budget
*Know where every dollar went, and why*

**Download to compare:** [Goodbudget](https://apps.apple.com/app/goodbudget-budget-finance/id471112395) (free, 10 envelopes)

Goodbudget uses the same envelope budgeting approach as MyLife and has a generous free tier (10 envelopes, 1 account). YNAB and Monarch are the bigger names in this space, but both require paid subscriptions ($109/yr and $100/yr respectively) just to get started.

**What Goodbudget charges for premium:** $80/yr (unlimited envelopes, multiple accounts, debt tracking)

**What to test:**
- Create 3-4 budget envelopes and add transactions to each. Is the flow faster or slower than Goodbudget?
- Try splitting a transaction across envelopes (e.g., a grocery trip that includes household items)
- Look at the spending reports and charts. Are they clear? Do they help you understand where your money went?
- Add recurring transactions (rent, subscriptions). Does MyLife handle them well?
- Overall feel: could you actually switch from whatever budgeting app you use today?

**The question:** *Is MyLife Budget good enough to replace Goodbudget, YNAB, or Monarch?*

---

### 2. Cycle
*Private period and fertility tracker*

**Download to compare:** [Clue](https://apps.apple.com/app/clue-period-cycle-tracker/id657189652) (free, core tracking included)

Clue is the science-first period tracker with a strong free tier. Flo is more popular (77M users) but pushes its premium plan aggressively. Clue lets you track periods, symptoms, and moods for free.

**What Clue charges for premium:** $49.99/yr (personalized insights, cycle analysis, expanded tracking)

**What to test:**
- Log a period start date and symptoms. Is the input flow intuitive?
- Check the cycle prediction. Does it show upcoming period and fertile window clearly?
- Log symptoms (cramps, headaches, energy levels). Is the symptom picker easy to use?
- Look at cycle history and patterns. Can you spot trends?
- Privacy gut check: does MyLife *feel* more trustworthy for this kind of sensitive data? (Remember: MyLife stores everything locally, Clue stores it on their servers)

**The question:** *Is MyLife Cycle good enough to replace Clue or Flo, especially given the privacy advantage?*

---

### 3. Nutrition
*Your food diary stays on your device. Your insights span your whole life.*

**Download to compare:** [Cronometer](https://apps.apple.com/app/cronometer-nutrition-tracker/id1145935738) (free, food logging and basic nutrients)

Cronometer tracks 82+ micronutrients (not just calories and macros) and has a generous free tier. MyFitnessPal is the bigger name with 220M users, but its free tier is loaded with ads and it was caught selling user data.

**What Cronometer charges for premium:** $49.99/yr (no ads, fasting timer, nutrition scores, custom charts)

**What to test:**
- Log a full day of meals. Is searching for foods fast? Is the database good enough?
- Check the nutrient breakdown. Does MyLife show macros (protein, carbs, fat) clearly?
- Try scanning a barcode on a packaged food. Does it find the item?
- Log water intake throughout the day
- Compare the daily summary view between both apps. Which one is more useful at a glance?

**The question:** *Is MyLife Nutrition good enough to replace Cronometer or MyFitnessPal?*

---

### 4. Notes
*Private knowledge engine with markdown, wiki linking, and intelligence*

**Download to compare:** [Obsidian](https://apps.apple.com/app/obsidian-connected-notes/id1557175442) (free, local notes)

Obsidian is the closest match to what MyLife Notes does: local-first markdown notes with wiki-style linking between notes. Notion is bigger but requires an internet connection and stores your data on their servers.

**What Obsidian charges for premium:** $48/yr for Sync (cross-device), $96/yr for Publish (share notes as a website)

**What to test:**
- Create a note with headers, bold text, bullet lists, and a checklist. Does the markdown editor feel good?
- Create two notes and link them together using [[wiki links]]. Does the linking work smoothly?
- Try the graph view (if available). Can you see how your notes connect?
- Search across all your notes. Is search fast and accurate?
- Try the canvas/whiteboard view for visual note-taking

**The question:** *Is MyLife Notes good enough to replace Obsidian, Notion, or Apple Notes?*

---

### 5. Habits
*Your complete habit system*

**Download to compare:** [Habitify](https://apps.apple.com/app/habitify-habit-tracker/id1111447047) (free, 3 habits)

Habitify is a clean, well-designed habit tracker available on iPhone, Apple Watch, and Mac. The free tier is limited to 3 habits, which is enough to compare side by side. MyLife Habits is more ambitious, combining features from 6+ standalone habit apps.

**What Habitify charges for premium:** $29.99/yr or $39.99 lifetime (unlimited habits, detailed stats, reminders)

**What to test:**
- Create 3 habits with different frequencies (daily, 3x/week, weekdays only). Is setup straightforward?
- Complete habits for a few days. Is the check-off flow satisfying?
- Look at your streaks and completion history. Are the stats motivating?
- Set reminders for each habit. Do notifications arrive on time?
- Compare the "at a glance" daily view. Which app makes it easier to see what you still need to do today?

**The question:** *Is MyLife Habits good enough to replace Habitify, Streaks, or Habitica?*

---

### 6. Workouts
*Your gym data, your device, your gains*

**Download to compare:** [Hevy](https://apps.apple.com/app/hevy-gym-log-workout-tracker/id1460763116) (free, unlimited workouts)

Hevy is the fastest-growing gym tracker with a generous free tier (unlimited workout logging, exercise library, progress charts). It is focused on strength training, which is the core of MyLife Workouts as well.

**What Hevy charges for premium:** $39.99/yr (advanced analytics, custom exercises, unlimited routines)

**What to test:**
- Log a complete workout (3-4 exercises with sets, reps, and weight). Is the logging flow quick?
- Browse the exercise library. Can you find exercises easily? Are the descriptions and form cues helpful?
- Look at your workout history and progress graphs. Can you see your strength going up over time?
- Create a workout template/routine you can reuse. Is it easy to set up?
- Check the body map view (MyLife unique feature). Does it help you see which muscles you've been training?

**The question:** *Is MyLife Workouts good enough to replace Hevy, Strong, or Fitbod?*

---

### 7. Flash
*Never forget what matters*

**Download to compare:** [Anki](https://apps.apple.com/app/ankimobile-flashcards/id373493387) ($24.99 one-time) or [Quizlet](https://apps.apple.com/app/quizlet-ai-powered-flashcards/id546473125) (free)

If you don't want to pay $25 for Anki, use Quizlet's free tier instead. Quizlet lets you create flashcard sets and study with multiple modes for free. Anki is the gold standard for spaced repetition but has a dated interface.

**What Quizlet charges for premium:** $35.99/yr (no ads, AI explanations, advanced study modes)

**What to test:**
- Create a deck of 10-15 flashcards. Is the card creation process fast?
- Study the deck. Does the spaced repetition feel right? (It should show you cards you got wrong more often)
- Try different study modes if available (standard flip, multiple choice, typing)
- Come back the next day and study again. Does the app remember which cards you struggled with?
- Overall feel: is creating and studying cards enjoyable or tedious?

**The question:** *Is MyLife Flash good enough to replace Quizlet or Anki?*

---

### 8. Mood
*Know your mind. Calm your body.*

**Download to compare:** [Daylio](https://apps.apple.com/app/daylio-journal/id1194023242) (free, daily mood + activity logging)

Daylio is the most popular dedicated mood tracker. You log your mood with a single tap (no typing required) and tag activities. The free tier covers daily logging and basic stats. MyLife Mood combines features from Daylio, Bearable, and Reflectly.

**What Daylio charges for premium:** $35.99/yr (advanced stats, mood patterns, unlimited entries, PDF export)

**What to test:**
- Log your mood a few times throughout the day. Is the mood picker quick and intuitive?
- Tag activities (exercise, socializing, work, etc.) alongside your mood. Can you spot what affects your mood?
- Check the mood charts and patterns after a few days. Are the visualizations helpful?
- Add a quick note with your mood entry. Is the journaling component useful?
- Compare the weekly/monthly overview. Which app gives you a better picture of your emotional patterns?

**The question:** *Is MyLife Mood good enough to replace Daylio or Bearable?*

---

### 9. Health
*Your health data, on your device, under your control*

**Download to compare:** [Apple Health](https://apps.apple.com/app/apple-health/id1242424672) (free, built into your iPhone)

You already have Apple Health on your phone. It is the default health data aggregator on iOS. MyLife Health is designed to work alongside Apple Health but adds cross-module correlation (connecting your workouts, mood, nutrition, and sleep data in ways Apple Health cannot).

**What Apple Health charges:** Free (it comes with your iPhone)

**What to test:**
- Check what health data MyLife shows compared to Apple Health. Is it organized better?
- If you use an Apple Watch or fitness tracker, see if that data appears in MyLife Health
- Look for cross-module insights (e.g., "your mood is better on days you work out"). This is MyLife's unique advantage.
- Log a blood pressure or weight reading. Is the input flow smooth?
- Compare the health dashboard. Is MyLife's presentation more useful than Apple Health's summary view?

**The question:** *Does MyLife Health add enough value on top of Apple Health to be worth opening regularly?*

---

### 10. Books
*Read in peace*

**Download to compare:** [The StoryGraph](https://apps.apple.com/app/the-storygraph/id1570489264) (free, unlimited shelves and tracking)

The StoryGraph is the best Goodreads alternative. It has a generous free tier with unlimited book tracking, mood/pace data, and reading stats. Goodreads (by Amazon) has 150M users but is universally criticized for its stale design and tracking.

**What The StoryGraph charges for premium:** $50/yr (advanced stats, buddy reads, content warnings filter)

**What to test:**
- Search for and add a book you're currently reading. Is the book database good?
- Log reading progress (page number or percentage). Is the tracking flow smooth?
- Check your reading stats and shelves. Can you organize books the way you want?
- Try adding a rating and review after finishing a book
- Browse for new books to read. Does MyLife help with discovery?

**The question:** *Is MyLife Books good enough to replace The StoryGraph or Goodreads?*

---

### 11. Journal
*Private journal, thought toolkit, and self-reflection suite*

**Download to compare:** [Day One](https://apps.apple.com/app/day-one-journal-private-diary/id1044867788) (free, 1 journal)

Day One is the gold standard for digital journaling. The free tier gives you 1 journal with text, photos, and location tagging. MyLife Journal matches these features and adds voice-to-text entry.

**What Day One charges for premium:** $34.99/yr (unlimited journals, audio recordings, advanced search, PDF export)

**What to test:**
- Write a journal entry with text and a photo. Is the writing experience pleasant?
- Try voice-to-text entry if available. Does it transcribe accurately?
- Check if location and weather metadata are captured automatically
- Search through past entries. Can you find what you're looking for?
- Compare the timeline/calendar view for browsing past entries. Which app makes it easier to revisit memories?

**The question:** *Is MyLife Journal good enough to replace Day One?*

---

### 12. Meds
*Your private health command center*

**Download to compare:** [Medisafe](https://apps.apple.com/app/medisafe-pill-medication-reminder/id573916946) (free, unlimited medications and reminders)

Medisafe is the most popular medication reminder app with a strong free tier. It tracks medications, sends reminders, and shows adherence reports. Important privacy note: Medisafe works with pharmaceutical companies and shares aggregated data.

**What Medisafe charges for premium:** $39.99/yr (family sharing, advanced reports, drug interaction checker)

**What to test:**
- Add 2-3 medications with different schedules (daily, twice daily, weekly). Is the setup clear?
- Wait for reminder notifications. Do they arrive on time? Are they helpful?
- Mark medications as taken or skipped. Is the daily check-off flow fast?
- Check your adherence report. Can you see how consistently you've been taking your meds?
- Privacy gut check: knowing Medisafe shares data with pharma companies, does MyLife's local-only approach feel meaningfully better for medication data?

**The question:** *Is MyLife Meds good enough to replace Medisafe?*

---

### 13. Fast
*Fasting and hydration, completely private*

**Download to compare:** [Zero](https://apps.apple.com/app/zero-fasting-health-tracker/id1168348542) (free, basic fasting timer)

Zero is the most popular fasting app (endorsed by Jack Dorsey). The free tier includes a fasting timer and basic history. MyLife Fast adds hydration tracking to the fasting experience.

**What Zero charges for premium:** $69.99/yr (fasting coach, advanced stats, exclusive content)

**What to test:**
- Start a fast and watch the timer. Is the countdown display clear and motivating?
- End a fast and check your fasting history. Can you see patterns in your fasting schedule?
- Log water intake during your fast. Is the hydration tracker easy to use?
- Try different fasting protocols (16:8, 18:6, etc.). Is switching between them intuitive?
- Compare the fasting history and stats. Which app gives you a better overview of your fasting habits?

**The question:** *Is MyLife Fast good enough to replace Zero or Simple?*

---

### 14. Recipes
*Your kitchen, completely private*

**Download to compare:** [Mealime](https://apps.apple.com/app/mealime-meal-plans-recipes/id1079999103) (free, meal planning and grocery lists)

Mealime offers free meal planning with auto-generated grocery lists and step-by-step cooking instructions. Paprika ($5 one-time) is beloved by power users, but Mealime's free tier is better for comparison testing.

**What Mealime charges for premium:** $2.99/mo (expanded recipes, macros, custom meal plans)

**What to test:**
- Add a recipe (either by typing it in or importing from a URL if supported). Is the process smooth?
- Browse your saved recipes. Is the organization intuitive (categories, tags, search)?
- Use the shopping list feature. Does it consolidate ingredients across multiple recipes?
- Try the step-by-step cooking view. Is it easy to follow with messy hands?
- Check the pantry tracker if available. Is it useful for knowing what you already have at home?

**The question:** *Is MyLife Recipes good enough to replace Mealime or Paprika?*

---

### 15. Trails
*Offline hiking and trail guide*

**Download to compare:** [AllTrails](https://apps.apple.com/app/alltrails-hike-bike-run/id405075943) (free, trail browsing and basic recording)

AllTrails is the dominant hiking app with 60M users and the largest trail database. The free tier lets you browse trails, read reviews, and record hikes with GPS. MyLife Trails aims to work offline, which is critical when you lose cell signal on the trail.

**What AllTrails charges for premium:** $35.99/yr (offline maps, wrong-turn alerts, 3D maps, Lifeline safety)

**What to test:**
- Search for trails near your location. Does MyLife have good trail coverage in your area?
- Look at trail details: difficulty, distance, elevation, photos. Is the information comprehensive?
- Record a hike or walk with GPS tracking. Is the map and tracking accurate?
- Try using offline features (download a trail before going on a hike without signal)
- Check your hiking history and stats. Are the summaries useful?

**The question:** *Is MyLife Trails good enough to replace AllTrails?*

---

### 16. RSVP
*Events, invites, and RSVP tracking*

**Download to compare:** [Partiful](https://apps.apple.com/app/partiful-party-invitations/id1592681252) (free)

Partiful is the hottest event app right now (Google's Best App of 2024, growing 400% year-over-year). It is completely free and makes creating events and sending invitations dead simple. MyLife RSVP adds expense splitting and calendar integration.

**What Partiful charges:** Free (no premium tier yet)

**What to test:**
- Create an event with a date, time, location, and description. Is the creation flow fast?
- Share an invite link with a friend. Does the invite look good?
- Track RSVPs. Can you see who is coming, maybe, and declined?
- Check calendar integration. Does the event show up in your phone's calendar?
- Try the expense splitting feature if available (unique to MyLife)

**The question:** *Is MyLife RSVP good enough to replace Partiful or Evite?*

---

### 17. Words
*Dictionary + thesaurus in 270 languages*

**Download to compare:** [Vocabulary.com](https://apps.apple.com/app/vocabulary-com/id1014963900) (free, core vocabulary games)

Vocabulary.com uses an adaptive learning engine that adjusts to your level. It is focused on English vocabulary building (not full language learning like Duolingo). MyLife Words targets the same niche: building vocabulary, not teaching grammar.

**What Vocabulary.com charges for premium:** $2.99/mo (ad-free, advanced features)

**What to test:**
- Look up a word and explore its definition, synonyms, and usage examples
- Save words to a personal list for review later
- Try the vocabulary learning/quiz features. Is the learning method effective?
- Test multiple languages if available. Does the dictionary handle different language pairs?
- Compare the overall experience to just using the built-in iOS dictionary (tap and hold any word, then tap "Look Up")

**The question:** *Is MyLife Words useful enough to open regularly, or do you just use your phone's built-in dictionary?*

---

### 18. Stars
*Private astrology and birth charts*

**Download to compare:** [Co-Star](https://apps.apple.com/app/co-star-personalized-astrology/id1264782561) (free, daily horoscope and birth chart)

Co-Star is the largest astrology app with 30M users. It is fully free and uses NASA data for real-time planetary positions. It is known for its blunt, sometimes funny daily push notifications.

**What Co-Star charges:** Free (the core experience is free; they sell merchandise and in-app extras)

**What to test:**
- Enter your birth date, time, and location to generate your birth chart. Is the setup smooth?
- Read your daily horoscope. Is it personalized and interesting?
- Explore your full birth chart (sun, moon, rising, planets). Is the information presented in an understandable way?
- Check compatibility with a friend (if supported). Is it fun to use?
- Privacy comparison: Co-Star stores your birth data on their servers. Does knowing MyLife keeps it local matter to you?

**The question:** *Is MyLife Stars as fun and engaging as Co-Star?*

---

### 19. Car
*Your complete vehicle companion*

**Download to compare:** [Drivvo](https://apps.apple.com/app/drivvo-car-management/id1145041167) (free, vehicle expense and fuel tracking)

Drivvo is a straightforward car maintenance and fuel expense tracker. The free tier covers unlimited vehicles, fuel logs, and expense tracking. There is no dominant car maintenance app on iOS, which is actually an opportunity.

**What Drivvo charges for premium:** $11.99/yr (no ads, CSV export, advanced reports)

**What to test:**
- Add your car (make, model, year, mileage). Is the vehicle setup quick?
- Log a fuel fill-up. Does it calculate your fuel efficiency (MPG or L/100km)?
- Add a maintenance record (oil change, tire rotation, etc.). Is the process intuitive?
- Set a maintenance reminder (e.g., "oil change in 3,000 miles"). Does it work?
- Look at your total cost of ownership over time. Are the expense reports useful?

**The question:** *Is MyLife Car good enough to replace Drivvo or Carfax Car Care?*

---

### 20. Garden
*Plant care and garden planner*

**Download to compare:** [Planta](https://apps.apple.com/app/planta-complete-plant-care/id1410126604) (free, basic plant care reminders)

Planta is the best-designed plant care app with species-specific watering schedules and reminders. The free tier includes adding plants and getting basic care reminders. PictureThis makes more money ($44M/yr) but is more about plant identification than ongoing care.

**What Planta charges for premium:** $35.99/yr (plant identification, light meter, disease diagnosis, advanced care)

**What to test:**
- Add a few plants you own. Can you find your specific plant species?
- Set up watering reminders. Are the suggested watering schedules reasonable?
- Log a watering or care event. Is the tracking flow quick?
- Explore the plant care guides. Are they helpful?
- Try the garden planner if available. Can you map out your garden layout?

**The question:** *Is MyLife Garden good enough to replace Planta?*

---

### 21. Pets
*Pet health records and care tracker*

**Download to compare:** [11pets](https://apps.apple.com/app/11pets-pet-care/id981910498) (free, pet health diary and reminders)

11pets is a dedicated pet health tracker with a solid free tier covering pet profiles, vaccine tracking, medication reminders, and vet visit logs. PetDesk is larger but is more about booking vet appointments than personal pet care tracking.

**What 11pets charges for premium:** ~$1.99/mo (advanced features, cloud backup)

**What to test:**
- Add a pet profile (name, breed, weight, birthday, photo). Is it easy?
- Log a vet visit with notes and any medications prescribed
- Set up medication or vaccine reminders. Do notifications work reliably?
- Track weight over time. Is the growth chart useful?
- If you have multiple pets, add them all. Is switching between pets smooth?

**The question:** *Is MyLife Pets good enough to replace 11pets or PetDesk?*

---

### 22. Closet
*Your wardrobe, fully private*

**Download to compare:** [Acloset](https://apps.apple.com/app/acloset-ai-wardrobe-closet/id1489498701) (free, basic wardrobe management)

Acloset has 4M users and offers AI-powered outfit suggestions from your uploaded wardrobe photos. The free tier lets you add clothing items and create outfits. The virtual closet space is growing fast (42% year-over-year) but has no dominant player yet.

**What Acloset charges for premium:** Varies (advanced AI styling, expanded features)

**What to test:**
- Add 5-10 clothing items by taking photos. Is the photo capture and categorization smooth?
- Create an outfit by combining items. Is the outfit builder intuitive?
- Browse your wardrobe by category (tops, bottoms, shoes, etc.). Is the organization useful?
- Check outfit suggestions if available. Are they reasonable?
- Think about your daily routine: would you actually open this app each morning to pick an outfit?

**The question:** *Is MyLife Closet good enough to replace Acloset or Whering?*

---

### 23. Surf
*Surf forecasts and spot intel, no ads, no tracking*

**Download to compare:** [Surfline](https://apps.apple.com/app/surfline-wave-surf-reports/id295269471) (free, basic forecasts for some spots)

Surfline is the only serious surf forecast platform, with 500+ live cams and the most comprehensive swell data. The free tier shows basic forecasts but locks detailed reports, cam rewinds, and premium spots behind the paywall. Note: this module is niche but relevant if you surf.

**What Surfline charges for premium:** $99.99/yr (all cams, detailed forecasts, 17-day forecasts, session recording)

**What to test:**
- Search for your local surf spot. Is it in the database?
- Check the wave forecast (swell height, period, wind, tide). Is the data accurate and easy to read?
- Compare the forecast to Surfline's forecast for the same spot. Do they roughly agree?
- Look at multi-day forecasts. Can you plan your sessions for the week?
- Privacy comparison: Surfline tracks your location data. Does MyLife's approach feel better?

**The question:** *Is MyLife Surf accurate enough to trust for planning your sessions?*

---

### 24. Homes
*Real estate, reimagined*

**Download to compare:** [HomeZada](https://apps.apple.com/app/homezada-home-management/id603498388) (free Essentials tier)

HomeZada is the most comprehensive home management app. The free Essentials tier covers basic home inventory and maintenance tracking. There is no dominant app in this space, so even a modest feature set can compete.

**What HomeZada charges for premium:** $79/yr (full maintenance scheduling, financial tracking, inventory valuations)

**What to test:**
- Add your home with basic details (address, size, type). Is the setup process smooth?
- Add a few inventory items (appliances, furniture). Is the cataloging useful?
- Set up a maintenance task (e.g., "change furnace filter every 3 months"). Are reminders helpful?
- Track a home expense or improvement project
- Overall: does this feel like a tool you'd actually use to manage your home, or is it solving a problem you don't have?

**The question:** *Is MyLife Homes useful enough to open regularly for home management?*

---

### 25. Voice
*Private on-device dictation*

**Download to compare:** [Otter](https://apps.apple.com/app/otter-transcribe-voice-notes/id1276437113) (free, 300 minutes/month)

Otter.ai is the leading transcription app with a generous free tier (300 minutes per month). It excels at meeting transcription with speaker identification. MyLife Voice focuses on privacy by doing transcription on-device rather than sending your audio to the cloud.

**What Otter charges for premium:** $8.33/mo ($99.99/yr, unlimited transcription, advanced search, export)

**What to test:**
- Record a voice note and check the transcription accuracy. Is it good enough to be useful?
- Try speaking in different environments (quiet room vs. noisy coffee shop). How does accuracy hold up?
- Test multi-language support if available
- Search through past transcriptions. Can you find what you're looking for?
- Privacy comparison: Otter sends your audio to their cloud for processing. Does on-device transcription in MyLife feel meaningfully better for sensitive recordings?

**The question:** *Is MyLife Voice accurate enough to replace Otter for quick voice notes?*

---

### 26. Forums
*Human-verified community, bot-free by design*

**Download to compare:** [Reddit](https://apps.apple.com/app/reddit/id1064216828) (free)

Reddit is the dominant text-based community platform. MyLife Forums is not trying to replace Reddit's massive scale. Instead, it aims to be a private, ad-free, bot-free community space within the MyLife ecosystem.

**What Reddit charges for premium:** $5.99/mo (ad-free, exclusive awards, custom avatar gear)

**What to test:**
- Browse available forums/communities. Is there anything interesting to read?
- Create a post. Is the posting flow smooth?
- Reply to someone else's post. Does the conversation threading make sense?
- Check for any content moderation or community features
- Honest question: with Reddit already on your phone, would you open MyLife Forums for anything?

**The question:** *Does MyLife Forums offer something Reddit doesn't (privacy, no bots, no ads) that is compelling enough to use?*

*Note: Forums is in beta. The experience will be limited until more testers are active.*

---

### 27. Market
*Buy, sell, and trade with your community*

**Download to compare:** [OfferUp](https://apps.apple.com/app/offerup-buy-sell-letgo/id468996152) (free)

OfferUp is the largest local buying/selling app after Facebook Marketplace. It is free to list items and browse. MyLife Market focuses on privacy and biometric verification to reduce scams, but it needs a critical mass of users to be useful.

**What OfferUp charges:** Free to list (optional promoted listings for $1-10+)

**What to test:**
- List an item for sale. Is the listing creation flow easy?
- Browse available listings. Is there anything to buy? (This depends on how many testers are active)
- Check the user verification features. Does biometric verification feel trustworthy?
- Compare the overall experience to posting on OfferUp or Facebook Marketplace
- Honest assessment: would you list something here, or would you stick to platforms where buyers already exist?

**The question:** *Is the MyLife Market experience good enough that you'd use it once the user base grows?*

*Note: Market is in early beta. The value depends on other testers listing items.*

---

### 28. Mail
*Self-hosted private email*

**Download to compare:** [ProtonMail](https://apps.apple.com/app/proton-mail-encrypted-email/id979659905) (free, 1 email address, 500MB storage)

ProtonMail is the privacy email standard with 100M+ users. The free tier includes end-to-end encryption, 1 Proton email address, and 500MB of storage. They are based in Switzerland with strong privacy laws.

**What ProtonMail charges for premium:** $47.88/yr (15GB, custom domain, 10 addresses, calendar)

**What to test:**
- Set up your email account. Is the onboarding smooth?
- Send and receive emails. Is the core email experience solid?
- Search through your inbox. Is search fast and accurate?
- Check for threading (grouping related emails together). Does it work correctly?
- Compare the overall polish to ProtonMail's app. ProtonMail has had years of refinement, so note where MyLife Mail needs to catch up.

**The question:** *Is MyLife Mail polished enough to consider using as a secondary email client?*

*Note: Mail is an early-stage module. Expect rough edges.*

---

## Cross-Module Features (The MyLife Superpower)

This is where MyLife does something no standalone app can do. Each competitor app lives in its own silo. MyLife connects your data across modules. Try these combinations:

### Combo 1: Fitness Stack
Enable **Workouts + Nutrition + Health**
- Log workouts and meals on the same day
- Check if MyLife shows how your nutrition affects your workout performance
- Look for calorie balance (calories eaten vs. calories burned)
- This replaces needing Hevy + Cronometer + Apple Health as separate apps

### Combo 2: Wellness Stack
Enable **Mood + Health + Workouts**
- Log your mood daily while also tracking workouts
- After a week, check if there are insights about exercise improving your mood
- Look for sleep and mood correlations in the Health module
- This replaces needing Daylio + Apple Health + your workout app

### Combo 3: Daily Life Stack
Enable **Budget + Nutrition + Recipes**
- Plan meals in Recipes, log what you eat in Nutrition
- Track grocery spending in Budget
- See if the full picture (what you eat, what it costs, what nutrients you get) comes together

### Combo 4: Hub Overload Test
Enable **5 or more modules** at once
- Does the app slow down with many modules enabled?
- Is the hub dashboard still useful with lots of modules, or does it feel cluttered?
- Can you switch between modules quickly?
- On web: try the Cmd+K (Mac) or Ctrl+K (Windows) command palette to search across all your modules

### Combo 5: The Privacy Audit
Pick any 3 modules and compare the privacy situation:
- MyLife: data stays on your device
- Competitors: check their privacy policies. What data do they collect? Who do they share it with?
- For modules like Cycle, Meds, and Mood, where the data is deeply personal, does the privacy difference feel meaningful?

---

## Feedback Template

When you find something to report, copy-paste this template and fill it in. Send it to us however we've set up feedback collection (TestFlight feedback, group chat, email, etc.).

```
MODULE: [e.g., Budget, Workouts, Notes]

WHAT I TRIED:
[What were you doing? Be specific. "I tried to add a transaction" is better than "Budget didn't work."]

WHAT HAPPENED:
[What did the app actually do? Did it crash? Show an error? Do the wrong thing? Look weird?]

WHAT I EXPECTED:
[What should have happened instead?]

COMPETITOR COMPARISON:
[Does the competitor app handle this better? How? Be specific about what they do differently.]

DEVICE:
[iPhone model and iOS version, e.g., "iPhone 15 Pro, iOS 18.3"]

SCREENSHOT:
[Attach if you have one. Screenshots of both MyLife and the competitor are incredibly helpful.]
```

### Quick Feedback (For Small Things)

If it is something small and you don't want to fill out the full template:

```
[Module] - [One sentence about what's wrong or what could be better]
```

Examples:
- "Budget - The font on the transaction list is too small to read"
- "Workouts - Adding a set takes 3 taps when it should take 1"
- "Notes - I can't figure out how to delete a note"

---

## Known Limitations

Please don't report these as bugs. We already know about them and they are on the roadmap:

### Beta/Early Modules
- **Forums** is in beta with limited content. It will feel empty until more testers are active.
- **Market** is in beta. Listings require other testers to be active.
- **Mail** is early-stage. Core email features are still being built out (search, threading, filters).
- **Garden** needs AI plant identification (coming later). For now, you manually select plant species.
- **Subs** (Subscription tracking) is being absorbed into the Budget module. It may feel incomplete on its own.

### Platform Limitations
- **No Apple Watch app yet.** This is planned but not built. Workouts, Health, and Meds will all benefit from Watch support.
- **No push notifications yet** for most modules. Meds reminders and habit reminders may not fire reliably.
- **Some modules show "fallback" pages on web.** Budget, Workouts, Recipes, Surf, RSVP, and Closet have full mobile experiences but simplified web pages while we build out the web UI.

### Cloud Features
- **Surf and Workouts** use Supabase for some cloud features (live forecast data, workout syncing). These may not work in the beta if the cloud environment is not configured for your account. Let us know if you see errors.
- **Offline-first is the goal,** but some features (like surf forecasts and trail data) inherently need an internet connection.

### General
- The app is still in beta. Crashes, visual glitches, and incomplete features are expected. That is exactly why we need your testing.
- Data you enter during the beta is stored locally on your device. If you delete and reinstall the app from TestFlight, your data will be lost. There is no cloud backup yet.

---

## Thank You

Seriously, thank you for taking the time to do this. Every piece of feedback helps us build a better app. The goal is to ship something that genuinely replaces the 5-10 standalone apps cluttering your phone, while keeping all your data private and under your control.

If you have questions about anything in this guide, reach out. And have fun poking around. Try to break things. That is what beta testing is for.
