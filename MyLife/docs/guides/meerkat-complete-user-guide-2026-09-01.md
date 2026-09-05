# Meerkat Complete User Guide

Verified against MyLife commit `493b2549` on 2026-09-01. The HTML version beside this file is the main visual guide and shows what the screens actually look like. The names and messages in those pictures are made-up examples. Every button label, menu order, and status message is copied straight out of the app.

## What Meerkat Is

Meerkat is a private social app. You get group spaces, private messages, posts, shared files, your own library, and a way to send things straight from one phone to another.

When you first open it, your phone makes a key and keeps it. That key is who you are in Meerkat. Nobody needs your phone number or your email to talk to you, and the key never turns into an account with a company. If you later want to post in the public area or buy the app, you sign in separately, and that sign-in is deliberately kept apart from your key so the two can never be matched up.

Meerkat also does not decide what your group looks like. Whoever made the group builds its home page and its channels out of ready-made pieces, and everyone in it can add their own pages, their own profile design, and decorations on top. The same app can be a family photo album, a club forum, a class page, a video channel, an events board, or a wall of pages your friends designed. Chapter 4 shows you how.

Nothing anyone adds can reach out to the internet. You pick colors and shapes from a set list instead of typing in code, pictures are stored on your own device rather than loaded from somewhere else, and everything anyone makes carries their name in a way nobody can fake.

What it costs:

- Reading the public area is free, once those servers are switched on.
- The private app is `$4.99`, paid once. There is no subscription.
- If you want Meerkat to run the servers that keep your group connected, that is `$4.99` a month, and it is optional.
- Or you can point Meerkat at your own server instead and pay nothing for it.

## What the Labels in This Guide Mean

- **Works now:** It is built and it works, as long as the person or the file you need is actually there.
- **Needs the full app:** It only works in the real installed app, not in the cut-down preview version some testers use.
- **Needs a server:** It needs a server that is switched on and that your phone can reach. If there isn't one, the app tells you so instead of pretending.
- **Not ready yet:** You can see the screen, but Meerkat will not claim the feature works.

## 1. First Launch

### Confirm your age

1. **Where:** Open Meerkat on the device where you installed it.
2. **What you will see:** A page titled `When were you born?` with fields labeled `Month`, `Day`, and `Year`.
3. **What to click or type:** Enter your birth date as `MM`, `DD`, and `YYYY`, then tap `Continue`.
4. **What happens next:** Meerkat works out your age on the phone itself. It does not save your birthday and it does not send it anywhere.
5. **Done when:** The onboarding page reads `Step 1 of 3` and `Private social, controlled by you`.
6. **If it fails:** Check the date is a real, complete date. Anyone under the minimum age gets a locked page instead of the setup screens.

### Choose how to begin

1. **Where:** Continue from `Step 1 of 3` in the onboarding sheet.
2. **What you will see:** The page `Private social, controlled by you`, followed by a name step and four starting choices.
3. **What to click or type:** Enter the name friends should see. Then choose exactly one: `Create a community`, `Join with an invite`, `Add a friend`, or `Just look around`.
4. **What happens next:** Meerkat makes your key, saves it on the phone, and takes you to whatever you picked.
5. **Done when:** The main app opens with the tabs `Feed`, `Communities`, `Public`, `Messages`, and `Me`.
6. **If it fails:** Close and reopen the app. If it says secure storage is unavailable, you are on the cut-down preview version. Install the full app instead.

### Unlock private features

1. **Where:** In Meerkat, open `Me > Unlock Meerkat`. The same screen may appear when you first use a private feature.
2. **What you will see:** `Unlock Meerkat`, a `$4.99` one-time price, and the buttons `Unlock for $4.99` and `Restore purchase`.
3. **What to click or type:** Tap `Unlock for $4.99` and complete the Apple purchase sheet. If you bought it before with the same Apple account, tap `Restore purchase`.
4. **What happens next:** Apple confirms the purchase and Meerkat records that you paid. Your key stays your key; paying does not turn it into an account.
5. **Done when:** The unlock page reports that private Meerkat is unlocked and private actions no longer open the paywall.
6. **If it fails:** Check you are on the full installed app and that App Store purchases work on this device. Try `Restore purchase` again. If the payment service is not set up, the page says so instead of pretending you are unlocked.

## 2. Navigate Meerkat

