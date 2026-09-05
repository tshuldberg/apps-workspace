import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LINK_PREVIEW_MIME_TYPE,
  LINK_PREVIEW_NAME,
  LINK_PREVIEW_JSON_CAP_BYTES,
  LINK_PREVIEW_IMAGE_MAX_DIMENSION,
  LINK_PREVIEW_READ_CAP_BYTES,
  LINK_PREVIEW_FETCH_TIMEOUT_MS,
  extractFirstUrl,
  isFetchableUrl,
  parseOgPreview,
  buildLinkPreview,
  encodeLinkPreviewAttachment,
  parseLinkPreviewAttachment,
  type LinkPreview,
} from '../(root)/data/link-preview';

// A tiny well-formed base64 JPEG: '/9j/' is the base64 of the SOI magic FF D8 FF.
const JPEG_B64 = '/9j/4AAA';

const enc = new TextEncoder();

function htmlDoc(head: string, body = ''): string {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('extractFirstUrl', () => {
  it('returns the first http(s) URL in a body', () => {
    expect(extractFirstUrl('look at https://example.com/page please')).toBe(
      'https://example.com/page',
    );
    expect(extractFirstUrl('http://plain.test and https://second.test')).toBe(
      'http://plain.test/',
    );
  });

  it('returns null when there is no URL', () => {
    expect(extractFirstUrl('just some words, no links')).toBeNull();
    expect(extractFirstUrl('')).toBeNull();
    expect(extractFirstUrl('ftp://not-http.test/file')).toBeNull();
  });

  it('strips trailing punctuation but keeps path/query', () => {
    expect(extractFirstUrl('see (https://example.com/a?b=1).')).toBe(
      'https://example.com/a?b=1',
    );
    expect(extractFirstUrl('end here: https://example.com/x!')).toBe(
      'https://example.com/x',
    );
  });

  it('rejects a URL longer than a sane cap', () => {
    const huge = `https://example.com/${'a'.repeat(5000)}`;
    expect(extractFirstUrl(huge)).toBeNull();
  });
});

describe('parseOgPreview', () => {
  it('extracts og:title / og:description / og:image (first image only)', () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="Hello World">',
        '<meta property="og:description" content="A nice page">',
        '<meta property="og:image" content="https://cdn.test/first.jpg">',
        '<meta property="og:image" content="https://cdn.test/second.jpg">',
      ].join(''),
    );
    const og = parseOgPreview(html, 'https://example.com/page');
    expect(og?.title).toBe('Hello World');
    expect(og?.description).toBe('A nice page');
    expect(og?.imageUrl).toBe('https://cdn.test/first.jpg');
  });

  it('falls back to <title> when og:title is missing', () => {
    const html = htmlDoc('<title>Doc Title</title>');
    const og = parseOgPreview(html, 'https://example.com/page');
    expect(og?.title).toBe('Doc Title');
    expect(og?.description).toBeUndefined();
    expect(og?.imageUrl).toBeUndefined();
  });

  it('returns null when there is no usable title at all', () => {
    const html = htmlDoc('<meta property="og:description" content="only desc">');
    expect(parseOgPreview(html, 'https://example.com/page')).toBeNull();
  });

  it('decodes HTML entities in extracted text', () => {
    const html = htmlDoc(
      '<meta property="og:title" content="Tom &amp; Jerry &lt;3">',
    );
    const og = parseOgPreview(html, 'https://example.com/page');
    expect(og?.title).toBe('Tom & Jerry <3');
  });

  it('resolves a relative og:image against the page URL', () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="Rel">',
        '<meta property="og:image" content="/img/hero.png">',
      ].join(''),
    );
    const og = parseOgPreview(html, 'https://example.com/a/b');
    expect(og?.imageUrl).toBe('https://example.com/img/hero.png');
  });

  it('ignores a non-http og:image (no javascript: or data: image url)', () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="Bad img">',
        '<meta property="og:image" content="javascript:alert(1)">',
      ].join(''),
    );
    const og = parseOgPreview(html, 'https://example.com/a');
    expect(og?.title).toBe('Bad img');
    expect(og?.imageUrl).toBeUndefined();
  });

  it('returns null for malformed / non-HTML input', () => {
    expect(parseOgPreview('', 'https://example.com')).toBeNull();
    expect(parseOgPreview('not html at all {[(', 'https://example.com')).toBeNull();
    expect(parseOgPreview('{"json":true}', 'https://example.com')).toBeNull();
  });
});

