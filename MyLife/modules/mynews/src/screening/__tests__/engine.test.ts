import { describe, expect, it } from 'vitest';

import { ADVERSARIAL_CASES, CLEAN_CASES } from '../__fixtures__/corpus';
import {
  CLASS_POLICY,
  DEFAULT_SCREENING_CONFIG,
  EVASION_MULTIPLIER,
  SCREENING_CLASSES,
  SCREENING_ENGINE_VERSION,
  SCREENING_RECORD_THRESHOLD,
  emptyClassScores,
  isQuarantined,
  screenContent,
  type ScreeningClass,
} from '..';
import { buildSignature, signatureSimilarity } from '../signature';

/**
 * The corpus is the contract. Every adversarial case must be held in its named
 * class, and every clean case must publish. A change that trades one for the
 * other has to change these fixtures, in the open, with a reason.
 */
describe('screenContent: adversarial corpus', () => {
  for (const testCase of ADVERSARIAL_CASES) {
    it(`holds "${testCase.name}" (${testCase.exercises})`, () => {
      const verdict = screenContent({
        kind: testCase.kind,
        text: testCase.text,
        title: testCase.title,
        links: testCase.links,
      });
      expect(isQuarantined(verdict), `expected a hold, got ${verdict.decision}`).toBe(true);
      expect(verdict.classScores[testCase.expectClass]).toBeGreaterThanOrEqual(
        CLASS_POLICY[testCase.expectClass].quarantineAt,
      );
      expect(verdict.thresholdHit).not.toBeNull();
      expect(verdict.explanations.length).toBeGreaterThan(0);
      for (const explanation of verdict.explanations) {
        expect(explanation).not.toContain('—');
      }
    });

    if (testCase.expectHumanOnly) {
      it(`routes "${testCase.name}" to a human and forbids auto-clear`, () => {
        const verdict = screenContent({
          kind: testCase.kind,
          text: testCase.text,
          title: testCase.title,
        });
        expect(verdict.decision).toBe('human-review');
        expect(verdict.requiresHumanReview).toBe(true);
      });
    }
  }
});

describe('screenContent: clean corpus (false-positive control)', () => {
  for (const testCase of CLEAN_CASES) {
    it(`publishes "${testCase.name}" (${testCase.exercises})`, () => {
      const verdict = screenContent({
        kind: testCase.kind,
        text: testCase.text,
        title: testCase.title,
        links: testCase.links,
      });
      expect(
        verdict.decision,
        `held on ${verdict.thresholdHit}: ${verdict.explanations.join(' | ')}`,
      ).toBe('allow');
      expect(verdict.thresholdHit).toBeNull();
      expect(verdict.requiresHumanReview).toBe(false);
    });
  }
});

describe('screenContent: determinism', () => {
  it('returns an identical verdict for identical input', () => {
    const input = {
      kind: 'article' as const,
      text: ADVERSARIAL_CASES[0]!.text,
      title: 'a headline',
    };
    expect(screenContent(input)).toEqual(screenContent(input));
  });

  it('orders signals deterministically regardless of detector order', () => {
    const verdict = screenContent({
      kind: 'comment',
      text: ADVERSARIAL_CASES[18]!.text,
      links: ADVERSARIAL_CASES[18]!.links,
    });
    const weights = verdict.signals.map((signal) => signal.weight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!).toBeLessThanOrEqual(weights[i - 1]!);
    }
  });

  it('stamps the engine version on every verdict', () => {
    expect(screenContent({ kind: 'comment', text: 'hello' }).engineVersion).toBe(
      SCREENING_ENGINE_VERSION,
    );
  });

  it('handles empty and whitespace-only input without holding it', () => {
    for (const text of ['', '   ', '\n\n\t']) {
      const verdict = screenContent({ kind: 'comment', text });
      expect(verdict.decision).toBe('allow');
      expect(verdict.score).toBe(0);
    }
  });
});

