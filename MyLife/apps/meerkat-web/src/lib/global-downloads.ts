import type { CommunityChannel } from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import { aggregateCommunityFiles, type PresentFile } from './meerkat-data';
import { formatBytes } from '../ui/format';

export interface DownloadCommunity {
  communityId: string;
  descriptor: {
    name: string;
    channels: readonly Pick<CommunityChannel, 'id' | 'name'>[];
  };
}

export interface GlobalDownloadFile extends PresentFile {
  communityId: string;
  communityName: string;
}

export type DownloadStatusFilter = 'all' | 'on-device' | 'removed';

export interface DownloadFilters {
  query: string;
  status: DownloadStatusFilter;
}

export interface DownloadSummary {
  total: number;
  onDevice: number;
  removed: number;
  onDeviceBytes: number;
  totalBytes: number;
}

export interface SelectionSummary {
  count: number;
  bytes: number;
  label: string;
}

export function globalDownloadFileId(communityId: string, localFileId: string): string {
  return `${communityId}:${localFileId}`;
}

export function aggregateGlobalDownloadFiles(
  db: DatabaseAdapter,
  communities: readonly DownloadCommunity[],
): Omit<GlobalDownloadFile, 'present'>[] {
  const rows: Omit<GlobalDownloadFile, 'present'>[] = [];
  for (const community of communities) {
    const files = aggregateCommunityFiles(db, community.communityId, community.descriptor.channels);
    for (const file of files) {
      rows.push({
        ...file,
        id: globalDownloadFileId(community.communityId, file.id),
        communityId: community.communityId,
        communityName: community.descriptor.name,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.hlcWall !== b.hlcWall) return a.hlcWall > b.hlcWall ? -1 : 1;
    if (a.hlcCounter !== b.hlcCounter) return b.hlcCounter - a.hlcCounter;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return rows;
}

export function filterGlobalDownloadFiles(
  files: readonly GlobalDownloadFile[],
  filters: DownloadFilters,
): GlobalDownloadFile[] {
  const q = filters.query.trim().toLowerCase();
  return files.filter((file) => {
    if (filters.status === 'on-device' && !file.present) return false;
    if (filters.status === 'removed' && file.present) return false;
    if (!q) return true;
    return [
      file.name,
      file.mimeType,
      file.channelName,
      file.communityName,
      file.authorDeviceId,
    ].some((value) => value.toLowerCase().includes(q));
  });
}

export function summarizeGlobalDownloads(files: readonly GlobalDownloadFile[]): DownloadSummary {
  let onDevice = 0;
  let onDeviceBytes = 0;
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (file.present) {
      onDevice += 1;
      onDeviceBytes += file.size;
    }
  }
  return {
    total: files.length,
    onDevice,
    removed: files.length - onDevice,
    onDeviceBytes,
    totalBytes,
  };
}

export function summarizeDownloadSelection(
  files: readonly GlobalDownloadFile[],
  selectedIds: ReadonlySet<string>,
): SelectionSummary {
  let count = 0;
  let bytes = 0;
  for (const file of files) {
    if (file.present && selectedIds.has(file.id)) {
      count += 1;
      bytes += file.size;
    }
  }
  return { count, bytes, label: `${count} file${count === 1 ? '' : 's'} · ${formatBytes(bytes)}` };
}