The five visible tabs are:

- `Feed`: activity from your communities.
- `Communities`: private spaces, channels, pages, files, and libraries.
- `Public`: read what people have published, without signing in to anything. Posting there needs a separate sign-in and needs those servers switched on.
- `Messages`: private chats, one-to-one and in groups, plus your list of people.
- `Me`: your profile, your privacy settings, saved things, colors, storage, connection, and everything else.

## 3. Create or Join a Community

### Create a community

1. **Where:** Open `Meerkat > Communities` and tap the plus button in the top-right corner.
2. **What you will see:** A sheet titled `Create a community`, a field labeled `Community name`, and the current theme choice.
3. **What to click or type:** Type the complete community name under `Community name`. Under `Start from a template`, choose one of `Family Space`, `Media Library`, `Club`, `Course Hub`, `Newsroom`, or `Blank`. A template creates the channels and libraries described under its name; `Blank` creates one `General` channel and nothing else. Tap `Use my current theme` if you want the community to open in the theme you already use. Tap `Create community`.
4. **What happens next:** Meerkat sets up the group and its first channel on this phone, and stamps it as yours in a way nobody else can copy.
5. **Done when:** The community page opens and shows the community name with its `Channels`, `Pages`, `Files`, and `Libraries` destinations. A template is a starting point, not a commitment: chapter 4 covers reshaping any of it afterwards.
6. **If it fails:** Read the message in the sheet. Give the group a name. If it cannot create your key, restart on the full installed app and check the phone's secure storage is working.

### Join with an invite

1. **Where:** Open `Meerkat > Communities`, tap the plus button, then choose the join option. You can also choose `Join with an invite` during onboarding.
2. **What you will see:** A way to scan a QR code or paste an invite link, and a `Preview invite` button.
3. **What to click or type:** Scan the code or paste the full invite link, then tap `Preview invite`.
4. **What happens next:** Meerkat checks the invite is genuine and not faked, then shows you the group and its joining rules before adding anything.
5. **Done when:** After you confirm, the community appears in `Communities` and its locally available content opens.
6. **If it fails:** Ask the owner for a fresh invite, and make sure you copied all of it. Some groups need the owner to approve you, which needs a working connection server. Meerkat will not say you joined until that approval actually arrives.

### Attach a community server as an owner

1. **Where:** Open `Meerkat > Communities > [community name] > Settings > Community server`.
2. **What you will see:** A server address field and `Verify and attach`, plus a current availability explanation.
3. **What to click or type:** Enter the full `https://` community-server address and tap `Verify and attach`.
4. **What happens next:** Meerkat actually contacts the server to check it is alive and really is a Meerkat server. It only attaches it after the server accepts a real upload from you.
5. **Done when:** The section reports that content is `Always available via this community's server.`
6. **If it fails:** Check the address starts with `https://`, that the server is online, and that it is really a Meerkat community server. Until it is attached, the group's content stays `Available from members who have it, when a sync connects.`

## 4. Build the Community: Channels, Posts, Pages, and Canvas

### Send a channel message

1. **Where:** Open `Meerkat > Communities > [community] > Channels > #[channel]`.
2. **What you will see:** The channel name, a line that always tells you who can read this channel, and the `Messages` tab. A brand new channel reads `No messages yet`.
3. **What to click or type:** Type in the composer and tap the send control.
4. **What happens next:** Meerkat saves your message on this phone with your name stamped on it. It only reaches anyone else when the app actually connects to them.
5. **Done when:** The message appears in the channel.
6. **If it fails:** Check the channel is not archived and that your role in the group is allowed to post. An archived channel is kept, but it is read-only.

### Start a post and reply

1. **Where:** Open a channel and select `Posts`, then tap `Start a post`.
2. **What you will see:** A post composer with `Post` and `Canvas` choices.
3. **What to click or type:** Enter the post title and body, or compose an allowed Canvas post, then publish it to the channel.
4. **What happens next:** Your post appears in the channel and in Feed with your name stamped on it. Opening it shows `Post thread` and any replies.
5. **Done when:** The post appears under `Posts` in the channel, and the line about who can read it is still shown at the top.
6. **If it fails:** Check what your role is allowed to do, whether the channel is archived, and how big your attachment is. A reply has only really saved once it shows up in the thread.

### Use reactions and mentions

