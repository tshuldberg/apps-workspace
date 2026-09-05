# MyMeds - Feature Gap Design Doc

**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Implemented (13+ tables)

## Current State

MyMeds is a fully implemented module with 13+ database tables covering medication tracking, reminders, refill tracking, drug interactions (200+ pairs), mood journaling, symptom logging, a correlation engine, and doctor report generation. The module uses the `md_` table prefix and stores all data locally in SQLite.

## Competitors Analyzed

| Competitor | Pricing | Category |
|------------|---------|----------|
| Medisafe | $40/yr | Medication management, adherence |
| Glucose Buddy | $40/yr | Diabetes management |
| MySugr | $36/yr | Diabetes management (owned by Roche) |
| Migraine Buddy | $50/yr | Migraine tracking, triggers |
| Cara Care | $80/yr | Digestive health (acquired by Bayer) |
| Blood Pressure Monitor | $13/yr | Blood pressure logging |
| I Am Sober | $40/yr | Sobriety tracking (cross-reference) |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Blood pressure logging | P0 | Medisafe, Glucose Buddy, BP Monitor | Low | Systolic/diastolic/pulse entry with AHA classification |
| Blood glucose logging | P1 | Glucose Buddy, MySugr | Low | Manual blood sugar entry with timestamp, notes |
| Insulin dose tracking | P1 | Glucose Buddy, MySugr | Low | Log insulin type, dose, injection site |
| BP trend visualization | P1 | BP Monitor | Low | Charts showing BP over time with danger zone highlighting |
| Caregiver alerts (Medfriend) | P1 | Medisafe | Medium | Notify family member if medication is missed |
| Adherence analytics | P1 | Medisafe | Low | Detailed reports on medication adherence rates over time |
| Health measurements (expanded) | P1 | Various | Low | Blood oxygen, temperature, heart rate, respiratory rate |
| CGM integration (Dexcom/Libre) | P2 | Glucose Buddy, MySugr | High | Read continuous glucose data via HealthKit |
| HbA1c calculator/estimator | P2 | Glucose Buddy, MySugr | Low | Estimate A1c from logged glucose readings |
| Head map (pain location) | P2 | Migraine Buddy | Medium | Visual body/head map to mark pain locations |
| Weather pressure correlation | P2 | Migraine Buddy | Low | Correlate symptoms with barometric pressure changes |
| Predictive risk analysis | P2 | Migraine Buddy | Medium | Predict likelihood of migraine/flare based on patterns |
| FODMAP tracking | P2 | Cara Care | Low | Log foods with FODMAP classification |
| Bristol Stool Scale | P2 | Cara Care | Low | Quick gut health logging with visual scale |
| Digestive symptom timeline | P2 | Cara Care | Low | Timeline view linking meals to digestive symptoms |
| Bolus calculator | P3 | MySugr | Medium | Calculate insulin dose based on carbs and correction factor |
| ECG/EKG data viewing | P3 | BP Monitor | Medium | Import ECG data from Apple Watch via HealthKit |

## Recommended Features to Build

1. **Blood pressure logging with AHA classification** - Simple systolic/diastolic/pulse entry form with automatic AHA category display (Normal, Elevated, Stage 1/2 Hypertension, Crisis). Include time-of-day tagging (morning vs. evening readings) since BP varies throughout the day. This replaces Blood Pressure Monitor ($13/yr) and fills a gap that Medisafe charges $40/yr to cover.

2. **BP trend visualization** - Line charts showing systolic and diastolic trends over 7/30/90/365 day windows. Overlay AHA danger zones as colored bands. Highlight readings that fall outside the user's target range. This pairs naturally with the BP logging feature.

3. **Blood glucose and insulin tracking** - Manual glucose entry with meal context (fasting, before meal, after meal, bedtime) and insulin dose logging (type, units, injection site rotation). This directly replaces Glucose Buddy ($40/yr) and MySugr ($36/yr, owned by Roche).

4. **Expanded health measurements** - Add logging for blood oxygen (SpO2), body temperature, heart rate, and respiratory rate. These are straightforward number entries with optional HealthKit auto-import. Low effort, high value for users managing chronic conditions.

5. **Adherence analytics** - Calculate and visualize medication adherence rates (percentage taken on time, missed doses, late doses) across configurable time windows. Generate shareable reports for doctor visits. Builds on existing reminder and logging infrastructure.

6. **Caregiver alerts (Medfriend)** - Optional feature allowing a trusted contact to receive a notification if a critical medication is missed after a configurable grace period. Uses local notification scheduling with optional SMS/push fallback. Privacy-sensitive: the caregiver only receives "medication missed" without details about which medication.

7. **Digestive health suite** - Combine FODMAP tracking, Bristol Stool Scale logging, and digestive symptom timeline into a cohesive gut health tracker. This replaces Cara Care ($80/yr, acquired by Bayer). Meal-to-symptom timeline linking is a powerful differentiator.

8. **Weather pressure correlation** - Fetch barometric pressure data and overlay it on symptom charts. Useful for migraine sufferers and people with joint pain. Low implementation cost since it only requires a weather API call and chart overlay.

9. **Pain location mapping** - Visual body/head outline where users tap to mark pain locations with intensity. Useful for migraines, chronic pain, and injury tracking. Replaces Migraine Buddy's ($50/yr) core differentiating feature.

10. **Predictive risk analysis** - Use logged patterns (weather, sleep, food, stress, medication adherence) to predict likelihood of symptom episodes. Start with simple statistical models, not ML. Flag high-risk days with actionable suggestions.

## Privacy Competitive Advantage

Medical and health data is the most sensitive category of personal information. The competitive landscape reveals deeply concerning data practices:

- **MySugr** is owned by Roche, a pharmaceutical giant. User diabetes data feeds into Roche's product development pipeline.
- **Cara Care** was acquired by Bayer, another pharmaceutical company. Digestive health data is now owned by a corporation that sells digestive health products.
- **Migraine Buddy** sells anonymized (but potentially re-identifiable) data to pharmaceutical companies and researchers. Their privacy policy explicitly states this.
- **Medisafe** partners with pharmaceutical companies and health plans, sharing usage data for "medication adherence programs."

MyMeds keeps all health data strictly on-device:

- **Medication lists** never leave the phone. No pharma company knows what you take.
- **Blood glucose readings** stay local. No insurance company can access your diabetes management data.
- **Symptom patterns** remain private. No data broker can correlate your migraines with your purchasing behavior.
- **Adherence data** is yours alone. No employer wellness program can penalize you for missed doses.
- **Caregiver alerts** send minimal information (missed dose notification only, not medication details).

This is not just a feature difference. It is a fundamental ethical distinction. Users managing chronic conditions deserve tools that do not monetize their health data.

## Cross-Module Integration

| Integration | Module | Description |
|-------------|--------|-------------|
| Centralized vitals dashboard | MyHealth | Blood pressure, glucose, SpO2, and all vitals feed into the unified MyHealth dashboard |
| Fasting impact on blood sugar | MyFast | Overlay fasting windows on glucose charts to visualize fasting's metabolic effect |
| FODMAP-safe recipe filtering | MyRecipes | Filter recipes by FODMAP category based on user's identified triggers |
| Medication as daily habit | MyHabits | Surface medication schedules as trackable habits with streak counting |
| Food-symptom correlation | MyNutrition | Cross-reference food log entries with digestive symptom timeline |
| Mood-medication correlation | MyMood | Already partially implemented. Expand to include adherence rate as a mood factor |
| Sleep-medication correlation | MyHealth (sleep) | Correlate medication timing with sleep quality metrics |
