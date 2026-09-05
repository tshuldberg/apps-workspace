import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenText } from '../(root)/lib/announce';

/**
 * Plan 48 WP10 accessibility invariants.
 *
 * These are source-level guards rather than rendering tests because the suite runs
 * in a node environment with no JSX (see CLAUDE.md). They cannot prove VoiceOver
 * says the right thing, but they do stop the three regressions that actually
 * happened here: a control with no accessible name, an input whose label is only a
 * placeholder, and an error message a screen reader never mentions.
 */

/** Source with comments removed, so a doc comment cannot satisfy an assertion
 * about code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const appRoot = join(__dirname, '..');

function screenFiles(): string[] {
  return readdirSync(appRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Opening tags of `<name ...>`, tolerating `>` inside braces and strings. */
function openingTags(src: string, name: string): Array<{ line: number; attrs: string }> {
  const out: Array<{ line: number; attrs: string }> = [];
  const token = `<${name}`;
  let i = 0;
  for (;;) {
    i = src.indexOf(token, i);
    if (i === -1) return out;
    let j = i + token.length;
    let depth = 0;
    let quote: string | null = null;
    while (j < src.length) {
      const c = src[j]!;
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
      j += 1;
    }
    out.push({ line: src.slice(0, i).split('\n').length, attrs: src.slice(i, j) });
    i = j;
  }
}

describe('every text input names itself', () => {
  it('sets accessibilityLabel on every TextInput', () => {
    const offenders: string[] = [];
    let total = 0;
    for (const file of screenFiles()) {
      const src = readFileSync(file, 'utf8');
      for (const { line, attrs } of openingTags(src, 'TextInput')) {
        total += 1;
        if (!attrs.includes('accessibilityLabel')) {
          offenders.push(`${file.slice(appRoot.length + 1)}:${line}`);
        }
      }
    }
    // A placeholder is not a label: iOS reads it only while the field is empty,
    // so the moment the user types, the field stops saying what it is.
    expect(offenders).toEqual([]);
    expect(total).toBeGreaterThanOrEqual(30);
  });
});