1. **Where:** Open a channel message or post action menu.
2. **What you will see:** Reaction controls and, while typing `@`, trusted community names.
3. **What to click or type:** Select a reaction or choose a trusted name from mention autocomplete.
4. **What happens next:** A reaction only appears once Meerkat has checked it is genuine. Picking a name from the `@` list attaches that exact person, not just their name as text, so nobody can impersonate them.
5. **Done when:** The reaction count updates, or the mention shows up highlighted.
6. **If it fails:** Give it a second to save. Meerkat will not flash up a reaction that was never actually saved, even briefly.

### Compose the community home with the layout editor

Only the community owner can do this. Another member sees `Only the community owner can edit its layout.`

1. **Where:** Open `Meerkat > Communities`, tap your community, tap `Community settings`, and scroll to the section headed `Layout`. On the web app the same section is `Layout` inside the community settings panel.
2. **What you will see:** A button labeled `Open layout editor`. The editor opens with a `Surface` control offering `Home` and one entry per channel, a `Template` control, a `Capabilities` control, and the buttons `Add a block`, `Preview`, and `Publish layout`.
3. **What to click or type:** Leave `Surface` on `Home` to compose the community home, or pick a channel to override just that channel's blocks. Tap `Add a block` and choose from the palette: `Hero`, `Chat`, `Posts`, `Timeline`, `Gallery`, `Video`, `Video player`, `Live stage`, `Short videos`, `Files`, `Storefront`, `Membership tiers`, `Link embeds`, `Events`, `Page`, or `Members`. Tap `Edit` on any block to change its settings.
4. **What happens next:** The editor keeps your changes as a draft. `Preview` shows you the real thing, exactly as everyone else will see it. Nothing reaches anyone until you publish.
5. **Done when:** You tap `Publish layout` and the community home shows your arrangement. Publishing saves one update stamped as yours. Everyone else's phone checks that stamp before showing it, so nobody can push a fake layout into your group.
6. **If it fails:** `Only the community owner can edit its layout.` means you are not the owner. `This community is not on this device.` means the group has not synced to this phone yet. If a block shows a message instead of content, that feature needs a server or the full installed app. See the note below.

**Switching something on is not the same as having it.** The `Capabilities` control lets an owner turn on `Video`, `Live stage`, `Short videos`, `Storefront`, `Membership tiers`, `Link embeds`, and `Offline downloads`. If this version of the app cannot actually do one of them, the block says so in plain words, for example `The storefront is enabled here, but this build has no billing service configured.` Meerkat never draws a feature it cannot really run.

### Share a layout, or start from someone else's

1. **Where:** In the layout editor, use the `Template` control.
2. **What you will see:** `Share this layout, or start from another community's.`, a `Copy layout template` action, and a field labeled `Paste a meerkat-layout template or link`.
3. **What to click or type:** Tap `Copy layout template` to put your arrangement on the clipboard as a code you can send to anyone. To use someone else's, paste their code into the field and tap `Import into draft`.
4. **What happens next:** An imported template lands in your draft only. You still review it and tap `Publish layout` before anyone else sees it.
5. **Done when:** The button reads `Copied`, or the imported arrangement appears in the editor draft.
6. **If it fails:** `That doesn't look like a Meerkat layout.` means the pasted text is not a layout code. Ask the sender to copy it again. `Reset to classic layout` returns the surface to the default arrangement at any time.

### Build a page, and promote it to a tab

Any member can build a page. Only the owner can promote one into a community tab.

1. **Where:** Open the community and tap `Open community pages`.
2. **What you will see:** A screen headed `Pages`. With none yet it reads `No pages yet. Build the first one.`
3. **What to click or type:** Tap `New page`, then tap `Build` to enter build mode. Place items from the palette: text, image, sticker, shape, frame, link card, guestbook, poll, counter, divider, an 88x31 button, a badge case, a top-friends list, a milestone card, or an embedded block. Use `Move`, `Size`, `Turn`, `Stack`, `Front`, `Back`, and `Remove` on a selected item. Tap `Templates` to start from a starter layout instead of an empty page.
4. **What happens next:** Everything you place is saved with your name on it. Other people can see you made it, and only you or one of the group's curators can change or remove it. Tap `Done building` when you are finished.
5. **Done when:** The page appears in the `Pages` list. If you are the owner and want it in the tab bar, tap `Promote to a tab`, type a `Tab name`, and tap `Promote`. `Demote` removes it from the tab bar without deleting the page.
6. **If it fails:** `Your role cannot place on this layer here.` means the owner has restricted that layer. `Only its author can change it.` means you are trying to edit someone else's item; as a curator you can remove it instead, and the app says `As a curator you can remove it.`

