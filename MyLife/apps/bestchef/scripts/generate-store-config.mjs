#!/usr/bin/env node
/**
 * BestChef store metadata pipeline (plan 45 item 1.4, audit M13).
 *
 * Reads the per-locale, human-editable JSON files under
 * apps/bestchef/store-metadata/<appLocale>.json and generates
 * apps/bestchef/store.config.json, the file `eas metadata:push` reads
 * (App Store Connect side, via the "production" submit profile in
 * eas.json). The per-locale files are the source of truth: they use the
 * app's own i18n locale codes and stay flat and diffable. This script
 * maps each app locale code to its ASC-required locale code and reshapes
 * the field names to the EAS Metadata AppleInfo contract (title, not
 * name; promoText, not promotionalText; keywords as an array).
 *
 * Run standalone: node apps/bestchef/scripts/generate-store-config.mjs
 * Verified by: apps/bestchef/scripts/check-store-metadata.mjs (which
 * regenerates and diffs store.config.json so it can never drift from the
 * per-locale source files).
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const METADATA_DIR = join(APP_ROOT, 'store-metadata');
const OUTPUT_PATH = join(APP_ROOT, 'store.config.json');

/**
 * ASC requires privacyPolicyUrl per locale. One policy serves every
 * market (apps/bestchef/legal/README.md, apps/bestchef/app/(root)/
 * constants/legal.ts). This is the real, product-defined URL the app's
 * own onboarding gate and settings screen already point at; it is not
 * yet hosted (blocked on founder item F2 in the legal corpus README),
 * so `eas metadata:push` will succeed at the API level but ASC human
 * review will reject the listing until the URL returns 200. See the F6
 * runbook in store-metadata/README.md.
 */
const PRIVACY_POLICY_URL = 'https://bestchef.app/privacy';

/**
 * App locale code -> ASC locale code, taken from eas-cli's own
 * fastlane-derived language table (submit/ios/utils/language.js). Every
 * one of the app's 21 supported locales maps directly to an ASC-
 * supported language; none need folding to a nearby locale.
 */
export const ASC_LOCALE_MAP = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  nl: 'nl-NL',
  sv: 'sv',
  pl: 'pl',
  tr: 'tr',
  id: 'id',
  vi: 'vi',
  hi: 'hi',
  th: 'th',
  ja: 'ja',
  ko: 'ko',
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  ar: 'ar-SA',
  he: 'he',
};

export function loadLocaleFiles() {
  const files = readdirSync(METADATA_DIR).filter((f) => f.endsWith('.json'));
  const byLocale = {};
  for (const file of files) {
    const locale = file.replace(/\.json$/, '');
    byLocale[locale] = JSON.parse(readFileSync(join(METADATA_DIR, file), 'utf-8'));
  }
  return byLocale;
}

export function buildStoreConfig(byLocale) {
  const info = {};
  for (const [appLocale, data] of Object.entries(byLocale)) {
    const ascLocale = ASC_LOCALE_MAP[appLocale];
    if (!ascLocale) {
      throw new Error(`No ASC locale mapping for app locale "${appLocale}"`);
    }
    info[ascLocale] = {
      title: data.name,
      subtitle: data.subtitle,
      description: data.description,
      keywords: data.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      promoText: data.promotionalText,
      releaseNotes: data.releaseNotes,
      privacyPolicyUrl: PRIVACY_POLICY_URL,
    };
  }

  const orderedLocales = Object.keys(ASC_LOCALE_MAP)
    .map((appLocale) => ASC_LOCALE_MAP[appLocale])
    .filter((ascLocale) => info[ascLocale]);
  const orderedInfo = {};
  for (const ascLocale of orderedLocales) {
    orderedInfo[ascLocale] = info[ascLocale];
  }

  return {
    configVersion: 0,
    apple: {
      info: orderedInfo,
    },
  };
}

export function generate() {
  const byLocale = loadLocaleFiles();
  const config = buildStoreConfig(byLocale);
  const serialized = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(OUTPUT_PATH, serialized, 'utf-8');
  return { config, serialized, outputPath: OUTPUT_PATH };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { outputPath } = generate();
  console.log(`Wrote ${outputPath}`);
}