describe('buildLinkPreview', () => {
  const okHtml = htmlDoc(
    [
      '<meta property="og:title" content="Live Title">',
      '<meta property="og:description" content="Live desc">',
    ].join(''),
  );

  function fetchReturning(
    body: string,
    opts: { contentType?: string; ok?: boolean } = {},
  ): typeof fetch {
    return (async () =>
      ({
        ok: opts.ok ?? true,
        headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? opts.contentType ?? 'text/html; charset=utf-8' : null) },
        body: {
          getReader() {
            let done = false;
            return {
              async read() {
                if (done) return { done: true, value: undefined };
                done = true;
                return { done: false, value: enc.encode(body) };
              },
              releaseLock() {},
              cancel() {},
            };
          },
        },
        async text() {
          return body;
        },
      }) as unknown as Response) as unknown as typeof fetch;
  }

  it('returns a typed preview for a good response', async () => {
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: fetchReturning(okHtml),
    });
    expect(preview).not.toBeNull();
    expect(preview?.url).toBe('https://example.com/x');
    expect(preview?.title).toBe('Live Title');
    expect(preview?.description).toBe('Live desc');
    expect(preview?.imageBase64).toBeUndefined();
  });

  it('returns null (never throws) when fetch rejects', async () => {
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    });
    expect(preview).toBeNull();
  });

  it('returns null when the response is not ok', async () => {
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: fetchReturning(okHtml, { ok: false }),
    });
    expect(preview).toBeNull();
  });

  it('returns null for a non-HTML content-type', async () => {
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: fetchReturning('{"a":1}', { contentType: 'application/json' }),
    });
    expect(preview).toBeNull();
  });

  it('stops reading at the 512 KB cap and still parses the head', async () => {
    // A doc whose <head> is well within the cap, then megabytes of filler after.
    const bigBody = okHtml + 'x'.repeat(LINK_PREVIEW_READ_CAP_BYTES * 3);
    let bytesRead = 0;
    const cappedFetch = (async () =>
      ({
        ok: true,
        headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'text/html' : null) },
        body: {
          getReader() {
            let offset = 0;
            const buf = enc.encode(bigBody);
            return {
              async read() {
                if (offset >= buf.length) return { done: true, value: undefined };
                const chunk = buf.subarray(offset, offset + 64 * 1024);
                offset += chunk.length;
                bytesRead += chunk.length;
                return { done: false, value: chunk };
              },
              releaseLock() {},
              cancel() {},
            };
          },
        },
      }) as unknown as Response) as unknown as typeof fetch;

    const preview = await buildLinkPreview('https://example.com/x', { fetchImpl: cappedFetch });
    expect(preview?.title).toBe('Live Title');
    // We never read more than the cap plus one final chunk.
    expect(bytesRead).toBeLessThanOrEqual(LINK_PREVIEW_READ_CAP_BYTES + 64 * 1024);
  });

  function fetchPageAndImage(html: string): typeof fetch {
    return (async (url, init) => String(url).startsWith('https://cdn.test/')
      ? new Response(Uint8Array.from([255, 216, 255, 224, 0, 0]), { headers: { 'content-type': 'image/jpeg' } })
      : fetchReturning(html)(url, init)) as typeof fetch;
  }

  it('downscales og:image via the injected downscaler and embeds base64', async () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="With Image">',
        '<meta property="og:image" content="https://cdn.test/pic.jpg">',
      ].join(''),
    );
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: (async (url, init) => {
        if (String(url).includes('cdn.test')) {
          expect(init?.redirect).toBe('error');
          return new Response(Uint8Array.from([255, 216, 255, 224, 0, 0]), { headers: { 'content-type': 'image/jpeg' } });
        }
        return fetchReturning(html)(url, init);
      }) as typeof fetch,
      downscaleImage: async (local) => {
        expect(local).toBe(`data:image/jpeg;base64,${JPEG_B64}`);
        return JPEG_B64;
      },
    });
    expect(preview?.imageBase64).toBe(JPEG_B64);
  });

  it('drops a non-JPEG downscaler result to a text-only preview', async () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="Bad Image">',
        '<meta property="og:image" content="https://cdn.test/pic.jpg">',
      ].join(''),
    );
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: fetchPageAndImage(html),
      // Well-formed base64 but NOT a JPEG (no /9j/ SOI prefix): must be dropped.
      downscaleImage: async () => 'aGVsbG8h',
    });
    expect(preview?.title).toBe('Bad Image');
    expect(preview?.imageBase64).toBeUndefined();
  });

  it.each(['http://127.0.0.1/private', 'http://169.254.169.254/latest', 'http://[::1]/x', 'https://user:pass@example.com/image'])('does not fetch or decode a forbidden image target: %s', async (image) => {
    const downscale = vi.fn(async () => JPEG_B64);
    const fetcher = vi.fn(fetchReturning(htmlDoc(`<title>safe text</title><meta property="og:image" content="${image}">`)));
    const preview = await buildLinkPreview('https://example.com/', { fetchImpl: fetcher as typeof fetch, downscaleImage: downscale });
    expect(preview?.title).toBe('safe text');
    expect(preview?.imageBase64).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(downscale).not.toHaveBeenCalled();
  });

  it.each(['redirect', 'oversize', 'svg', 'no-stream'])('keeps text and refuses unsafe image responses: %s', async (kind) => {
    const downscale = vi.fn(async () => JPEG_B64);
    const fetcher: typeof fetch = async (url, init) => {
      if (!String(url).includes('cdn.test')) return fetchReturning(htmlDoc('<title>safe text</title><meta property="og:image" content="https://cdn.test/image">'))(url, init);
      expect(init?.redirect).toBe('error');
      if (kind === 'redirect') throw new TypeError('Redirect forbidden');
      if (kind === 'no-stream') return { ok: true, headers: new Headers({ 'content-type': 'image/jpeg' }), body: null } as Response;
      return new Response(new Uint8Array(kind === 'oversize' ? 2 * 1024 * 1024 + 1 : 10), { headers: { 'content-type': kind === 'svg' ? 'image/svg+xml' : 'image/jpeg' } });
    };
    const preview = await buildLinkPreview('https://example.com/', { fetchImpl: fetcher as typeof fetch, downscaleImage: downscale });
    expect(preview?.title).toBe('safe text');
    expect(preview?.imageBase64).toBeUndefined();
    expect(downscale).not.toHaveBeenCalled();
  });

  it('keeps the text preview when the downscaler returns null', async () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="With Image">',
        '<meta property="og:image" content="https://cdn.test/pic.jpg">',
      ].join(''),
    );
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: fetchPageAndImage(html),
      downscaleImage: async () => null,
    });
    expect(preview?.title).toBe('With Image');
    expect(preview?.imageBase64).toBeUndefined();
  });

  it('drops an image that pushes the encoded preview past the JSON cap', async () => {
    const html = htmlDoc(
      [
        '<meta property="og:title" content="Big Image">',
        '<meta property="og:image" content="https://cdn.test/pic.jpg">',
      ].join(''),
    );
    // A valid JPEG (passes the SOI gate) but oversized, so the CAP is what drops it.
    const oversized = JPEG_B64 + 'A'.repeat(LINK_PREVIEW_JSON_CAP_BYTES + 10);
    const preview = await buildLinkPreview('https://example.com/x', {
      fetchImpl: fetchPageAndImage(html),
      downscaleImage: async () => oversized,
    });
    // Text preview survives; the too-big image is dropped, not the whole preview.
    expect(preview?.title).toBe('Big Image');
    expect(preview?.imageBase64).toBeUndefined();
  });
});

