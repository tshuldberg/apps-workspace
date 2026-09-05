/**
 * Screening fixture corpus (plan 48 WP8).
 *
 * Two halves, both load-bearing:
 *
 *   ADVERSARIAL  content that must be held. Each case names the evasion it
 *                exercises so a regression says what broke, not just that a
 *                number moved.
 *   CLEAN        content that must NOT be held. This half is the one that keeps
 *                the engine usable: a news platform that quarantines reporting
 *                about abuse is worse than one with no screening at all, so the
 *                clean set deliberately includes hard cases (an article ABOUT
 *                hate speech, a scam warning, a suicide-prevention piece, a
 *                security advisory full of suspicious URLs).
 *
 * The same corpus is used by the engine tests and by the edge twin parity test,
 * so the twin is proven to score identically rather than merely to exist.
 */

import type { ScreeningClass, ScreeningContentKind } from '../types';

export interface ScreeningCase {
  name: string;
  kind: ScreeningContentKind;
  text: string;
  title?: string;
  links?: string[];
  /** The evasion or pattern this case exercises. */
  exercises: string;
}

export interface AdversarialCase extends ScreeningCase {
  expectClass: ScreeningClass;
  /** True when the class must route to a human and can never be auto-cleared. */
  expectHumanOnly?: boolean;
}

/** Zero-width space, used to split words without changing what a reader sees. */
const ZWSP = '​';
/** Right-to-left override. */
const RLO = '‮';