describe('screenContent: scoring structure', () => {
  it('saturates every class score at 1', () => {
    const verdict = screenContent({
      kind: 'comment',
      text: `${ADVERSARIAL_CASES[0]!.text} ${ADVERSARIAL_CASES[6]!.text} ${ADVERSARIAL_CASES[9]!.text}`,
    });
    for (const cls of SCREENING_CLASSES) {
      expect(verdict.classScores[cls]).toBeLessThanOrEqual(1);
      expect(verdict.classScores[cls]).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports the class that drove the decision as topClass', () => {
    const verdict = screenContent({ kind: 'comment', text: ADVERSARIAL_CASES[9]!.text });
    expect(verdict.topClass).toBe('self-harm');
    expect(verdict.thresholdHit).toBe(`self-harm>=${CLASS_POLICY['self-harm'].quarantineAt}`);
    expect(verdict.score).toBe(verdict.classScores['self-harm']);
  });

  it('picks the most severe class when several cross their thresholds', () => {
    const verdict = screenContent({
      kind: 'comment',
      // A child-safety cooccurrence and a hate slur in one submission.
      text: 'she is 13 yo, send pics, and you are a kike anyway',
    });
    expect(verdict.topClass).toBe('child-safety');
    expect(verdict.requiresHumanReview).toBe(true);
  });

  it('does not let structure anomalies alone hold an article', () => {
    // All-caps, one repeated word, and a truncation-free body: spam evidence but
    // nowhere near the spam threshold on its own.
    const verdict = screenContent({
      kind: 'article',
      text: `${'BUDGET '.repeat(25)}the council approved it`,
    });
    expect(verdict.classScores.spam).toBeGreaterThan(0);
    expect(verdict.decision).toBe('allow');
  });

  it('records a below-threshold flag for measurement', () => {
    // Enough promotional signal to clear the record threshold without reaching
    // the spam threshold.
    const verdict = screenContent({
      kind: 'comment',
      text: 'limited time offer, work from home, passive income, visit my website',
    });
    expect(verdict.decision).toBe('allow');
    expect(verdict.score).toBeGreaterThanOrEqual(SCREENING_RECORD_THRESHOLD);
    expect(verdict.recorded).toBe(true);
  });

  it('does not record an unremarkable allow', () => {
    const verdict = screenContent({ kind: 'comment', text: CLEAN_CASES[0]!.text });
    expect(verdict.recorded).toBe(false);
  });
});

describe('screenContent: evasion aggravation', () => {
  it('scores an obfuscated slur above the same slur in the clear', () => {
    const plain = screenContent({ kind: 'comment', text: 'you absolute faggot' });
    const obfuscated = screenContent({ kind: 'comment', text: 'you absolute f4gg0t' });
    expect(obfuscated.classScores.hate).toBeGreaterThan(plain.classScores.hate);
    expect(obfuscated.signals.some((signal) => signal.obfuscated === true)).toBe(true);
  });

  it('applies the evasion multiplier to risk classes but not to spam', () => {
    const verdict = screenContent({
      kind: 'comment',
      text: 'you absolute f4gg0t, limited time offer',
    });
    const spamOnly = screenContent({ kind: 'comment', text: 'limited time offer' });
    expect(verdict.classScores.spam).toBeCloseTo(spamOnly.classScores.spam, 10);
    expect(EVASION_MULTIPLIER).toBeGreaterThan(1);
  });

  it('lets the evasion multiplier alone carry a borderline hit over the line', () => {
    // A contested term scores 0.4, which is under the 0.55 hate threshold even
    // with the obfuscated-match bonus (0.46). The class-level evasion multiplier
    // is what takes it to 0.598, so this case fails if that multiplier stops
    // being applied. Its plain-text twin below must stay publishable, which is
    // what makes this a test of the multiplier rather than of the lexicon.
    const obfuscated = screenContent({ kind: 'comment', text: 'stop being such a qu33r about it' });
    const plain = screenContent({ kind: 'comment', text: 'stop being such a queer about it' });
    expect(plain.decision).toBe('allow');
    expect(obfuscated.decision).toBe('quarantine');
    expect(obfuscated.classScores.hate).toBeCloseTo(
      Math.min(1, 0.4 * 1.15 * EVASION_MULTIPLIER),
      5,
    );
  });

  it('scores a quoted slur below the same slur used as an attack', () => {
    const attack = screenContent({ kind: 'comment', text: 'you are a kike, plain and simple' });
    const quoted = screenContent({
      kind: 'article',
      text: 'He used the word "kike" in the recording, which he later confirmed.',
    });
    expect(quoted.classScores.hate).toBeLessThan(attack.classScores.hate);
    expect(quoted.decision).toBe('allow');
  });
});

describe('screenContent: near-duplicate flooding', () => {
  const text = 'the council approved the transit budget after three months of public hearings';

  it('flags a repost that matches enough recent submissions', () => {
    const first = screenContent({ kind: 'comment', text });
    const recent = [first.signature, first.signature];
    const repost = screenContent({ kind: 'comment', text, recentSignatures: recent });
    expect(repost.signals.some((s) => s.code === 'flood.near-duplicate-repost')).toBe(true);
  });

  it('does not flag a single prior match', () => {
    const first = screenContent({ kind: 'comment', text });
    const second = screenContent({ kind: 'comment', text, recentSignatures: [first.signature] });
    expect(second.signals.some((s) => s.code === 'flood.near-duplicate-repost')).toBe(false);
  });

  it('does not flag unrelated recent submissions', () => {
    const other = screenContent({ kind: 'comment', text: CLEAN_CASES[3]!.text });
    const verdict = screenContent({
      kind: 'comment',
      text,
      recentSignatures: [other.signature, other.signature, other.signature],
    });
    expect(verdict.signals.some((s) => s.code === 'flood.near-duplicate-repost')).toBe(false);
  });

  it('never flags empty text as a flood', () => {
    const empty = screenContent({ kind: 'comment', text: '' });
    const verdict = screenContent({
      kind: 'comment',
      text: '',
      recentSignatures: [empty.signature, empty.signature, empty.signature],
    });
    expect(verdict.signals.some((s) => s.code === 'flood.near-duplicate-repost')).toBe(false);
  });

  it('produces the same signature for the same bytes and seed', () => {
    const a = buildSignature(text.split(' '), { seed: 7, shingleWidth: 5, slots: 32 });
    const b = buildSignature(text.split(' '), { seed: 7, shingleWidth: 5, slots: 32 });
    expect(a).toEqual(b);
    expect(signatureSimilarity(a, b)).toBe(1);
  });

  it('refuses to compare signatures built with a different seed', () => {
    const a = buildSignature(text.split(' '), { seed: 7, shingleWidth: 5, slots: 32 });
    const b = buildSignature(text.split(' '), { seed: 8, shingleWidth: 5, slots: 32 });
    expect(signatureSimilarity(a, b)).toBe(0);
  });

  it('refuses even when the slots coincide, so the seed guard is load-bearing', () => {
    // Empty text yields all-zero slots under every seed. Without the seed check,
    // two unrelated empty signatures would compare as identical, which is how a
    // seed change would silently turn every stored signature into a false match.
    const a = buildSignature([], { seed: 7, shingleWidth: 5, slots: 32 });
    const b = buildSignature([], { seed: 8, shingleWidth: 5, slots: 32 });
    expect(a.slots).toEqual(b.slots);
    expect(signatureSimilarity(a, b)).toBe(0);
  });

  it('refuses to compare signatures built under a different version', () => {
    const a = buildSignature(text.split(' '), { seed: 7, shingleWidth: 5, slots: 32 });
    expect(signatureSimilarity(a, { ...a, version: a.version + 1 })).toBe(0);
  });
});

describe('screening configuration', () => {
  it('pins the default config', () => {
    expect(DEFAULT_SCREENING_CONFIG.signatureSeed).toBe(0x5eed_1234);
    expect(DEFAULT_SCREENING_CONFIG.shingleWidth).toBe(5);
    expect(DEFAULT_SCREENING_CONFIG.signatureSlots).toBe(32);
    expect(DEFAULT_SCREENING_CONFIG.floodSimilarity).toBe(0.9);
    expect(DEFAULT_SCREENING_CONFIG.floodMinMatches).toBe(2);
    expect(DEFAULT_SCREENING_CONFIG.recordThreshold).toBe(SCREENING_RECORD_THRESHOLD);
    expect(DEFAULT_SCREENING_CONFIG.maxScanChars).toBe(400_000);
  });

  it('pins every class threshold and the human-only classes', () => {
    expect(CLASS_POLICY).toEqual({
      'child-safety': { quarantineAt: 0.25, humanOnly: true },
      'self-harm': { quarantineAt: 0.4, humanOnly: true },
      threats: { quarantineAt: 0.55, humanOnly: false },
      hate: { quarantineAt: 0.55, humanOnly: false },
      'doxxing-privacy': { quarantineAt: 0.6, humanOnly: false },
      'fraud-scam': { quarantineAt: 0.65, humanOnly: false },
      spam: { quarantineAt: 0.75, humanOnly: false },
    });
  });

  it('orders the class list severity-first so the first threshold hit is the worst', () => {
    const thresholds = SCREENING_CLASSES.map((cls) => CLASS_POLICY[cls].quarantineAt);
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]!).toBeGreaterThanOrEqual(thresholds[i - 1]!);
    }
  });

  it('honors a tightened threshold from config', () => {
    const text = 'limited time offer, work from home, passive income';
    expect(screenContent({ kind: 'comment', text }).decision).toBe('allow');
    const strict = screenContent(
      { kind: 'comment', text },
      {
        ...DEFAULT_SCREENING_CONFIG,
        classPolicy: {
          ...CLASS_POLICY,
          spam: { quarantineAt: 0.1, humanOnly: false },
        },
      },
    );
    expect(strict.decision).toBe('quarantine');
    expect(strict.topClass).toBe('spam');
  });

  it('zeroes every class in an empty score map', () => {
    const scores = emptyClassScores();
    for (const cls of SCREENING_CLASSES) expect(scores[cls as ScreeningClass]).toBe(0);
  });
});

