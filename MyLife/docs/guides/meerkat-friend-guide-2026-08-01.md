# Getting started with Meerkat (friend guide)

A step-by-step guide for a first-time, non-technical tester. HTML twin (the version to send): `meerkat-friend-guide-2026-08-01.html`. Supersedes the tester sections of `meerkat-tester-guide-2026-07-24.html` for friend onboarding; that older guide remains the record of the 07-24 testbed session.

## 1. What Meerkat is

Discord-like communities + channels + DMs, but no company holds your messages. Your account is a key created on your device; no email, no password. The phone app is the home of your data; the web app is another window into it. Delivery: sending hands a sealed message to the connection server; while the recipient's app is open it arrives on its own within seconds (live-wake), and a closed app receives it on next open. No push notifications yet, so a closed app stays quiet. Manual Sync sessions remain for first-time setup with a new person and for big files; Automatic connections is an opt-in extra.

## 2. The four things Trey sends

1. TestFlight invite (iPhone real app), or
2. Web link (computer, and iPhone fallback via Safari Add to Home Screen). Temporary tunnel address; changes when the test server restarts.
3. Connection server address (`wss://…`), pasted once per device.
4. Community invite link (`meerkat://community/join#…`, signed, expires in 48h).

## 3-4. Install

- iPhone Path A: install TestFlight from the App Store, open the invite, Install Meerkat.
- iPhone Path B: open web link in Safari, Share, Add to Home Screen, always launch from the icon.
- Computer: Chrome/Edge, install icon in the address bar (or menu, Install page as app).

## 5. Every device is its own identity

Each device generates its own key and safety code. Do not copy an identity across devices. Set each up separately, then link them (step 12) so they count as one person.

## 6. First run

A. Age question (checked on device, never stored or sent). B. Pick a name, screenshot the safety code. C. "Just look around". D. Unlock: TestFlight build = tap Unlock (Apple sandbox, no real charge); web test build = Settings, Unlock Meerkat, Restore purchase (test server grants it). More icons appear when unlocked.

## 7. Connection server (every device)

Settings > Connection server > "I have a server URL" > paste the `wss://` address > Save > shows "reachable". Prevents the stale-probe "No relay URL configured" quirk.

## 8. Join the community

"+" > Add a community > Join with an invite link > paste > Preview invite (name, counts, "invited by an owner", expiry) > Join community.

## 9. Pair with Trey (one time)

Channel > Sync > copy your `MKPAIR1-` code, swap codes, Pair device, both see "Paired devices: 1". Then read safety codes to each other over a separate channel (MITM check).

## 10. Send a message

Send; while the other person's app is open it should appear on their screen within a few seconds on its own (live-wake), or on next app open otherwise. Manual fallback (also the path for big files): both open Sync > Manual session > same phrase (16+ chars, identical) > one presses Listen, other Sync now within a minute > Recent sessions shows `completed · wan_relay · sent N / received M`. Manual flow verified on the 07-24 testbed. Automatic connections is the opt-in dialing extra.

## 11. Calls

Both apps open (no push wake). Messages > chat > phone/camera button > Allow mic/camera > answer > check the Calls log after. The channel "Room" button is honestly non-functional (no media server deployed).

## 12. Link phone + computer as one person

Pair own devices first; on one, Messages > linked-devices panel > "Link this second device"; other device must confirm; member list then shows one row with "2 devices".

## 13. Bug reports

Screenshot + what was pressed + which device and time. Do not report: silence while the app is closed (no push yet), Room button, tunnel link rotation.

## Operator notes (Trey, not part of the friend copy)

- TestFlight build must be built with `EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` baked (RevenueCat iOS key) or the unlock is honestly unavailable and sync stays locked; optionally bake `MEERKAT_DEFAULT_RELAY_URL` to skip step 7.
- TestFlight sandbox purchases do not charge testers.
- Web path needs the testbed (`artifacts/meerkat-testbed/start.sh tunnel`) or a deployed relay + web bundle; the wss address in step 7 is that server.
- Friend needs: TestFlight invite (App Store Connect > TestFlight > Internal/External testers), web link, wss address, community invite link, and an agreed sync phrase.