describe('SSRF / LAN-leak guard', () => {
  const BLOCKED = [
    'http://localhost/x',
    'http://sub.localhost/x',
    'http://127.0.0.1/x',
    'http://127.9.9.9/x',
    'http://0.0.0.0/x',
    'http://10.0.0.5/x',
    'http://172.16.0.1/x',
    'http://172.31.255.255/x',
    'http://192.168.1.1/x',
    'http://169.254.169.254/latest/meta-data/', // cloud metadata endpoint
    'http://100.64.0.1/x', // CGNAT
    'http://[::1]/x',
    'http://[fc00::1]/x',
    'http://[fd12:3456::1]/x',
    'http://[fe80::1]/x',
    'http://[::ffff:127.0.0.1]/x', // IPv4-mapped loopback
    'http://[::ffff:10.0.0.1]/x', // IPv4-mapped private
    'http://0x7f.0.0.1/x', // hex-encoded 127.0.0.1 (URL normalizes)
    'http://2130706433/x', // decimal-encoded 127.0.0.1 (URL normalizes)
    'http://127.1/x', // short-form 127.0.0.1 (URL normalizes)
    'http://127.0.0.1./x', // trailing-dot loopback (URL normalizes)
    'http://LOCALHOST/x', // upper-case localhost
  ];

  for (const url of BLOCKED) {
    it(`refuses ${url}`, () => {
      expect(isFetchableUrl(url)).toBeNull();
      expect(extractFirstUrl(`visit ${url} now`)).toBeNull();
    });
  }

  const ALLOWED = [
    'http://example.com/x',
    'https://example.com/x',
    'http://172.15.0.1/x', // just below the private range
    'http://172.32.0.1/x', // just above the private range
    'http://8.8.8.8/x', // a public IP literal
    'http://[2001:4860:4860::8888]/x', // a public IPv6 literal
  ];
  for (const url of ALLOWED) {
    it(`allows public ${url}`, () => {
      expect(isFetchableUrl(url)).not.toBeNull();
    });
  }

  it('never fetches a blocked host in buildLinkPreview', async () => {
    let called = false;
    const preview = await buildLinkPreview('http://169.254.169.254/latest/', {
      fetchImpl: (async () => {
        called = true;
        throw new Error('should not be called');
      }) as unknown as typeof fetch,
    });
    expect(called).toBe(false);
    expect(preview).toBeNull();
  });

  it('refuses a redirect whose Location resolves to a blocked host', async () => {
    const targets: string[] = [];
    const redirectingFetch = (async (input: string) => {
      targets.push(input);
      // First hop (public) 302s to the metadata endpoint.
      if (input.startsWith('http://example.com')) {
        return {
          ok: false,
          status: 302,
          headers: { get: (h: string) => (h.toLowerCase() === 'location' ? 'http://169.254.169.254/latest/' : null) },
        } as unknown as Response;
      }
      // If we ever get here, the guard failed to stop the internal fetch.
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        async text() {
          return '<meta property="og:title" content="LEAK">';
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const preview = await buildLinkPreview('http://example.com/start', { fetchImpl: redirectingFetch });
    expect(preview).toBeNull();
    // The internal host was NEVER fetched (only the first public hop).
    expect(targets.every((t) => !t.includes('169.254'))).toBe(true);
  });

  it('follows a redirect to another PUBLIC host and builds', async () => {
    const publicRedirect = (async (input: string) => {
      if (input.startsWith('http://example.com')) {
        return {
          ok: false,
          status: 301,
          headers: { get: (h: string) => (h.toLowerCase() === 'location' ? 'https://final.test/page' : null) },
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'text/html' : null) },
        async text() {
          return '<meta property="og:title" content="Landed">';
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const preview = await buildLinkPreview('http://example.com/start', { fetchImpl: publicRedirect });
    expect(preview?.title).toBe('Landed');
    // preview.url stays the user-pasted URL, normalized.
    expect(preview?.url).toBe('http://example.com/start');
  });
});

describe('encode / parse round trip', () => {
  const preview: LinkPreview = {
    url: 'https://example.com/page',
    title: 'A Title',
    description: 'A description',
    imageBase64: JPEG_B64,
  };

  it('round-trips a full preview', () => {
    const bytes = encodeLinkPreviewAttachment(preview);
    expect(bytes).not.toBeNull();
    const parsed = parseLinkPreviewAttachment(bytes as Uint8Array);
    expect(parsed).toEqual(preview);
  });

  it('round-trips a text-only preview', () => {
    const textOnly: LinkPreview = { url: 'https://example.com', title: 'T' };
    const bytes = encodeLinkPreviewAttachment(textOnly);
    const parsed = parseLinkPreviewAttachment(bytes as Uint8Array);
    expect(parsed).toEqual(textOnly);
  });

  it('encode returns null when the JSON exceeds the cap', () => {
    const tooBig: LinkPreview = {
      url: 'https://example.com',
      title: 'T',
      imageBase64: JPEG_B64 + 'A'.repeat(LINK_PREVIEW_JSON_CAP_BYTES + 1),
    };
    expect(encodeLinkPreviewAttachment(tooBig)).toBeNull();
  });

  it('parse returns null for oversized bytes', () => {
    const oversized = enc.encode(`{"padding":"${'x'.repeat(LINK_PREVIEW_JSON_CAP_BYTES)}"}`);
    expect(parseLinkPreviewAttachment(oversized)).toBeNull();
  });

  it('parse returns null for non-JSON / malformed bytes', () => {
    expect(parseLinkPreviewAttachment(enc.encode('not json {['))).toBeNull();
    expect(parseLinkPreviewAttachment(enc.encode('42'))).toBeNull();
    expect(parseLinkPreviewAttachment(enc.encode('null'))).toBeNull();
    expect(parseLinkPreviewAttachment(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
  });

  it('parse returns null when required fields are missing or wrong-typed', () => {
    expect(parseLinkPreviewAttachment(enc.encode('{"title":"no url"}'))).toBeNull();
    expect(parseLinkPreviewAttachment(enc.encode('{"url":"https://x","title":123}'))).toBeNull();
    expect(parseLinkPreviewAttachment(enc.encode('{"url":"ftp://x","title":"bad scheme"}'))).toBeNull();
  });

  it('parse drops unknown/wrong-typed optional fields but keeps a valid core', () => {
    const parsed = parseLinkPreviewAttachment(
      enc.encode('{"url":"https://x.test","title":"T","description":42,"imageBase64":true,"extra":"nope"}'),
    );
    expect(parsed).toEqual({ url: 'https://x.test', title: 'T' });
  });

  it('parse drops a non-JPEG imageBase64 (garbage) to a text-only preview', () => {
    // Well-formed base64 but not a JPEG (no /9j/), and a huge non-JPEG blob:
    // both must drop to text-only rather than round-trip into a data: URI.
    const garbage = 'aGVsbG8h'; // base64 of "hello!", valid base64, not a JPEG
    const parsed = parseLinkPreviewAttachment(
      enc.encode(JSON.stringify({ url: 'https://x.test', title: 'T', imageBase64: garbage })),
    );
    expect(parsed).toEqual({ url: 'https://x.test', title: 'T' });

    const bigGarbage = 'z'.repeat(60 * 1024); // 60KB non-JPEG, in cap but bad shape
    const parsed2 = parseLinkPreviewAttachment(
      enc.encode(JSON.stringify({ url: 'https://x.test', title: 'T', imageBase64: bigGarbage })),
    );
    expect(parsed2).toEqual({ url: 'https://x.test', title: 'T' });
  });

  it('parse keeps a valid base64 JPEG imageBase64', () => {
    const parsed = parseLinkPreviewAttachment(
      enc.encode(JSON.stringify({ url: 'https://x.test', title: 'T', imageBase64: JPEG_B64 })),
    );
    expect(parsed).toEqual({ url: 'https://x.test', title: 'T', imageBase64: JPEG_B64 });
  });
});

describe('timeout abort', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null after the abort when a fetch never resolves', async () => {
    // A fetch that resolves only when its AbortSignal fires (mirrors a hung page).
    const hangingFetch = ((url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }
      })) as unknown as typeof fetch;

    const promise = buildLinkPreview('https://example.com/slow', {
      fetchImpl: hangingFetch,
      timeoutMs: 8000,
    });
    // Advance past the timeout so the AbortController fires and the fetch rejects.
    await vi.advanceTimersByTimeAsync(8001);
    await expect(promise).resolves.toBeNull();
  });
});

describe('exported caps', () => {
  it('match decision 7 contract', () => {
    expect(LINK_PREVIEW_MIME_TYPE).toBe('application/x-meerkat-link-preview+json');
    expect(LINK_PREVIEW_NAME).toBe('link-preview');
    expect(LINK_PREVIEW_JSON_CAP_BYTES).toBe(64 * 1024);
    expect(LINK_PREVIEW_IMAGE_MAX_DIMENSION).toBe(320);
    expect(LINK_PREVIEW_READ_CAP_BYTES).toBe(512 * 1024);
    expect(LINK_PREVIEW_FETCH_TIMEOUT_MS).toBe(8000);
  });
});
