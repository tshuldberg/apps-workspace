/**
 * Screening lexicons (plan 48 WP8). Data, not code: every class is a list of
 * entries, and expanding coverage is a data edit that needs no engine change.
 *
 * Two entry shapes:
 *   terms         any listed term or pattern firing is evidence on its own.
 *   cooccurrence  evidence only when BOTH groups fire, for classes where a
 *                 single word is meaningless in isolation. A minor-age word is
 *                 not a signal; a minor-age word next to sexual solicitation
 *                 is. Same for a phone number versus a phone number attached
 *                 to "everyone go visit him".
 *
 * A small number of hate-class terms are stored base64 so this source file is
 * not itself a readable slur list. `encoded: true` marks them; the compiler
 * decodes once at module load. This is presentation only: the decoded terms are
 * matched exactly like the plaintext ones.
 *
 * Operational note: this is a starting corpus sized for correctness of the
 * mechanism, and `ScreeningConfig` carries no lexicon override on purpose so
 * additions land here, reviewed, with a fixture. Lexicon expansion is a
 * standing moderation-ops task, not a code-shape change.
 */

import type { ScreeningClass } from './types';

export interface LexiconTermEntry {
  type: 'terms';
  code: string;
  weight: number;
  explain: string;
  /** Lowercase phrases, matched on word boundaries. */
  terms: readonly string[];
  /** Raw regex sources, matched against the normalized and folded views. */
  patterns?: readonly string[];
  /** True when `terms` are base64-encoded in this file. */
  encoded?: boolean;
}

export interface LexiconCooccurrenceEntry {
  type: 'cooccurrence';
  code: string;
  weight: number;
  explain: string;
  groupA: readonly string[];
  groupB: readonly string[];
  patternsA?: readonly string[];
  patternsB?: readonly string[];
  encodedA?: boolean;
  encodedB?: boolean;
}

export type LexiconEntry = LexiconTermEntry | LexiconCooccurrenceEntry;

/**
 * base64 of the encoded entries below, decoded at compile time. Node, Deno,
 * Hermes, and browsers all provide atob; Buffer is used when it does not exist.
 */
export function decodeTerm(encoded: string): string {
  if (typeof atob === 'function') return atob(encoded);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeBuffer = (globalThis as any).Buffer;
  if (nodeBuffer) return nodeBuffer.from(encoded, 'base64').toString('utf8');
  throw new Error('mynews screening: no base64 decoder available');
}

const SPAM: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'spam.promotional-pitch',
    weight: 0.25,
    explain: 'Uses common bulk-promotional phrasing.',
    terms: [
      'buy now',
      'act now',
      'limited time offer',
      'click here now',
      'order today',
      'best prices',
      'cheap price',
      'discount code',
      'promo code',
      'special promotion',
      'free trial',
      'risk free',
      'no obligation',
      'satisfaction guaranteed',
      'money back guarantee',
      'call now',
      'subscribe now',
      'visit my website',
      'check out my profile',
      'dm me for',
      'whatsapp me',
      'telegram me',
    ],
  },
  {
    type: 'terms',
    code: 'spam.earnings-claim',
    weight: 0.35,
    explain: 'Makes an unsolicited earnings or income claim.',
    terms: [
      'work from home',
      'make money fast',
      'earn money online',
      'passive income',
      'financial freedom',
      'be your own boss',
      'extra cash',
      'get rich',
      'double your money',
    ],
    patterns: [
      // "earn $500 a day", "make 2000 usd per week"
      '(?:earn|make|makes|making)\\s+(?:up to\\s+)?[$€£]?\\s?\\d{2,6}(?:[.,]\\d{3})*\\s*(?:usd|eur|gbp|dollars?|euros?)?\\s*(?:a|per|each|every)\\s*(?:day|week|month|hour)',
    ],
  },
  {
    type: 'terms',
    code: 'spam.seo-boilerplate',
    weight: 0.3,
    explain: 'Contains link-farm and SEO boilerplate phrasing.',
    terms: [
      'guest post',
      'backlinks',
      'seo services',
      'increase your traffic',
      'rank higher on google',
      'buy followers',
      'boost your followers',
      'cheap essay',
      'write my essay',
      'homework help service',
    ],
  },
  {
    type: 'terms',
    code: 'spam.adult-solicitation',
    weight: 0.35,
    explain: 'Solicits paid adult content or contact.',
    terms: [
      'onlyfans',
      'camgirl',
      'live cams',
      'hot singles',
      'sexy singles in your area',
      'adult dating site',
      'escort service',
    ],
  },
];

