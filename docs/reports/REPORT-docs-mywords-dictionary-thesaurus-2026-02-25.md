# Documentation Research: MyWords Dictionary + Thesaurus Providers

Date: 2026-02-25
Scope: Identify a real dictionary + thesaurus stack with maximum language coverage for the new MyWords module.

## Sources (Official)
- https://freedictionaryapi.com/
- https://freedictionaryapi.com/openapi.json
- https://api.datamuse.com/
- https://dictionaryapi.dev/
- https://en.wiktionary.org/api/rest_v1/
- https://www.openthesaurus.de/about/api

## Findings (Documented Facts)
1. Free Dictionary API documents multilingual coverage, dictionary/thesaurus data from Wiktionary, JSON responses, and a stated free-tier rate limit of 100 requests/minute per IP with cache headers.
2. Free Dictionary API OpenAPI spec includes `/api/v1/languages` and `/api/v1/entries/{languageCode}/{word}`, where entries include dictionary fields and thesaurus fields (e.g., `definition`, `synonyms`, `antonyms`).
3. Datamuse provides dedicated thesaurus relations (`rel_syn`, `rel_ant`) and query controls (`max`, metadata flags), making it suitable as an English enrichment fallback.
4. dictionaryapi.dev remains a strong public dictionary endpoint but is documented around the English `/entries/en/<word>` route and does not provide comparable multilingual breadth.
5. Wikimedia Wiktionary REST API exposes definition endpoints per language edition; it is a valid primary-source baseline but less convenient than Free Dictionary API for one-endpoint multilingual + thesaurus integration.
6. OpenThesaurus API is useful but language-limited (German and English), so it is not suitable as the primary multilingual layer.

## Recommendations
1. Use Free Dictionary API as the primary MyWords provider for both dictionary and thesaurus data, and load languages dynamically from `/api/v1/languages`.
2. Add Datamuse as a fallback only for English lookups when synonym/antonym coverage is sparse.
3. Keep source attribution in-product for Wiktionary-derived content and expose provider names/links in the result UI.
4. Add short-term server-side caching to reduce request volume and stay well below provider rate limits.

## Proposed Instruction Updates
- None.
