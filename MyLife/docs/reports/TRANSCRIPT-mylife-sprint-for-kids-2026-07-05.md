# The Big Four-Day Build: A Conversation

*A transcript that explains everything we built from July 2 to July 5, 2026, and why we built it. Written so a 10-year-old can follow along. One kid (Q) asks questions, one builder (A) answers.*

---

## Part 1: The big picture

**Q: What even is this whole project?**

A: It is called MyLife. Think of it as one giant toolbox of apps that one person builds. Inside the toolbox there are little apps for tracking books you read, your mood, your plants, your workouts, and bigger apps too: a private chat network called Meerkat, a cooking contest app called BestChef, a gym coach app called DoWork, and a newspaper app called MyNews. The big rule for all of them: they never lie to you. If something did not really send, the app must not say "Sent."

**Q: What happened in these four days?**

A: We wrote 234 batches of changes (each batch is called a "commit," like saving your game with a note about what you did). That added about 188,000 new lines of instructions for the computer. We also wrote 240 new files of tests. Tests are little robot checkers that try the app automatically and yell if something breaks.

**Q: Why so fast?**

A: Because we ran several builder teams at the same time, each working on a different app, like four groups building different LEGO sets at different tables. At the end we carried all the sets to one big table (that is called "merging") and checked that they still fit together.

---

## Part 2: Meerkat, the private clubhouse network

**Q: What is Meerkat?**

A: Imagine a clubhouse app like Discord, but private. Nobody's messages sit on a big company's computer where the company can read them. Instead, your phone and your friends' phones pass sealed envelopes to each other. Even the "post office" computer that helps carry envelopes (we call it a relay) cannot open them. It just sees locked boxes.

**Q: What did you build for it this week?**

A: A lot. Let me go through it.

**1. Private messages, finally.** Meerkat could do group chats in a clubhouse, but not one-on-one private notes. That was like a school where you can talk in class but never pass a note to one friend. We built real private messages: one-on-one and small private groups. Every note is sealed so only the right person can open it.

**2. Honest checkmarks.** In many apps the checkmark says "delivered" even when the app is just guessing. We made the checkmark honest: it only turns on when the other phone sends back a signed proof, like a receipt with a signature that cannot be faked.

**3. Changing the locks when someone leaves a group.** If you kick someone out of a group note-passing circle, they should not be able to read the NEW notes. So when someone leaves, we hand out a brand-new secret code to everyone still in the group. We even wrote a test with three pretend phones that proves the removed phone cannot read anything new.

**4. Delete-for-everyone, safely.** You can erase your own message from everyone's phone. But ONLY your own. We put in two separate guards that both check "is the person deleting this the person who wrote it?" so nobody can erase someone else's words.

**5. Really kicking someone out of a clubhouse.** Before this week, the "remove member" button did not truly work all the way down. That is against our honesty rule. Now the clubhouse owner signs a removal order (a signature made of math that nobody can forge), everyone's phones see it, and the locks change.

**6. Making the chat feel nice.** The chat worked, but it looked like a science experiment. We rebuilt it to feel like the chat apps you know: message bubbles, emoji reactions, replying to a message, @mentioning a friend, and new messages appearing on their own instead of you pressing a Refresh button like it is 2009.

**7. Making it easy to join.** Joining a clubhouse used to mean copying and pasting a long weird code. Now a friend sends you a link or shows you a QR code, you scan it, you see a little preview card of the clubhouse, and you tap Join. One step instead of a scavenger hunt.

**8. Making the feed about the actual posts.** The home feed used to spend most of its space explaining HOW it works instead of showing you posts. That is like a TV that mostly shows you its own wiring diagram. Now it shows posts, pictures, reply counts, and real profile photos. The explanations moved behind a little info button.

**9. Link previews that protect you.** When someone shares a link, the SENDER's phone fetches the little preview picture and title, then sends the preview along with the link. Your phone never visits the website just because someone sent it to you. That way nobody can trick your phone into knocking on a stranger's door.

**10. Armor for the helper computers.** The volunteer "community node" computers that help store clubhouse stuff got armor: limits on how big a request can be and how much junk a stranger can stuff into them, so a prankster cannot fill them up like cramming a mailbox with pizza flyers.

**11. A "prove you are a person" gate.** For public spaces we added a humanity check. And it fails closed. That means: if the check cannot run, the door stays shut. A broken lock should be a locked door, not an open one.

**12. Letting a clubhouse choose how its data travels.** A clubhouse can now say "our stuff only travels over local Wi-Fi, never the internet," and the app obeys everywhere, even refusing updates that arrive the wrong way.

**13. Auto-connect.** Phones now find each other and sync on their own, with polite retry timers, instead of waiting for you to press a button.