### Design your profile page inside a community

Your profile is per community. A design in one community is never automatically linked to your design in another.

1. **Where:** Open the community, open its member list, and tap your own name.
2. **What you will see:** Your profile page for that community and a button labeled `Design my profile`.
3. **What to click or type:** Tap `Design my profile`, then build the page the same way as any other page. To reuse a design you already made elsewhere, tap `Use one of my other designs`.
4. **What happens next:** Copying a design makes a fresh draft here. It is locked with this group's keys and carries nothing that points back to the group you copied it from, so nobody can connect the two.
5. **Done when:** Your profile in this community shows your design to the other members.
6. **If it fails:** `Not currently a member of this community.` means your membership has not synced here yet.

### Change how the community looks

1. **Where:** Open the community and find the `Community theme` control.
2. **What you will see:** The choices `Use community theme`, `Use my theme`, and `High contrast`, plus `Adopt this theme` when the owner has published one you do not have yet.
3. **What to click or type:** Choose the one you want. To build your own palette, open `Meerkat > Me > Appearance`, tap `Create custom theme`, and either edit the colors directly or tap `Generate from a color` and pick one shade. `Edit the main colors. Secondary shades update automatically.`
4. **What happens next:** `High contrast` always beats any theme, whether it came from you or from the group. A group's theme only applies inside that group. The tab bar, Feed, Messages, and your private chats never change color.
5. **Done when:** The community renders in the theme you chose. Tap `Share` to hand your theme to someone else as a code or a QR code; they use `Import a theme` and either `Paste a theme code` or `Scan QR`.
6. **If it fails:** A broken theme code is refused and your old theme stays. Nothing you import can change the app's own safety markers, so a theme can never be used to fake one.

## 5. Add Friends and Message Privately

### Add a friend with a code

1. **Where:** Open `Meerkat > Messages > People` and tap the add-friend button.
2. **What you will see:** `Add friend`, `Your friend code`, `Let friends find you`, `Add a friend`, and `Scan their code`.
3. **What to click or type:** Share your `MEER-...` code, or paste or scan the other person's complete code.
4. **What happens next:** Meerkat looks up their code, checks it really belongs to them, and remembers them on this phone.
5. **Done when:** The person appears under `Messages > People`.
6. **If it fails:** Ask for a new code. A friend code works once and then expires. Meerkat also cannot look anyone up without a working connection server.

### Compare a safety code

1. **Where:** Open `Meerkat > Messages > People > [person] > Safety code`.
2. **What you will see:** A five-emoji comparison and a control labeled `These 5 emoji match my friend's`.
3. **What to click or type:** Compare the five emoji over a trusted channel or in person. Tap the confirmation only when both devices show the same sequence.
4. **What happens next:** Meerkat records that you checked this person yourself.
5. **Done when:** The person shows as checked.
6. **If it fails:** If the emoji do not match, do not tap the button. Remove the person, make a new friend code, and compare again face to face or on a call where you recognize their voice. Emoji that do not match can mean someone is trying to sit in the middle of your conversation.

### Send a direct message

1. **Where:** Open `Meerkat > Messages > People > [person]` and tap `Message`, or open an existing conversation under `Chats`.
2. **What you will see:** The conversation header and a composer labeled `Message`. A new conversation reads `No messages yet`.
3. **What to click or type:** Enter the message and tap send. Use the plus menu for supported attachments.
4. **What happens next:** Meerkat locks the message and keeps it on your phone. It only goes out when your phone actually reaches theirs, or when it can leave it waiting on a server for them to pick up later. Either way it stays locked the whole time.
5. **Done when:** The message appears in the chat. Only believe a `delivered` or `read` mark when the app shows you a real confirmation that came back from their phone.
6. **If it fails:** Open `Me > Advanced connection` and check you have a connection server that answers, or run a manual sync while you are both online.

Calls and voice rooms are visible in the app but you cannot use them yet. They need the full installed app and a call server, and the app will tell you when both are ready. Until then, do not treat the call button as a working call.