export const ADVERSARIAL_CASES: AdversarialCase[] = [
  {
    name: 'plain slur',
    kind: 'comment',
    text: 'you are nothing but a kike and everyone knows it',
    exercises: 'unobfuscated hate lexicon hit',
    expectClass: 'hate',
  },
  {
    name: 'slur split by zero-width spaces',
    kind: 'comment',
    text: `you are nothing but a k${ZWSP}i${ZWSP}k${ZWSP}e and everyone knows it`,
    exercises: 'zero-width character insertion inside a term',
    expectClass: 'hate',
  },
  {
    name: 'slur with leet substitution',
    kind: 'comment',
    text: 'go back where you came from you f4gg0t',
    exercises: 'digit-for-letter leet substitution',
    expectClass: 'hate',
  },
  {
    name: 'slur with Cyrillic homoglyphs',
    kind: 'comment',
    // 'с' and 'о' are Cyrillic, 'coon' reads identically to a Latin reader.
    text: 'nobody wants you here сoоn',
    exercises: 'Cyrillic homoglyph substitution',
    expectClass: 'hate',
  },
  {
    name: 'slur split by periods',
    kind: 'comment',
    text: 'typical c.h.i.n.k behaviour from that department, as usual, every time',
    exercises: 'letter-separator insertion',
    expectClass: 'hate',
  },
  {
    name: 'dehumanizing generalization',
    kind: 'comment',
    text: 'immigrants are vermin and the sooner people admit it the better',
    exercises: 'group plus dehumanizing predicate cooccurrence',
    expectClass: 'hate',
  },
  {
    name: 'explicit threat',
    kind: 'comment',
    text: 'i will kill you if you publish that, and i know where you live',
    exercises: 'explicit first-person threat',
    expectClass: 'threats',
  },
  {
    name: 'threat with repeated-letter padding',
    kind: 'comment',
    text: 'i willll killll you when you least expect it',
    exercises: 'repeated-character padding inside a threat phrase',
    expectClass: 'threats',
  },
  {
    name: 'mass violence reference',
    kind: 'article',
    title: 'my plan',
    text: 'tomorrow i will shoot up the school and my manifesto explains why',
    exercises: 'mass-violence lexicon',
    expectClass: 'threats',
  },
  {
    name: 'self-harm encouragement',
    kind: 'comment',
    text: 'nobody would miss you, just kill yourself already',
    exercises: 'self-harm encouragement, human-only class',
    expectClass: 'self-harm',
    expectHumanOnly: true,
  },
  {
    name: 'self-harm method request',
    kind: 'comment',
    text: 'looking for the most painless way to die, what is the lethal dose of that',
    exercises: 'self-harm method instruction, human-only class',
    expectClass: 'self-harm',
    expectHumanOnly: true,
  },
  {
    name: 'first-person crisis disclosure',
    kind: 'comment',
    text: 'i want to kill myself and this is my last post here',
    exercises: 'crisis disclosure routed to a person rather than refused',
    expectClass: 'self-harm',
    expectHumanOnly: true,
  },
  {
    name: 'minor sexualization',
    kind: 'comment',
    text: 'she is 14 yo, send pics and do not tell your parents about it',
    exercises: 'age indicator plus solicitation cooccurrence, human-only class',
    expectClass: 'child-safety',
    expectHumanOnly: true,
  },
  {
    name: 'grooming pattern',
    kind: 'comment',
    text: 'are you home alone right now, delete these messages after you read them',
    exercises: 'grooming cooccurrence, human-only class',
    expectClass: 'child-safety',
    expectHumanOnly: true,
  },
  {
    name: 'exploitation market vocabulary',
    kind: 'comment',
    text: 'anyone here still doing cp trade, dm me',
    exercises: 'child sexual abuse trade vocabulary, human-only class',
    expectClass: 'child-safety',
    expectHumanOnly: true,
  },
  {
    name: 'doxxing with targeting',
    kind: 'comment',
    text:
      'here is his address 412 maple street and his phone number 555 123 4567, everyone should call and do not let him sleep',
    exercises: 'personal details plus brigading instruction cooccurrence',
    expectClass: 'doxxing-privacy',
  },
  {
    name: 'credential harvesting',
    kind: 'comment',
    text:
      'your account will be suspended unless you verify your identity to unlock it, send your seed phrase to our official support team',
    exercises: 'phishing plus wallet-key harvesting',
    expectClass: 'fraud-scam',
  },
  {
    name: 'investment scam with lookalike link',
    kind: 'article',
    title: 'guaranteed returns for early adopters',
    text:
      'this crypto giveaway offers guaranteed returns of 500% roi, claim your prize before the window closes',
    links: ['https://coinbase-secure-login.tk/claim'],
    exercises: 'fraud lexicon plus brand-lookalike and high-abuse TLD URL heuristics',
    expectClass: 'fraud-scam',
  },
  {
    name: 'link spam with shorteners and repetition',
    kind: 'comment',
    text:
      'buy now buy now buy now buy now buy now buy now buy now buy now limited time offer work from home earn 500 usd a day https://bit.ly/aaa https://tinyurl.com/bbb https://cutt.ly/ccc',
    exercises: 'promotional lexicon plus repetition plus shortener stacking',
    expectClass: 'spam',
  },
  {
    name: 'bidi override abuse around a threat',
    kind: 'comment',
    text: `${RLO}i will kill you${RLO} nice article though`,
    exercises: 'bidirectional override characters as an evasion aggravator',
    expectClass: 'threats',
  },
];