const FRAUD_SCAM: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'fraud.credential-harvest',
    weight: 0.7,
    explain: 'Asks for wallet recovery phrases, private keys, or account credentials.',
    terms: [
      'seed phrase',
      'recovery phrase',
      'private key',
      'wallet passphrase',
      'send your password',
      'verify your password',
      'confirm your password',
      'enter your credentials',
      'your account will be suspended',
      'unusual sign in activity',
      'verify your identity to unlock',
      'two factor code',
      'send the code you received',
      'one time code',
    ],
  },
  {
    type: 'terms',
    code: 'fraud.advance-fee',
    weight: 0.6,
    explain: 'Advance-fee and inheritance-scam phrasing.',
    terms: [
      'unclaimed inheritance',
      'next of kin',
      'transfer of funds',
      'processing fee required',
      'release your funds',
      'nigerian prince',
      'lottery winner notification',
      'you have won',
      'claim your prize',
      'wire transfer immediately',
      'western union payment',
      'gift card payment',
      'pay with gift cards',
      'bitcoin payment only',
    ],
  },
  {
    type: 'terms',
    code: 'fraud.investment-guarantee',
    weight: 0.5,
    explain: 'Guarantees investment returns, which no legitimate offer does.',
    terms: [
      'guaranteed returns',
      'guaranteed profit',
      'risk free investment',
      'double your bitcoin',
      'crypto giveaway',
      'airdrop claim',
      'send 1 eth receive',
      'signal group profits',
      'binary options',
      'forex signals',
      'pump and dump',
      'insider tip',
    ],
    patterns: [
      // "500% returns", "10x guaranteed"
      '\\d{2,4}\\s?%\\s?(?:roi|returns?|profits?|gains?)',
      '\\d{1,3}\\s?x\\s?(?:guaranteed|returns?|profits?)',
    ],
  },
  {
    type: 'terms',
    code: 'fraud.impersonated-support',
    weight: 0.5,
    explain: 'Impersonates a support or security team to create urgency.',
    terms: [
      'official support team',
      'account security team',
      'contact our support agent',
      'live support agent whatsapp',
      'recovery expert',
      'recover your lost funds',
      'refund department',
    ],
  },
];

const HATE: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'hate.slur',
    weight: 0.65,
    explain: 'Contains a term used as an ethnic, racial, religious, or anti-LGBTQ slur.',
    encoded: true,
    terms: [
      // Stored base64 so this file is not a readable slur list. The decoded
      // strings are ordinary lowercase terms matched on word boundaries.
      'a2lrZQ==',
      'c3Bpaw==',
      'Y2hpbms=',
      'Z29vaw==',
      'd2V0YmFjaw==',
      'YmVhbmVy',
      'Y29vbg==',
      'ZmFnZ290',
      'dHJhbm55',
      'cmFnaGVhZA==',
      'c2hlbWFsZQ==',
      'aGFsZiBicmVlZA==',
    ],
  },
  {
    type: 'terms',
    code: 'hate.slur-contested',
    weight: 0.4,
    explain:
      'Contains a term that is a slur in most uses but is also reclaimed by some communities and routinely quoted in reporting. Scored lower so a news report about the word is not treated like an attack.',
    encoded: true,
    terms: [
      'ZHlrZQ==',
      'Z3lwc3k=',
      'cmV0YXJk',
      'cmV0YXJkZWQ=',
      'cXVlZXI=',
    ],
  },
  {
    type: 'cooccurrence',
    code: 'hate.dehumanizing-generalization',
    weight: 0.6,
    explain:
      'Applies a dehumanizing predicate to a protected group rather than to an individual or an argument.',
    groupA: [
      'muslims',
      'jews',
      'christians',
      'hindus',
      'immigrants',
      'migrants',
      'refugees',
      'blacks',
      'asians',
      'arabs',
      'latinos',
      'mexicans',
      'gays',
      'lesbians',
      'trans people',
      'transgender people',
      'women',
      'men',
      'disabled people',
    ],
    groupB: [
      'are vermin',
      'are animals',
      'are subhuman',
      'are parasites',
      'are a disease',
      'are cockroaches',
      'should be exterminated',
      'should be wiped out',
      'do not deserve to live',
      'need to be removed',
      'are all criminals',
      'are all rapists',
      'should be deported',
      'should be banned from existing',
    ],
  },
  {
    type: 'terms',
    code: 'hate.extremist-endorsement',
    weight: 0.5,
    explain: 'Endorses genocidal or extremist violence.',
    terms: [
      'gas the',
      'heil hitler',
      'white power',
      'race war now',
      'ethnic cleansing is',
      'day of the rope',
      'the great replacement',
      'blood and soil',
    ],
  },
];

