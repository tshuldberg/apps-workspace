// === Story dialogue — Key story beat text ===

export const STORY_TEXT = {
  // === Opening ===
  intro: [
    'Hello there! Welcome to the world of POKeMON!',
    'My name is OAK! People call me the POKeMON PROF!',
    'This world is inhabited by creatures called POKeMON!',
    'For some people, POKeMON are pets. Others use them for fights.',
    'Myself... I study POKeMON as a profession.',
    'First, what is your name?',
  ],
  introRival: [
    'This is my grandson. He\'s been your rival since you were a baby.',
    '...Erm, what is his name again?',
  ],
  introEnd: [
    'Right! So your name is {PLAYER}!',
    '{PLAYER}! Your very own POKeMON legend is about to unfold!',
    'A world of dreams and adventures with POKeMON awaits! Let\'s go!',
  ],

  // === Starter Selection ===
  oakLabFirst: [
    'OAK: Ah, {PLAYER}! How nice to see you!',
    'I have a POKeMON for you. Choose one!',
  ],
  starterBulbasaur: [
    'So! You want the plant POKeMON, BULBASAUR?',
  ],
  starterCharmander: [
    'So! You want the fire POKeMON, CHARMANDER?',
  ],
  starterSquirtle: [
    'So! You want the water POKeMON, SQUIRTLE?',
  ],
  rivalPicksStarter: [
    '{RIVAL}: I\'ll take this one then!',
    'Heh, my POKeMON is stronger than yours!',
  ],

  // === First Rival Battle ===
  firstRivalBattleIntro: [
    '{RIVAL}: Wait, {PLAYER}! Let\'s check out our POKeMON!',
    'Come on, I\'ll take you on!',
  ],
  firstRivalBattleWin: [
    '{RIVAL}: WHAT? Unbelievable!',
    'I picked the wrong POKeMON!',
  ],
  firstRivalBattleLoss: [
    '{RIVAL}: Yeah! Am I great or what?',
  ],

  // === Oak's Parcel ===
  oaksParcelReceive: [
    'MART CLERK: Hey! You came from PALLET TOWN?',
    'You know Prof. OAK, right?',
    'His order came in. Can you take it to him?',
    '{PLAYER} received OAK\'S PARCEL!',
  ],
  oaksParcelDeliver: [
    'OAK: Ah! That\'s my PARCEL! Thank you!',
    'Now, I have something for both of you.',
    'Here, take these POKeDEXES!',
    'It\'s a high-tech encyclopedia! It automatically records data on POKeMON you\'ve seen or caught!',
    'To make a complete guide on all the POKeMON in the world... That was my dream!',
    'But, I\'m too old! I can\'t do it!',
    'So, I want you two to fulfill my dream for me!',
    'Get moving, you two! This is a great undertaking in POKeMON research!',
  ],

  // === Rival Encounters ===
  rivalRoute22: [
    '{RIVAL}: Hey! {PLAYER}!',
    'You\'re going to the POKeMON LEAGUE? Forget it!',
    'You probably don\'t have any badges!',
    'I do! Here, let me show you what a real trainer looks like!',
  ],
  rivalCerulean: [
    '{RIVAL}: Hey, {PLAYER}!',
    'You\'re still struggling along?',
    'I\'ve already caught {COUNT} kinds of POKeMON!',
    'Different kinds are found in different places!',
  ],
  rivalSSAnne: [
    '{RIVAL}: Bonjour! {PLAYER}!',
    'Imagine seeing you here!',
    '{PLAYER}, were you really invited?',
    'So how are your POKeMON? Mine are doing great!',
    'Let me see if you\'ve gotten any better!',
  ],
  rivalPokemonTower: [
    '{RIVAL}: What? What are you doing here?',
    'I heard there was a rare POKeMON here. I already caught it!',
    'What? You don\'t have the SILPH SCOPE?',
    'Ha! You can\'t even identify the ghosts!',
    'Don\'t bother me! Go somewhere else!',
  ],
  rivalSilphCo: [
    '{RIVAL}: What? {PLAYER}! What are you doing here?',
    'You\'re not going to save SILPH CO.? Hmph!',
    'I came here to battle TEAM ROCKET!',
    'But since you\'re here, let\'s battle first!',
  ],
  rivalRoute22Final: [
    '{RIVAL}: Hey! {PLAYER}!',
    'So you\'re going to the POKeMON LEAGUE?',
    'You collected all 8 badges?',
    'That\'s cool! Then I guess I better get going, too!',
    'But first, let me see how strong you are!',
  ],
  championBattle: [
    '{RIVAL}: So, you finally made it here!',
    'I\'m the POKeMON LEAGUE CHAMPION!',
    'I knew I\'d be the one to beat the ELITE FOUR!',
    '{PLAYER}! You want to challenge me? Fine!',
    'I\'ll show you the power of a real champion!',
  ],

  // === Team Rocket ===
  rocketGameCorner: [
    'Hey! Don\'t touch that poster!',
    'There\'s nothing behind it! Get lost, kid!',
  ],
  rocketGiovanniHideout: [
    'GIOVANNI: So! You have come this far!',
    'I am the LEADER of TEAM ROCKET!',
    'POKEMON are merely tools for our use!',
    'If you interfere, I will crush you!',
  ],
  rocketGiovanniDefeat: [
    'GIOVANNI: Blast! You beat me!',
    'Very well! I will leave this place!',
    'But mark my words: TEAM ROCKET will rise again!',
  ],
  rocketSilphCo: [
    'GIOVANNI: I see you have beaten my subordinates.',
    'But I will not be defeated so easily!',
    'The MASTER BALL project is our crowning achievement!',
  ],
  rocketSilphCoDefeat: [
    'GIOVANNI: ...I see. I have underestimated you.',
    'Fine. I shall disband TEAM ROCKET!',
    '...But I wonder... Will TEAM ROCKET truly disappear?',
    'I will go train my own POKeMON. Until we meet again!',
  ],

  // === Gym Leaders ===
  brockPreBattle: [
    'BROCK: So you\'re here! I\'m BROCK!',
    'I\'m PEWTER\'s GYM LEADER!',
    'My rock-hard willpower is evident in my POKeMON!',
    'Come and fight me, kid!',
  ],
  brockDefeat: [
    'BROCK: I took you for granted.',
    'As proof of your victory, here\'s the BOULDERBADGE!',
    'That badge will make your POKeMON more powerful!',
    'Here, take this TM too! It contains BIDE!',
  ],

  mistyPreBattle: [
    'MISTY: So, you\'re a new challenger?',
    'I\'m MISTY, the GYM LEADER of CERULEAN!',
    'My strategy is an all-out offensive with WATER-type POKeMON!',
  ],
  mistyDefeat: [
    'MISTY: Wow! You\'re too much!',
    'Alright! You can have the CASCADEBADGE!',
    'And take this TM for BUBBLEBEAM!',
  ],

  surgePreBattle: [
    'LT. SURGE: Hey, kid! What do you think you\'re doing here?',
    'You won\'t live long in combat! Not with your puny power!',
    'I tell you, ELECTRIC POKeMON saved me during the war!',
  ],
  surgeDefeat: [
    'LT. SURGE: Whoa! You\'re the real deal, kid!',
    'Fine then, take the THUNDERBADGE!',
    'And this TM for THUNDERBOLT — use it well!',
  ],

  erikaPreBattle: [
    'ERIKA: Hello... Lovely weather, isn\'t it?',
    'Oh, I\'m sorry, I must have dozed off.',
    'Welcome! My POKeMON are of the GRASS type!',
  ],
  erikaDefeat: [
    'ERIKA: Oh! I concede defeat.',
    'You are remarkably strong.',
    'Here, take the RAINBOWBADGE.',
    'And this TM for MEGA DRAIN.',
  ],

  kogaPreBattle: [
    'KOGA: Fwahahaha!',
    'A mere child dares to challenge me?',
    'I shall show you true terror as a ninja master!',
  ],
  kogaDefeat: [
    'KOGA: Humph! You have proven your worth!',
    'Here is the SOULBADGE!',
    'And this TM for TOXIC — the deadliest poison move!',
  ],

  sabrinaPreBattle: [
    'SABRINA: I had a vision of your arrival.',
    'I have had psychic powers since I was a child.',
    'I dislike fighting, but if you wish, I will show you my powers!',
  ],
  sabrinaDefeat: [
    'SABRINA: Your power... It exceeds what I foresaw.',
    'Here, the MARSHBADGE is yours.',
    'And take TM46 — PSYWAVE!',
  ],

  blainePreBattle: [
    'BLAINE: Hah! I am BLAINE!',
    'The GYM LEADER of CINNABAR ISLAND!',
    'My fiery POKeMON are ready to burn!',
  ],
  blaineDefeat: [
    'BLAINE: I have burned out!',
    'You have earned the VOLCANOBADGE!',
    'And take TM38 — FIRE BLAST!',
  ],

  giovanniGymPreBattle: [
    'GIOVANNI: I knew you would come eventually.',
    'I am the GYM LEADER of VIRIDIAN CITY!',
    'For your final badge, you will face the strongest GROUND type trainer!',
  ],
  giovanniGymDefeat: [
    'GIOVANNI: Ha! That was a truly intense fight!',
    'You have earned the EARTHBADGE!',
    'Having been Pokemon Champion now, I shall no longer be involved with TEAM ROCKET.',
    'I plan to dedicate my skills to the study of Pokemon!',
  ],

  // === Elite Four ===
  loreleiPreBattle: [
    'LORELEI: Welcome to the POKeMON LEAGUE!',
    'I am LORELEI of the ELITE FOUR!',
    'No one can best my icy POKeMON! Freeze in your tracks!',
  ],
  loreleiDefeat: [
    'LORELEI: Things shouldn\'t be this way!',
    'You... You\'re better than I thought.',
    'Go on ahead. You\'ve earned it.',
  ],

  brunoPreBattle: [
    'BRUNO: I am BRUNO of the ELITE FOUR!',
    'Through rigorous training, people and POKeMON can become stronger!',
    'We will grind you down with our superior power! Hoo hah!',
  ],
  brunoDefeat: [
    'BRUNO: Why? How could I lose?',
    'My fighting POKeMON lost?',
    'Go! The next one is even stronger!',
  ],

  agathaPreBattle: [
    'AGATHA: I am AGATHA of the ELITE FOUR!',
    'OAK and I were once rivals! He chose to study POKeMON.',
    'I\'ll show you how a real trainer battles!',
  ],
  agathaDefeat: [
    'AGATHA: Oh ho! You\'re something special, child!',
    'But the next trainer is the true test!',
    'Good luck!',
  ],

  lancePreBattle: [
    'LANCE: I\'ve been waiting for you!',
    'I am the last of the ELITE FOUR!',
    'I am the dragon master, LANCE!',
    'You still need more discipline if you want to beat the CHAMPION!',
    'Come! Let me test you!',
  ],
  lanceDefeat: [
    'LANCE: I still can\'t believe my dragons lost to you!',
    'You are truly a Pokemon Master!',
    'But the battle isn\'t over yet!',
    'There is one more trainer you must face!',
    'He beat the ELITE FOUR before you!',
    'His name? I believe you know him...',
  ],

  // === Hall of Fame ===
  hallOfFame: [
    'OAK: {PLAYER}! Congratulations!',
    'You and your POKeMON are hall of famers!',
    'You have beaten the ELITE FOUR and the CHAMPION!',
    'Your POKeMON will be recorded in the HALL OF FAME!',
    'This is the greatest honor a POKeMON TRAINER can achieve!',
    'Well done! Enjoy the rest of your adventure!',
  ],
} as const;