export const CLEAN_CASES: ScreeningCase[] = [
  {
    name: 'ordinary local news article',
    kind: 'article',
    title: 'City council approves the transit budget after a long debate',
    text:
      'The council voted seven to two on Tuesday to approve the transit budget, ending three months of hearings. The plan adds twelve buses on the eastern corridor and funds two new shelters. Riders told the council that evening service was the priority; the transit director said the first new routes should be running by spring. Opponents argued the money would be better spent repaving Third Avenue.',
    exercises: 'baseline clean prose',
  },
  {
    name: 'reporting ABOUT hate speech, with a quoted slur',
    kind: 'article',
    title: 'Councilman resigns after recording surfaces',
    text:
      'In the recording, obtained by this outlet, the councilman used the word "kike" twice while describing a colleague. He resigned on Friday. The state party said the language was indefensible. Two colleagues who were present confirmed the account, and the recording has been reviewed by three people outside the newsroom.',
    exercises: 'quoted-slur mitigation: coverage of abuse is not abuse',
  },
  {
    name: 'suicide prevention reporting with a helpline',
    kind: 'article',
    title: 'Crisis line expands overnight staffing',
    text:
      'The county crisis line will staff overnight shifts starting next month, after call volume rose forty percent. Counselors say the overnight gap was the hardest to cover. Anyone in crisis can reach the line at any hour, and the county says wait times should fall below two minutes once the new shift is fully staffed.',
    exercises: 'sensitive subject matter without encouragement or method content',
  },
  {
    name: 'scam warning article',
    kind: 'article',
    title: 'Readers report a new refund scam',
    text:
      'Several readers received messages claiming to be from a refund department and asking them to confirm a one time code. Do not send the code. The utility says it never asks for codes by text, and the state attorney general is collecting reports. One reader lost 400 dollars before the bank reversed the transfer.',
    exercises: 'fraud vocabulary in a warning context, no solicitation of its own',
  },
  {
    name: 'security advisory with many suspicious-looking links',
    kind: 'article',
    title: 'Phishing campaign targets newsroom staff',
    text:
      'The campaign used shortened links and a lookalike domain. Researchers documented the infrastructure in a public write-up. Staff who clicked were prompted for credentials on a page that copied the real login screen. The registrar has since suspended two of the domains.',
    links: [
      'https://example.org/advisory',
      'https://example.net/indicators',
      'https://example.com/write-up',
    ],
    exercises: 'legitimate citation list must not trip link-count or density heuristics',
  },
  {
    name: 'heated but ordinary criticism',
    kind: 'comment',
    text:
      'This piece is badly argued and the sourcing is thin. The second paragraph contradicts the third, and the headline promises something the reporting never delivers. I would retract it.',
    exercises: 'strong criticism is not harassment',
  },
  {
    name: 'correction suggestion with citations',
    kind: 'suggestion',
    title: 'The vote was seven to two, not six to three; see the clerk record',
    text: 'The council vote was seven to two.',
    links: ['https://example.gov/clerk/minutes/2026-07-14'],
    exercises: 'normal editorial suggestion shape',
  },
  {
    name: 'medical reporting with dosage language',
    kind: 'article',
    title: 'Regulator narrows the approved dose',
    text:
      'The regulator narrowed the approved dose after a review of adverse events. Physicians said the change mostly affects patients already on the higher amount, and the manufacturer will update the label within ninety days.',
    exercises: 'clinical dosage language without self-harm framing',
  },
  {
    name: 'immigration policy article naming groups neutrally',
    kind: 'article',
    title: 'Asylum backlog grows as hearings slip',
    text:
      'Immigrants waiting for hearings now face an average delay of four years, according to court data. Refugees who arrived last spring are still without work authorization. Advocates want more judges; the department says it has requested funding for twenty more.',
    exercises: 'protected-group nouns without a dehumanizing predicate',
  },
  {
    name: 'crime report describing a threat that was made',
    kind: 'article',
    title: 'Man charged after threatening a poll worker',
    text:
      'Prosecutors say the man told the worker he knew where she lived, according to the complaint. He was charged on Monday and released on his own recognizance. The worker has since left the job.',
    exercises: 'attributed reporting of a threat, not a threat',
  },
  {
    name: 'business article with legitimate money language',
    kind: 'article',
    title: 'Startup raises a modest round',
    text:
      'The company raised four million dollars and says it will hire eight engineers. Revenue roughly doubled last year off a small base. The founders declined to discuss valuation.',
    exercises: 'financial vocabulary without guarantees or solicitation',
  },
  {
    name: 'long article with normal repetition of a subject name',
    kind: 'article',
    title: 'Everything the mayor said about the bridge',
    text: `${'The mayor said the bridge would open. '.repeat(12)}Engineers disagreed, and the opening slipped twice more before the county took over the contract.`,
    exercises: 'topical repetition below the word-repetition threshold',
  },
];
