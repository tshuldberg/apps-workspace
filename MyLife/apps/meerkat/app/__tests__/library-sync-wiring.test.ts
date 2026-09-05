// Source locks for the Set-7 library/data-hub + sync-screen hardening
// (PROMPT-008). Pins, on both surfaces where they twin: back fallbacks on every
// deep-linkable library screen and the Sync Close control; catches on the
// genuinely-throwing store seams (release/unpin eviction, openContent decrypt,
// tombstone) so a failed tap surfaces honestly instead of a silent unhandled
// rejection or a stranded spinner; the ingest file-picker setup catch + a
// synchronous single-flight ref; the edit-details catch matching the sibling
// tag/collection handlers; and fail-honest clipboard on the Sync pairing/friend
// codes (success claimed only after the await resolves, a missing/failed copy
// stated, never a silent void call). Each assertion fails on revert for the
// right reason.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const tabs = join(root, '(tabs)');
const libraryHub = readFileSync(join(tabs, 'library.tsx'), 'utf8');
const libraryChannel = readFileSync(join(tabs, 'library', '[channelId].tsx'), 'utf8');
const libraryItem = readFileSync(join(tabs, 'library', 'item', '[itemId].tsx'), 'utf8');
const libraryPlay = readFileSync(join(tabs, 'library', 'play', '[itemId].tsx'), 'utf8');
const libraryReader = readFileSync(join(tabs, 'library', 'reader', '[itemId].tsx'), 'utf8');
const libraryView = readFileSync(join(root, 'components', 'library', 'LibraryView.tsx'), 'utf8');
const sync = readFileSync(join(root, 'sync.tsx'), 'utf8');

const web = join(__dirname, '..', '..', '..', 'meerkat-web', 'src', 'ui');
const webItem = readFileSync(join(web, 'library', 'LibraryItemDetail.tsx'), 'utf8');
const webPlayer = readFileSync(join(web, 'library', 'LibraryPlayer.tsx'), 'utf8');
const webCbz = readFileSync(join(web, 'library', 'CbzReader.tsx'), 'utf8');
const webEpub = readFileSync(join(web, 'library', 'EpubReader.tsx'), 'utf8');
const webSync = readFileSync(join(web, 'sync', 'SyncDialog.tsx'), 'utf8');

describe('mobile: back fallbacks on deep-linkable library screens + Sync', () => {
  it('My Library hub falls back to /me', () => {
    expect(libraryHub).toContain('router.canGoBack()');
    expect(libraryHub).toContain("router.replace('/me')");
    expect(libraryHub).not.toMatch(/onPress=\{\(\) => router\.back\(\)\}/);
  });

  it('a single library falls back to /library', () => {
    expect(libraryChannel).toContain('router.canGoBack()');
    expect(libraryChannel).toContain("router.replace('/library')");
  });

  it('item detail falls back to its channel (both headers)', () => {
    expect(libraryItem).toContain('router.replace(`/library/${item.channelId}`)');
    expect(libraryItem).toContain("router.replace('/library')");
    expect(libraryItem).not.toMatch(/onBack=\{\(\) => router\.back\(\)\}/);
  });

  it('player + reader fall back to the item detail', () => {
    expect(libraryPlay).toContain('router.replace(itemId ? `/library/item/${itemId}` : ');
    expect(libraryReader).toContain('router.replace(itemId ? `/library/item/${itemId}` : ');
  });

  it('Sync Close falls back to /me instead of a dead router.back', () => {
    expect(sync).toContain('router.canGoBack()');
    expect(sync).toContain("router.replace('/me')");
    expect(sync).not.toContain('onPress={() => router.back()} accessibilityLabel="Close sync"');
  });
});

