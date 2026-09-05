import { describe, expect, it } from 'vitest';
import { safeCitations } from '../lib/format';

describe('safeCitations', () => {
  it('keeps https URLs', () => {
    expect(safeCitations(['https://a.example/x', 'https://b.example/y'])).toEqual([
      'https://a.example/x',
      'https://b.example/y',
    ]);
  });

  it('drops javascript:, data:, and http: URLs so no unsafe href renders (F2)', () => {
    expect(
      safeCitations([
        'https://ok.example/source',
        // eslint-disable-next-line no-script-url
        'javascript:alert(document.cookie)',
        'data:text/html,<script>1</script>',
        'http://insecure.example',
      ]),
    ).toEqual(['https://ok.example/source']);
  });

  it('returns empty for an empty list', () => {
    expect(safeCitations([])).toEqual([]);
  });
});