describe('every pressable declares a role', () => {
  it('sets accessibilityRole on every Pressable and TouchableOpacity', () => {
    const offenders: string[] = [];
    let total = 0;
    for (const file of screenFiles()) {
      const src = readFileSync(file, 'utf8');
      for (const name of ['Pressable', 'TouchableOpacity']) {
        for (const { line, attrs } of openingTags(src, name)) {
          total += 1;
          if (!attrs.includes('accessibilityRole')) {
            offenders.push(`${file.slice(appRoot.length + 1)}:${line}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
    expect(total).toBeGreaterThanOrEqual(55);
  });
});

describe('every visual selection state has an accessibility state', () => {
  it('pairs an active/selected style with accessibilityState', () => {
    const offenders: string[] = [];
    let paired = 0;
    for (const file of screenFiles()) {
      const src = readFileSync(file, 'utf8');
      for (const name of ['Pressable', 'TouchableOpacity']) {
        for (const { line, attrs } of openingTags(src, name)) {
          const showsSelection = /&&\s*styles\.\w*(Active|Selected|On)\b/.test(attrs);
          if (!showsSelection) continue;
          if (attrs.includes('accessibilityState')) paired += 1;
          else offenders.push(`${file.slice(appRoot.length + 1)}:${line}`);
        }
      }
    }
    // A control that looks selected but does not say so leaves a screen-reader
    // user unable to tell which option is chosen.
    expect(offenders).toEqual([]);
    expect(paired).toBeGreaterThanOrEqual(5);
  });
});

describe('errors reach a screen reader', () => {
  it('renders every error through ErrorText, never a bare Text', () => {
    const offenders: string[] = [];
    let usages = 0;
    for (const file of screenFiles()) {
      const src = readFileSync(file, 'utf8');
      if (src.includes('<Text style={styles.error}>')) {
        offenders.push(file.slice(appRoot.length + 1));
      }
      usages += src.split('<ErrorText').length - 1;
    }
    expect(offenders).toEqual([]);
    expect(usages).toBeGreaterThanOrEqual(38);
  });

  it('keeps both announcement mechanisms in ErrorText', () => {
    // Comments are stripped first. Both mechanisms are NAMED in this file's doc
    // comment, so scanning the raw text would keep passing after the code that
    // implements them was deleted.
    const src = stripComments(
      readFileSync(join(appRoot, '(root)/components/ErrorText.tsx'), 'utf8'),
    );
    // Android announces from the live region; iOS VoiceOver stays silent without
    // an explicit announcement, so losing either one silences a platform.
    expect(src).toContain('accessibilityLiveRegion="assertive"');
    expect(src).toContain('announceForAccessibility');
    expect(src).toContain("Platform.OS !== 'ios'");
  });
});

describe('flattenText', () => {
  it('reads a plain string message', () => {
    expect(flattenText('Could not publish.')).toBe('Could not publish.');
  });

  it('joins an interpolated message into one announceable sentence', () => {
    expect(flattenText(['Could not load your profile: ', 'network error'])).toBe(
      'Could not load your profile: network error',
    );
  });

  it('collapses the whitespace JSX leaves between children', () => {
    expect(flattenText(['Line one', '\n   ', 'line two'])).toBe('Line one line two');
  });

  it('collapses runs of whitespace inside a child, which trimming cannot reach', () => {
    // Isolates the collapse from the trim: the doubled space is interior, so only
    // the replace can remove it.
    expect(flattenText(['Could not   publish', 'try again'])).toBe('Could not publish try again');
  });

  it('is empty for nothing to announce, so no empty announcement fires', () => {
    expect(flattenText(null)).toBe('');
    expect(flattenText(undefined)).toBe('');
    expect(flattenText(false)).toBe('');
    expect(flattenText([])).toBe('');
  });

  it('skips element children rather than guessing at their text', () => {
    const element = { type: 'Text', props: { children: 'nested' } } as unknown as React.ReactNode;
    expect(flattenText(element)).toBe('');
  });

  it('does not leave the gap a skipped child opens at the start', () => {
    // A skipped element contributes an empty string, so the join leaves a leading
    // space that only the outer trim removes.
    const element = { type: 'Text', props: {} } as unknown as React.ReactNode;
    expect(flattenText([element, 'Could not publish'])).toBe('Could not publish');
  });

  it('trims a single padded string child', () => {
    expect(flattenText('   Could not publish.   ')).toBe('Could not publish.');
  });

  it('reads a numeric child', () => {
    expect(flattenText(['Retry in ', 30, ' seconds'])).toBe('Retry in 30 seconds');
  });
});

describe('locale is declared explicitly', () => {
  it('declares English in the iOS bundle rather than inheriting a build default', () => {
    const app = JSON.parse(readFileSync(join(appRoot, '..', 'app.json'), 'utf8')) as {
      expo: { ios: { infoPlist?: Record<string, unknown> } };
    };
    expect(app.expo.ios.infoPlist?.CFBundleDevelopmentRegion).toBe('en');
    // The app genuinely ships one language; claiming mixed localizations would be
    // a bundle-level claim it cannot back.
    expect(app.expo.ios.infoPlist?.CFBundleAllowMixedLocalizations).toBe(false);
  });
});

describe('reduced motion', () => {
  it('has no animation to reduce, which is why no reduced-motion branch exists', () => {
    const animated: string[] = [];
    for (const file of screenFiles()) {
      const src = readFileSync(file, 'utf8');
      if (/\bAnimated\.|LayoutAnimation|react-native-reanimated|withTiming\(/.test(src)) {
        animated.push(file.slice(appRoot.length + 1));
      }
    }
    // This is the evidence behind the WP10 note that the reduced-motion check is
    // a no-op here. The day someone adds an animation, this fails and the
    // AccessibilityInfo.isReduceMotionEnabled branch has to come with it.
    expect(animated).toEqual([]);
  });
});
