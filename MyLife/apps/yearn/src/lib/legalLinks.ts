// Canonical hosted legal URLs. The static sources live in apps/yearn/legal/ and
// must be deployed to these clean URLs (see apps/yearn/legal/README.md). App
// Store Connect's Privacy Policy URL must match YEARN_PRIVACY_URL.
export const YEARN_LEGAL_BASE_URL = 'https://yearn.app';

export const YEARN_TERMS_URL = `${YEARN_LEGAL_BASE_URL}/terms`;
export const YEARN_PRIVACY_URL = `${YEARN_LEGAL_BASE_URL}/privacy`;
export const YEARN_GUIDELINES_URL = `${YEARN_LEGAL_BASE_URL}/guidelines`;

export interface YearnLegalLink {
  label: string;
  url: string;
}

export const yearnLegalLinks: YearnLegalLink[] = [
  { label: 'Terms of Service', url: YEARN_TERMS_URL },
  { label: 'Privacy Policy', url: YEARN_PRIVACY_URL },
  { label: 'Community Guidelines', url: YEARN_GUIDELINES_URL },
];
