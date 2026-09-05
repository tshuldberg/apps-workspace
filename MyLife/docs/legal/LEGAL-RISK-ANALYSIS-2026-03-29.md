# MyLife Legal Risk Analysis

**Prepared: March 29, 2026**
**Status: Internal review -- NOT legal advice. Engage counsel before acting on any recommendation.**

---

## Executive Summary

This analysis covers 10 legal risk domains for MyLife as a privacy-first personal life management hub with 29 modules, priced at $5/year, competing against established apps across 23+ categories. The review identifies **3 critical risks**, **4 moderate risks**, and **3 low risks**.

| # | Risk Domain | Severity | Action Required |
|---|------------|----------|-----------------|
| 1 | Trademark: "MyLife" name conflict | **CRITICAL** | Immediate -- rebrand or clear before launch |
| 2 | Health data privacy (state laws) | **CRITICAL** | Pre-launch compliance framework required |
| 3 | Comparative advertising claims | **HIGH** | Legal review of all marketing materials |
| 4 | FDA regulatory classification | **MODERATE** | Careful feature scoping and disclaimers |
| 5 | Financial data / Plaid compliance | **MODERATE** | GLBA + CFPB Section 1033 compliance |
| 6 | Patent exposure (Medisafe, others) | **MODERATE** | Freedom-to-operate search recommended |
| 7 | Anti-Enshittification Pledge | **MODERATE** | Draft with counsel for enforceability + M&A |
| 8 | App Store compliance | **LOW** | Standard compliance, avoid comparative ads in listing |
| 9 | Predatory pricing / antitrust | **LOW** | Not a credible threat at current scale |
| 10 | Feature copying / trade secrets | **LOW** | Standard competitive development |

---

## 1. TRADEMARK: "MyLife" Name Conflict [CRITICAL]

### The Problem

