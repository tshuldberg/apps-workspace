// Shared legal content for the native app and public web. Capability-dependent
// claims are assembled at runtime. The default export set represents an
// unconfigured build, so it never advertises payments or live contact channels
// that the release has not actually configured.

import {
  DEFAULT_MYNEWS_CAPABILITIES,
  type MyNewsCapabilities,
} from './capabilities';
import { CURRENT_TERMS_VERSION, LEGAL_CONTACT } from './terms';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
} from './account';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  id: 'terms' | 'privacy' | 'guidelines';
  title: string;
  summary: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalContentContacts {
  dsaContactEmail: string;
  safetyEmail: string;
  dmcaEmail: string;
}

export interface LegalContentBundle {
  terms: LegalDocument;
  privacy: LegalDocument;
  guidelines: LegalDocument;
  documents: LegalDocument[];
  promptSummary: string[];
}

const DEFAULT_CONTACTS: LegalContentContacts = {
  dsaContactEmail: LEGAL_CONTACT.dsaContactEmail,
  safetyEmail: LEGAL_CONTACT.safetyEmail,
  dmcaEmail: LEGAL_CONTACT.dmcaEmail,
};

export const LEGAL_CLAIM_CAPABILITIES = {
  payments: [
    /support journalists directly/i,
    /supporting journalists and fees/i,
    /2% platform fee/i,
    /process support payments/i,
    /support records/i,
  ],
  emailContact: [/@[a-z0-9.-]+\.[a-z]{2,}/i],
} as const;