describe('screenContent: hostile size', () => {
  it('bounds work and reports truncation instead of hiding it', () => {
    const verdict = screenContent(
      { kind: 'article', text: 'a'.repeat(5_000) },
      { ...DEFAULT_SCREENING_CONFIG, maxScanChars: 1_000 },
    );
    expect(verdict.signals.some((s) => s.code === 'structure.scan-truncated')).toBe(true);
  });

  it('still finds a term inside a large body', () => {
    const filler = `${CLEAN_CASES[0]!.text} `.repeat(40);
    const verdict = screenContent({
      kind: 'article',
      text: `${filler} i will kill you ${filler}`,
    });
    expect(isQuarantined(verdict)).toBe(true);
    expect(verdict.topClass).toBe('threats');
  });
});

describe('screenContent: WP12 evasion regressions', () => {
  it('catches a single doubled letter (finding A1): elongation must not evade', () => {
    // collapseRepeats only folds runs of 3+, so a doubled letter used to be a
    // fixed point that scored 0 with no evasion penalty. Elongation-tolerant
    // literals close it.
    for (const text of [
      'i will kkill you tomorrow at your house',
      'shoot up the sschool',
      'i will killl you', // triple still caught (was already, keep it pinned)
    ]) {
      expect(isQuarantined(screenContent({ kind: 'article', text })), text).toBe(true);
    }
  });

  it('does not invent a match for a DROPPED letter', () => {
    // Elongation tolerance requires at least the original letters. "as" must
    // never match a term like "ass"; dropping a letter is a different string,
    // not the term. This guards the false-positive direction of the A1 fix.
    const verdict = screenContent({ kind: 'article', text: 'the class met as planned' });
    expect(verdict.decision).toBe('allow');
  });

  it('an apostrophe no longer halves every later weight (finding A2)', () => {
    const plain = screenContent({ kind: 'article', text: 'i will kill you tomorrow at your house' });
    const withApostrophe = screenContent({
      kind: 'article',
      text: "he said he didn't care. i will kill you tomorrow at your house",
    });
    // The contraction must not flip the verdict or discount the threat.
    expect(isQuarantined(plain)).toBe(true);
    expect(isQuarantined(withApostrophe)).toBe(true);
    const plainTop = Math.max(...plain.signals.map((s) => s.weight));
    const apostropheTop = Math.max(...withApostrophe.signals.map((s) => s.weight));
    expect(apostropheTop).toBe(plainTop);
  });

  it('a genuine double-quoted quotation still gets the quoted discount', () => {
    // The A2 fix must not remove the legitimate journalism mitigation.
    const reported = screenContent({
      kind: 'article',
      text: 'the complaint quoted him: "i will kill you tomorrow at your house"',
    });
    const direct = screenContent({ kind: 'article', text: 'i will kill you tomorrow at your house' });
    const reportedTop = Math.max(...reported.signals.map((s) => s.weight), 0);
    const directTop = Math.max(...direct.signals.map((s) => s.weight), 0);
    expect(reportedTop).toBeLessThan(directTop);
  });
});