const THREATS: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'threats.explicit-violence',
    weight: 0.65,
    explain: 'Contains an explicit statement of intent to harm a person.',
    terms: [
      'i will kill you',
      'i am going to kill you',
      'i will find you and',
      'i will hurt you',
      'i will beat you',
      'you are a dead man',
      'you will not survive',
      'i know where you live',
      'i know where you sleep',
      'watch your back',
      'i will burn your house',
      'i hope you get shot',
      'someone should shoot',
      'you deserve to be beaten',
    ],
    patterns: [
      'i (?:will|am going to|gonna) (?:kill|shoot|stab|strangle|beat|rape|hurt|maim) (?:you|him|her|them|your)',
    ],
  },
  {
    type: 'cooccurrence',
    code: 'threats.targeted-incitement',
    weight: 0.6,
    explain: 'Incites others to violence against a named target.',
    groupA: [
      'go get him',
      'go get her',
      'go get them',
      'lets pay him a visit',
      'lets pay her a visit',
      'someone needs to teach',
      'handle this yourself',
      'do something about him',
      'do something about her',
    ],
    groupB: [
      'with a bat',
      'with a gun',
      'with a knife',
      'break his legs',
      'break her legs',
      'make him bleed',
      'make her bleed',
      'burn it down',
      'end him',
      'end her',
    ],
  },
  {
    type: 'terms',
    code: 'threats.mass-violence',
    weight: 0.7,
    explain: 'References planning or celebrating mass violence.',
    terms: [
      'shoot up the school',
      'shoot up the office',
      'bomb the building',
      'plant a bomb',
      'blow up the',
      'body count will be',
      'my manifesto',
    ],
  },
];

const SELF_HARM: readonly LexiconEntry[] = [
  {
    type: 'terms',
    code: 'self-harm.encouragement',
    weight: 0.6,
    explain: 'Encourages another person to end their life or harm themselves.',
    terms: [
      'kill yourself',
      'kys',
      'go die',
      'you should end it',
      'end your life',
      'nobody would miss you',
      'do the world a favor and die',
      'hang yourself',
      'drink bleach',
      'slit your wrists',
    ],
  },
  {
    type: 'terms',
    code: 'self-harm.method-instruction',
    weight: 0.6,
    explain: 'Describes methods or dosages for suicide or self-injury.',
    terms: [
      'painless way to die',
      'how much to overdose',
      'lethal dose of',
      'best way to kill myself',
      'how to hang myself',
      'exit bag',
      'suicide method',
      'pro ana',
      'thinspo',
      'how to hide cutting',
    ],
  },
  {
    type: 'terms',
    code: 'self-harm.first-person-crisis',
    weight: 0.45,
    explain:
      'Reads as a first-person crisis disclosure. Routed to a person so support resources can be offered rather than an automated refusal.',
    terms: [
      'i want to kill myself',
      'i am going to kill myself',
      'i want to die',
      'i am going to end it tonight',
      'i have a plan to die',
      'i cannot go on anymore',
      'goodbye cruel world',
      'this is my last post',
    ],
  },
];