## 6. Pair and Sync Devices

### Pair devices

1. **Where:** On both devices, open `Meerkat > Me > Advanced connection > Sync`.
2. **What you will see:** `Sync`, a pairing code, a safety-code check, controls for syncing through a connection server, controls for syncing over Wi-Fi, and a list of syncs that actually happened.
3. **What to click or type:** Generate or enter the pairing code on the second device. Compare the five emoji on both devices, then tap `These 5 emoji match my friend's` on each.
4. **What happens next:** Meerkat saves the other device and what it is allowed to sync with this one.
5. **Done when:** The other device appears in the paired list and the safety check shows as done.
6. **If it fails:** Start with a fresh pairing code and keep both screens open. Never approve mismatched emoji.

### Sync through a connection server

1. **Where:** On both devices, open `Meerkat > Me > Advanced connection > Sync > Manual session`. Use this when the two devices are not on the same Wi-Fi.
2. **What you will see:** The connection server address, a box for a shared phrase, and the buttons to start.
3. **What to click or type:** Enter the same phrase on both devices. On one device tap `Listen`; on the other tap `Sync now`.
4. **What happens next:** The shared phrase is how the two devices find each other. Everything they send is locked first, so the server in the middle can only see how big the messages are and when they went. It cannot read them, and it cannot tell which device is which.
5. **Done when:** A finished session appears in the recent list with real counts of what was sent, received, and saved.
6. **If it fails:** Check `Connection status`. If there is no server it says `No connection server`. If the server does not answer it says `Unreachable`. Fix the address in `Me > Advanced connection` and try again.

### Sync directly over Wi-Fi

1. **Where:** In the full installed app, open `Meerkat > Me > Advanced connection > Sync > LAN` on both devices, with both on the same Wi-Fi. Nothing leaves your Wi-Fi in this mode.
2. **What you will see:** Controls to wait for the other device, and to connect to it. On an iPhone you may get a pop-up asking to allow Local Network access.
3. **What to click or type:** Allow Local Network access. On one device tap to wait, and on the other tap to connect.
4. **What happens next:** The two devices talk to each other directly over your Wi-Fi, locked the whole way, with no server involved at all.
5. **Done when:** A finished sync appears in the recent list.
6. **If it fails:** The cut-down preview version of the app cannot do Wi-Fi syncing. Install the full app, keep both devices on the same Wi-Fi, and allow Local Network access in `iOS Settings > Privacy & Security > Local Network > Meerkat`.

`Automatic connections` is off unless you turn it on. When it is on, Meerkat does one catch-up as you open the app, and one when another of your paired devices turns up on the same Wi-Fi. It does not run while the app is closed.

## 7. Share Protected Content

### Create a protected share link

1. **Where:** Open `Meerkat > Me > Advanced sharing`.
2. **What you will see:** `Advanced sharing`, `Create or open protected share links`, a `Write` area, controls for who is allowed to open it, and your saved items.
3. **What to click or type:** Type or add what you want to share, choose how far it is allowed to travel, create the share, then copy the link it gives you.
4. **What happens next:** Meerkat locks the content, stamps it as yours, and keeps the locked pieces on this phone. The link contains the key that opens it, so anyone you send the link to can open it and nobody else can.
5. **Done when:** The item appears as `Saved and ready to share` with a copyable link.
6. **If it fails:** Check you have free space and that the phone's key storage is working. Meerkat will not hand you a link for something it did not actually lock and save.

### Open a protected link

1. **Where:** Open `Meerkat > Me > Advanced sharing > Open a link`.
2. **What you will see:** A field for the complete Meerkat share or magnet link.
3. **What to click or type:** Paste the full link and tap the open action.
4. **What happens next:** Meerkat looks on your phone first. If it is not there, it downloads the locked pieces from wherever it can find them, checks that the key in your link opens them and that they came from who they claim, and only then keeps them.
5. **Done when:** The content opens and appears in your saved items.
6. **If it fails:** Make sure you copied the whole link and that at least one server holding the content is online. If a server sends back something faked or broken, Meerkat skips it and takes nothing from it.

### Send an item from another app

