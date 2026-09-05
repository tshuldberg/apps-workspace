import type { DatabaseAdapter } from '@mylife/db';
import type { AcceptedPublicPost } from '@mylife/sync';
import { CURRENT_PUBLIC_TERMS_VERSION } from '@mylife/sync';
import { getSetting, setSetting } from './db';

export const PUBLIC_TERMS_ACCEPTED_KEY = `public_terms_accepted_${CURRENT_PUBLIC_TERMS_VERSION.replace('-', '_')}`;
const BLOCKED_PUBLIC_PERSONAS_KEY = 'blocked_public_personas';

export interface PublicLegalConfig {
  privacyUrl: string;
  termsUrl: string;
  standardsUrl: string;
  supportUrl: string;
}

export function publicLegalConfig(): PublicLegalConfig {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const value = (key: string): string => typeof extra[key] === 'string' ? extra[key].trim() : '';
  return {
    privacyUrl: value('privacyPolicyUrl'),
    termsUrl: value('termsUrl'),
    standardsUrl: value('communityStandardsUrl'),
    supportUrl: value('supportUrl'),
  };
}

export function hasAcceptedPublicTerms(db: DatabaseAdapter): boolean {
  return getSetting(db, PUBLIC_TERMS_ACCEPTED_KEY) === '1';
}

export function acceptPublicTerms(db: DatabaseAdapter): void {
  setSetting(db, PUBLIC_TERMS_ACCEPTED_KEY, '1');
}

export function getBlockedPublicPersonas(db: DatabaseAdapter): Set<string> {
  try {
    const parsed = JSON.parse(getSetting(db, BLOCKED_PUBLIC_PERSONAS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string').map((value) => value.toLowerCase()));
  } catch {
    return new Set();
  }
}

export function blockPublicPersona(db: DatabaseAdapter, personaPubkey: string): void {
  const blocked = getBlockedPublicPersonas(db);
  blocked.add(personaPubkey.toLowerCase());
  setSetting(db, BLOCKED_PUBLIC_PERSONAS_KEY, JSON.stringify([...blocked].sort()));
}

export function filterBlockedPublicPosts(
  db: DatabaseAdapter,
  posts: AcceptedPublicPost[],
): AcceptedPublicPost[] {
  const blocked = getBlockedPublicPersonas(db);
  return posts.filter((accepted) => !blocked.has(accepted.post.personaPubkey.toLowerCase()));
}
