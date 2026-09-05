# GPT-5.5 Intelligence Migration

Date: 2026-04-25

## Summary

Migrated the active MyLife OpenAI API integration in `@mylife/intelligence` to GPT-5.5 guidance from the official OpenAI latest model guide.

## What Changed

- Confirmed the official OpenAI latest-model guide identifies `gpt-5.5` as the current latest model and recommends the Responses API for GPT-5.5 reasoning, tool calling, and multi-turn workflows.
- Updated the intelligence LLM request path to use `gpt-5.5` through the Responses API.
- Kept OpenAI `store` disabled by default for MyLife privacy expectations.
- Added explicit GPT-5.5 defaults for `reasoning.effort: "medium"` and `text.verbosity: "low"`.
- Added Responses API structured output via `text.format` for the `insights` envelope.
- Reduced the prompt schema text now that the API enforces the output contract.
- Preserved legacy parsing support for older Chat Completions shaped fixtures.

## Files Changed

- `packages/intelligence/src/llm/types.ts`
- `packages/intelligence/src/llm/index.ts`
- `packages/intelligence/src/llm/query.ts`
- `packages/intelligence/src/llm/prompt.ts`
- `packages/intelligence/src/__tests__/llm.test.ts`
- `packages/intelligence/src/llm/__tests__/query.function-gate.test.ts`
- `errors_log.md`

## Verification

- `pnpm --filter @mylife/intelligence typecheck` passed.
- `pnpm --filter @mylife/intelligence test -- src/__tests__/llm.test.ts src/llm/__tests__/query.function-gate.test.ts` passed with 39 tests.
- `pnpm gate:function --file packages/intelligence/src/llm/query.ts` passed.
- `pnpm gate:function:changed` was attempted and failed on an unrelated Payments typecheck blocker in `modules/payments/src/launch/__tests__/readiness.function-gate.test.ts` because it imports a helper outside the package `rootDir`. Logged in `errors_log.md`.

## Notes

- Active OpenAI API usage was found in `packages/intelligence`; other matching hits were docs, stubs, or Anthropic integrations.
- This was not a module parity change, so parity-specific checks were not run.
