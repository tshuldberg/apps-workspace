import type { BillingCycle } from '../types';

export interface ServiceTier {
  name: string;
  costCents: number;
  billingCycle: BillingCycle;
  features: string[];
  missingFeatures?: string[];
}

export interface AlternativeService {
  name: string;
  costCents: number;
  billingCycle: BillingCycle;
  freeOptionAvailable: boolean;
  url: string;
  differentiators: string[];
}

export interface AlternativesEntry {
  serviceName: string;
  tiers: ServiceTier[];
  annualCostCents?: number;
  alternatives: AlternativeService[];
}

export const ALTERNATIVES_DATA: AlternativesEntry[] = [
  {
    serviceName: 'Netflix',
    tiers: [
      { name: 'Standard with Ads', costCents: 699, billingCycle: 'monthly', features: ['HD streaming', 'Same content library'], missingFeatures: ['No ad-free experience', 'No downloads'] },
      { name: 'Standard', costCents: 1549, billingCycle: 'monthly', features: ['HD streaming', 'Ad-free', 'Downloads', '2 screens'], missingFeatures: [] },
      { name: 'Premium', costCents: 2299, billingCycle: 'monthly', features: ['4K + HDR', 'Ad-free', 'Downloads', '4 screens', 'Spatial audio'], missingFeatures: [] },
    ],
    alternatives: [
      { name: 'Hulu', costCents: 799, billingCycle: 'monthly', freeOptionAvailable: false, url: 'https://www.hulu.com', differentiators: ['Hulu originals', 'Next-day TV episodes'] },
      { name: 'Disney+', costCents: 799, billingCycle: 'monthly', freeOptionAvailable: false, url: 'https://www.disneyplus.com', differentiators: ['Disney/Marvel/Star Wars', 'Family content'] },
      { name: 'Tubi', costCents: 0, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.tubi.tv', differentiators: ['Free with ads', 'Large library of older content'] },
    ],
  },
  {
    serviceName: 'Spotify',
    tiers: [
      { name: 'Free', costCents: 0, billingCycle: 'monthly', features: ['Ad-supported streaming', 'Shuffle play'], missingFeatures: ['No offline downloads', 'Ads between songs', 'No on-demand play'] },
      { name: 'Individual', costCents: 1099, billingCycle: 'monthly', features: ['Ad-free', 'Offline downloads', 'On-demand'], missingFeatures: [] },
      { name: 'Duo', costCents: 1499, billingCycle: 'monthly', features: ['2 accounts', 'Ad-free', 'Duo Mix'], missingFeatures: [] },
      { name: 'Family', costCents: 1699, billingCycle: 'monthly', features: ['6 accounts', 'Ad-free', 'Family Mix', 'Spotify Kids'], missingFeatures: [] },
    ],
    alternatives: [
      { name: 'YouTube Music', costCents: 1099, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://music.youtube.com', differentiators: ['YouTube integration', 'Music videos'] },
      { name: 'Apple Music', costCents: 1099, billingCycle: 'monthly', freeOptionAvailable: false, url: 'https://www.apple.com/apple-music', differentiators: ['Lossless audio', 'Spatial Audio', 'Apple ecosystem'] },
    ],
  },
  {
    serviceName: 'Adobe Creative Cloud',
    tiers: [
      { name: 'Photography Plan', costCents: 999, billingCycle: 'monthly', features: ['Photoshop', 'Lightroom', '20GB cloud'], missingFeatures: ['No Illustrator', 'No Premiere', 'No After Effects'] },
      { name: 'Single App', costCents: 2299, billingCycle: 'monthly', features: ['One app of choice', '100GB cloud'], missingFeatures: ['Only one app'] },
      { name: 'All Apps', costCents: 5999, billingCycle: 'monthly', features: ['All 20+ apps', '100GB cloud', 'Adobe Fonts'], missingFeatures: [] },
    ],
    annualCostCents: 65988,
    alternatives: [
      { name: 'Canva Pro', costCents: 1299, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.canva.com', differentiators: ['Browser-based', 'Templates', 'Simpler than Photoshop'] },
      { name: 'Figma', costCents: 1500, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.figma.com', differentiators: ['UI/UX design', 'Real-time collaboration', 'Browser-based'] },
      { name: 'Affinity Suite', costCents: 16999, billingCycle: 'lifetime', freeOptionAvailable: false, url: 'https://affinity.serif.com', differentiators: ['One-time purchase', 'Photo/Designer/Publisher', 'No subscription'] },
    ],
  },
  {
    serviceName: 'Microsoft 365',
    tiers: [
      { name: 'Personal', costCents: 699, billingCycle: 'monthly', features: ['1 user', 'Word/Excel/PowerPoint', '1TB OneDrive'], missingFeatures: ['Single user only'] },
      { name: 'Family', costCents: 999, billingCycle: 'monthly', features: ['Up to 6 users', '1TB each', 'All Office apps'], missingFeatures: [] },
    ],
    annualCostCents: 6999,
    alternatives: [
      { name: 'Google Workspace', costCents: 0, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://workspace.google.com', differentiators: ['Browser-based', '15GB free storage', 'Google ecosystem'] },
      { name: 'LibreOffice', costCents: 0, billingCycle: 'lifetime', freeOptionAvailable: true, url: 'https://www.libreoffice.org', differentiators: ['Free open source', 'Desktop apps', 'No subscription'] },
    ],
  },
  {
    serviceName: 'iCloud',
    tiers: [
      { name: '50GB', costCents: 99, billingCycle: 'monthly', features: ['50GB storage', 'iCloud backup'], missingFeatures: ['No Private Relay', 'No Hide My Email'] },
      { name: '200GB', costCents: 299, billingCycle: 'monthly', features: ['200GB storage', 'Family sharing', 'iCloud+'], missingFeatures: [] },
      { name: '2TB', costCents: 999, billingCycle: 'monthly', features: ['2TB storage', 'Family sharing', 'iCloud+'], missingFeatures: [] },
    ],
    alternatives: [
      { name: 'Google One', costCents: 199, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://one.google.com', differentiators: ['15GB free', 'Cross-platform', 'Google ecosystem'] },
      { name: 'Dropbox', costCents: 1199, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.dropbox.com', differentiators: ['2GB free', 'Cross-platform', 'File sharing'] },
    ],
  },
  {
    serviceName: 'YouTube Premium',
    tiers: [
      { name: 'Individual', costCents: 1399, billingCycle: 'monthly', features: ['Ad-free videos', 'Background play', 'YouTube Music'], missingFeatures: [] },
      { name: 'Family', costCents: 2299, billingCycle: 'monthly', features: ['Up to 5 members', 'Ad-free', 'YouTube Music'], missingFeatures: [] },
    ],
    annualCostCents: 13999,
    alternatives: [
      { name: 'Vimeo', costCents: 0, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://vimeo.com', differentiators: ['Creator-focused', 'No ads on free tier'] },
    ],
  },
  {
    serviceName: 'Amazon Prime',
    tiers: [
      { name: 'Monthly', costCents: 1499, billingCycle: 'monthly', features: ['Free shipping', 'Prime Video', 'Prime Music', 'Prime Reading'], missingFeatures: [] },
    ],
    annualCostCents: 13900,
    alternatives: [
      { name: 'Walmart+', costCents: 1295, billingCycle: 'monthly', freeOptionAvailable: false, url: 'https://www.walmart.com/plus', differentiators: ['Free delivery', 'Fuel savings', 'Paramount+'] },
    ],
  },
  {
    serviceName: 'ChatGPT',
    tiers: [
      { name: 'Free', costCents: 0, billingCycle: 'monthly', features: ['GPT-4o mini', 'Limited usage'], missingFeatures: ['No GPT-4o full', 'No DALL-E', 'Usage limits'] },
      { name: 'Plus', costCents: 2000, billingCycle: 'monthly', features: ['GPT-4o', 'DALL-E', 'Advanced analysis', 'Higher limits'], missingFeatures: [] },
      { name: 'Pro', costCents: 20000, billingCycle: 'monthly', features: ['Unlimited access', 'o1 pro mode', 'Priority'], missingFeatures: [] },
    ],
    alternatives: [
      { name: 'Claude', costCents: 2000, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://claude.ai', differentiators: ['Strong reasoning', 'Long context', 'Artifacts'] },
      { name: 'Gemini', costCents: 0, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://gemini.google.com', differentiators: ['Google integration', 'Free tier', 'Multimodal'] },
    ],
  },
  {
    serviceName: 'Hulu',
    tiers: [
      { name: 'With Ads', costCents: 799, billingCycle: 'monthly', features: ['Hulu library', 'Next-day TV'], missingFeatures: ['Ads'] },
      { name: 'No Ads', costCents: 1799, billingCycle: 'monthly', features: ['Ad-free', 'Downloads', 'Hulu library'], missingFeatures: [] },
    ],
    alternatives: [
      { name: 'Peacock', costCents: 799, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.peacocktv.com', differentiators: ['NBC content', 'Free tier', 'Live sports'] },
      { name: 'Tubi', costCents: 0, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.tubi.tv', differentiators: ['Free with ads', 'Large library'] },
    ],
  },
  {
    serviceName: 'Disney+',
    tiers: [
      { name: 'Basic', costCents: 799, billingCycle: 'monthly', features: ['Disney/Marvel/Star Wars', 'Ad-supported'], missingFeatures: ['Ads', 'No downloads'] },
      { name: 'Premium', costCents: 1399, billingCycle: 'monthly', features: ['Ad-free', 'Downloads', '4K'], missingFeatures: [] },
    ],
    annualCostCents: 13999,
    alternatives: [
      { name: 'Tubi', costCents: 0, billingCycle: 'monthly', freeOptionAvailable: true, url: 'https://www.tubi.tv', differentiators: ['Free', 'Ad-supported', 'Different library'] },
    ],
  },
];
