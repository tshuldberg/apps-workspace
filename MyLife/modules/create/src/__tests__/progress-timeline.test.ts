import { describe, expect, it } from 'vitest';
import {
  buildCreateProgressTimeline,
  CREATE_PROGRESS_MOOD_OPTIONS,
} from '../components';

describe('MyCreate progress timeline helpers', () => {
  it('sorts entries newest first and maps milestone, mood, and photo metadata', () => {
    const items = buildCreateProgressTimeline([
      {
        id: 'entry-old',
        project_id: 'proj-1',
        date: '2026-04-20T10:00:00.000Z',
        notes_md: 'Blocked colors for the cover.',
        hours_spent: 1.5,
        milestone: false,
        milestone_name: null,
        roadblock: null,
        breakthrough: null,
        mood: 'focused',
        photo_ids: ['photo-1'],
        created_at: '2026-04-20T10:05:00.000Z',
      },
      {
        id: 'entry-new',
        project_id: 'proj-1',
        date: '2026-04-21T10:00:00.000Z',
        notes_md: 'Shipped first draft and found the final layout rhythm.',
        hours_spent: 2.25,
        milestone: true,
        milestone_name: 'First draft complete',
        roadblock: 'Render queue was backed up',
        breakthrough: 'The alternate composition clicked',
        mood: 'inspired',
        photo_ids: ['photo-2', 'photo-3'],
        created_at: '2026-04-21T10:05:00.000Z',
      },
    ]);

    expect(items.map((item) => item.id)).toEqual(['entry-new', 'entry-old']);
    expect(items[0]).toMatchObject({
      milestone: true,
      milestoneName: 'First draft complete',
      moodLabel: 'Inspired',
      moodEmoji: '✨',
      photoCount: 2,
      hoursLabel: '2.25h',
    });
    expect(items[1]).toMatchObject({
      milestone: false,
      moodLabel: 'Focused',
      moodEmoji: '🎯',
      photoCount: 1,
    });
  });

  it('collapses long notes into a preview and exposes all configured mood options', () => {
    const items = buildCreateProgressTimeline([
      {
        id: 'entry-1',
        project_id: 'proj-1',
        date: '2026-04-21T10:00:00.000Z',
        notes_md:
          'A'.repeat(220) + ' with extra whitespace\n\nthat should collapse cleanly.',
        hours_spent: 1,
        milestone: false,
        milestone_name: null,
        roadblock: null,
        breakthrough: null,
        mood: 'frustrated',
        photo_ids: [],
        created_at: '2026-04-21T10:05:00.000Z',
      },
    ]);

    expect(items[0]?.notesPreview?.length).toBeLessThanOrEqual(180);
    expect(items[0]?.notesPreview?.endsWith('...')).toBe(true);
    expect(CREATE_PROGRESS_MOOD_OPTIONS.map((option) => option.value)).toEqual([
      'focused',
      'flowing',
      'struggling',
      'grinding',
      'inspired',
      'frustrated',
    ]);
  });
});
