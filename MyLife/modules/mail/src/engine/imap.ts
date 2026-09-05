import type { ImapConfig } from '../types';

/**
 * Known provider auto-discovery configurations.
 */
const PROVIDER_CONFIGS: Record<string, ImapConfig> = {
  'gmail.com': {
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'googlemail.com': {
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'outlook.com': {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'hotmail.com': {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'live.com': {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'yahoo.com': {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'icloud.com': {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'me.com': {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
  'protonmail.com': {
    imapHost: '127.0.0.1',
    imapPort: 1143,
    imapSecurity: 'starttls',
    smtpHost: '127.0.0.1',
    smtpPort: 1025,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  },
};

/**
 * Auto-discover IMAP/SMTP configuration from an email address.
 * Returns null if the provider is not recognized.
 */
export function autoDiscoverConfig(email: string): ImapConfig | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return PROVIDER_CONFIGS[domain] ?? null;
}

/**
 * Get the list of supported auto-discovery providers.
 */
export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}

/**
 * Build a default IMAP config from a domain (best guess).
 */
export function guessConfig(domain: string): ImapConfig {
  return {
    imapHost: `imap.${domain}`,
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: `smtp.${domain}`,
    smtpPort: 587,
    smtpSecurity: 'starttls',
    authMethod: 'password',
  };
}

/**
 * Parse a MIME message header value for a specific field.
 * Simple implementation for common headers.
 */
export function parseHeader(rawHeaders: string, field: string): string | null {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, 'im');
  const match = rawHeaders.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse References header into array of Message-IDs.
 */
export function parseReferences(referencesHeader: string | null): string[] {
  if (!referencesHeader) return [];
  const matches = referencesHeader.match(/<[^>]+>/g);
  return matches?.map((m) => m.slice(1, -1)) ?? [];
}
