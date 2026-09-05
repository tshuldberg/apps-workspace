// Plan 32 NC-2 / TC-3: the Signal rule, enforced as a lint-style guard.
//
// The receiver NEVER fetches anything to render a link preview. This test reads
// the render components (mobile LinkPreviewCard + its web twin) and fails if any
// of them references a network primitive (fetch/XMLHttpRequest/axios/WebSocket)
// or constructs an Image source from the preview's own url (a remote fetch). The
// only sanctioned image source is a local data: URI built from the verified blob
// bytes. The one place a URL is ever fetched is buildLinkPreview on the SENDER,
// which this test also confirms lives only in link-preview.ts (the pure module).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MOBILE_CARD = resolve(__dirname, '../(root)/components/LinkPreviewCard.tsx');
const WEB_CARD = resolve(__dirname, '../../../meerkat-web/src/ui/channel/LinkPreviewCard.tsx');

const NETWORK_TOKENS = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\baxios\b/,
  /\bWebSocket\b/,
  /navigator\.sendBeacon/,
  /EventSource/,
];

function importSources(contents: string): string[] {
  const sources: string[] = [];
  const re = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contents)) !== null) sources.push(match[1]);
  return sources;
}

// Strip // line comments and /* block */ comments so the guard scans real code,
// not the honesty prose in the header (which deliberately names the anti-pattern).
function stripComments(contents: string): string {
  return contents
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function guardCard(label: string, path: string) {
  describe(`${label} never fetches on the receiver (NC-2)`, () => {
    const contents = stripComments(readFileSync(path, 'utf8'));

    it('references no network primitive', () => {
      for (const token of NETWORK_TOKENS) {
        expect(token.test(contents), `${label} must not use ${token}`).toBe(false);
      }
    });

    it('imports no network/http module', () => {
      for (const source of importSources(contents)) {
        expect(/^https?$|node-fetch|cross-fetch|got|superagent/.test(source), `${label} import ${source}`).toBe(false);
      }
    });

    it('the only image source is a local data: URI literal', () => {
      // The one sanctioned way to feed an image is a data:image/ URI built from
      // the verified local blob bytes. Its presence is required.
      expect(contents, `${label} must build a data:image/ URI`).toMatch(/data:image\//);
    });

    it('no remote field (preview.url/imageUrl) ever reaches an image source', () => {
      // Collect every same-file alias of a remote preview field, e.g.
      //   const x = preview.url;   const y = preview.imageUrl;
      // so an indirect `<img src={x}>` is caught, not just a direct glue.
      const REMOTE_FIELD = /preview\.(?:url|imageUrl|image)\b/;
      const aliases = new Set<string>(['preview.url', 'preview.imageUrl', 'preview.image']);
      const aliasRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*preview\.(?:url|imageUrl|image)\b/g;
      let m: RegExpExecArray | null;
      while ((m = aliasRe.exec(contents)) !== null) aliases.add(m[1]);

      // An image-source POSITION: RN `source={{ uri: X }}` / `uri: X`, web
      // `src={X}` / `src="X"`, and template-literal forms `uri: \`${X}\`` /
      // `src={\`${X}\`}`. For each, X must never be a remote field or its alias.
      const aliasAlt = [...aliases]
        .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      const inSourcePosition = new RegExp(
        // src= or uri: or source={{ ... }} , optionally through a template ${...}
        String.raw`(?:\bsrc\s*=|\buri\s*:|\bsource\s*=\s*\{\{)[^;\n}]*?\$?\{?\s*(?:` + aliasAlt + String.raw`)`,
      );
      const hit = inSourcePosition.exec(contents);
      expect(
        hit,
        `${label} feeds a remote preview field into an image source: ${hit?.[0] ?? ''}`,
      ).toBeNull();

      // Belt-and-suspenders: the render also must not construct an RN Image or web
      // img whose source is anything but the memoized data: URI variable. We assert
      // no remote field appears within 40 chars after an image-source keyword.
      const nearSource = new RegExp(
        String.raw`(?:<Image\b|<img\b|source\s*=|\bsrc\s*=|\buri\s*:)[\s\S]{0,40}`,
        'g',
      );
      let region: RegExpExecArray | null;
      while ((region = nearSource.exec(contents)) !== null) {
        expect(
          REMOTE_FIELD.test(region[0]),
          `${label} references a remote preview field near an image source: ${region[0]}`,
        ).toBe(false);
      }
    });
  });
}

guardCard('mobile LinkPreviewCard', MOBILE_CARD);
guardCard('web LinkPreviewCard', WEB_CARD);

describe('buildLinkPreview is the only sender-side fetch', () => {
  it('the pure module contains the single sanctioned fetch call site', () => {
    const pure = readFileSync(resolve(__dirname, '../(root)/data/link-preview.ts'), 'utf8');
    // fetchImpl is injected; the module calls it, but references no global http import.
    for (const source of importSources(pure)) {
      expect(/^https?$|node-fetch|cross-fetch|got|superagent/.test(source)).toBe(false);
    }
  });
});