1. **Where:** In another iOS app, open its Share sheet and choose Meerkat. Then return to `Meerkat > Share Inbox`.
2. **What you will see:** `Shared with Meerkat` and a staged item with destinations for a community, channel, person, or Library.
3. **What to click or type:** Choose the exact destination and confirm the send or promote action.
4. **What happens next:** The item sits on your phone and goes nowhere until you actually send it.
5. **Done when:** The inbox shows `Sent` only after the real message exists, or the item appears in My Library after promotion.
6. **If it fails:** Leave the item where it is and try again. Waiting to be sent never means sent.

## 8. Use My Library

1. **Where:** Open `Meerkat > Me > My Library`.
2. **What you will see:** `My Library`, your collections, buttons to make new ones, and everything you have saved. It works even if you have no groups at all.
3. **What to click or type:** Make a library, pick what kind it is, add a file from your phone or from the Share Inbox, and type in any details you want to keep with it.
4. **What happens next:** Meerkat locks the file and keeps it on this phone. Photos have their hidden location tag removed first, unless you turn that off.
5. **Done when:** The item appears in the library and opens in the appropriate reader, player, or file action.
6. **If it fails:** Check you have space left and that Meerkat can reach the file. In the cut-down preview version of the app, playing audio or video has to make an unlocked temporary copy first, and the app warns you before it does. The full installed app plays it without ever unlocking the whole file.

Meerkat never guesses about who else has a copy of something. If your phone does not actually know, it says so rather than reassuring you.

## 9. Storage and Backup

1. **Where:** Open `Meerkat > Me > Settings > Storage & Backup`.
2. **What you will see:** `Add destination`, `What goes where`, `Destinations`, `Back up now`, and `Restore from a backup`.
3. **What to click or type:** Add a place to back up to, sign in to it or fill in its address, choose what goes there, save the recovery key somewhere else entirely, then tap `Back up now`.
4. **What happens next:** Meerkat locks the backup, sends it, and then checks it really arrived.
5. **Done when:** The destination shows a successful backup with a real date and time on it.
6. **If it fails:** Read the message from that particular service. Seeing a service in the list does not mean your account details for it are right. Fix the address or the account, try again, and do not rely on the backup until it succeeds.

Before you delete anything, back up and then practice restoring it onto a second device you trust. Meerkat cannot recover your recovery key for you. If you lose it, the backup cannot be opened by anyone, including you.

## 10. Profile, Appearance, and Settings

### Edit your profile and identity

1. **Where:** Open `Meerkat > Me > Edit profile` to change how you look to other people, or `Meerkat > Me > Privacy identity` to see your codes.
2. **What you will see:** Your display name and profile fields. The identity screen also shows your friend code, your safety code, and the long code that stands for your phone's key.
3. **What to click or type:** Change what you want other people to see, and save. Use the identity screen to copy a code or compare one with a friend. Do not post these codes publicly.
4. **What happens next:** Your profile changes are stamped as yours in that group. Your key stays on your phone, and it stays separate from any public name you use.
5. **Done when:** The saved profile renders in the intended community or private surface.
6. **If it fails:** Check your role in the group. If Meerkat cannot confirm a profile picture really came from that person, it shows nothing rather than showing something it cannot vouch for.

### Change appearance

1. **Where:** Open `Meerkat > Me > Appearance`.
2. **What you will see:** `System`, `Light`, `Dark`, and custom theme controls.
3. **What to click or type:** Choose the appearance or open the theme editor and save valid colors.
4. **What happens next:** The colors change on this device only. A group's theme applies inside that group and nowhere else, so the tab bar, Feed, Messages, and your private chats always look the same.
5. **Done when:** The selected appearance persists on this device and text remains readable.
6. **If it fails:** Go back to one of the built-in themes. A broken theme, or one you would not be able to read, is refused.

### Check connection status

1. **Where:** Open `Meerkat > Me > Advanced connection`.
2. **What you will see:** One of five honest states: checking, no connection server, unreachable, the free server is reachable, or your own server is reachable.
3. **What to click or type:** If you need to, type in a connection server address and save it. This box is for an address only. Never put a password or a private code in it.
4. **What happens next:** Meerkat actually contacts the server to see whether it answers, and remembers the result on this device.
5. **Done when:** The card says the server is reachable. That means the server answered. It does not mean any of your friends are online.
6. **If it fails:** Check the address, the server's security certificate, your own internet connection, and whether the server is actually running.

## 11. Public Reading and Participation