**14. Turning a clubhouse into a private Netflix.** This one is big. Every clubhouse is already a locked storage box, so we built shelves for it: you can put your family videos, music, and photos in, and members can browse and play them, like your own private Netflix plus Spotify plus photo album. Every file gets its own tiny lock, and that tiny lock is itself locked with the clubhouse key. Playing a video happens through a tiny pretend web server that lives INSIDE the app on your phone, so the video never leaves the sealed world. We also added photo timelines, offline maps you download ahead of time (checked piece by piece so a corrupted download gets rejected), and themes so every clubhouse can look different.

**Q: Did the inspectors find anything wrong with all that?**

A: Yes, a few things, and that is exactly why we inspect. The biggest one: if the "you are removed" letter reaches a phone through the backup gossip path instead of the normal mailbox, that phone updates the clubhouse card but forgets to cross the removed person off its own member list. The removed person still cannot read new secrets (the locks changed), but the list is wrong, and wrong lists cause trouble later. Also, one helper computer saves a tiny progress note to disk in a way that could get torn in half if the power dies at the exact wrong moment. Both go on the fix-it list.

---

## Part 3: BestChef, the cooking contest app

**Q: What is BestChef?**

A: A cooking competition in your pocket. People cook a dish, film it, upload it, and others vote for the best one. The plan is to launch it around the world in at least 7 languages.

**Q: What did you build?**

A: The theme of the week was: make it work for the whole planet, and make cheating impossible.

**1. Teaching the app 21 languages.** Almost a thousand phrases, translated into 21 language files, including the boring but super important legal text. We also made the computer send error CODES instead of English sentences, so your phone can show the error in YOUR language. Before, a French user could get scolded in English by the server.

**2. Getting the details of language right.** Different languages have different rules. Arabic and Hebrew read right-to-left, so arrows and icons have to mirror. Polish and Russian have special counting rules (one thing, few things, many things are different words). We wired in the official rules for all of that, plus local time formats, and even emoji suggestions that understand dish names in many languages.

**3. Dish names in your language.** A dish can now carry translations, and search finds it in your language. Before, the app broke if a dish name was not written in English-style letters. Imagine a cooking app where you cannot type your own food's real name. Fixed.

**4. A referee desk.** We built a whole separate app for human moderators: they see reported videos, decide on appeals, approve winners' proof photos, and promote good videos into the public feed. If a moderator wrongly removes something and the appeal wins, the video goes back up automatically.

**5. Anti-cheating armor.** Voting contests attract cheaters like picnics attract ants. We added: limits on how many actions one person can do (quotas), a permanent fingerprint list of every vote-proof photo so you cannot delete your vote and vote again with the same photo, and blocks that are enforced by the server, not just hidden on your phone.

**6. Uploads that survive bad Wi-Fi.** Your cooking video now goes into a sturdy waiting line on the phone. Tunnel? Elevator? Phone died? The upload continues later. A cleanup robot also deletes leftover files so storage does not fill up with junk.

**7. The law stuff.** Different countries have different rules about age and about appealing when your content is removed. We wrote per-country age gates and a proper appeal flow.

**8. Fun stuff too.** Comments on videos, bookmarks that follow you across devices, and confetti "trophy moments" when you win.

**Q: Any problems found?**

A: Two honest ones. First, the robot judge that screens vote photos is still a PRETEND judge, a stand-in with fake scores, because the real photo-checking service is not connected yet. Everyone knows, it is written on the fix-it list in capital letters, and the contest must not open to the public until the real judge is hired. Second, if two copies of the checking robot wake up at the same time, they can both grab the same photo and both stamp it. The stamping desk needs a "take a number" system.

---

## Part 4: DoWork, the gym coach app

**Q: What is DoWork?**

A: An app built around one real personal trainer. He films exercise videos, students subscribe to watch them, he coaches each student privately, and you control the video with your voice while you work out, because your hands are busy holding weights.

**Q: What got built?**

A: The whole trainer side of the app, basically.

**1. The trainer's studio.** The trainer gets a profile page, a place to upload and manage his videos, and QR invite codes he can hand to people to make them his students.

**2. Private coaching.** A student films themselves doing an exercise and sends it. The trainer watches and replies with feedback pinned to exact seconds of the video: "at 0:32 your back is bending." Like a teacher writing notes in the margin of your homework.

**3. Voice control.** Say "pause," "next," or "repeat" mid-exercise and the player obeys. The listening happens ON the phone. Your voice is not shipped off to some company's computer.

**4. Real payments.** Subscriptions go through the app store's real cash register. And here is the honesty rule again: after a purchase, the app asks OUR server "is this person really subscribed?" and only trusts that answer. The phone's word alone is not enough, because phones can be tricked.