const DOXXING_PRIVACY: readonly LexiconEntry[] = [
  {
    type: 'cooccurrence',
    code: 'doxxing.personal-details-with-targeting',
    weight: 0.65,
    explain:
      'Publishes personal contact or location details alongside phrasing that directs attention at that person.',
    groupA: [
      'here is his address',
      'here is her address',
      'here is their address',
      'his home address',
      'her home address',
      'their home address',
      'his phone number',
      'her phone number',
      'his real name is',
      'her real name is',
      'he works at',
      'she works at',
      'his employer is',
      'her employer is',
      'his kids go to',
      'her kids go to',
    ],
    patternsA: [
      // US-style street address, generic street suffixes.
      '\\b\\d{1,5}\\s+(?:[a-z]+\\s){1,3}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way)\\b',
      // Phone-shaped runs, international and US forms.
      '\\+?\\d{1,3}[\\s.-]?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b',
    ],
    groupB: [
      'go say hi',
      'pay him a visit',
      'pay her a visit',
      'let him know what you think',
      'let her know what you think',
      'everyone should call',
      'everyone should email',
      'flood his inbox',
      'flood her inbox',
      'you know what to do',
      'do not let him sleep',
      'do not let her sleep',
    ],
  },
  {
    type: 'terms',
    code: 'doxxing.sensitive-identifier',
    weight: 0.6,
    explain: 'Contains what looks like a government or financial identifier for a private person.',
    terms: ['social security number', 'passport number', 'drivers license number', 'bank account number'],
    patterns: [
      // SSN shape, not validated: presence of the shape is the signal.
      '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      // 13-19 digit card-shaped run.
      '\\b(?:\\d[ -]?){13,19}\\b',
    ],
  },
  {
    type: 'terms',
    code: 'doxxing.intimate-media-threat',
    weight: 0.65,
    explain: 'Threatens to publish intimate images of a person.',
    terms: [
      'i will leak your nudes',
      'i will post your nudes',
      'send nudes or i will',
      'revenge porn',
      'i have your nudes',
    ],
  },
];

const CHILD_SAFETY: readonly LexiconEntry[] = [
  {
    type: 'cooccurrence',
    code: 'child-safety.minor-sexualization',
    weight: 0.5,
    explain:
      'A minor-age reference appears together with sexual or solicitation language. Held for human review; never auto-cleared and never auto-reported.',
    groupA: [
      'preteen',
      'pre teen',
      'underage',
      'under age',
      'minor girl',
      'minor boy',
      'little girl',
      'little boy',
      'middle schooler',
      'elementary schooler',
      'my daughter is',
      'my son is',
    ],
    patternsA: ['\\b(?:0?[3-9]|1[0-7])\\s?(?:yo|y o|yr|yrs|year old|years old)\\b'],
    groupB: [
      'nudes',
      'naked',
      'sexy',
      'sexual',
      'send pics',
      'send pictures',
      'dm me',
      'private chat',
      'meet up alone',
      'do not tell your parents',
      'keep this between us',
      'our little secret',
      'looking for young',
    ],
  },
  {
    type: 'terms',
    code: 'child-safety.exploitation-market',
    weight: 0.6,
    explain:
      'Uses trade vocabulary associated with child sexual abuse material. Held for human review; escalation to NCMEC is an operator decision, never automatic.',
    encoded: true,
    terms: [
      'Y3NhbQ==',
      'Y3AgdHJhZGU=',
      'bG9saQ==',
      'c2hvdGE=',
      'aGVicGhpbGU=',
      'anMgbW9kZWxz',
      'cGl6emEgdHJhZGU=',
      'Y2hpbGQgbW9kZWwgbnVkZQ==',
      'anVpY3kgamFpbGJhaXQ=',
      'amFpbGJhaXQ=',
    ],
  },
  {
    type: 'cooccurrence',
    code: 'child-safety.grooming-pattern',
    weight: 0.45,
    explain:
      'Reads as grooming: age-gap framing plus secrecy or isolation instructions. Held for human review.',
    groupA: [
      'how old are you',
      'are your parents home',
      'are you home alone',
      'do you have a boyfriend',
      'do you have a girlfriend',
      'you seem mature for your age',
    ],
    groupB: [
      'do not tell anyone',
      'do not tell your parents',
      'delete these messages',
      'move to another app',
      'switch to telegram',
      'switch to signal',
      'send me a picture of you',
      'turn on your camera',
      'i can buy you',
    ],
  },
];

export const LEXICONS: Readonly<Record<ScreeningClass, readonly LexiconEntry[]>> = Object.freeze({
  'child-safety': CHILD_SAFETY,
  'self-harm': SELF_HARM,
  threats: THREATS,
  hate: HATE,
  'doxxing-privacy': DOXXING_PRIVACY,
  'fraud-scam': FRAUD_SCAM,
  spam: SPAM,
});