Meerkat has a public side as well as a private one. They are two doors into the same app, not two different apps. Whoever owns a group can publish things out of it. Anyone can then read those things with no account, no profile, and nothing following them around. The owner can also hand out an open invitation that turns a reader into a member.

The wall between the two sides is built in, not a setting you could get wrong. When you post publicly, you carry a pass that proves you are allowed to post without saying who you are. Nothing Meerkat stores or sends ever puts your sign-in next to your key, so the two cannot be matched up, not even by Meerkat. Reading the public area tells nobody who you are. Joining a public group puts your name on its member list; it does not hand you the keys to anything private inside it.

Your group can stay completely private, publish a page anyone can read, or open its door to newcomers. None of those choices moves your private content anywhere.

1. **Where:** Open `Meerkat > Public`.
2. **What you will see:** `Public` and `Explore`. An unconfigured build reads `Public accounts are off in this build` or `The public feed is not connected in this build.`
3. **What to click or type:** Read whatever is there. To post yourself, you sign in separately, and that only works when the servers behind the public area are switched on.
4. **What happens next:** Reading stays anonymous. When you post, you carry a pass that proves you are allowed to post without revealing who you signed in as.
5. **Done when:** You can see real published content, or the app tells you plainly which server is missing.
6. **If it fails:** This has nothing to do with your key or your private groups, so do not change those. The public area runs on separate servers. Ask whoever set up your copy of the app whether those servers are running.

## 12. Delete Account or Device Data

- `Delete account` deletes the sign-in you use for the public area and for proving you paid. It does not touch your groups, your messages, or anything on your phone.
- `Delete my data` wipes Meerkat's data off this phone. It cannot reach into other people's phones and delete copies they already have.

Back up first. Read every confirmation screen word for word. These two buttons do completely different things, and that is on purpose.

## Troubleshooting Reference

| Symptom | Meaning | Next action |
|---|---|---|
| `No connection server` | The app has no connection server to use. | Open `Me > Advanced connection`, enter a server address, and wait while it is checked. |
| `Unreachable` | Meerkat tried the server and it did not answer. | Check your internet, the address, the server's security certificate, and whether the server is running. |
| A friend code does not work | The code has expired, has already been used once, or the server that looks codes up is down. | Ask for a fresh code and try again while you are both online. |
| Wi-Fi sync controls are missing | You are on the cut-down preview version of the app. | Install the full app. |
| Automatic connections show nothing moved | No connection actually completed. | Get one of your paired devices online, or run a manual sync. |
| The public feed says it is not connected | This copy of the app has no public servers set up. | Use the private side, or get a copy of the app with those servers configured. |
| The call button does nothing | Calls need the full installed app and a call server, and one of them is missing. | Send a message instead. Do not assume the button will place a call. |
| An item in the Share Inbox never sends | It was never actually sent anywhere. | Pick where it should go and try again while that person or group can be reached. |
| A backup has no date on it | The backup did not finish, or Meerkat could not confirm it arrived. | Fix the destination settings and tap `Back up now` again. |

## Platform Differences

| What it does | Full installed app on iPhone or Android | Cut-down preview app | Web browser |
|---|---|---|---|
| Syncing through a connection server | Yes, when a server is set up and reachable | Yes | Yes |
| Syncing directly over Wi-Fi | Yes | No | No |
| Sending straight to a nearby phone | Only in some builds | No | No |
| Using Bluetooth to wake the app | Only in some builds, and only to wake it. It never carries your data. | No | No |
| Playing video and audio without unlocking the whole file | Yes | No. It makes a temporary unlocked copy and warns you first. | Handled by the browser |
| Sharing into Meerkat from another app | Yes | Depends on the device | Through the browser's file picker |
| Catching up while the app is closed | Only in some builds, and only if you turn it on | Does nothing | Not applicable |

## Evidence Basis

Everything in this guide was checked against the app's actual code at version `493b2549`, together with its full change history from 2026-06-14 to 2026-09-01. That was roughly 1,876 files and 490,395 lines across the phone app, the web app, and the pieces behind them. Those numbers describe how much was built, not how many people use it.

Source entry points include `apps/meerkat/app`, `apps/meerkat/components`, `apps/meerkat-web`, `packages/sync`, `packages/meerkat-relay`, `packages/billing-config`, and the Meerkat-specific package family. Current code outranks this dated guide if they later differ.
