// Plan 38 Phase 6 (MOBILE, amendment C.9): the sealed in-app epub/cbz reader.
// Content is opened from verified, locally pinned sealed blocks
// (openLibraryItemContent) and rendered WITHOUT ever leaving the app or touching
// the network:
//   - CBZ: the archive is unzipped in memory under hard zip-bomb caps
//     (library-archive.ts) and pages are shown one at a time.
//   - EPUB: the OPF/spine is parsed with bounded regexes (no XML parser -> no
//     XXE), each chapter's active content is stripped, every external URL is
//     neutralized, in-archive assets are inlined as data: URIs, and the result is
//     mounted in a WebView with javaScriptEnabled={false} and a default-src 'none'
//     CSP -- epub bytes are attacker-controlled community data.
// Resume comes from cm_library_progress (personal; your own devices only).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { encodeBase64 } from 'tweetnacl-util';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useNode } from '../../../providers/NodeProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useSync } from '../../../providers/SyncProvider';
import { HonestNotice } from '../../../components/kit';
import { type MkColors } from '../../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../../providers/AppThemeProvider';
import {
  getLibraryItem,
  getLibraryProgress,
  openLibraryItemContent,
  setLibraryProgress,
} from '../../../data/library-store-core';
import { openZip, type UnzipCaps, type ZipArchive } from '../../../data/library-archive';
import {
  buildSandboxedChapter,
  decodeReaderPosition,
  encodeReaderPosition,
  EPUB_CONTAINER_PATH,
  imageMimeForEntry,
  inlineResourceUrls,
  parseContainerRootfile,
  parseOpfSpine,
  readerKindFor,
  sortImageEntries,
  stripActiveContent,
  type ReaderKind,
} from '../../../data/library-reader-core';

const CBZ_CAPS: UnzipCaps = {
  maxEntries: 4000,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxEntryUncompressedBytes: 64 * 1024 * 1024,
  rejectNestedArchives: true,
};
const EPUB_CAPS: UnzipCaps = {
  maxEntries: 6000,
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  maxEntryUncompressedBytes: 32 * 1024 * 1024,
  rejectNestedArchives: true,
};

const ASSET_RE = /\.(png|jpe?g|gif|webp|css|otf|ttf|woff2?)$/i;

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function assetMime(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'css') return 'text/css';
  if (ext === 'otf') return 'font/otf';
  if (ext === 'ttf') return 'font/ttf';
  if (ext === 'woff') return 'font/woff';
  if (ext === 'woff2') return 'font/woff2';
  return imageMimeForEntry(name);
}

function bodyOf(html: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return m ? m[1]! : html;
}

interface CbzModel { kind: 'cbz'; archive: ZipArchive; pages: string[]; }
interface EpubModel { kind: 'epub'; chapters: string[]; }
type ReaderModel = CbzModel | EpubModel;