**MyLife.com (MyLife Inc.)** is an existing, well-known company:
- Founded 2002 (as Reunion.com), rebranded to MyLife after 2008 merger with Wink.com
- Operates at mylife.com as a reputation management / people search platform
- Has ~14,000 BBB complaints, F rating, and a **$34M FTC settlement** (2020) for FCRA violations and deceptive practices
- The "MY LIFE" mark is also registered by Synapse Group Inc. (USPTO Serial #90015633)

**This is the single highest legal risk for the project.** Even though MyLife.com operates in a different product category (information brokerage vs. personal productivity), trademark law evaluates likelihood of confusion broadly, especially when:
- The marks are identical or nearly identical ("MyLife" vs "MyLife")
- Both are software/app products
- Both target general consumers
- Both fall under USPTO Class 9 (downloadable software) and potentially Class 42

### Risk Assessment

| Factor | Analysis |
|--------|----------|
| Mark similarity | Identical. Both use "MyLife" |
| Product overlap | Partial. Both are consumer-facing software platforms |
| Consumer confusion | High. Users searching "MyLife app" will encounter both |
| Prior use | MyLife.com has priority (2002/2008) |
| Registration | MY LIFE has existing USPTO registrations |
| Dilution | Even without confusion, famous marks get dilution protection |
| SEO/discoverability | Catastrophic -- searching "MyLife app" returns the reputation management company |

### What Could Happen

1. **Cease-and-desist letter** from MyLife.com or Synapse Group demanding name change
2. **USPTO opposition** if you file a trademark application (they can oppose during the publication period)
3. **Infringement lawsuit** under the Lanham Act Section 32 (registered mark) or Section 43(a) (unregistered)
4. **App Store rejection or takedown** if MyLife.com files a trademark complaint with Apple/Google
5. **Investor concern** -- no investor wants to fund a brand that may need to be changed post-launch

### Recommendations

1. **Conduct a formal trademark clearance search** (comprehensive, not just USPTO TESS) through a trademark attorney before ANY public launch
2. **Strongly consider rebranding** -- the TODOS.md already identifies this as a P1 item ("MyLife undersells the product vision")
3. **Do NOT file a trademark application** for "MyLife" in Class 9/42 until counsel confirms viability
4. **Avoid any association** with MyLife.com's reputation in marketing
5. **Reserve alternative domain names and social handles NOW** for candidate replacement names

### Module Name Sub-Risk

The "My[X]" naming pattern (MyBooks, MyBudget, MyWorkouts, etc.) creates additional minor trademark concerns:
- "MyFitnessPal" is a registered trademark (Under Armour / Francisco Partners) -- "MyWorkouts" is likely distinct enough
- Generic "My[Category]" names are generally weak marks and harder to enforce, but search each individually
- The pattern itself is not protectable, but individual module names should be checked

---

## 2. HEALTH DATA PRIVACY (State Laws) [CRITICAL]

### The Regulatory Landscape

MyLife stores health, medication, menstrual cycle, mood, nutrition, and fasting data. Even though data stays local (no cloud), **multiple state consumer health data laws now apply regardless of where data is stored**.

### Laws That Apply

| Law | Effective | Scope | Key Requirements |
|-----|-----------|-------|-----------------|
| **Washington My Health My Data Act (MHMDA)** | March 31, 2024 | Any entity collecting health data of WA consumers | Consent, privacy policy, deletion rights, no sale without written auth |
| **Nevada SB 370** | March 31, 2024 | Any entity collecting health data of NV consumers | Similar to WA MHMDA |
| **Connecticut CTDPA (health amendments)** | July 1, 2023 | CT residents | Health data = sensitive data, additional consent required |
| **Maryland (2024)** | 2024 | MD consumers | Fourth state with consumer health data law |
| **Federal HIPRA (proposed)** | Introduced Nov 2025 | Would extend HIPAA-like protections to non-HIPAA entities | Monitor -- not yet law |

### What "Consumer Health Data" Includes (Per WA MHMDA)

All of the following MyLife data types are explicitly covered:
- **Vital signs / body measurements** (Health module: HR, BP, O2, temp, etc.)
- **Medication data** (Meds module: prescriptions, dosages, schedules)
- **Menstrual cycle data** (Cycle module) -- **post-Dobbs, this is especially sensitive**
- **Mental health data** (Mood module: entries, emotion tags, activities)
- **Sleep data** (Health module: stages, quality scores)
- **Nutrition / diet data** (Nutrition module: food logs, macros)
- **Reproductive health** (Cycle module)
- **Biometric data** (if Face ID/Touch ID is used for app lock)
- **Health-related searches** (if any in-app search logs exist)
- **Geolocation for health purposes** (Trails module data near health facilities could trigger geofencing provisions)

### HIPAA Analysis

| Question | Answer |
|----------|--------|
| Is MyLife a "covered entity" under HIPAA? | **No** -- MyLife is not a healthcare provider, health plan, or healthcare clearinghouse |
| Is MyLife a "business associate"? | **No** -- unless it processes data on behalf of a covered entity |
| Does HIPAA apply? | **Not currently** -- but the proposed HIPRA (2025) would extend similar protections |
| Does that mean health data is unregulated? | **Absolutely not** -- state laws fill this gap aggressively |

### Post-Dobbs Menstrual Cycle Data Risk

The WA MHMDA was explicitly passed in response to Dobbs v. Jackson. Menstrual cycle tracking apps face unique scrutiny:
- Law enforcement subpoenas for cycle data have been attempted
- If cycle data could theoretically be obtained via device seizure, local-only storage is not a complete defense
- MyLife's privacy positioning is strong here, but must be backed by technical and legal safeguards

### Required Actions

1. **Publish a Consumer Health Data Privacy Policy** prominently (homepage link required by WA MHMDA)
2. **Implement affirmative consent** before collecting ANY health data (separate from general app ToS)
3. **Build a deletion mechanism** -- users must be able to delete all health data on request
4. **Never sell health data** -- document this prohibition formally (not just marketing)
5. **Implement data minimization** -- only collect what each module actually needs
6. **Add geofencing compliance** -- ensure Trails module cannot be used to track users near health facilities
7. **Encrypt local data** -- even on-device, health data should be encrypted at rest (SQLite encryption)
8. **Consider on-device encryption for cycle data specifically** -- additional safeguard against device seizure
9. **Engage a health privacy attorney** to draft compliant policies for all 50 states + territories

---

## 3. COMPARATIVE ADVERTISING CLAIMS [HIGH]

### Current Marketing Language Under Review

The business plan and investor deck make several comparative claims:

| Claim | Location | Risk Level |
|-------|----------|------------|
| "The average consumer pays $800+ annually for 10+ personal productivity apps" | Business plan, deck | **MODERATE** -- must be substantiated |
| "YNAB at 1/22nd the price" | Business plan | **HIGH** -- direct competitor comparison |
| Competitor pricing table ($109 YNAB, $79.99 MFP, etc.) | Business plan, deck | **HIGH** -- prices must be current and accurate |
| "You save $580/yr (99%)" | Investor deck | **HIGH** -- assumes user would pay for all 10 apps |
| "Every competitor stores transaction data on their servers" | Business plan | **MODERATE** -- verify this is true for ALL named competitors |
| Privacy breach citations (Flo, MFP, Strava, BetterHelp) | Business plan, deck | **LOW** -- factual public record |

### Lanham Act Requirements

Under Section 43(a) of the Lanham Act, comparative advertising is **legal and common** in the US, BUT:

1. **Claims must be literally true** -- if YNAB changes their price, your materials are instantly misleading
2. **Claims must not be misleading in context** -- saying "replaces YNAB at 1/22nd the price" is misleading if MyBudget doesn't have feature parity with YNAB
3. **Claims must be substantiated BEFORE publication** -- you need documentation supporting every number
4. **You cannot disparage competitors with false statements** -- breach citations are fine (public record), but characterizing competitors' privacy as "terrible" without specifics risks a defamation-adjacent claim

### The "$800/yr" Claim Problem

The comparison assumes a user subscribes to ALL 10 listed apps. This is a **theoretical maximum**, not a typical consumer experience. If a competitor challenges this:
- They would argue the comparison is misleading because few consumers pay for all 10
- You would need survey data or market research to substantiate "average consumer pays $800+"
- Consider rephrasing: "A consumer who wanted equivalent functionality across these 10 categories would pay $800+/yr"

### The Feature Parity Problem

Claiming to "replace" a competitor at a fraction of the price implies **equivalent functionality**. If MyBudget is at 95% parity with YNAB, that 5% gap is exactly what YNAB's lawyers would focus on. Claims of replacement must be qualified.

### Recommendations

1. **Add qualifiers** to all comparative claims: "comparable functionality," "similar features," "covers the same categories"
2. **Date-stamp all competitor prices** and verify quarterly
3. **Do not name competitors in App Store listings** -- use categories instead ("budgeting apps charge $100+/yr")
4. **Keep privacy breach citations factual** with links to primary sources (FTC orders, news reports)
5. **Have an advertising attorney review** all marketing materials, especially the investor deck and any App Store description
6. **Rephrase the $800 claim** to avoid implying this is what a typical consumer currently pays
7. **Maintain a comparison substantiation file** -- document every claim and its supporting evidence

---

## 4. FDA REGULATORY CLASSIFICATION [MODERATE]

### Where MyLife Sits

The FDA classifies health software on a spectrum:

| Category | Regulated? | MyLife Modules |
|----------|------------|----------------|
| **General wellness** (lifestyle, healthy habits) | **No** (enforcement discretion) | Habits, Fast, Nutrition (calorie counting), Mood (journaling), Trails |
| **Low-risk wellness devices** | **Usually no** (2026 guidance expanded this) | Health (vitals tracking), Cycle (period tracking) |
| **Software as Medical Device (SaMD)** | **Yes** | None currently, BUT risks exist |

### Risk Triggers

MyLife could cross into FDA-regulated territory if:

1. **Meds module provides dosage recommendations** -- tracking is fine, but suggesting "take your pill now" based on an algorithm could be "clinical decision support"
2. **Health module claims diagnostic capability** -- "your HRV indicates high stress" vs "here's your HRV data" (the former is a medical claim)
3. **Cycle module predicts fertility** -- fertility prediction has been scrutinized (Natural Cycles received FDA clearance as a contraceptive device)
4. **Cross-module correlation claims** -- "Mood + Meds: Pearson correlation engine identifies how medication changes affect mood" -- this is dangerously close to a clinical claim
5. **Sleep quality scoring** -- presenting a "weighted quality scoring algorithm" as health advice could trigger SaMD classification

### The WHOOP Precedent (2025)

The FDA issued a warning letter to WHOOP in 2025 for offering blood pressure estimates without clearance. Key lesson: **any specific physiological measurement with an implied health conclusion can trigger FDA oversight.**

### Recommendations

1. **Frame all health features as "tracking" and "logging," never as "diagnosis," "treatment," or "recommendation"**
2. **Add prominent disclaimers**: "MyLife is not a medical device. Consult your healthcare provider for medical decisions."
3. **Rephrase the Mood + Meds correlation engine** -- present it as "data visualization" not "identifies how medication changes affect mood"
4. **Do not describe cycle tracking as contraception or fertility planning**
5. **Sleep quality scoring** should be presented as informational, not as health guidance
6. **Review every module's description** in the business plan for clinical-sounding language
7. **Consider a brief FDA counsel review** of the Health, Meds, and Cycle modules specifically

---

## 5. FINANCIAL DATA / PLAID COMPLIANCE [MODERATE]

### Regulatory Framework

MyBudget integrates Plaid for bank sync. This triggers:

| Regulation | Applicability | Requirements |
|------------|--------------|--------------|
| **CFPB Section 1033** (finalized Oct 2024) | Yes -- MyLife is an "authorized third party" accessing consumer financial data | Clear disclosure, consumer authorization, revocation capability, annual reauthorization |
| **GLBA (Gramm-Leach-Bliley Act)** | Partial -- data security provisions apply to authorized third parties | Must comply with GLBA Safeguards Rule for data security |
| **State money transmitter laws** | **No** -- MyLife does not transmit money, only reads transaction data |
| **CFPA (registration as financial institution)** | **No** -- read-only access to financial data does not make MyLife a financial institution |
| **PCI DSS** | **No** -- MyLife does not store, process, or transmit payment card data |

### Key Compliance Requirements

1. **Consumer authorization**: Must obtain clear, informed consent before accessing financial data through Plaid
2. **Data use limitation**: Can only use financial data for the budgeting service the user requested
3. **Revocation**: Users must be able to disconnect their bank accounts and revoke access at any time
4. **Annual reauthorization**: Users must reaffirm their consent every 12 months (CFPB 1033 rule)
5. **Data security**: Must comply with GLBA Safeguards Rule (encryption, access controls, incident response)
6. **Privacy policy**: Must disclose what financial data is collected, how it's used, and how long it's retained

### The Local Storage Advantage

MyLife's architecture is actually a compliance strength here:
- Financial data stored locally on device, not on MyLife servers
- Plaid connection runs through user's own authorization
- No cloud transmission of transaction data reduces breach surface

### Recommendations

1. **Implement Plaid Link with proper disclosure flow** -- Plaid provides SDKs with built-in consent UIs
2. **Build annual reauthorization prompts** into the Budget module
3. **Ensure bank disconnect/revocation is easily accessible** in Budget settings
4. **Add financial data privacy disclosures** to your privacy policy
5. **Do NOT store Plaid access tokens** on any MyLife-controlled server
6. **Monitor CFPB 1033 rulemaking** -- the rule is being revised (Aug 2025 ANPR with 36 questions)

---

## 6. PATENT EXPOSURE [MODERATE]

### Known Patent Risk

| Area | Finding | Risk |
|------|---------|------|
| **Medisafe** | US20150235004A1 -- "Platform, device and method for social medication management" (filed 2015, assigned to MediSafe Project LTD) | **MODERATE** -- covers social medication adherence tracking |
| **YNAB / Envelope budgeting** | No patents found for envelope budgeting methodology | **LOW** -- envelope budgeting is a decades-old concept, not patentable |
| **Goodreads / Book tracking** | No patents found | **LOW** -- basic CRUD book tracking is not novel |
| **AllTrails** | Not searched in depth | **UNKNOWN** -- GPS trail recording may have patents |
| **Flo / Cycle tracking** | Known to have patents on prediction algorithms | **LOW-MODERATE** -- if using similar prediction methods |

### Medisafe Patent Analysis

The Medisafe patent (US20150235004A1) covers "social medication adherence enhancement" -- specifically, systems where caregivers/family can monitor and support medication adherence. MyMeds would need to avoid:
- Shared medication adherence dashboards for caregivers
- Social notification systems for medication compliance
- The specific architecture described in the patent claims

**However**: MyMeds appears to be primarily a personal tracking tool, not a social adherence platform. The risk is low unless social/caregiver features are added.

### General Software Patent Landscape

- Software patents are enforceable in the US (reaffirmed 2024-2025)
- $1.9B+ awarded in patent damages in first half of 2025 alone
- Patent trolls (NPEs) are a bigger threat than competitors for most startups
- Post-Alice (2014), abstract software patents are harder to enforce, but specific implementations remain valid

### Recommendations

1. **Commission a Freedom-to-Operate (FTO) search** for the Meds, Health, Cycle, and Workouts modules before launch
2. **Avoid implementing "social adherence" features** in Meds without patent counsel review
3. **Document independent development** -- keep design docs, competitor analysis methodology, and development logs (you already do this well)
4. **Consider patent insurance** (available from providers like RPX or patent insurance carriers)
5. **If contacted by a patent holder**, engage patent litigation counsel immediately -- do NOT respond directly

---

## 7. ANTI-ENSHITTIFICATION PLEDGE [MODERATE]

### Enforceability Analysis

The proposed pledge includes: no ads ever, no data selling ever, user data ownership, data export always available, delete-all-my-data button.

| Question | Answer |
|----------|--------|
| Can this be made legally binding? | **Yes** -- the FTC treats public commitments as enforceable under Section 5 of the FTC Act |
| Precedent? | **Yes** -- the Student Privacy Pledge (signed by 300+ ed tech companies) is a legally binding, FTC-enforceable commitment |
| Can the FTC enforce it? | **Yes** -- the FTC can challenge statements shown to be false or misleading, including voluntary pledges |
| What about state enforcement? | **Yes** -- state AGs can enforce deceptive practices claims if you violate your own published pledge |

### The Acquisition Problem

This is the key legal question: **what happens if MyLife is acquired and the new owner wants to monetize data?**

| Scenario | Legal Outcome |
|----------|---------------|
| Acquirer wants to add ads | The pledge is a binding commitment to current users. Changing it would require user consent (new ToS acceptance) and could trigger FTC/state AG enforcement |
| Acquirer wants to sell data | Expressly prohibited by the pledge. Any violation is per se deceptive under FTC Act + state consumer protection laws |
| Acquirer wants to eliminate data export | Same as above |
| Acquirer modifies ToS | Users must affirmatively consent to new terms. Cannot retroactively strip rights |

### This Creates Both Risk AND Value

**Risk**: If the company ever needs to pivot (e.g., add freemium ads to survive), the pledge makes that legally complex.

**Value**: The pledge is a **competitive moat**. It makes MyLife categorically different from every competitor. It also makes the company MORE attractive to mission-aligned acquirers (think Mozilla, Proton, Signal-style organizations).

### Recommendations

1. **Structure the pledge as part of the Terms of Service**, not just marketing copy -- this makes the commitment clear and legally grounded
2. **Include a "successor binding" clause** -- any acquirer must honor the pledge for existing users' data
3. **Add a sunset provision** -- e.g., "This pledge applies to all data collected under these terms. If we ever need to change these commitments, we will: (a) give 12 months notice, (b) provide full data export, (c) allow users to delete all data before changes take effect"
4. **Do NOT make the pledge irrevocable for future features** -- new features can have different terms, but existing commitments to existing data must stand
5. **Have a privacy attorney draft the legal language** -- the FTC enforceability cuts both ways
6. **Consider making the pledge a separate, standalone document** (like the Student Privacy Pledge format) for credibility

---

## 8. APP STORE COMPLIANCE [LOW]

### Bundled App Concerns

| Concern | Risk | Analysis |
|---------|------|----------|
| Rejection for bundling 29 features | **Very Low** | Apple and Google do not prohibit multi-feature apps. Notion, Obsidian, and other productivity suites bundle extensively. The key is that each module provides genuine value. |
| $5/yr pricing | **None** | No minimum pricing requirements. Many apps price at $0.99/yr or less. |
| Self-hosted deployment mode | **Low** | As long as the App Store version uses IAP for subscriptions, a separate self-hosted option is fine. Do NOT offer self-hosted as a way to bypass IAP from within the App Store app. |
| RevenueCat compliance | **None** | RevenueCat is a standard, Apple/Google-approved subscription management tool |

### Comparative Advertising in App Store Listings

**Do NOT name competitors in App Store descriptions.** While not explicitly prohibited by Apple's guidelines, it:
- Often triggers rejection during review
- Can prompt trademark complaints from named competitors
- Violates the spirit of Apple's guidelines against disparaging other developers

**Instead**: Use category-based language: "Replace your budgeting, workout, and recipe apps with one subscription" rather than "Replace YNAB, Hevy, and Cronometer."

### Recommendations

1. Keep App Store description focused on MyLife's features, not competitors' weaknesses
2. Use category language ("budgeting apps typically cost $100+/yr") not brand names
3. Ensure IAP is the only purchase method within the App Store version
4. The website and investor materials can use competitor names (under Lanham Act comparative advertising rules)

---

## 9. PREDATORY PRICING / ANTITRUST [LOW]

### Analysis

Predatory pricing under US antitrust law (Sherman Act Section 2, FTC Act Section 5) requires:

1. **Pricing below cost** -- the company must price below its own marginal cost
2. **Intent to monopolize** -- the company must have a reasonable prospect of recouping losses by later raising prices after competitors exit
3. **Market power** -- the company must have or be likely to achieve monopoly power in a relevant market

**MyLife fails all three tests:**

| Element | MyLife's Position |
|---------|-------------------|
| Below cost? | Possibly -- $5/yr for 29 modules may be below marginal cost per user. But marginal cost for local-first software is near-zero (no servers for most modules). |
| Intent to monopolize? | **No** -- MyLife is a startup with zero market share. Cannot monopolize 23+ separate app categories simultaneously. |
| Recoupment likely? | **No** -- there is no plausible scenario where MyLife drives YNAB, Medisafe, AllTrails, etc. out of business and then raises prices. |
| Market power? | **None** -- MyLife has zero users at launch. |

**Courts are extremely skeptical of predatory pricing claims** (per FTC guidance), and the Supreme Court has called successful predatory pricing "rarely combinded" with long-term success. A bootstrapped startup offering low prices is the **opposite** of antitrust concern -- it's healthy competition.

### Could Competitors Claim Unfair Competition?

In theory, a competitor could argue that $5/yr for 29 modules is a "loss leader" designed to unfairly capture market share. In practice:
- This claim would fail in any US jurisdiction
- Low pricing by new entrants is the textbook definition of competition
- No court has ever held that a small startup's low pricing constitutes predatory pricing against established incumbents

### Recommendations

1. **No action required** -- this is not a credible legal risk
2. **If investors ask**: the response is that near-zero marginal cost (local-first, no servers) makes $5/yr sustainable, not predatory
3. **Document your cost structure** to show pricing is above marginal cost

---

## 10. FEATURE COPYING / TRADE SECRETS [LOW]

### Can Competitors Sue for "Copying Features"?

**No.** In the United States:
- **Software features are not protectable** by copyright (copyright protects specific expression/code, not functionality)
- **Software ideas and concepts are not protectable** -- envelope budgeting, medication tracking, book shelves, etc. are all general concepts
- **Only specific patented implementations** are protectable (see Section 6)
- **Trade secrets** are only protectable if you obtained them through improper means (theft, breach of NDA, etc.)

### Your Competitor Analysis Methodology

MyLife's competitor analysis process (extracting frames from screen recordings, documenting features, building comparable UIs) is **standard competitive intelligence** and is legal because:
- You are analyzing publicly available products
- You are not decompiling or reverse-engineering proprietary code
- You are building your own independent implementation
- You are not breaching any NDA or terms of service (assuming you use the apps as a normal consumer)

### Terms of Service Risk

Some apps' ToS prohibit "competitive analysis" or "benchmarking." In practice:
- These clauses are generally unenforceable for consumer products
- Using an app as a consumer and noting its features is not "reverse engineering"
- No court has held that observing a competitor's UI constitutes a ToS violation

### Recommendations

1. **Continue documenting independent development** (design docs, competitor analysis docs with timestamps)
2. **Do NOT copy UI designs pixel-for-pixel** -- functional similarity is fine, visual copying is a copyright/trade dress risk
3. **Do NOT copy competitor code, APIs, or database schemas** -- only observe and independently implement
4. **Do NOT use competitor assets** (icons, illustrations, fonts, branded elements)
5. **Keep competitor screen recordings and analysis docs** as evidence of clean-room-style development

---

## Priority Action Plan

### Before Public Launch (Blockers)

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 1 | **Trademark clearance search for "MyLife"** | Attorney | 1-2 weeks |
| 2 | **Draft consumer health data privacy policy** (WA, NV, CT, MD compliant) | Attorney | 2-3 weeks |
| 3 | **Review all marketing materials** for Lanham Act compliance | Attorney | 1 week |
| 4 | **Add health/FDA disclaimers** to all health-adjacent modules | Dev + Attorney | 1 week |
| 5 | **Implement health data consent flow** (affirmative, module-level) | Dev | 1-2 weeks |
| 6 | **Implement data deletion mechanism** for health data | Dev | 1 week |
| 7 | **Draft Terms of Service + Privacy Policy** | Attorney | 2-4 weeks |

### Before Seed Round (High Priority)

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 8 | **Freedom-to-operate patent search** (Meds, Health, Cycle focus) | Patent attorney | 3-4 weeks |
| 9 | **Draft Anti-Enshittification Pledge** with legal enforceability | Attorney | 2 weeks |
| 10 | **Plaid compliance review** (CFPB 1033, GLBA Safeguards) | Attorney + Dev | 2 weeks |
| 11 | **Rebrand evaluation** (if trademark search reveals conflict) | Founder + Attorney | 4-8 weeks |

### Ongoing (Post-Launch)

| # | Action | Frequency |
|---|--------|-----------|
| 12 | Verify competitor pricing accuracy in marketing materials | Quarterly |
| 13 | Monitor state health data privacy legislation | Monthly |
| 14 | Monitor CFPB 1033 rulemaking changes | Quarterly |
| 15 | Monitor FDA digital health guidance updates | Semi-annually |
| 16 | Review new module features for FDA/patent risk | Per feature |

---

## Appendix A: Key Statutes and Regulations

| Statute | What It Covers | Why It Matters |
|---------|---------------|----------------|
| Lanham Act (15 U.S.C. 1051-1141) | Trademark infringement + false advertising | Name conflict + comparative advertising |
| FTC Act Section 5 | Unfair/deceptive practices | Pledge enforceability + marketing claims |
| Washington MHMDA (RCW 19.373) | Consumer health data | Health modules, cycle tracking |
| Nevada SB 370 | Consumer health data | Health modules |
| Connecticut CTDPA | Consumer health data (sensitive) | Health modules, geofencing |
| CFPB Section 1033 (Dodd-Frank) | Consumer financial data access | Plaid integration |
| GLBA Safeguards Rule | Financial data security | Plaid integration |
| FDA General Wellness Guidance (2026) | Health app classification | Health, Meds, Cycle modules |
| Sherman Act Section 2 | Monopolization / predatory pricing | Pricing defense |
| HIPAA (42 U.S.C. 1320d) | Protected health information | Currently not applicable, but monitor HIPRA |

## Appendix B: Research Sources

- [USPTO Trademark Search](https://tmsearch.uspto.gov/)
- [MyLife.com Wikipedia](https://en.wikipedia.org/wiki/MyLife)
- [FTC Predatory Pricing Guidance](https://www.ftc.gov/advice-guidance/competition-guidance/guide-antitrust-laws/single-firm-conduct/predatory-or-below-cost-pricing)
- [Washington MHMDA Full Text](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- [CFPB Section 1033 Overview](https://www.congress.gov/crs-product/IF13117)
- [FDA General Wellness Guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
- [Comparative Advertising and Lanham Act](https://www.bonalaw.com/insights/legal-resources/do-i-have-a-lanham-act-claim-against-my-competitor-for-false-advertising)
- [Medisafe Patent US20150235004A1](https://patents.google.com/patent/US20150235004A1/en)
- [Digital Health Laws USA 2026](https://iclg.com/practice-areas/digital-health-laws-and-regulations/usa)
- [FTC Mobile Health App Tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
- [Health Privacy Developments 2025](https://www.insideprivacy.com/health-privacy/health-privacy-developments-to-watch-in-2025/)
- [HIPRA Senate Bill (2025)](https://www.insideprivacy.com/health-privacy/u-s-senate-introduces-the-health-information-privacy-reform-act/)
- [Student Privacy Pledge (FTC enforceability)](https://fpf.org/blog/g-suite-student-privacy-pledge/)
- [Software Patents Enforceability 2025](https://arapackelaw.com/patents/are-software-patents-enforceable/)
- [Plaid CFPB Section 1033 Compliance](https://plaid.com/resources/compliance/section-1033-authorized-third-parties/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

---

**DISCLAIMER:** This document is an internal risk assessment prepared using publicly available legal information. It is NOT legal advice. It should be reviewed by qualified attorneys in trademark, health privacy, advertising, FDA regulatory, and financial compliance law before any decisions are made. Laws change frequently -- verify all statutes cited against current versions before relying on them.