**5. Downloads with a permission recheck.** You can save videos for offline use at the gym basement with no signal. But when you download AND when you open, the app checks you are still allowed. Cancel your subscription and the videos politely delete themselves.

**6. A pile of honesty fixes.** Raw computer error messages no longer reach humans (they get translated into friendly sentences). Fake GPS was replaced with the phone's real location. And we discovered the app had NO login screen reachable from anywhere. The door existed but there was no hallway to it. We built the hallway.

**7. Turning on the real backend.** The actual production server was set up and verified live: the database, six little server programs, notification hooks, and a demo trainer account with real videos.

**Q: Did the inspectors catch anything?**

A: One good one. When you share a workout or send feedback and the server says NO (for example, your coaching link ended), the app was taught to treat every failure like a bad-Wi-Fi problem: it says "Saved offline, will retry!" But some failures are not Wi-Fi. Some are the server genuinely refusing. Retrying will never help, and after enough retries the app quietly throws the message away. So the user was told "saved" about a thing that will never arrive. That is a lie by accident. It is now on the fix-it list, near the top.

---

## Part 5: MyNews, the newspaper app

**Q: What is MyNews?**

A: A news app where reporters publish articles and volunteer editors help improve them, like Wikipedia manners meeting a newspaper. Readers can support reporters directly with tiny payments, and there are no ads.

**Q: What got built?**

A: The whole first version, in three stages.

**1. The foundation.** MyNews became the 41st mini-app in the toolbox, with its own database tables and its own math engines: one that compares two versions of a text and finds the exact differences, one that scores an editor's trustworthiness, and one that splits payments fairly.

**2. Wax-seal publishing.** Every article is signed with the reporter's secret key, like a wax seal on a letter. The server checks the seal BEFORE saving anything. So even the server cannot forge an article in your name. Reading works too: a nice reader screen, reporter pages, and an old-fashioned RSS feed.

**3. The editing desk.** An editor cannot change your article. They can only SUGGEST a change: "in paragraph two, change X to Y, and here is my source." The reporter sees suggestions side by side and accepts, rejects, or counter-edits each one. Only the author can accept. Good suggestions earn the editor credibility points. Newsrooms let teams work on drafts together with embargo labels ("secret until Friday").

**Q: Problems?**

A: One worth telling. Creating a newsroom does two saves in a row: first the room, then adding you as its owner. If the first save works and the second one fails, you get a ghost newsroom: it exists, but it belongs to nobody and you cannot see it. The fix is to make both saves happen together or not at all, which databases know how to do. We wrote it on the fix-it list before the real server gets turned on.

---

## Part 6: The website, the big merge, and the inspections

**Q: What happened with the website?**

A: The MyLife website learned to behave like a phone app: you can install it on your home screen, the layout respects the phone notch, and the Today dashboard got smarter. We also deleted a whole feature that was showing made-up people and made-up likes in the workouts social tab. Fake friends are against the rules. Better an honest empty room than a fake party.

**Q: What is a "merge landing"?**

A: Remember the four LEGO tables? Twice this week we carried everything onto the main table. Each time, before gluing anything, we ran the full robot checker army. And the checkers caught three real bugs that no single table could see: a counter that said 40 mini-apps when there were now 41, a settings file that a hiding rule had accidentally made invisible, and an upload waiting line that could shuffle two items uploaded in the same millisecond. All three fixed before landing. That is why we never merge blind.

**Q: And then you inspected everything?**

A: Right. Three layers of inspection. First, a harsh "would we let real customers use this TODAY?" review of all 8 products. The answer was zero out of eight, mostly because the money and legal plumbing is not connected yet, not because the code lies. Second, a deep world-launch inspection of BestChef that found real blockers, like demo food data that could show a fake "Organic Milk" to real users. Third, this sprint's code audit: we hired a second, completely different AI to read the four days of code with fresh eyes, it wrote up everything suspicious, and then we personally re-checked every serious claim against the code before believing it. Two different brains catch more than one.

**Q: Why do you write down your own mistakes?**

A: We keep a notebook called the errors log. Every real bug goes in with the date, where it lives, and whether it is fixed. Hiding mistakes makes software rot. Writing them down makes them chores. This week we added five new entries from the audit, and none of them get to hide.

**Q: So, in one sentence, what were the four days about?**

A: We took four apps that had strong engines and gave them the rest of their bodies, honestly: private messages that do not lie about delivery, a cooking contest that speaks 21 languages and resists cheaters, a gym coach that takes real money and real voice commands, a newspaper with unforgeable wax seals, and then we let inspectors hunt for every flaw and wrote every flaw down.

*The end. The grown-up version of this walkthrough, with file names and severities, lives at `REPORT-mylife-sprint-audit-2026-07-05.html`.*
