// Plan 38 Phase 6 (WEB): pure sealed-reader helpers. Locks the epub sandbox
// guards (script never executes, network blocked, external URLs neutralized),
// the OPF/spine extraction (XXE-proof: no entity expansion), cbz page ordering,
// and the resume-position round trip.

import { describe, expect, it } from 'vitest';
import {
  EPUB_CHAPTER_CSP,
  EPUB_IFRAME_SANDBOX,
  buildSandboxedChapter,
  decodeReaderPosition,
  encodeReaderPosition,
  inlineResourceUrls,
  joinArchivePath,
  parseContainerRootfile,
  parseOpfSpine,
  readerKindFor,
  sortImageEntries,
  stripActiveContent,
} from '../library-reader-core';

describe('cbz page ordering', () => {
  it('keeps only images and sorts them in natural order', () => {
    const names = [
      'comic/page10.jpg', 'comic/page2.jpg', 'comic/page1.jpg',
      'comic/cover.png', 'comic/notes.txt', '__MACOSX/comic/._page1.jpg', 'comic/.hidden.jpg',
    ];
    expect(sortImageEntries(names)).toEqual([
      'comic/cover.png', 'comic/page1.jpg', 'comic/page2.jpg', 'comic/page10.jpg',
    ]);
  });
});

describe('epub OPF/spine extraction', () => {
  const container =
    '<?xml version="1.0"?><container><rootfiles>' +
    '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
    '</rootfiles></container>';
  const opf =
    '<package><manifest>' +
    '<item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="css" href="style/main.css" media-type="text/css"/>' +
    '</manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>';

  it('reads the OPF path from container.xml', () => {
    expect(parseContainerRootfile(container)).toBe('OEBPS/content.opf');
  });

  it('resolves spine hrefs against the OPF directory in order', () => {
    const spine = parseOpfSpine('OEBPS/content.opf', opf);
    expect(spine.opfDir).toBe('OEBPS');
    expect(spine.hrefs).toEqual(['OEBPS/text/ch1.xhtml', 'OEBPS/text/ch2.xhtml']);
  });

  it('never expands a DOCTYPE entity (XXE-proof)', () => {
    const malicious =
      '<!DOCTYPE package [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' +
      '<package><manifest><item id="a" href="&xxe;ch.xhtml" media-type="x"/></manifest>' +
      '<spine><itemref idref="a"/></spine></package>';
    const spine = parseOpfSpine('content.opf', malicious);
    // The entity is left literal, never resolved to file contents.
    expect(spine.hrefs[0]).toBe('&xxe;ch.xhtml');
  });
});

describe('epub sandbox + sanitation guards', () => {
  it('the iframe is fully sandboxed (no scripts, no same-origin)', () => {
    const doc = buildSandboxedChapter('<p>hi</p>');
    expect(doc.sandbox).toBe(EPUB_IFRAME_SANDBOX);
    expect(doc.sandbox).not.toContain('allow-scripts');
    expect(doc.sandbox).not.toContain('allow-same-origin');
    expect(doc.sandbox).toBe('');
  });

  it('the CSP blocks all network and permits no script-src', () => {
    const doc = buildSandboxedChapter('<p>hi</p>');
    expect(doc.csp).toBe(EPUB_CHAPTER_CSP);
    expect(doc.csp).toContain("default-src 'none'");
    expect(doc.csp).not.toContain('script-src');
    expect(doc.srcdoc).toContain(EPUB_CHAPTER_CSP);
  });

  it('strips <script>, event handlers, and javascript: URLs', () => {
    const dirty =
      '<p onclick="steal()">x</p><script>fetch("http://evil")</script>' +
      '<a href="javascript:alert(1)">y</a>';
    const clean = stripActiveContent(dirty);
    expect(clean).not.toContain('<script');
    expect(clean.toLowerCase()).not.toContain('onclick');
    expect(clean.toLowerCase()).not.toContain('javascript:');
  });

  it('neutralizes external resource URLs and inlines only in-archive assets', () => {
    const html =
      '<img src="http://evil.example/x.png">' +
      '<img src="//evil.example/y.png">' +
      '<img src="images/local.png">' +
      '<div style="background:url(images/bg.png)"></div>';
    const resolve = (p: string): string | null =>
      p === 'OEBPS/text/images/local.png' ? 'data:image/png;base64,AAAA'
        : p === 'OEBPS/text/images/bg.png' ? 'data:image/png;base64,BBBB'
          : null;
    const out = inlineResourceUrls(html, 'OEBPS/text/ch1.xhtml', resolve);
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('http://');
    expect(out).toContain('data:image/png;base64,AAAA');
    expect(out).toContain('data:image/png;base64,BBBB');
  });
});

describe('path resolution', () => {
  it('resolves ../ and ./ against the base', () => {
    expect(joinArchivePath('OEBPS/text', '../images/a.png')).toBe('OEBPS/images/a.png');
    expect(joinArchivePath('OEBPS/text', './b.xhtml')).toBe('OEBPS/text/b.xhtml');
    expect(joinArchivePath('', 'c.opf')).toBe('c.opf');
  });
});

describe('reader kind detection', () => {
  it('maps mime and filename to the reader', () => {
    expect(readerKindFor('application/epub+zip', null)).toBe('epub');
    expect(readerKindFor(null, 'book.EPUB')).toBe('epub');
    expect(readerKindFor('application/vnd.comicbook+zip', null)).toBe('cbz');
    expect(readerKindFor(null, 'issue.cbz')).toBe('cbz');
    expect(readerKindFor('application/pdf', 'doc.pdf')).toBe(null);
  });
});

describe('resume position round trip', () => {
  it('cbz stores the page index directly', () => {
    const packed = encodeReaderPosition('cbz', { index: 42 });
    expect(packed).toBe(42);
    expect(decodeReaderPosition('cbz', packed)).toEqual({ index: 42, fraction: 0 });
  });

  it('epub packs spine index + scroll fraction', () => {
    const packed = encodeReaderPosition('epub', { index: 7, fraction: 0.5 });
    const back = decodeReaderPosition('epub', packed);
    expect(back.index).toBe(7);
    expect(back.fraction).toBeCloseTo(0.5, 3);
  });

  it('clamps out-of-range fractions', () => {
    expect(decodeReaderPosition('epub', encodeReaderPosition('epub', { index: 0, fraction: 2 })).fraction)
      .toBeLessThan(1);
    expect(encodeReaderPosition('epub', { index: 3, fraction: -1 })).toBe(3 * 10000);
  });
});