export default function LibraryReaderScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { store } = useNode();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const item = useMemo(() => (itemId ? getLibraryItem(db, itemId) : null), [db, itemId]);
  const kind: ReaderKind | null = item ? readerKindFor(item.mimeType, item.title) : null;

  const [status, setStatus] = useState<'loading' | 'ready' | 'locked' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [model, setModel] = useState<ReaderModel | null>(null);
  const [index, setIndex] = useState(0);
  const [pageUri, setPageUri] = useState<string | null>(null);
  const [chapterHtml, setChapterHtml] = useState<string | null>(null);

  // Load + parse the sealed archive once.
  useEffect(() => {
    let cancelled = false;
    if (!item || !kind) { setStatus('error'); setErrorMsg('This item is not a readable book.'); return; }
    setStatus('loading');
    void (async () => {
      try {
        const bytes = await openLibraryItemContent(db, store, identity, item);
        if (cancelled) return;
        if (!bytes) { setStatus('locked'); return; }
        const resume = getLibraryProgress(db, item.id);
        const startIndex = resume ? decodeReaderPosition(kind, resume.positionMs).index : 0;
        if (kind === 'cbz') {
          const archive = await openZip(bytes, CBZ_CAPS);
          const pages = sortImageEntries(archive.entries.map((e) => e.name));
          if (pages.length === 0) throw new Error('This comic archive has no readable pages.');
          if (cancelled) return;
          setModel({ kind: 'cbz', archive, pages });
          setIndex(Math.min(startIndex, pages.length - 1));
        } else {
          const chapters = await buildEpubChapters(bytes);
          if (chapters.length === 0) throw new Error('This book has no readable chapters.');
          if (cancelled) return;
          setModel({ kind: 'epub', chapters });
          setIndex(Math.min(startIndex, chapters.length - 1));
        }
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [db, store, identity, item, kind]);

  // Render the current CBZ page (decode-on-demand) or EPUB chapter document.
  useEffect(() => {
    let cancelled = false;
    if (!model) return;
    void (async () => {
      if (model.kind === 'cbz') {
        setPageUri(null);
        try {
          const name = model.pages[index]!;
          const bytes = await model.archive.read(name);
          if (cancelled) return;
          setPageUri(`data:${imageMimeForEntry(name)};base64,${encodeBase64(bytes)}`);
        } catch {
          if (!cancelled) setPageUri(null);
        }
      } else {
        setChapterHtml(model.chapters[index] ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [model, index]);

  // Persist resume position on page/chapter change.
  useEffect(() => {
    if (status !== 'ready' || !item || !kind) return;
    setLibraryProgress(
      db, item.id,
      { positionMs: encodeReaderPosition(kind, { index }), communityId: item.communityId },
      recordLocalChange,
    );
  }, [db, item, kind, index, status, recordLocalChange]);

  const total = model ? (model.kind === 'cbz' ? model.pages.length : model.chapters.length) : 0;
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);

  const title = item?.title ?? 'Reader';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace(itemId ? `/library/item/${itemId}` : '/library'); }}
          hitSlop={10}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {status === 'ready' ? <Text style={styles.counter}>{index + 1}/{total}</Text> : null}
      </View>

      <View style={styles.stage}>
        {status === 'loading' ? (
          <View style={styles.center}><ActivityIndicator color={c.accent} /><Text style={styles.dim}>Opening…</Text></View>
        ) : status === 'locked' ? (
          <View style={styles.center}>
            <Text style={styles.dim}>This book is not stored on this device yet, or your device cannot unlock it. Sync with a device that holds it.</Text>
          </View>
        ) : status === 'error' ? (
          <View style={styles.center}><Text style={styles.dim}>{errorMsg ?? 'This book could not be opened.'}</Text></View>
        ) : model?.kind === 'cbz' ? (
          pageUri ? <RNImage source={{ uri: pageUri }} style={styles.page} resizeMode="contain" /> : <ActivityIndicator color={c.accent} />
        ) : chapterHtml ? (
          <WebView
            key={index}
            originWhitelist={[]}
            source={{ html: chapterHtml }}
            javaScriptEnabled={false}
            domStorageEnabled={false}
            incognito
            setSupportMultipleWindows={false}
            // Block ANY navigation the chapter attempts (defense in depth on top of
            // the CSP + strip): only the initial data document is allowed to load.
            onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('data:') || req.navigationType === undefined}
            style={styles.web}
          />
        ) : <ActivityIndicator color={c.accent} />}
      </View>

      {status === 'ready' ? (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={goPrev} disabled={index <= 0} hitSlop={10} style={styles.navBtn}>
            <ChevronLeft size={26} color={index <= 0 ? c.textTertiary : c.text} />
          </Pressable>
          <Text style={styles.navLabel}>{kind === 'cbz' ? 'Page' : 'Chapter'} {index + 1} of {total}</Text>
          <Pressable onPress={goNext} disabled={index >= total - 1} hitSlop={10} style={styles.navBtn}>
            <ChevronRight size={26} color={index >= total - 1 ? c.textTertiary : c.text} />
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' ? (
        <HonestNotice text="Rendered from the sealed copy on this device. Nothing is loaded from a server, and no plain copy is written to disk." />
      ) : null}
      <View style={{ height: insets.bottom + 8 }} />
    </View>
  );
}

/**
 * Parse an EPUB into an ordered list of self-contained, network-blocked chapter
 * documents. Assets referenced by a chapter are inlined as data: URIs from the
 * archive; everything external is neutralized; active content is stripped.
 */
async function buildEpubChapters(bytes: Uint8Array): Promise<string[]> {
  const archive = await openZip(bytes, EPUB_CAPS);
  const containerXml = decodeText(await archive.read(EPUB_CONTAINER_PATH));
  const opfPath = parseContainerRootfile(containerXml);
  if (!opfPath) throw new Error('This EPUB has no package document.');
  const spine = parseOpfSpine(opfPath, decodeText(await archive.read(opfPath)));

  // Inline the archive's images/CSS/fonts as data URIs (bounded by the caps).
  const assetMap = new Map<string, string>();
  for (const entry of archive.entries) {
    if (!ASSET_RE.test(entry.name)) continue;
    try {
      const assetBytes = await archive.read(entry.name);
      assetMap.set(entry.name, `data:${assetMime(entry.name)};base64,${encodeBase64(assetBytes)}`);
    } catch {
      // A missing/over-cap asset simply renders as a broken image; keep going.
    }
  }

  const chapters: string[] = [];
  for (const href of spine.hrefs) {
    try {
      const raw = decodeText(await archive.read(href));
      const stripped = stripActiveContent(raw);
      const inlined = inlineResourceUrls(stripped, href, (p) => assetMap.get(p) ?? null);
      chapters.push(buildSandboxedChapter(bodyOf(inlined)).html);
    } catch {
      // Skip an unreadable chapter rather than aborting the whole book.
    }
  }
  return chapters;
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { color: c.text, fontSize: 16, fontWeight: '700', flex: 1 },
  counter: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  stage: { flex: 1, backgroundColor: c.surface },
  page: { flex: 1, width: '100%' },
  web: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  dim: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 10 },
  navBtn: { padding: 6 },
  navLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
});
