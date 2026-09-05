// Plan 30 TC-4: the chat kit is props-only.
//
// A lint-style guard that reads every file under components/chat/ and fails if
// any of them reach into a DATA or CAPABILITY provider (ChatProvider,
// SyncProvider, NodeProvider, IdentityProvider, DatabaseProvider) or import from
// providers/ at all. The single documented exception is chat-theme.ts, the
// theme seam, which may import ONLY AppThemeProvider (theming is app-wide and
// orthogonal to data; every capability flag still arrives as a prop).

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chatDir = resolve(__dirname, '../(root)/components/chat');
const THEME_SEAM = 'chat-theme.ts';

const FORBIDDEN_PROVIDERS = [
  'ChatProvider',
  'SyncProvider',
  'NodeProvider',
  'IdentityProvider',
  'DatabaseProvider',
];

function kitFiles(): string[] {
  return readdirSync(chatDir).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));
}

// Every module specifier a file references: static `from '...'` / `import '...'`,
// dynamic `import('...')`, and `require('...')`.
function importSources(contents: string): string[] {
  const sources: string[] = [];
  const re = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contents)) !== null) sources.push(match[1]);
  return sources;
}

describe('chat kit imports no data/capability providers (TC-4)', () => {
  const files = kitFiles();

  it('ships at least the seven kit files', () => {
    // emoji-data, chat-kit-core, chat-theme, index + the four .tsx are the floor.
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  for (const file of files) {
    it(`${file} imports no provider (theme seam excepted)`, () => {
      const contents = readFileSync(resolve(chatDir, file), 'utf8');
      const sources = importSources(contents);

      for (const source of sources) {
        for (const provider of FORBIDDEN_PROVIDERS) {
          expect(source, `${file} must not import ${provider}`).not.toContain(provider);
        }
        // Props-only contract: no coupling to any data module.
        expect(source, `${file} must not import from data/`).not.toContain('data/');
        if (file === THEME_SEAM) {
          // The one allowed provider path, theming only.
          if (source.includes('providers/')) {
            expect(source, `${THEME_SEAM} may only reach AppThemeProvider`).toContain('providers/AppThemeProvider');
          }
        } else {
          expect(source, `${file} must not import from providers/`).not.toContain('providers/');
        }
      }
    });
  }
});
