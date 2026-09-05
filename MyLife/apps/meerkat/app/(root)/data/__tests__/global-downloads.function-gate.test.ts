import { describe, expect, it } from 'vitest';
import {
  filterGlobalDownloadFiles,
  globalDownloadFileId,
  summarizeGlobalDownloads,
  type GlobalDownloadFile,
} from '../community-files';

function file(overrides: Partial<GlobalDownloadFile>): GlobalDownloadFile {
  return {
    id: 'cm-a:ch-a:att-a',
    attachmentId: 'att-a',
    blobHash: 'hash-a',
    name: 'Launch notes.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    channelId: 'ch-a',
    channelName: 'general',
    messageId: 'msg-a',
    authorDeviceId: 'device-a',
    hlcWall: '2026-07-08T00:00:00.000Z',
    hlcCounter: 0,
    present: true,
    communityId: 'cm-a',
    communityName: 'Launch Team',
    ...overrides,
  };
}

describe('global Downloads helpers', () => {
  it('scopes row ids by community before selection or save results use them', () => {
    expect(globalDownloadFileId('cm-1', 'ch-1:att-1')).toBe('cm-1:ch-1:att-1');
  });

  it('filters by status and searches across file, channel, and community labels', () => {
    const rows = [
      file({ id: 'a', name: 'Roadmap.pdf', present: true, communityName: 'Launch Team' }),
      file({ id: 'b', name: 'Receipt.jpg', present: false, channelName: 'receipts', communityName: 'Ops' }),
    ];

    expect(filterGlobalDownloadFiles(rows, { query: '', status: 'on-device' }).map((row) => row.id)).toEqual(['a']);
    expect(filterGlobalDownloadFiles(rows, { query: '', status: 'removed' }).map((row) => row.id)).toEqual(['b']);
    expect(filterGlobalDownloadFiles(rows, { query: 'ops', status: 'all' }).map((row) => row.id)).toEqual(['b']);
    expect(filterGlobalDownloadFiles(rows, { query: 'receipts', status: 'all' }).map((row) => row.id)).toEqual(['b']);
  });

  it('summarizes only live on-device bytes as saveable', () => {
    const summary = summarizeGlobalDownloads([
      file({ id: 'a', size: 10, present: true }),
      file({ id: 'b', size: 20, present: false }),
      file({ id: 'c', size: 30, present: true }),
    ]);

    expect(summary).toEqual({
      total: 3,
      onDevice: 2,
      removed: 1,
      onDeviceBytes: 40,
      totalBytes: 60,
    });
  });
});
