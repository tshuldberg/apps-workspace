// Plan 38 Phase 6 (MOBILE): sealed epub/cbz reader pure-core tests. epub/cbz
// bytes are attacker-controlled, so the sanitation + network-strip + XXE-free OPF
// parsing are all exercised here.

import { describe, it, expect } from 'vitest';
import {
  isImageEntry,
  naturalCompare,
  sortImageEntries,
  imageMimeForEntry,
  parseContainerRootfile,
  parseOpfSpine,
  joinArchivePath,
  stripActiveContent,
  inlineResourceUrls,
  buildSandboxedChapter,
  encodeReaderPosition,
  decodeReaderPosition,
  readerKindFor,
  EPUB_CHAPTER_CSP,
} from './library-reader-core';

describe('CBZ page selection', () => {
  it('detects image entries and skips hidden/system files', () => {
    expect(isImageEntry('page01.jpg')).toBe(true);
    expect(isImageEntry('sub/page.png')).toBe(true);
    expect(isImageEntry('.thumb.jpg')).toBe(false);
    expect(isImageEntry('__MACOSX/page.jpg')).toBe(false);
    expect(isImageEntry('notes.txt')).toBe(false);
    expect(isImageEntry('cover.svg')).toBe(false);
  });

  it('sorts pages in natural order', () => {
    expect(naturalCompare('page2', 'page10')).toBeLessThan(0);
    expect(sortImageEntries(['p10.jpg', 'p2.jpg', 'p1.jpg', 'notes.txt'])).toEqual(['p1.jpg', 'p2.jpg', 'p10.jpg']);
  });

  it('maps page extensions to data-URI mimes', () => {
    expect(imageMimeForEntry('a.jpg')).toBe('image/jpeg');
    expect(imageMimeForEntry('a.PNG')).toBe('image/png');
    expect(imageMimeForEntry('a.webp')).toBe('image/webp');
  });
});

describe('EPUB OPF parsing (no XML parser -> XXE-free)', () => {
  it('extracts the rootfile path from container.xml', () => {
    const xml = `<?xml version="1.0"?><container><rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles></container>`;
    expect(parseContainerRootfile(xml)).toBe('OEBPS/content.opf');
  });

  it('ignores a DOCTYPE / entity block entirely (no expansion)', () => {
    const evil = `<?xml version="1.0"?>
      <!DOCTYPE container [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
      <container><rootfiles><rootfile full-path="a/b.opf"/></rootfiles></container>`;
    // The path is still read; the entity is never expanded (it stays literal text).
    expect(parseContainerRootfile(evil)).toBe('a/b.opf');
  });

  it('resolves the manifest+spine into ordered chapter paths', () => {
    const opf = `<package><manifest>
        <item id="c1" href="ch1.xhtml"/>
        <item id="c2" href="nested/ch2.xhtml"/>
        <item id="css" href="style.css"/>
      </manifest><spine>
        <itemref idref="c1"/>
        <itemref idref="c2"/>
      </spine></package>`;
    const spine = parseOpfSpine('OEBPS/content.opf', opf);
    expect(spine.opfDir).toBe('OEBPS');
    expect(spine.hrefs).toEqual(['OEBPS/ch1.xhtml', 'OEBPS/nested/ch2.xhtml']);
  });

  it('joins archive paths with ../ and ./ resolution', () => {
    expect(joinArchivePath('OEBPS/text', '../images/a.png')).toBe('OEBPS/images/a.png');
    expect(joinArchivePath('OEBPS', './ch1.xhtml')).toBe('OEBPS/ch1.xhtml');
  });
});

describe('chapter sanitation + network strip', () => {
  it('strips scripts, event handlers, and javascript: URLs', () => {
    const dirty = `<p onclick="steal()">hi</p><script>evil()</script><a href="javascript:alert(1)">x</a>`;
    const clean = stripActiveContent(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
  });

  it('neutralizes external URLs and inlines in-archive assets via resolve', () => {
    const html = `<img src="images/a.png"><img src="https://evil.example/track.gif"><img src="data:image/png;base64,AAAA">`;
    const out = inlineResourceUrls(html, 'OEBPS/ch1.xhtml', (p) =>
      p === 'OEBPS/images/a.png' ? 'data:image/png;base64,LOCAL' : null);
    expect(out).toContain('data:image/png;base64,LOCAL');
    expect(out).toContain('data:image/png;base64,AAAA'); // pre-existing data URI kept
    expect(out).not.toContain('evil.example');            // external neutralized
  });

  it('builds a network-blocked chapter document with a default-src none CSP', () => {
    const doc = buildSandboxedChapter('<p>chapter</p>');
    expect(doc.csp).toBe(EPUB_CHAPTER_CSP);
    expect(doc.html).toContain("default-src 'none'");
    expect(doc.html).toContain('<p>chapter</p>');
  });
});

describe('resume position codec', () => {
  it('cbz round-trips a page index', () => {
    expect(encodeReaderPosition('cbz', { index: 42 })).toBe(42);
    expect(decodeReaderPosition('cbz', 42)).toEqual({ index: 42, fraction: 0 });
  });

  it('epub round-trips spine index + scroll fraction', () => {
    const packed = encodeReaderPosition('epub', { index: 7, fraction: 0.5 });
    const un = decodeReaderPosition('epub', packed);
    expect(un.index).toBe(7);
    expect(un.fraction).toBeCloseTo(0.5, 3);
  });

  it('classifies reader targets by mime and title', () => {
    expect(readerKindFor('application/epub+zip', null)).toBe('epub');
    expect(readerKindFor(null, 'Book.epub')).toBe('epub');
    expect(readerKindFor('application/vnd.comicbook+zip', null)).toBe('cbz');
    expect(readerKindFor(null, 'Issue 1.cbz')).toBe('cbz');
    expect(readerKindFor('video/mp4', 'movie.mp4')).toBeNull();
  });
});
