import type { AppCategory } from '../types';
// Import directly from the RN component module (not the barrel) so tsc
// resolves the type even when checking under the web-safe `./ui/index.ts`.
// `badges.ts` follows the same pattern.
import type { PresenceMaterialSymbolName } from '../ui/components/MaterialSymbol';

export interface AppLibraryEntry {
  appId: string;
  name: string;
  category: AppCategory;
  iconName: PresenceMaterialSymbolName;
  gradientFrom: string;
  gradientTo: string;
  description: string;
}

export const APP_LIBRARY: AppLibraryEntry[] = [
  {
    appId: 'com.instagram.app',
    name: 'Instagram',
    category: 'social',
    iconName: 'camera_alt',
    gradientFrom: '#FB7185',
    gradientTo: '#F59E0B',
    description: 'Stories, reels, and social browsing',
  },
  {
    appId: 'com.zhiliaoapp.musically',
    name: 'TikTok',
    category: 'entertainment',
    iconName: 'music_note',
    gradientFrom: '#22D3EE',
    gradientTo: '#0F172A',
    description: 'Short-form video feed',
  },
  {
    appId: 'com.google.ios.youtube',
    name: 'YouTube',
    category: 'entertainment',
    iconName: 'play_circle',
    gradientFrom: '#F87171',
    gradientTo: '#DC2626',
    description: 'Streaming video and shorts',
  },
  {
    appId: 'com.facebook.Facebook',
    name: 'Facebook',
    category: 'communication',
    iconName: 'chat',
    gradientFrom: '#60A5FA',
    gradientTo: '#2563EB',
    description: 'Feeds, groups, and messages',
  },
  {
    appId: 'com.atebits.Tweetie2',
    name: 'X',
    category: 'news',
    iconName: 'chat',
    gradientFrom: '#475569',
    gradientTo: '#0F172A',
    description: 'Fast-moving news and discourse',
  },
  {
    appId: 'com.reddit.Reddit',
    name: 'Reddit',
    category: 'social',
    iconName: 'chat',
    gradientFrom: '#FB923C',
    gradientTo: '#EA580C',
    description: 'Community threads and rabbit holes',
  },
  {
    appId: 'com.toyopagroup.picaboo',
    name: 'Snapchat',
    category: 'social',
    iconName: 'camera_alt',
    gradientFrom: '#FDE047',
    gradientTo: '#F59E0B',
    description: 'Snaps, stories, and chat',
  },
  {
    appId: 'com.tinyspeck.chatlyio',
    name: 'Slack',
    category: 'productivity',
    iconName: 'chat',
    gradientFrom: '#A855F7',
    gradientTo: '#4C1D95',
    description: 'Work chat and notifications',
  },
  {
    appId: 'com.google.Gmail',
    name: 'Gmail',
    category: 'communication',
    iconName: 'chat',
    gradientFrom: '#FCA5A5',
    gradientTo: '#EF4444',
    description: 'Email inbox triage',
  },
  {
    appId: 'com.apple.mobilesafari',
    name: 'Safari',
    category: 'other',
    iconName: 'explore',
    gradientFrom: '#38BDF8',
    gradientTo: '#0284C7',
    description: 'General browsing',
  },
  {
    appId: 'com.google.chrome.ios',
    name: 'Chrome',
    category: 'other',
    iconName: 'explore',
    gradientFrom: '#93C5FD',
    gradientTo: '#2563EB',
    description: 'Search and web browsing',
  },
  {
    appId: 'com.hammerandchisel.discord',
    name: 'Discord',
    category: 'gaming',
    iconName: 'groups',
    gradientFrom: '#818CF8',
    gradientTo: '#4338CA',
    description: 'Servers, chat, and voice',
  },
  {
    appId: 'com.spotify.client',
    name: 'Spotify',
    category: 'entertainment',
    iconName: 'music_note',
    gradientFrom: '#4ADE80',
    gradientTo: '#15803D',
    description: 'Music and podcasts',
  },
  {
    appId: 'notion.id',
    name: 'Notion',
    category: 'productivity',
    iconName: 'lightbulb',
    gradientFrom: '#94A3B8',
    gradientTo: '#334155',
    description: 'Notes, docs, and planning',
  },
];

export function findAppLibraryEntry(appId: string): AppLibraryEntry | undefined {
  return APP_LIBRARY.find((entry) => entry.appId === appId);
}