export function createLegalContent(
  capabilities: MyNewsCapabilities = DEFAULT_MYNEWS_CAPABILITIES,
  contacts: LegalContentContacts = DEFAULT_CONTACTS,
): LegalContentBundle {
  const supportAgreement = capabilities.payments ? ', or supporting a journalist' : '';
  const termsSections: LegalSection[] = [
    {
      heading: 'What MyNews is',
      paragraphs: [
        capabilities.payments
          ? 'MyNews lets journalists publish articles under a portable, cryptographically signed byline, lets volunteer editors propose typed improvements that only the article author can accept, and lets readers support journalists directly. There are no ads and no advertising-driven ranking.'
          : 'MyNews lets journalists publish articles under a portable, cryptographically signed byline and lets volunteer editors propose typed improvements that only the article author can accept. There are no ads and no advertising-driven ranking.',
        'Every article revision carries the author’s digital signature. Only the article’s author can change the article’s words. Suggested edits are never merged without the author’s signature.',
      ],
    },
    {
      heading: 'Your identity and account',
      paragraphs: [
        capabilities.payments
          ? 'MyNews is anonymous-first. Your author identity is a signing key pair created on your device; you may add an email for recovery and sign-in, but a real name is not required to read, follow, or support journalists.'
          : 'MyNews is anonymous-first. Your author identity is a signing key pair created on your device; you may add an email for recovery and sign-in, but a real name is not required to read or follow journalists.',
        'You are responsible for your signing key and for activity under your identity. Do not impersonate another person or publication.',
      ],
    },
    {
      heading: 'Publishing and editing',
      paragraphs: [
        'You retain ownership of what you write. By publishing, you grant MyNews a non-exclusive license to host, display, and distribute your content on the service so readers can find and read it.',
        'You must have the rights to what you publish. Corrections and context suggestions must cite at least one verifiable https source. You are responsible for the accuracy and legality of your content.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You agree to follow the Community Guidelines. Content that harasses, depicts non-consensual intimate imagery, incites violence, infringes copyright, impersonates, or spams is prohibited and may be removed.',
        'We provide reporting, blocking, and muting tools, and a moderation process with enforcement including content removal and account suspension. Repeat copyright infringers are suspended.',
      ],
    },
    ...(capabilities.payments
      ? [
          {
            heading: 'Supporting journalists and fees',
            paragraphs: [
              'When you support a journalist, MyNews retains a 2% platform fee on the gross amount; standard payment-processing fees also apply per charge. The remainder is allocated to the journalist. MyNews does not sell your data and runs no ads.',
              'Support is voluntary. We describe the fee model in full and conserve every cent in the allocation math.',
            ],
          },
        ]
      : []),
    {
      heading: 'Moderation, removal, and your notices',
      paragraphs: [
        'We may remove content or restrict or suspend an account that violates these Terms or the Community Guidelines. When we take action against your content, you can view a statement of reasons for that action in the app so you understand why.',
        'You can report content to us and review notices about moderation actions in the app.',
      ],
    },
    {
      heading: 'Disclaimers and liability',
      paragraphs: [
        'MyNews is provided “as is” without warranties of any kind. Journalism on the platform reflects its authors, not MyNews. To the maximum extent permitted by law, MyNews is not liable for indirect or consequential damages arising from your use of the service.',
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        'We may update these Terms. When we make a material change we update the effective date and ask you to accept the new version before you next publish or suggest an edit. Continued use after an update means you accept it.',
        ...(capabilities.emailContact
          ? [`Questions about these Terms: ${contacts.dsaContactEmail}.`]
          : []),
      ],
    },
  ];

  const terms: LegalDocument = {
    id: 'terms',
    title: 'Terms of Service',
    summary: 'The agreement between you and MyNews for using the service.',
    effectiveDate: CURRENT_TERMS_VERSION,
    intro:
      `These Terms govern your use of MyNews, an open-journalism platform operated by ${LEGAL_CONTACT.operator}. ` +
      `By creating an identity, publishing an article, suggesting an edit${supportAgreement}, you agree to these Terms. ` +
      'If you do not agree, do not use the service.',
    sections: termsSections,
  };

  const privacy: LegalDocument = {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'What data MyNews collects, why, and the choices you have.',
    effectiveDate: CURRENT_TERMS_VERSION,
    intro:
      'MyNews is privacy-first. This policy explains what we collect and why. We run no advertising, no third-party trackers, and no behavioral profiling.',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: [
          'Identity: your public signing key and chosen handle/display name. An email address only if you add one for recovery or sign-in.',
          'Content you create: articles, revisions, suggestions, and their signatures, which are public by design so readers can verify bylines.',
          ...(capabilities.payments
            ? [
                'Support records: the fact and amount of support you send a journalist, processed through our payment processor. We do not store full card numbers.',
              ]
            : []),
          'Reports and safety signals: content you report, and blocks/mutes you set, which are private to you.',
        ],
      },
      {
        heading: 'What we do NOT do',
        paragraphs: [
          'No advertising and no ad-tech trackers. No selling or renting of your personal data. No behavioral profiles used to rank your feed.',
          'Your device keeps a local SQLite cache for follows, saved items, drafts, and read position so the app can load quickly. That cache is on your device.',
        ],
      },
      {
        heading: 'How we use data',
        paragraphs: [
          capabilities.payments
            ? 'To operate the service: publish and display articles, run the editing desk, process support payments, and enforce safety. We use your data to provide these features, not to advertise to you.'
            : 'To operate the service: publish and display articles, run the editing desk, and enforce safety. We use your data to provide these features, not to advertise to you.',
        ],
      },
      {
        heading: 'Sharing',
        paragraphs: [
          capabilities.payments
            ? 'Public content such as articles, bylines, and revision history is visible to everyone by design. We share data with service providers strictly to run the service, including our database host and payment processor, and when required by law.'
            : 'Public content such as articles, bylines, and revision history is visible to everyone by design. We share data with service providers strictly to run the service, including our database host, and when required by law.',
        ],
      },
      {
        heading: 'Your choices and rights',
        paragraphs: [
          'You can edit your profile, delete drafts, unpublish or retract your own articles, and remove blocks. Depending on where you live, you may have additional rights under laws such as the GDPR or CCPA.',
          ...(capabilities.emailContact
            ? [`Privacy requests and questions: ${contacts.dsaContactEmail}.`]
            : []),
        ],
      },
      {
        heading: 'Exporting your data',
        paragraphs: [
          'You can export everything your account owns as a single JSON file from the app, at any time, without asking us first. The export includes your profile, your articles and their full revision history, the suggestions and comments you wrote, your credibility ledger, your follows, blocks and newsroom memberships, the reports you filed, your record of accepting these terms, and your support and payment records.',
        ],
      },
      {
        heading: 'Deleting your account',
        paragraphs: [
          `You can delete your account from the app. Deletion starts a ${ACCOUNT_DELETION_GRACE_DAYS}-day grace period that you can cancel at any point inside it; nothing is destroyed until it ends. When it ends we run the deletion in one step and record the outcome so you can see it.`,
          'What we keep:',
          ...ACCOUNT_DELETION_RETAINED,
          'What we delete:',
          ...ACCOUNT_DELETION_REMOVED,
        ],
      },
    ],
  };

  const guidelines: LegalDocument = {
    id: 'guidelines',
    title: 'Community Guidelines',
    summary: 'The rules that keep MyNews a trustworthy place for journalism.',
    effectiveDate: CURRENT_TERMS_VERSION,
    intro:
      'MyNews is built for open, accountable journalism. These Guidelines set the floor for what belongs here. Breaking them can lead to content removal or account suspension.',
    sections: [
      {
        heading: 'No harassment or threats',
        paragraphs: [
          'Do not target people with abuse, threats, or sustained harassment. Robust criticism of public claims is welcome; attacks on people are not.',
        ],
      },
      {
        heading: 'No non-consensual intimate imagery (NCII)',
        paragraphs: [
          'Sharing intimate images of a person without their consent is strictly prohibited. We remove NCII on a take-down-first basis and act on reports urgently.',
          capabilities.emailContact
            ? `To report NCII, use the in-app report tool or email ${contacts.safetyEmail}. Reports are handled on an expedited timeline.`
            : 'To report NCII, use the in-app report tool. Reports are handled on an expedited timeline.',
        ],
      },
      {
        heading: 'No incitement to violence',
        paragraphs: ['Do not incite, threaten, or glorify violence against people or groups.'],
      },
      {
        heading: 'Respect copyright',
        paragraphs: [
          'Publish only what you have the rights to publish. Copyright complaints follow our DMCA process, and repeat infringers are suspended.',
        ],
      },
      {
        heading: 'No impersonation or deception',
        paragraphs: [
          'Do not impersonate another person or publication. Bylines are cryptographically signed so readers can verify who wrote what; do not undermine that trust.',
        ],
      },
      {
        heading: 'No spam or manipulation',
        paragraphs: [
          'Do not flood the platform, game the editing desk, or manufacture credibility. Suggestion volume and credibility are rate-limited and audited.',
        ],
      },
      {
        heading: 'Reporting and enforcement',
        paragraphs: [
          'Anyone can report content for review. When we act on a report we record it in an audit trail, and the affected author can see a statement of reasons in the app.',
          ...(capabilities.emailContact
            ? [
                `Safety contact: ${contacts.safetyEmail}. General and legal contact: ${contacts.dsaContactEmail}. Copyright contact: ${contacts.dmcaEmail}.`,
              ]
            : []),
        ],
      },
    ],
  };

  const promptSummary = [
    'You publish under a signed byline; only you can change your article’s words.',
    'You follow the Community Guidelines: no harassment, NCII, incitement, copyright infringement, impersonation, or spam.',
    ...(capabilities.payments
      ? ['MyNews keeps a 2% platform fee on support, runs zero ads, and never sells your data.']
      : ['MyNews runs zero ads and never sells your data.']),
    'We can remove content or suspend accounts that break the rules; you can see why in Notices.',
  ];

  return {
    terms,
    privacy,
    guidelines,
    documents: [terms, privacy, guidelines],
    promptSummary,
  };
}

const DEFAULT_LEGAL_CONTENT = createLegalContent();

export const TERMS_OF_SERVICE = DEFAULT_LEGAL_CONTENT.terms;
export const PRIVACY_POLICY = DEFAULT_LEGAL_CONTENT.privacy;
export const COMMUNITY_GUIDELINES = DEFAULT_LEGAL_CONTENT.guidelines;
export const LEGAL_DOCUMENTS = DEFAULT_LEGAL_CONTENT.documents;
export const TERMS_PROMPT_SUMMARY = DEFAULT_LEGAL_CONTENT.promptSummary;
