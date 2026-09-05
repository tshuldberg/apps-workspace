# Install Meerkat on your iPhone (free): guide for a new tester

Send this document to the person testing. It assumes they have never heard of Meerkat or
TestFlight and are not a developer. It costs them nothing.

Supersedes `meerkat-friend-guide-2026-08-01.md`, which told testers to paste a temporary server
address. That is no longer needed: the connection server is now permanent and built into the app.

---

# PART A: what Trey does first (the tester cannot start without this)

A new person cannot install on their own. Apple requires you to invite them. Pick ONE path.

## Path A1: friend joins your App Store Connect team (instant, up to 100 people)

Best for a handful of close testers. They will need an Apple Account (any free Apple ID works).

1. Ask the friend for **the email address attached to their Apple Account**. It must be that
   exact address, not any other email they use.
2. Open `https://appstoreconnect.apple.com/access/users` in a browser, signed in as Trey.
   (Or: **appstoreconnect.apple.com** > **Users and Access** in the top navigation bar.)
3. Click the **`+`** button next to the **Users** heading. A form titled **`Invite User`** opens.
4. Fill in **First Name**, **Last Name**, and **Email** (the Apple Account address from step 1).
5. Under **Roles**, tick **`Developer`**. (Marketer also works. Do not use Admin.)
6. Click **`Invite`** at the top right. Apple emails them an invitation. **They must open that
   email and accept before you continue.** This often lands in spam; tell them to look.
7. Once they have accepted, open
   `https://appstoreconnect.apple.com/apps/6800001912/testflight/ios`.
8. In the left sidebar, under the heading **INTERNAL TESTING**, click **`B1`**.
9. On the **Testers** tab, click the **`+`** next to the **Tester** heading. A dialog opens
   titled **`Add Testers to the Group "B1"`** listing your team members.
10. Tick the checkbox on your friend's row, then click **`Add`**.

**Done when:** the B1 Testers list shows their email with status **`Invited`**. They receive a
TestFlight email within a few minutes. Now send them PART B below.

## Path A2: friend is NOT on your team (up to 10,000 people, needs a one-time Apple review)

Use this for wider testing. Apple reviews the build once before external testers can install,
usually 1 to 2 days.

1. Open `https://appstoreconnect.apple.com/apps/6800001912/testflight/ios`.
2. In the left sidebar under **EXTERNAL TESTING**, click **`A1`**.
3. On the **Builds** tab, click **`+`**, select the newest build, and click **`Add`**. Apple will
   ask for export compliance if it has not been answered for that build, and will then submit it
   for **Beta App Review**.
4. Wait for the status to change from **`Waiting for Review`** to **`Ready to Test`**. This is
   the 1 to 2 day step.
5. On the **Testers** tab, click **`+`** > **`Add New Testers`**, enter their email addresses,
   and click **`Add`**. Or use **`Enable Public Link`** to get a URL anyone can use.

**Done when:** the group shows **`Ready to Test`** and testers have been emailed. Then send them
PART B.

---

# PART B: send this part to the tester

Everything below is written for you, the tester. It is free. You will not be charged at any
point, and you do not need a credit card.

## B1: what Meerkat is (30 seconds of context)

Meerkat is a private messaging and community app, like Discord or Slack, except no company holds
your messages. There is no email signup and no password: your account is a key created on your
phone. This is an early test build, so some things are deliberately switched off (listed at the
end).

## B2: install the TestFlight app

TestFlight is Apple's official app for trying pre-release apps. It is made by Apple and is free.

1. On your iPhone, open the **App Store** (blue icon with a white "A" made of drawing tools).
2. Tap the **Search** tab at the bottom right, type **`TestFlight`**, and search.
3. Find the app named **TestFlight** by **Apple**. Tap **`GET`**, then confirm with Face ID,
   Touch ID, or your Apple Account password.
4. Wait for it to finish installing. Do not open it yet.

**Done when:** a blue icon with a white paper-plane logo named **TestFlight** is on your home
screen.

## B3: accept your invitation

1. Open the **Mail** app (or whichever app receives the email tied to your Apple Account) and
   find an email from **TestFlight**, subject line similar to
   **"Trey Shuldberg has invited you to test Meerkatts"**.
   **If you cannot find it, check your Spam or Junk folder.** This is the most common problem.
