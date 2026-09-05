import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseReaderUpload } from '../parse-upload';

async function buildSimpleEpubBase64(): Promise<string> {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Sample EPUB</dc:title>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="chap1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chap1"/>
  </spine>
</package>`,
  );
  zip.file(
    'OEBPS/chapter1.xhtml',
    `<html><body><h1>Hello</h1><p>EPUB test paragraph.</p></body></html>`,
  );
  return zip.generateAsync({ type: 'base64' });
}

function toBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

describe('parseReaderUpload', () => {
  it('parses text files', async () => {
    const parsed = await parseReaderUpload({
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      textContent: 'Hello reader world',
    });
    expect(parsed.title).toBe('notes');
    expect(parsed.totalWords).toBe(3);
    expect(parsed.textContent).toBe('Hello reader world');
  });

  it('parses html files into clean text', async () => {
    const parsed = await parseReaderUpload({
      fileName: 'chapter.html',
      textContent: '<h1>Title</h1><p>Paragraph</p>',
    });
    expect(parsed.textContent).toContain('Title');
    expect(parsed.textContent).toContain('Paragraph');
  });

  it('parses epub files', async () => {
    const base64 = await buildSimpleEpubBase64();
    const parsed = await parseReaderUpload({
      fileName: 'book.epub',
      mimeType: 'application/epub+zip',
      base64Content: base64,
    });

    expect(parsed.title).toBe('Sample EPUB');
    expect(parsed.author).toBe('Test Author');
    expect(parsed.textContent).toContain('EPUB test paragraph.');
  });

  it('parses pdf text operators for simple PDFs', async () => {
    const pseudoPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT (Hello PDF Reader) Tj ET
endstream
endobj`;

    const parsed = await parseReaderUpload({
      fileName: 'sample.pdf',
      mimeType: 'application/pdf',
      base64Content: toBase64(pseudoPdf),
    });

    expect(parsed.fileExtension).toBe('pdf');
    expect(parsed.textContent).toContain('Hello PDF Reader');
  });

  it('parses mobi and azw-like html payloads', async () => {
    const mobiLike = `BOOKMOBI${'\u0000'.repeat(32)}<html><body><p>MOBI chapter one text.</p></body></html>`;
    const azwLike = `BOOKMOBI${'\u0000'.repeat(16)}<html><body><p>AZW chapter two text.</p></body></html>`;

    const mobi = await parseReaderUpload({
      fileName: 'book.mobi',
      mimeType: 'application/x-mobipocket-ebook',
      base64Content: toBase64(mobiLike),
    });
    expect(mobi.textContent).toContain('MOBI chapter one text.');

    const azw = await parseReaderUpload({
      fileName: 'book.azw',
      mimeType: 'application/vnd.amazon.ebook',
      base64Content: toBase64(azwLike),
    });
    expect(azw.textContent).toContain('AZW chapter two text.');
  });
});