describe('mobile: catches on throwing library store seams', () => {
  it('release copy (unpin/eviction) surfaces a failure instead of a silent throw', () => {
    expect(libraryItem).toContain('Could not remove this copy');
  });

  it('open content folds a throw to an honest alert (try/finally is not enough)', () => {
    expect(libraryItem).toContain('Could not open this item');
    expect(libraryItem).toContain('Could not open the file');
  });

  it('remove item catches the tombstone throw and only navigates on success', () => {
    expect(libraryItem).toContain('Could not remove this item');
    // Navigation is inside the async AFTER the awaited tombstone, gated by canGoBack.
    expect(libraryItem).toMatch(/await tombstoneLibraryItem[\s\S]*?catch[\s\S]*?router\.canGoBack\(\)/);
  });

  it('edit details catches like the sibling tag/collection handlers', () => {
    expect(libraryItem).toContain('Could not save details');
  });

  it('edit/tag/collection sheets close only on success (an Alert under a dismissing sheet is torn down on iOS)', () => {
    // Each catch alerts THEN returns, so setXOpen(false) runs only on the success path.
    expect(libraryItem).toMatch(/Could not save details'[\s\S]{0,120}?return;\s*\}\s*setEditOpen\(false\)/);
    expect(libraryItem).toMatch(/Could not add tag'[\s\S]{0,120}?return;\s*\}\s*setTagOpen\(false\)/);
    expect(libraryItem).toMatch(/Could not add to collection'[\s\S]{0,120}?return;\s*\}\s*setCollectionOpen\(false\)/);
    expect(libraryItem).toMatch(/Could not create collection'[\s\S]{0,120}?return;\s*\}\s*setCollectionOpen\(false\)/);
  });

  it('player open-with-another-app catches a share/write throw', () => {
    expect(libraryPlay).toContain('Could not open the file');
  });
});

describe('mobile: ingest picker guard + single-flight', () => {
  it('LibraryView catches a file-picker throw and single-flights ingest', () => {
    expect(libraryView).toContain('Could not open the file picker');
    expect(libraryView).toContain('ingestBusyRef');
    expect(libraryView).toContain('ingestBusyRef.current = false');
  });
});

describe('mobile: Sync clipboard honesty', () => {
  it('pairing-code copy claims success only after resolve and states a failure', () => {
    expect(sync).toContain('Pairing code copied.');
    expect(sync).toContain('Could not copy. The pairing code was not copied.');
    expect(sync).not.toContain('void Clipboard.setStringAsync(myPairingCode)');
  });

  it('friend-code copy gives real feedback instead of a silent void call', () => {
    expect(sync).toContain('Friend code copied.');
    expect(sync).toContain('Could not copy. The friend code was not copied.');
    expect(sync).not.toContain('void Clipboard.setStringAsync(myFriendCode)');
  });
});

describe('web twin: item detail catches', () => {
  it('release path renders a failure like the keep path', () => {
    expect(webItem).toMatch(/lib\.releaseItem\(item\)\.then\([\s\S]*?window\.alert/);
  });

  it('download + open-pdf wrap openContent in try/catch to set openError', () => {
    expect(webItem).toContain('This file could not be opened.');
    expect((webItem.match(/This file could not be opened\./g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('remove folds the tombstone rejection into openError', () => {
    expect(webItem).toContain('This item could not be removed.');
  });

  it('edit details catches the synchronous signing throw and closes only on success', () => {
    // editItemMetadata signs (ed25519) and writes SQL synchronously; a bare call
    // was an uncaught handler throw with the editor left open and no feedback.
    expect(webItem).toMatch(/try \{\s*lib\.editItemMetadata[\s\S]{0,200}?Could not save details\.[\s\S]{0,120}?return;\s*\}\s*setEditing\(false\)/);
  });

  it('tag + collection writes catch like the mobile twin (signing seams)', () => {
    expect(webItem).toMatch(/try \{\s*lib\.addTag/);
    expect(webItem).toContain('Could not add tag.');
    expect(webItem).toMatch(/try \{\s*lib\.addToCollection/);
    expect(webItem).toContain('Could not add to collection.');
    expect(webItem).toMatch(/try \{\s*const collection = lib\.createCollection/);
    expect(webItem).toContain('Could not create collection.');
  });
});

describe('web twin: reader/player stranded-spinner guards', () => {
  it('LibraryPlayer load effect catches openContent so it never strands on loading', () => {
    // The load effect: openContent lives inside the try, and the try closes with a
    // catch that flips to 'error' right after setting 'ready' (not the MSE catch).
    expect(webPlayer).toMatch(/pendingBytesRef\.current = bytes;\s*setState\('ready'\);\s*\} catch \{\s*if \(!cancelled\) setState\('error'\);/);
  });

  it('CbzReader opens content inside the try (error state, not a stuck spinner)', () => {
    expect(webCbz).toMatch(/try \{\s*const bytes = await lib\.openContent\(item\)/);
  });

  it('EpubReader opens content inside the try (error state, not a stuck spinner)', () => {
    expect(webEpub).toMatch(/try \{\s*const bytes = await lib\.openContent\(item\)/);
  });
});

describe('web twin: Sync clipboard honesty', () => {
  it('copy states a missing clipboard and catches a failure instead of faking success', () => {
    expect(webSync).toContain('Select the code above to copy it.');
    expect(webSync).toContain('Could not copy. The pairing code was not copied.');
    expect(webSync).not.toContain('await navigator.clipboard?.writeText(pairingCode);');
  });
});
