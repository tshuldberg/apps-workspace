/**
 * Intl polyfills for Hermes (plan 33 Phase 3.5, review F2).
 *
 * Hermes ships Collator/DateTimeFormat/NumberFormat but has historically
 * lacked Intl.PluralRules and Intl.RelativeTimeFormat. Without them the
 * CLDR plural engine silently degrades to two-form English-style plurals
 * (safe, but Arabic/Hebrew/Polish grammar never activates) and relative
 * time falls back to compact "2h" strings. The guards keep native
 * implementations when the runtime has them.
 *
 * Import this module FIRST in the root layout, before any i18n use.
 */

import { shouldPolyfill as shouldPolyfillPluralRules } from '@formatjs/intl-pluralrules/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillRelativeTime } from '@formatjs/intl-relativetimeformat/should-polyfill.js';

if (shouldPolyfillPluralRules()) {
  require('@formatjs/intl-pluralrules/polyfill-force.js');
  require('@formatjs/intl-pluralrules/locale-data/ar');
  require('@formatjs/intl-pluralrules/locale-data/de');
  require('@formatjs/intl-pluralrules/locale-data/en');
  require('@formatjs/intl-pluralrules/locale-data/es');
  require('@formatjs/intl-pluralrules/locale-data/fr');
  require('@formatjs/intl-pluralrules/locale-data/he');
  require('@formatjs/intl-pluralrules/locale-data/hi');
  require('@formatjs/intl-pluralrules/locale-data/bn');
  require('@formatjs/intl-pluralrules/locale-data/ta');
  require('@formatjs/intl-pluralrules/locale-data/te');
  require('@formatjs/intl-pluralrules/locale-data/id');
  require('@formatjs/intl-pluralrules/locale-data/it');
  require('@formatjs/intl-pluralrules/locale-data/ja');
  require('@formatjs/intl-pluralrules/locale-data/ko');
  require('@formatjs/intl-pluralrules/locale-data/nl');
  require('@formatjs/intl-pluralrules/locale-data/pl');
  require('@formatjs/intl-pluralrules/locale-data/pt');
  require('@formatjs/intl-pluralrules/locale-data/pt-PT');
  require('@formatjs/intl-pluralrules/locale-data/sv');
  require('@formatjs/intl-pluralrules/locale-data/th');
  require('@formatjs/intl-pluralrules/locale-data/tr');
  require('@formatjs/intl-pluralrules/locale-data/vi');
  require('@formatjs/intl-pluralrules/locale-data/zh');
}

if (shouldPolyfillRelativeTime()) {
  require('@formatjs/intl-relativetimeformat/polyfill-force.js');
  require('@formatjs/intl-relativetimeformat/locale-data/ar');
  require('@formatjs/intl-relativetimeformat/locale-data/de');
  require('@formatjs/intl-relativetimeformat/locale-data/en');
  require('@formatjs/intl-relativetimeformat/locale-data/es');
  require('@formatjs/intl-relativetimeformat/locale-data/fr');
  require('@formatjs/intl-relativetimeformat/locale-data/he');
  require('@formatjs/intl-relativetimeformat/locale-data/hi');
  require('@formatjs/intl-relativetimeformat/locale-data/bn');
  require('@formatjs/intl-relativetimeformat/locale-data/ta');
  require('@formatjs/intl-relativetimeformat/locale-data/te');
  require('@formatjs/intl-relativetimeformat/locale-data/id');
  require('@formatjs/intl-relativetimeformat/locale-data/it');
  require('@formatjs/intl-relativetimeformat/locale-data/ja');
  require('@formatjs/intl-relativetimeformat/locale-data/ko');
  require('@formatjs/intl-relativetimeformat/locale-data/nl');
  require('@formatjs/intl-relativetimeformat/locale-data/pl');
  require('@formatjs/intl-relativetimeformat/locale-data/pt');
  require('@formatjs/intl-relativetimeformat/locale-data/pt-PT');
  require('@formatjs/intl-relativetimeformat/locale-data/sv');
  require('@formatjs/intl-relativetimeformat/locale-data/th');
  require('@formatjs/intl-relativetimeformat/locale-data/tr');
  require('@formatjs/intl-relativetimeformat/locale-data/vi');
  require('@formatjs/intl-relativetimeformat/locale-data/zh');
  require('@formatjs/intl-relativetimeformat/locale-data/zh-Hant');
}