describe('screenContent: advisory-framing abuse (finding A3)', () => {
  const SCAM =
    'your account will be suspended unless you verify your identity to unlock it, send your seed phrase to our official support team';

  it('generic warning vocabulary alone cannot exempt a live scam', () => {
    const bare = screenContent({ kind: 'comment', text: SCAM });
    const withGeneric = screenContent({ kind: 'comment', text: `${SCAM} beware of phishing` });
    expect(isQuarantined(bare)).toBe(true);
    expect(isQuarantined(withGeneric)).toBe(true);
  });

  it('a genuine advisory with a self-identifying marker still gets the discount', () => {
    const advisory = screenContent({
      kind: 'article',
      text: 'attackers ask you to verify your identity to unlock it. this is a scam warning; report it to the attorney general and consumer protection.',
    });
    expect(advisory.signals.some((s) => s.code === 'context.advisory-framing')).toBe(true);
  });
});

describe('screenContent: quoted-context abuse (finding A2 residual)', () => {
  const THREAT = 'i will kill you tomorrow at your house';
  const GROOM = 'are you home alone? do not tell your parents, switch to telegram';

  it('a single leading double-quote does not exempt a later match', () => {
    // The odd-parity-from-field-start predicate credited every match after one
    // stray quote. A lone leading quote has no CLOSE nearby, so no discount.
    expect(isQuarantined(screenContent({ kind: 'article', text: `" ${THREAT}` }))).toBe(true);
    expect(isQuarantined(screenContent({ kind: 'article', text: `" ${GROOM}` }))).toBe(true);
  });

  it('wrapping the whole document in one quote pair does not exempt a mid-document match', () => {
    const filler = 'the valley faces a hard season and the county filed its report. '.repeat(6);
    const wrapped = `"${filler}${THREAT}${filler}"`;
    expect(isQuarantined(screenContent({ kind: 'article', text: wrapped }))).toBe(true);
  });

  it('a humanOnly class (child-safety, self-harm) is never quoted-discounted', () => {
    // Even a genuinely quoted grooming indicator must reach human review.
    const quoted = screenContent({ kind: 'article', text: `the filing quoted the message: "${GROOM}"` });
    expect(quoted.decision).toBe('human-review');
  });

  it('a genuinely quoted non-severe match is still discounted (mitigation preserved)', () => {
    const direct = screenContent({ kind: 'article', text: THREAT });
    const quoted = screenContent({ kind: 'article', text: `the complaint quoted him: "${THREAT}"` });
    expect(isQuarantined(direct)).toBe(true);
    // The bounded, closed quotation still earns the discount and clears.
    expect(quoted.decision).toBe('allow');
  });
});
