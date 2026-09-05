import { describe, expect, it } from 'vitest';
import { codeLines, fileCallsGatePositively, gateAliases, localGuardFor } from '../check-no-ungated-fixtures.mjs';

function guardForNeedle(source, needle) {
  const lines = codeLines(source);
  const aliases = gateAliases(lines);
  const lineIndex = lines.findIndex((line) => line.includes(needle));
  expect(lineIndex).toBeGreaterThanOrEqual(0);
  return localGuardFor(lines, lineIndex, aliases);
}

describe('check-no-ungated-fixtures polarity', () => {
  it('rejects an inverted gate that wraps the fixture directly', () => {
    const source = `function render() {
  if (!shouldShowDemoContent()) {
    return SAMPLE_INGREDIENTS;
  }
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBeNull();
  });

  it('rejects an inverted gate even with extra whitespace before the identifier', () => {
    const source = `function render() {
  if (! shouldShowDemoContent()) {
    return SAMPLE_INGREDIENTS;
  }
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBeNull();
  });

  it('accepts a positive (non-negated) gate call', () => {
    const source = `function render() {
  if (shouldShowDemoContent()) {
    return SAMPLE_INGREDIENTS;
  }
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBe('shouldShowDemoContent');
  });

  it('accepts an inverted gate used as an early-exit guard clause', () => {
    const source = `function render() {
  if (!shouldShowDemoContent()) {
    return [];
  }
  return SAMPLE_INGREDIENTS;
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBe('shouldShowDemoContent');
  });

  it('accepts a positive gate alias variable', () => {
    const source = `function render() {
  const showDemoContent = shouldShowDemoContent();
  if (showDemoContent) {
    return SAMPLE_INGREDIENTS;
  }
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBe('shouldShowDemoContent');
  });

  it('rejects a negated alias variable that wraps the fixture directly', () => {
    const source = `function render() {
  const showDemoContent = shouldShowDemoContent();
  if (!showDemoContent) {
    return SAMPLE_INGREDIENTS;
  }
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBeNull();
  });

  it('accepts a negated alias variable used as an early-exit guard clause', () => {
    const source = `function render() {
  const showDemoContent = shouldShowDemoContent();
  if (!showDemoContent) {
    return null;
  }
  return SAMPLE_INGREDIENTS;
}`;
    expect(guardForNeedle(source, 'SAMPLE_INGREDIENTS')).toBe('shouldShowDemoContent');
  });

  it('accepts a positive gate call used directly as a ternary condition', () => {
    const source = `function findSubmission() {
  const demo = shouldShowDemoContent()
    ? DEMO_SUBMISSIONS.find((s) => s.id === id) ?? null
    : null;
  return demo;
}`;
    expect(guardForNeedle(source, 'DEMO_SUBMISSIONS')).toBe('shouldShowDemoContent');
  });

  it('does not mistake a ternary-condition gate call for a boolean alias definition', () => {
    // If the ternary's `const demo = shouldShowDemoContent()` line were
    // wrongly registered as a boolean alias for `demo`, this would look
    // like an ungated fixture: `demo` itself is never called, so a naive
    // alias lookup would fail to find a guard for it.
    const source = `function findSubmission() {
  const demo = shouldShowDemoContent()
    ? DEMO_SUBMISSIONS.find((s) => s.id === id) ?? null
    : null;
  return demo;
}`;
    const lines = codeLines(source);
    const aliases = gateAliases(lines);
    expect(aliases.has('demo')).toBe(false);
  });
});

describe('check-no-ungated-fixtures file-wide helper gate', () => {
  it('rejects a file that only calls the gate in negated form', () => {
    const source = `if (!shouldUseDemoFixturesInDev()) {
  doSomethingElse();
}
getInitialGroceryPhotoCandidates();`;
    expect(fileCallsGatePositively(source, 'shouldUseDemoFixturesInDev')).toBe(false);
  });

  it('accepts a file that calls the gate positively anywhere', () => {
    const source = `const allowed = shouldUseDemoFixturesInDev();
getInitialGroceryPhotoCandidates();`;
    expect(fileCallsGatePositively(source, 'shouldUseDemoFixturesInDev')).toBe(true);
  });
});
