/**
 * Cloud video feed adapter (F-046).
 *
 * Wraps the module's `bc_media_assets`-backed video catalog in the app's
 * DemoVideo shape so feed.tsx and video/[id].tsx render cloud and demo
 * content identically. Demo fixtures only appear when the public render
 * policy allows them.
 */

import {
  getFeedVideoById,
  listFeedVideos,
  type FeedVideo,
} from '@mylife/bestchef';
import {
  DEMO_VIDEOS,
  getAllVideos,
  getVideosForCuisine,
  getVideosForDish,
  type DemoVideo,
} from './demo-videos';
import { shouldShowDemoContent } from './public-render-policy';

export type VideoFeedSource = 'cloud' | 'demo' | 'none';

export interface VideoFeedResult {
  videos: DemoVideo[];
  source: VideoFeedSource;
}

export function mapFeedVideo(video: FeedVideo): DemoVideo {
  return {
    id: video.id,
    submissionId: video.submissionId,
    dishId: video.dishId ?? '',
    dishName: video.dishName ?? 'Cook-along',
    cuisine: video.cuisine ?? '',
    chefName: video.chefName ?? 'BestChef Cook',
    chefHandle: video.chefHandle ?? 'bestchef',
    title: video.title,
    description: video.description,
    videoUrl: video.videoUrl,
    duration: video.durationSeconds ?? 0,
    likes: video.likeCount,
    chefProfileId: video.chefProfileId ?? undefined,
    comments: video.commentCount,
    shares: 0,
  };
}

function demoVideosFor(opts: { dishId?: string; cuisine?: string }): DemoVideo[] {
  if (opts.dishId) return getVideosForDish(opts.dishId);
  if (opts.cuisine) return getVideosForCuisine(opts.cuisine);
  return getAllVideos();
}

export async function loadFeedVideos(
  opts: { dishId?: string; cuisine?: string; limit?: number } = {},
): Promise<VideoFeedResult> {
  try {
    const result = await listFeedVideos(opts);
    if (result.ok && result.data.length > 0) {
      return { videos: result.data.map(mapFeedVideo), source: 'cloud' };
    }
  } catch {
    // Cloud not configured or unreachable; fall through to policy fallback.
  }
  if (shouldShowDemoContent()) {
    return { videos: demoVideosFor(opts), source: 'demo' };
  }
  return { videos: [], source: 'none' };
}

export async function loadFeedVideoById(id: string): Promise<DemoVideo | null> {
  try {
    const result = await getFeedVideoById(id);
    if (result.ok && result.data) {
      return mapFeedVideo(result.data);
    }
  } catch {
    // fall through
  }
  if (shouldShowDemoContent()) {
    return DEMO_VIDEOS.find((video) => video.id === id) ?? null;
  }
  return null;
}
