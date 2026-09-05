# The Anti-Enshittification Pledge

**Version 1.0**

**Status note (2026-04-23):** This file is a March 2026 product-principles draft. It is not the architecture source of truth and should not be treated as a legally operative commitment unless it is separately adopted in user-facing policy.

Current source-of-truth docs:
- `docs/plans/consolidation/README.md`
- `docs/plans/consolidation/phase-review-report.md`
- `docs/plans/queue/08-mesh-sync-mission-control.md`
- `packages/module-registry/src/constants.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/web/components/Providers.tsx`

If you are about to use claims from this document in a current deliverable, stop and ask the user to verify that the specific language or assumptions should still be used.

This is not a Terms of Service. It is a product-principles document that describes the defaults and user protections the product is intended to preserve as the implementation evolves.

We wrote this because the software industry has a pattern. A company makes something good. People depend on it. Then the company makes it worse on purpose, because now people are trapped.

We refuse to do that. Here is exactly what we promise, in plain language.

---

## The Seven Commitments

### 1. No Advertisements. Ever.

We will never show you ads. Not banner ads. Not "sponsored content." Not "personalized recommendations powered by our partners." Not ads disguised as features. There is no version of the future where you open MyLife and see an advertisement. This is permanent.

### 2. We Will Never Sell Your Data

Your data belongs to you. We will never sell it, license it, share it, or trade it with any third party for any reason. Not to advertisers. Not to data brokers. Not to "trusted partners." Not in anonymized form. Not in aggregate form. Not ever.

If someone offers us money for your data, the answer is no.

### 3. No Bait and Switch

If a feature is free today, it stays free forever. We will never take something you already have and put it behind a paywall. We may add new premium features, but we will never remove free ones. The app you have today will never get worse because we want more money.

### 4. Your Data Is Yours. Take It Anytime.

You can export all of your data at any time. Every module. Every record. In standard, open formats (CSV, JSON, Markdown). No waiting period. No "request your data and we'll email it in 30 days." You press a button, you get your files. Right now.

This is not a grudging compliance feature buried in settings. It is a first-class product feature because we believe portable data is a human right.

### 5. Delete Everything With One Button

Settings has a button. It says "Delete All My Data." It does exactly what it says. One tap, confirmation, done. All of it. Gone. No "we'll retain some data for analytics." No "deletion may take up to 90 days." No ghost profiles. No shadow copies.

When you delete your data, it is deleted. Period.

### 6. Your Speech, Your Filters

We believe people should be able to speak freely. We also believe people should be able to choose what they see.

During setup, you set your own content preferences. You decide what gets filtered. You decide what is visible. We do not make that choice for you. We do not impose a single standard of acceptable content on everyone. We give you the tools and respect your judgment.

If you want strict filtering, you can have it. If you want no filtering, you can have that too. Your app, your rules.

### 7. The Exit Door Is Always Open

If we ever break any of these commitments, you can leave. Export your data (Commitment 4), delete your account (Commitment 5), and walk away with everything you brought in. No lock-in. No switching cost. No friction.

We designed it this way on purpose. We want you to stay because the product is good, not because leaving is hard.

---

## What This Means, Technically

These commitments are meant to show up in product decisions, default settings, and data handling choices, not just in brand language.

**Local-first storage.** Your data is stored on your device in a single SQLite file. For most modules, it stays there instead of being sent to a server, which reduces centralized storage and server-side exposure.

**Zero telemetry.** We do not track what you tap, what screens you visit, how long you spend in the app, or what features you use. We collect no analytics. We run no A/B tests on your behavior. We have no "engagement metrics" because we do not measure your engagement.

**Zero accounts for core features.** You do not need to create an account, provide an email, or sign in to use the app. Your data exists on your device. That is it.

**On-device processing.** Features like cross-module insights and search run entirely on your device. Your data is not sent to a cloud service for analysis. If you choose to enable AI features, you provide your own API key and your data goes directly from your device to the AI provider. We never see it.

**Open export formats.** CSV. JSON. Markdown. Formats that any other app, any spreadsheet, any text editor can read. We will never trap your data in a proprietary format that only works with our app.

**No server-side data for local modules.** For modules that run entirely locally, we do not keep a copy of the underlying user data on our servers. That limits what can be centrally queried, retained, or exposed in a server breach.

**Cloud-connected modules should be minimal and transparent.** When a module requires network connectivity, it should store only what is necessary for the feature to function, make sharing explicit, and let users revoke access or participation without hidden retention.

---

## What Happens If We Get Acquired

Companies get acquired. Priorities change. New owners might not share these values.

If MyLife is ever acquired, this pledge transfers to the new owner as a product obligation. But we are not naive. Pledges can be rewritten. So here is the real protection: the architecture.

Because your data is local, a new owner cannot suddenly start harvesting it. They would have to ship an update that changes the architecture, and you would have to install it. You can always stay on the current version, export your data, and leave.

The exit door does not have a lock. That is the point.

---

## Why We Are Doing This

The video that started this: a man describes his job as an "enshittificator." He takes things that work and makes them worse. Pop-ups on your favorite website. Ads interrupting your video. Premium features that used to be free. A thousand photos of your deceased mother, and now you have to pay to access them.

He describes the playbook: make it nice, make people depend on it, then make it shitty.

We watched that and thought: what if you just... did not do that?

What if you built software that stayed good? What if the business model was simple enough that you never needed to make it worse? What if $5 a year from enough people was just... enough?

That is what this is. Not a charity. A business built on the belief that you can make money by making something good and keeping it good.

---

## How to Hold Us Accountable

This pledge is versioned. Any changes will be documented with a clear explanation of what changed and why. The full history will be public.

If you believe we have violated any of these commitments, tell us. Publicly. We would rather be called out and fix it than quietly drift into becoming the thing we promised not to be.

---

*MyLife: One app. One database. Zero telemetry. $5/yr.*

*Built with conviction that personal data belongs to the person.*