2. In that email, tap the button labeled **`View in TestFlight`**.
3. TestFlight opens. If it asks you to accept terms, tap **`Accept`**.

**Done when:** you see a page inside TestFlight headed **Meerkatts**.

## B4: install Meerkat

1. On that Meerkatts page in TestFlight, tap the blue **`INSTALL`** button.
2. Wait for it to download. The button changes to **`OPEN`**.
3. Tap **`OPEN`**.

**Done when:** the Meerkat app launches. You may first see a one-time TestFlight notice about
sending crash data; either choice is fine.

## B5: first run

1. The app opens on a screen headed **Feed** with a card asking **"When were you born?"**
2. Type your birth date into the three boxes: **Month** (`MM`), **Day** (`DD`), **Year**
   (`YYYY`). For example `07`, `14`, `1990`.
   Your birth date is checked on your phone and is never stored or sent anywhere.
3. Tap **`Continue`**.

**Done when:** the birth date card disappears.

## B6: unlock the app, free

The app shows a $4.99 price. **You will not be charged.** Apple sends all purchases in test
builds to a practice environment called Sandbox, where no real money moves.

1. Tap the unlock button. It reads **`Unlock for $4.99`** or **`Buy or restore unlock`**.
2. Apple's purchase panel slides up from the bottom.
3. **Look for the words `[Environment: Sandbox]` on that panel.** They confirm this is the free
   practice purchase.
   **If you do NOT see the word Sandbox, stop and tell Trey. Do not confirm.**
4. Confirm with Face ID, Touch ID, or your Apple Account password.
5. If Apple asks you to sign in with an Apple Account, use your normal one. You are still not
   charged.

**Done when:** the app opens fully and a row of five tabs appears along the bottom: **Feed,
Communities, Public, Messages, Me**.

## B7: check you are connected

1. Tap the **Me** tab at the bottom right.
2. Look for the connection status card.

**Done when:** it reports the connection server is reachable. You do not need to type in a
server address; it is already built into the app.

## B8: add Trey as a friend and send a message

1. Tap the **Messages** tab at the bottom.
2. Tap the **`+`** at the top to open **Add friend**.
3. You each need the other's code. Either show each other the QR code on screen, or copy your
   friend code and send it to each other by text.
4. After adding, you will be asked to compare a **five-emoji safety code**. Read the emoji aloud
   to each other in person or on a phone call. **They must match on both phones.** This is what
   proves nobody is impersonating either of you. If they do not match, stop and tell Trey.
5. Open the conversation and send a message.

**Done when:** each of you sees the other's message. If Trey's app is open, it arrives within a
few seconds; if his app is closed, it arrives when he next opens it.

---

# What works and what does not, honestly

This is an early build. These are deliberate, not faults:

- **No push notifications.** If the app is closed, messages arrive when you next open it, not as
  a banner.
- **Voice and video calls are unavailable.** The code exists but the server for it is not
  deployed.
- **Public / Discover shows "Could not reach a public directory."** That service is not deployed
  yet. Private communities and direct messages work.
- **The web version cannot be unlocked yet.** Only the iPhone app can.
- **Nothing is sent anywhere until you connect with someone.** Communities you create live only
  on your phone until you invite another device.

If something looks wrong, screenshot it and send it to Trey. The app is built to state honestly
when something is unavailable, so a screen saying "not available" is usually correct behavior
rather than a bug. A crash, a spinner that never finishes, or a claim that seems too good
(for example a message marked delivered when the other person never got it) is worth reporting.

---

# Troubleshooting

| Problem | What to do |
|---|---|
| No TestFlight email | Check Spam/Junk. Confirm Trey used the exact email attached to your Apple Account. Ask him to resend. |
| "This beta isn't accepting new testers" | You are not in the group yet. Ask Trey to complete PART A. |
| Purchase panel does not say Sandbox | Stop. Do not confirm. Tell Trey; the build may be misconfigured. |
| "Purchase unavailable" or the buy button fails | Apple may still be propagating the store setup. Wait a few hours and retry, then tell Trey. |
| App opens to an error screen | Delete the app fully (press and hold the icon > Remove App > Delete App), reinstall from TestFlight. That clears the local database. |
| Connection card says unreachable | Check your internet. If it persists, tell Trey; the connection server may be down. |
