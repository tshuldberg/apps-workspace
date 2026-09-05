# MyWords Module Audit

**ID:** words | **Prefix:** wd_ | **Tier:** premium | **Storage:** sqlite (cache + saved words) with remote APIs
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0
**One-line promise:** Dictionary + thesaurus in 270 languages

## User Value
- Word lookup in 270+ languages (definition, pronunciation, etymology, forms)
- Thesaurus (English): synonyms, antonyms, rhymes, contextual meaning
- Wiktionary-sourced English word history and etymology
- Alphabetical prefix browse with pagination
- Word Helper suggestions for writing
- Saved words with word lists and FTS5 full-text search
- Cross-module Flash card integration (flash_card_id column)
- Offline lookup cache

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Multi-provider lookup orchestrator | src/service.ts | shipped |
| Free Dictionary API client (270 langs) | src/api/free-dictionary.ts | shipped |
| Datamuse client (thesaurus, rhymes) | src/api/datamuse.ts | shipped |
| Wiktionary client (etymology) | src/api/wiktionary.ts | shipped |
| In-memory LRU cache (lang 24h, lookup 5m, browse 10m) | src/service.ts | shipped |
| Alphabetical browse | src/service.ts | shipped |
| Word helper (replacement suggestions) | src/service.ts | shipped |
| Supported languages list | src/service.ts | shipped |
| Saved words + word lists | wd_saved_words, wd_word_lists V1 | shipped |
| Flash module cross-link | V2 migration | shipped |
| Offline lookup cache | wd_lookup_cache V3 | shipped |
| FTS5 full-text search | V4 migration + triggers | shipped |
| Lookup, Helper, Languages, Saved tabs | app/(words)/* | shipped |
| Word detail, saved detail, list | app/(words)/word, saved, list | shipped |

## Data Model
Prefix `wd_`, schema v4. Tables: wd_word_lists, wd_saved_words (with flash_card_id FK), wd_lookup_cache, wd_saved_words_fts (FTS5 virtual table with sync triggers). Stateless for live lookups (API-driven), persistent for saved/cached.

## Screens / User Flows
Mobile tabs: Lookup, Word Helper, Languages, Saved, Settings. Screens: word-detail, saved-word-detail. Web route parity.

## Distinctive / Moat-worthy
- 270 languages via Free Dictionary API (most competitors are English-only)
- Three-provider aggregation under one clean API
- FTS5 full-text saved words search is rare in consumer dictionary apps
- Flash module integration turns any saved word into a flash card

## Gaps vs competitors
- Requires network for lookup (cache covers repeat queries)
- No audio pronunciation playback yet
- No offline full dictionary bundle (would require major asset)

## Investor-facing hook
Merriam-Webster plus Dictionary.com plus Wiktionary in one module that works in 270 languages, with saved-word FTS and automatic flash-card creation that no consumer dictionary app ships today.
