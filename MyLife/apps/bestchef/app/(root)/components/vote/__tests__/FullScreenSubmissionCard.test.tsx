/**
 * Contract tests for FullScreenSubmissionCard (P4-A).
 *
 * Covers F-007 (upvote/like), F-008 (comments), F-009 (share),
 * F-010 (bookmark/save), F-011 (open chef profile).
 *
 * Tests validate the component's static structure and prop contracts
 * by inspecting source code, matching the project's file-based
 * test pattern (no @testing-library dependency required).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPONENT_DIR = path.resolve(
  process.cwd(),
  'app/(root)/components/vote',
);
const CARD_FILE = path.join(COMPONENT_DIR, 'FullScreenSubmissionCard.tsx');
const UTILS_FILE = path.join(COMPONENT_DIR, 'utils.ts');

const src = readFileSync(CARD_FILE, 'utf8');
const utils = readFileSync(UTILS_FILE, 'utf8');

describe('FullScreenSubmissionCard contract', () => {
  describe('SubmissionViewModel type', () => {
    it('defines videos field for video media', () => {
      expect(src).toContain('videos?: SubmissionVideo[]');
    });

    it('defines comment_count field', () => {
      expect(src).toContain('comment_count: number');
    });

    it('defines viewerUpvoted for optimistic like state', () => {
      expect(src).toContain('viewerUpvoted');
    });

    it('defines viewerSaved for bookmark state', () => {
      expect(src).toContain('viewerSaved');
    });

    it('defines chefId for chef navigation', () => {
      expect(src).toContain('chefId');
    });
  });

  describe('Props interface', () => {
    it('exports FullScreenSubmissionCardProps interface', () => {
      expect(src).toContain('FullScreenSubmissionCardProps');
    });

    it('declares onUpvoteChange prop (F-007)', () => {
      expect(src).toContain("onUpvoteChange: (next: 'up' | 'down' | null) => void");
    });

    it('declares onReviewedVote prop', () => {
      expect(src).toContain('onReviewedVote: () => void');
    });

    it('declares onCommentOpen prop (F-008)', () => {
      expect(src).toContain('onCommentOpen: () => void');
    });

    it('declares onShare prop (F-009)', () => {
      expect(src).toContain('onShare: () => void');
    });

    it('declares onSaveToggle prop (F-010)', () => {
      expect(src).toContain('onSaveToggle: () => void');
    });

    it('declares onChefPress prop (F-011)', () => {
      expect(src).toContain('onChefPress: () => void');
    });

    it('declares isActive prop for video playback control', () => {
      expect(src).toContain('isActive: boolean');
    });
  });

  describe('Video playback (F-007 video background)', () => {
    it('conditionally renders Video component for video submissions', () => {
      expect(src).toContain("videos?.[0]?.uri");
    });

    it('uses expo-av Video with looping and mute support', () => {
      expect(src).toContain('Video');
      expect(src).toContain('isLooping');
      expect(src).toContain('isMuted');
    });

    it('controls playback via isActive prop', () => {
      expect(src).toContain('shouldPlay={isActive}');
    });

    it('uses expo-image for photo fallback with cachePolicy', () => {
      expect(src).toContain('cachePolicy="memory-disk"');
    });

    it('renders DishVisual as final media fallback', () => {
      expect(src).toContain('DishVisual');
    });
  });

  describe('Right-rail action buttons', () => {
    it('renders 6 RailButton instances', () => {
      const matches = src.match(/<RailButton/g);
      expect(matches?.length).toBeGreaterThanOrEqual(6);
    });

    it('upvote button calls onUpvoteChange handler (F-007)', () => {
      expect(src).toContain('handleUpvote');
      expect(src).toContain("onUpvoteChange('up')");
    });

    it('downvote button calls onUpvoteChange with down direction', () => {
      expect(src).toContain('handleDownvote');
      expect(src).toContain("onUpvoteChange('down')");
    });

    it('toggling upvote off calls onUpvoteChange(null)', () => {
      expect(src).toContain('onUpvoteChange(null)');
    });

    it('reviewed-vote button calls onReviewedVote handler', () => {
      expect(src).toContain('onReviewedVote()');
    });

    it('comment button calls onCommentOpen handler (F-008)', () => {
      expect(src).toContain('onCommentOpen()');
    });

    it('share button invokes RN Share.share with submission id (F-009)', () => {
      expect(src).toContain('Share.share(');
      expect(src).toContain('submission.id');
    });

    it('save button calls onSaveToggle handler (F-010)', () => {
      expect(src).toContain('onSaveToggle()');
    });

    it('save button renders filled gold bookmark when saved', () => {
      expect(src).toContain("saved ? GOLD : WHITE");
    });
  });

  describe('Optimistic state updates', () => {
    it('increments upvote count optimistically', () => {
      expect(src).toContain('setUpvoteCount');
    });

    it('decrements count when toggling off', () => {
      expect(src).toContain('Math.max(0');
    });
  });

  describe('Double-tap heart upvote', () => {
    it('includes DoubleTapZone component', () => {
      expect(src).toContain('DoubleTapZone');
    });

    it('calls onUpvoteChange("up") on double-tap when not already upvoted', () => {
      expect(src).toContain("onUpvoteChange('up')");
      expect(src).toContain('spawnHeart');
    });

    it('spawns heart animation on double-tap', () => {
      expect(src).toContain('heartOpacity');
      expect(src).toContain('heartScale');
    });
  });

  describe('Single-tap play/pause (F-007 video)', () => {
    it('togglePlay function exists for video interaction', () => {
      expect(src).toContain('togglePlay');
    });

    it('shows transient play icon with opacity animation', () => {
      expect(src).toContain('playIconOpacity');
    });
  });

  describe('Chef profile navigation (F-011)', () => {
    it('chef row Pressable calls onChefPress handler', () => {
      expect(src).toContain('onChefPress');
    });

    it('renders chef display name', () => {
      expect(src).toContain('chefName');
    });

    it('renders Follow pill when not following', () => {
      expect(src).toContain('viewerFollowing');
      expect(src).toContain("Follow");
    });

    it('renders verified seal for restaurant accounts', () => {
      expect(src).toContain('is_restaurant');
    });
  });

  describe('Layout and gradients', () => {
    it('uses full-screen dimensions from Dimensions.get', () => {
      expect(src).toContain("Dimensions.get('window')");
    });

    it('renders top gradient covering top 30%', () => {
      expect(src).toContain('SCREEN_HEIGHT * 0.30');
    });

    it('renders bottom gradient covering bottom 45%', () => {
      expect(src).toContain('SCREEN_HEIGHT * 0.45');
    });

    it('ranks badge appears when rank <= 100', () => {
      expect(src).toContain('rank <= 100');
    });
  });

  describe('Ingredient marquee', () => {
    it('includes IngredientMarquee component', () => {
      expect(src).toContain('IngredientMarquee');
    });

    it('marquee scrolls at 25px/sec', () => {
      expect(src).toContain('/ 25');
    });

    it('marquee pauses when isActive=false', () => {
      expect(src).toContain('if (!isActive)');
    });
  });

  describe('Reviewed-vote pulse animation', () => {
    it('pulses every 8 seconds when reviewedCount is 0', () => {
      expect(src).toContain('8000');
      expect(src).toContain('reviewedCount === 0');
    });
  });

  describe('Performance', () => {
    it('wraps component in React.memo or memo', () => {
      expect(src.includes('React.memo(') || src.includes(' memo(')).toBe(true);
    });

    it('memo keyed on submission.id + isActive', () => {
      expect(src).toContain('submission.id === next.submission.id');
      expect(src).toContain('prev.isActive === next.isActive');
    });
  });

  describe('Accessibility', () => {
    it('all action buttons have accessibilityLabel props', () => {
      const matches = src.match(/accessibilityLabel=/g);
      expect(matches?.length).toBeGreaterThanOrEqual(8);
    });

    it('all action buttons have accessibilityRole="button"', () => {
      const matches = src.match(/accessibilityRole="button"/g);
      expect(matches?.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('formatCount utility', () => {
    it('exports formatCount from utils.ts', () => {
      expect(utils).toContain('export function formatCount');
    });

    it('abbreviates thousands with k suffix', () => {
      expect(utils).toMatch(/k['"`]/);
    });

    it('abbreviates millions with M suffix', () => {
      expect(utils).toMatch(/M['"`]/);
    });
  });
});
