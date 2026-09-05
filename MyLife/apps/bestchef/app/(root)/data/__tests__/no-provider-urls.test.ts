import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = join(__dirname, '..', '..');

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\bapi\.anthropic\.com\b/, description: 'Anthropic API URL' },
  { pattern: /\bapi\.openai\.com\b/, description: 'OpenAI API URL' },
  { pattern: /\bfdc\.nal\.usda\.gov\b/, description: 'USDA FoodData Central URL' },
  { pattern: /ANTHROPIC_API_KEY/, description: 'ANTHROPIC_API_KEY env reference' },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry === 'i18n') continue;
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      out.push(...walk(full));
    } else if (info.isFile() && full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('BestChef public-launch provider scan', () => {
  it('does not reference third-party provider URLs or ANTHROPIC_API_KEY in app/**.tsx files', () => {
    const files = walk(APP_ROOT);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const { pattern, description } of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          offenders.push(`${file}: ${description}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
