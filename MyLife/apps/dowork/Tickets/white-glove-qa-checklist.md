# DoWork White-Glove QA Checklist (Plan 36 Phase 7)

The device QA script for the first TestFlight round with the trainer (F7).
Gated on F1 (Supabase prod deploy), F2 (EAS/ASC), F3 (RevenueCat products),
F6 (push keys). Findings go to `Tickets/` and `errors_log.md` before submit.

## A. Trainer onboarding (with the trainer, his device)

- [ ] Redeem the first real invite code (Settings > Are you a trainer?)
- [ ] Studio opens; profile editor: headline, specialties, socials, hero image, price tier
- [ ] Bulk-upload 3+ videos from his actual filmed library (metadata, premium flags, thumbnails)
- [ ] Videos appear on his public profile and on linked exercise detail rails
- [ ] Directory shows him (verified) with subscriber count; QR poster share renders and scans

## B. Voice session (his actual gym, noise reality check)

- [ ] Continuous voice on: pause / play / slow down / speed up / back up thirty seconds / restart, all while music and gym noise
- [ ] False-trigger check: normal conversation near the phone does not drive the player
- [ ] Push-to-talk pill works with continuous mode off
- [ ] Simultaneous playback + mic: audio does not duck to silence; if the OS blocks capture, the honest unavailable state shows and push-to-talk still works
- [ ] Tune recognizer thresholds/debounce from findings (code follow-up if needed)

## C. Client coaching loop (two devices, trainer + a real client)

- [ ] Trainer generates a client invite; client joins by scanning the QR (cold start deep link) and by manual code entry
- [ ] Client sees the premium library via the active link (no subscription)
- [ ] Client films and sends a form check from the gym; trainer gets the push; tap routes to the form check
- [ ] Trainer reviews: 2+ timestamped notes (tap a note seeks the player) + a video reply; check flips to reviewed
- [ ] Client gets the push, sees notes anchored in the player and plays the reply
- [ ] RLS negative: a third account sees none of it (direct navigation shows honest empty/denied states)

## D. Monetization sandbox matrix (second account, sandbox tester)

- [ ] Subscribe from the profile paywall; webhook lands; dw_trainer_subscriptions row active; premium rows appear after server confirm
- [ ] Renewal event processes (sandbox accelerated clock)
- [ ] Cancel: access persists until period end, then expires
- [ ] Billing-issue and refund events land in the ledger correctly
- [ ] Restore Purchases on a fresh install restores entitlement
- [ ] Re-subscribe after expiry
- [ ] Webhook replay: duplicate rc_event_id returns duplicate:true, no double ledger row
- [ ] Earnings screen shows the sandbox events; subscriber count updates

## E. Push + prefs

- [ ] Token registers on first opt-in (prefs screen); provisioning states were honest pre-F2
- [ ] New-video push to subscribers + active clients; opted-out type is NOT delivered
- [ ] Marketing stays off by default; opt-in receives a manual test broadcast; opt-out stops it
- [ ] Sign-out removes the device token (no pushes to a signed-out device)

## F. Offline downloads

- [ ] Download an entitled video; airplane mode; it plays from local with the Downloaded indicator
- [ ] Entitlement revoke (end the client link / cancel sub past period): open deletes the file with the honest explanation
- [ ] Storage meter shows correct sizes; delete one; wipe all; sign-out wipes downloads
- [ ] Form checks offer no download affordance anywhere

## G. Deep links

- [ ] dowork://trainer/<handle>, dowork://video/<id>, dowork://client-invite/<code> from Notes/Messages, warm and cold start
- [ ] Notification taps route correctly from cold start

## H. Account + safety

- [ ] Report and block from feed and comments; blocked content disappears
- [ ] Delete Account removes cloud rows, storage prefixes, auth user; local db wiped; downloads wiped
- [ ] Blocked-users screen unblock flow

## I. Day-1 polish sweep

- [ ] Dynamic Type at max: no clipped text on the new screens
- [ ] VoiceOver order sane on the player rail and paywall
- [ ] All empty states honest (no demo content anywhere in the production build)
