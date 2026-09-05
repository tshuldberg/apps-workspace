import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { VOICE_MODULE } from '../definition';
import {
  createTranscription,
  getTranscription,
  getTranscriptions,
  deleteTranscription,
  createVoiceNote,
  getVoiceNote,
  getVoiceNotes,
  updateVoiceNote,
  deleteVoiceNote,
  toggleFavorite,
  setSetting,
  getSetting,
  getSettings,
  getTranscriptionStats,
  createSpeaker,
  getSpeaker,
  getSpeakers,
  updateSpeaker,
  deleteSpeaker,
  createSpeakerSegment,
  getSpeakerSegments,
  updateSegmentSpeaker,
  createCommand,
  getCommand,
  getCommands,
  updateCommand,
  deleteCommand,
  incrementCommandUsage,
  logCommandExecution,
  getCommandLog,
  createLanguageSegment,
  getLanguageSegments,
  getLanguageBreakdown,
  createLanguageProfile,
  getLanguageProfile,
  getLanguageProfiles,
  setDefaultProfile,
  deleteLanguageProfile,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('voice', VOICE_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Transcriptions', () => {
  it('creates a transcription and retrieves it by id', () => {
    const t = createTranscription(testDb.adapter, 't1', {
      text: 'Hello world',
      durationSeconds: 5.2,
      language: 'en',
      confidence: 0.95,
    });
    expect(t.id).toBe('t1');
    expect(t.text).toBe('Hello world');
    expect(t.durationSeconds).toBe(5.2);
    expect(t.language).toBe('en');
    expect(t.confidence).toBe(0.95);
    expect(t.audioUri).toBeNull();
    expect(t.createdAt).toBeTruthy();

    const found = getTranscription(testDb.adapter, 't1');
    expect(found).not.toBeNull();
    expect(found!.text).toBe('Hello world');
  });

  it('returns null for non-existent transcription', () => {
    expect(getTranscription(testDb.adapter, 'nope')).toBeNull();
  });

  it('creates a transcription with audio URI', () => {
    const t = createTranscription(testDb.adapter, 't2', {
      text: 'Test audio',
      durationSeconds: 10,
      audioUri: 'file:///audio/test.m4a',
    });
    expect(t.audioUri).toBe('file:///audio/test.m4a');
  });

  it('lists transcriptions ordered by created_at DESC', () => {
    createTranscription(testDb.adapter, 't3', { text: 'First', durationSeconds: 1 });
    createTranscription(testDb.adapter, 't4', { text: 'Second', durationSeconds: 2 });
    createTranscription(testDb.adapter, 't5', { text: 'Third', durationSeconds: 3 });

    // Force distinct timestamps so ORDER BY created_at DESC is deterministic
    testDb.adapter.execute(`UPDATE vc_transcriptions SET created_at = '2024-01-01T00:00:00' WHERE id = 't3'`);
    testDb.adapter.execute(`UPDATE vc_transcriptions SET created_at = '2024-01-02T00:00:00' WHERE id = 't4'`);
    testDb.adapter.execute(`UPDATE vc_transcriptions SET created_at = '2024-01-03T00:00:00' WHERE id = 't5'`);

    const all = getTranscriptions(testDb.adapter);
    expect(all).toHaveLength(3);
    // Most recent first
    expect(all[0].text).toBe('Third');
  });

  it('lists transcriptions with limit and offset', () => {
    createTranscription(testDb.adapter, 't6', { text: 'A', durationSeconds: 1 });
    createTranscription(testDb.adapter, 't7', { text: 'B', durationSeconds: 2 });
    createTranscription(testDb.adapter, 't8', { text: 'C', durationSeconds: 3 });

    const page = getTranscriptions(testDb.adapter, { limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
  });

  it('deletes a transcription', () => {
    createTranscription(testDb.adapter, 't9', { text: 'Temp', durationSeconds: 1 });
    expect(getTranscription(testDb.adapter, 't9')).not.toBeNull();

    deleteTranscription(testDb.adapter, 't9');
    expect(getTranscription(testDb.adapter, 't9')).toBeNull();
  });

  it('handles nullable language and confidence', () => {
    const t = createTranscription(testDb.adapter, 't10', {
      text: 'No metadata',
      durationSeconds: 3,
    });
    expect(t.language).toBeNull();
    expect(t.confidence).toBeNull();
  });
});

describe('Voice Notes', () => {
  it('creates a voice note', () => {
    const note = createVoiceNote(testDb.adapter, 'n1', {
      title: 'Meeting notes',
      tags: 'work,meeting',
    });
    expect(note.id).toBe('n1');
    expect(note.title).toBe('Meeting notes');
    expect(note.tags).toBe('work,meeting');
    expect(note.isFavorite).toBe(false);
    expect(note.transcriptionId).toBeNull();
  });

  it('creates a voice note linked to a transcription', () => {
    createTranscription(testDb.adapter, 't-link', { text: 'Linked text', durationSeconds: 5 });
    const note = createVoiceNote(testDb.adapter, 'n2', {
      title: 'Linked note',
      transcriptionId: 't-link',
    });
    expect(note.transcriptionId).toBe('t-link');
  });

  it('retrieves a voice note by id', () => {
    createVoiceNote(testDb.adapter, 'n3', { title: 'Find me' });
    const found = getVoiceNote(testDb.adapter, 'n3');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Find me');

    expect(getVoiceNote(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists voice notes with limit/offset', () => {
    createVoiceNote(testDb.adapter, 'n4', { title: 'A' });
    createVoiceNote(testDb.adapter, 'n5', { title: 'B' });
    createVoiceNote(testDb.adapter, 'n6', { title: 'C' });

    const all = getVoiceNotes(testDb.adapter);
    expect(all).toHaveLength(3);

    const limited = getVoiceNotes(testDb.adapter, { limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it('updates a voice note title and tags', () => {
    createVoiceNote(testDb.adapter, 'n7', { title: 'Original', tags: 'old' });
    const updated = updateVoiceNote(testDb.adapter, 'n7', { title: 'Updated', tags: 'new' });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated');
    expect(updated!.tags).toBe('new');
  });

  it('returns null when updating non-existent voice note', () => {
    expect(updateVoiceNote(testDb.adapter, 'ghost', { title: 'Nope' })).toBeNull();
  });

  it('deletes a voice note', () => {
    createVoiceNote(testDb.adapter, 'n8', { title: 'Delete me' });
    deleteVoiceNote(testDb.adapter, 'n8');
    expect(getVoiceNote(testDb.adapter, 'n8')).toBeNull();
  });

  it('toggles favorite on a voice note', () => {
    createVoiceNote(testDb.adapter, 'n9', { title: 'Toggle test' });
    expect(getVoiceNote(testDb.adapter, 'n9')!.isFavorite).toBe(false);

    const toggled = toggleFavorite(testDb.adapter, 'n9');
    expect(toggled!.isFavorite).toBe(true);

    const toggledBack = toggleFavorite(testDb.adapter, 'n9');
    expect(toggledBack!.isFavorite).toBe(false);
  });

  it('returns null when toggling favorite on non-existent note', () => {
    expect(toggleFavorite(testDb.adapter, 'ghost')).toBeNull();
  });
});

describe('Settings', () => {
  it('gets and sets settings', () => {
    expect(getSetting(testDb.adapter, 'language')).toBeNull();
    setSetting(testDb.adapter, 'language', 'en');
    expect(getSetting(testDb.adapter, 'language')).toBe('en');
  });

  it('upserts settings on conflict', () => {
    setSetting(testDb.adapter, 'theme', 'dark');
    setSetting(testDb.adapter, 'theme', 'light');
    expect(getSetting(testDb.adapter, 'theme')).toBe('light');
  });

  it('lists all settings', () => {
    setSetting(testDb.adapter, 'a', '1');
    setSetting(testDb.adapter, 'b', '2');
    const all = getSettings(testDb.adapter);
    expect(all).toHaveLength(2);
    expect(all[0].key).toBe('a');
    expect(all[1].key).toBe('b');
  });
});

describe('Transcription Stats', () => {
  it('returns zero stats for empty database', () => {
    const stats = getTranscriptionStats(testDb.adapter);
    expect(stats.totalCount).toBe(0);
    expect(stats.totalDurationSeconds).toBe(0);
    expect(stats.avgDurationSeconds).toBe(0);
    expect(stats.byLanguage).toHaveLength(0);
  });

  it('calculates aggregate stats', () => {
    createTranscription(testDb.adapter, 's1', { text: 'A', durationSeconds: 10, language: 'en' });
    createTranscription(testDb.adapter, 's2', { text: 'B', durationSeconds: 20, language: 'en' });
    createTranscription(testDb.adapter, 's3', { text: 'C', durationSeconds: 30, language: 'es' });

    const stats = getTranscriptionStats(testDb.adapter);
    expect(stats.totalCount).toBe(3);
    expect(stats.totalDurationSeconds).toBe(60);
    expect(stats.avgDurationSeconds).toBe(20);
    expect(stats.byLanguage).toHaveLength(2);
    expect(stats.byLanguage[0].language).toBe('en');
    expect(stats.byLanguage[0].count).toBe(2);
    expect(stats.byLanguage[1].language).toBe('es');
    expect(stats.byLanguage[1].count).toBe(1);
  });

  it('groups null language as unknown', () => {
    createTranscription(testDb.adapter, 's4', { text: 'No lang', durationSeconds: 5 });
    const stats = getTranscriptionStats(testDb.adapter);
    expect(stats.byLanguage[0].language).toBe('unknown');
  });
});

// ── Speaker CRUD Tests ───────────────────────────────────────────────

describe('Speakers', () => {
  it('creates a speaker with name and color', () => {
    const s = createSpeaker(testDb.adapter, 'sp1', { name: 'Alice', color: '#60A5FA' });
    expect(s.id).toBe('sp1');
    expect(s.name).toBe('Alice');
    expect(s.color).toBe('#60A5FA');
    expect(s.sampleCount).toBe(0);
    expect(s.voicePrintHash).toBeNull();
  });

  it('handles missing voice_print_hash', () => {
    const s = createSpeaker(testDb.adapter, 'sp2', { name: 'Bob' });
    expect(s.voicePrintHash).toBeNull();
  });

  it('returns null for non-existent speaker', () => {
    expect(getSpeaker(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists speakers ordered by name', () => {
    createSpeaker(testDb.adapter, 'sp3', { name: 'Charlie' });
    createSpeaker(testDb.adapter, 'sp4', { name: 'Alice' });
    const all = getSpeakers(testDb.adapter);
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Alice');
    expect(all[1].name).toBe('Charlie');
  });

  it('updates name, color, and increments sample count', () => {
    createSpeaker(testDb.adapter, 'sp5', { name: 'Dave', color: '#EF4444' });
    const updated = updateSpeaker(testDb.adapter, 'sp5', {
      name: 'David',
      color: '#34D399',
      incrementSamples: true,
    });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('David');
    expect(updated!.color).toBe('#34D399');
    expect(updated!.sampleCount).toBe(1);
  });

  it('returns null when updating non-existent speaker', () => {
    expect(updateSpeaker(testDb.adapter, 'ghost', { name: 'X' })).toBeNull();
  });

  it('deletes a speaker', () => {
    createSpeaker(testDb.adapter, 'sp6', { name: 'Eve' });
    deleteSpeaker(testDb.adapter, 'sp6');
    expect(getSpeaker(testDb.adapter, 'sp6')).toBeNull();
  });
});

// ── Speaker Segment Tests ────────────────────────────────────────────

describe('Speaker Segments', () => {
  it('creates and retrieves speaker segments for a transcription', () => {
    createTranscription(testDb.adapter, 'tx1', { text: 'Meeting', durationSeconds: 60 });
    createSpeaker(testDb.adapter, 'sp-a', { name: 'Alice' });

    const seg = createSpeakerSegment(testDb.adapter, 'seg1', {
      transcriptionId: 'tx1',
      speakerId: 'sp-a',
      speakerLabel: 'Alice',
      startSeconds: 0,
      endSeconds: 15,
      text: 'Hello everyone',
      confidence: 0.92,
    });
    expect(seg.transcriptionId).toBe('tx1');
    expect(seg.speakerId).toBe('sp-a');
    expect(seg.startSeconds).toBe(0);
    expect(seg.endSeconds).toBe(15);
  });

  it('returns segments ordered by start_seconds', () => {
    createTranscription(testDb.adapter, 'tx2', { text: 'Chat', durationSeconds: 30 });

    createSpeakerSegment(testDb.adapter, 'seg2', {
      transcriptionId: 'tx2',
      speakerLabel: 'Speaker 2',
      startSeconds: 10,
      endSeconds: 20,
      text: 'Second part',
    });
    createSpeakerSegment(testDb.adapter, 'seg3', {
      transcriptionId: 'tx2',
      speakerLabel: 'Speaker 1',
      startSeconds: 0,
      endSeconds: 10,
      text: 'First part',
    });

    const segments = getSpeakerSegments(testDb.adapter, 'tx2');
    expect(segments).toHaveLength(2);
    expect(segments[0].startSeconds).toBe(0);
    expect(segments[1].startSeconds).toBe(10);
  });

  it('updates segment speaker assignment', () => {
    createTranscription(testDb.adapter, 'tx3', { text: 'Test', durationSeconds: 10 });
    createSpeaker(testDb.adapter, 'sp-b', { name: 'Bob' });
    createSpeakerSegment(testDb.adapter, 'seg4', {
      transcriptionId: 'tx3',
      speakerLabel: 'Speaker 1',
      startSeconds: 0,
      endSeconds: 10,
      text: 'Some text',
    });

    updateSegmentSpeaker(testDb.adapter, 'seg4', 'sp-b', 'Bob');
    const segments = getSpeakerSegments(testDb.adapter, 'tx3');
    expect(segments[0].speakerId).toBe('sp-b');
    expect(segments[0].speakerLabel).toBe('Bob');
  });

  it('cascades delete when transcription is deleted', () => {
    createTranscription(testDb.adapter, 'tx4', { text: 'Gone', durationSeconds: 5 });
    createSpeakerSegment(testDb.adapter, 'seg5', {
      transcriptionId: 'tx4',
      speakerLabel: 'Speaker 1',
      startSeconds: 0,
      endSeconds: 5,
      text: 'Goodbye',
    });

    deleteTranscription(testDb.adapter, 'tx4');
    const segments = getSpeakerSegments(testDb.adapter, 'tx4');
    expect(segments).toHaveLength(0);
  });

  it('sets speaker_id to NULL when speaker is deleted (ON DELETE SET NULL)', () => {
    createTranscription(testDb.adapter, 'tx5', { text: 'Test', durationSeconds: 10 });
    createSpeaker(testDb.adapter, 'sp-del', { name: 'ToDelete' });
    createSpeakerSegment(testDb.adapter, 'seg6', {
      transcriptionId: 'tx5',
      speakerId: 'sp-del',
      speakerLabel: 'ToDelete',
      startSeconds: 0,
      endSeconds: 10,
      text: 'Will lose speaker',
    });

    deleteSpeaker(testDb.adapter, 'sp-del');
    const segments = getSpeakerSegments(testDb.adapter, 'tx5');
    expect(segments[0].speakerId).toBeNull();
    expect(segments[0].speakerLabel).toBe('ToDelete');
  });
});

// ── Voice Command CRUD Tests ─────────────────────────────────────────

describe('Commands', () => {
  it('creates a command with phrase and action', () => {
    const cmd = createCommand(testDb.adapter, 'cmd1', {
      phrase: 'Start fasting',
      action: 'start_fast',
      moduleTarget: 'fast',
    });
    expect(cmd.id).toBe('cmd1');
    expect(cmd.phrase).toBe('Start fasting');
    expect(cmd.action).toBe('start_fast');
    expect(cmd.moduleTarget).toBe('fast');
    expect(cmd.isEnabled).toBe(true);
    expect(cmd.priority).toBe(0);
    expect(cmd.usageCount).toBe(0);
  });

  it('handles optional params and priority', () => {
    const cmd = createCommand(testDb.adapter, 'cmd2', {
      phrase: 'Log mood',
      action: 'log_mood',
      params: '{"default_rating": 3}',
      priority: 5,
    });
    expect(cmd.params).toBe('{"default_rating": 3}');
    expect(cmd.priority).toBe(5);
  });

  it('returns null for non-existent command', () => {
    expect(getCommand(testDb.adapter, 'nope')).toBeNull();
  });

  it('returns enabled commands only when filtered', () => {
    createCommand(testDb.adapter, 'cmd3', { phrase: 'A', action: 'a', isEnabled: true });
    createCommand(testDb.adapter, 'cmd4', { phrase: 'B', action: 'b', isEnabled: false });

    const all = getCommands(testDb.adapter);
    expect(all).toHaveLength(2);

    const enabledOnly = getCommands(testDb.adapter, { enabledOnly: true });
    expect(enabledOnly).toHaveLength(1);
    expect(enabledOnly[0].phrase).toBe('A');
  });

  it('updates phrase, action, isEnabled', () => {
    createCommand(testDb.adapter, 'cmd5', { phrase: 'Old', action: 'old_action' });
    const updated = updateCommand(testDb.adapter, 'cmd5', {
      phrase: 'New',
      action: 'new_action',
      isEnabled: false,
    });
    expect(updated).not.toBeNull();
    expect(updated!.phrase).toBe('New');
    expect(updated!.action).toBe('new_action');
    expect(updated!.isEnabled).toBe(false);
  });

  it('returns null when updating non-existent command', () => {
    expect(updateCommand(testDb.adapter, 'ghost', { phrase: 'X' })).toBeNull();
  });

  it('deletes a command and cascades to log', () => {
    createCommand(testDb.adapter, 'cmd6', { phrase: 'Delete me', action: 'x' });
    logCommandExecution(testDb.adapter, 'log1', {
      commandId: 'cmd6',
      matchedPhrase: 'delete me',
      success: true,
    });

    deleteCommand(testDb.adapter, 'cmd6');
    expect(getCommand(testDb.adapter, 'cmd6')).toBeNull();
    const log = getCommandLog(testDb.adapter, { commandId: 'cmd6' });
    expect(log).toHaveLength(0);
  });

  it('increments usage count', () => {
    createCommand(testDb.adapter, 'cmd7', { phrase: 'Count me', action: 'count' });
    incrementCommandUsage(testDb.adapter, 'cmd7');
    incrementCommandUsage(testDb.adapter, 'cmd7');
    const cmd = getCommand(testDb.adapter, 'cmd7');
    expect(cmd!.usageCount).toBe(2);
  });
});

// ── Command Log Tests ────────────────────────────────────────────────

describe('Command Log', () => {
  it('logs a successful execution', () => {
    createCommand(testDb.adapter, 'cmd-log', { phrase: 'Test', action: 'test' });
    const entry = logCommandExecution(testDb.adapter, 'le1', {
      commandId: 'cmd-log',
      matchedPhrase: 'test',
      matchConfidence: 0.95,
      success: true,
    });
    expect(entry.success).toBe(true);
    expect(entry.matchConfidence).toBe(0.95);
    expect(entry.errorMessage).toBeNull();
  });

  it('logs a failed execution with error message', () => {
    createCommand(testDb.adapter, 'cmd-fail', { phrase: 'Fail', action: 'fail' });
    const entry = logCommandExecution(testDb.adapter, 'le2', {
      commandId: 'cmd-fail',
      matchedPhrase: 'fail',
      success: false,
      errorMessage: 'Module not enabled',
    });
    expect(entry.success).toBe(false);
    expect(entry.errorMessage).toBe('Module not enabled');
  });

  it('returns log entries ordered by executed_at DESC', () => {
    createCommand(testDb.adapter, 'cmd-multi', { phrase: 'Multi', action: 'multi' });
    logCommandExecution(testDb.adapter, 'le3', {
      commandId: 'cmd-multi',
      matchedPhrase: 'first',
      success: true,
    });
    logCommandExecution(testDb.adapter, 'le4', {
      commandId: 'cmd-multi',
      matchedPhrase: 'second',
      success: true,
    });

    const log = getCommandLog(testDb.adapter);
    expect(log).toHaveLength(2);
  });

  it('filters log by commandId', () => {
    createCommand(testDb.adapter, 'cmd-a', { phrase: 'A', action: 'a' });
    createCommand(testDb.adapter, 'cmd-b', { phrase: 'B', action: 'b' });
    logCommandExecution(testDb.adapter, 'le5', { commandId: 'cmd-a', matchedPhrase: 'a', success: true });
    logCommandExecution(testDb.adapter, 'le6', { commandId: 'cmd-b', matchedPhrase: 'b', success: true });

    const logA = getCommandLog(testDb.adapter, { commandId: 'cmd-a' });
    expect(logA).toHaveLength(1);
    expect(logA[0].commandId).toBe('cmd-a');
  });
});

// ── Language Segment Tests ───────────────────────────────────────────

describe('Language Segments', () => {
  it('creates and retrieves language segments', () => {
    createTranscription(testDb.adapter, 'tx-lang1', { text: 'Bilingual', durationSeconds: 30 });
    const seg = createLanguageSegment(testDb.adapter, 'ls1', {
      transcriptionId: 'tx-lang1',
      language: 'en-US',
      startSeconds: 0,
      endSeconds: 15,
      text: 'Hello world',
      confidence: 0.95,
    });
    expect(seg.language).toBe('en-US');
    expect(seg.startSeconds).toBe(0);
    expect(seg.endSeconds).toBe(15);
  });

  it('returns segments ordered by start_seconds', () => {
    createTranscription(testDb.adapter, 'tx-lang2', { text: 'Mixed', durationSeconds: 30 });
    createLanguageSegment(testDb.adapter, 'ls2', {
      transcriptionId: 'tx-lang2',
      language: 'es-MX',
      startSeconds: 15,
      endSeconds: 30,
      text: 'Hola mundo',
    });
    createLanguageSegment(testDb.adapter, 'ls3', {
      transcriptionId: 'tx-lang2',
      language: 'en-US',
      startSeconds: 0,
      endSeconds: 15,
      text: 'Hello world',
    });

    const segments = getLanguageSegments(testDb.adapter, 'tx-lang2');
    expect(segments).toHaveLength(2);
    expect(segments[0].language).toBe('en-US');
    expect(segments[1].language).toBe('es-MX');
  });

  it('cascades delete when transcription is deleted', () => {
    createTranscription(testDb.adapter, 'tx-lang3', { text: 'Gone', durationSeconds: 10 });
    createLanguageSegment(testDb.adapter, 'ls4', {
      transcriptionId: 'tx-lang3',
      language: 'en-US',
      startSeconds: 0,
      endSeconds: 10,
      text: 'Test',
    });

    deleteTranscription(testDb.adapter, 'tx-lang3');
    expect(getLanguageSegments(testDb.adapter, 'tx-lang3')).toHaveLength(0);
  });

  it('calculates language breakdown percentages', () => {
    createTranscription(testDb.adapter, 'tx-lang4', { text: 'Mixed', durationSeconds: 100 });
    createLanguageSegment(testDb.adapter, 'ls5', {
      transcriptionId: 'tx-lang4',
      language: 'en-US',
      startSeconds: 0,
      endSeconds: 65,
      text: 'English part',
    });
    createLanguageSegment(testDb.adapter, 'ls6', {
      transcriptionId: 'tx-lang4',
      language: 'es-MX',
      startSeconds: 65,
      endSeconds: 100,
      text: 'Spanish part',
    });

    const breakdown = getLanguageBreakdown(testDb.adapter, 'tx-lang4');
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].language).toBe('en-US');
    expect(breakdown[0].percentage).toBe(65);
    expect(breakdown[1].language).toBe('es-MX');
    expect(breakdown[1].percentage).toBe(35);
  });

  it('returns empty breakdown for no segments', () => {
    createTranscription(testDb.adapter, 'tx-lang5', { text: 'None', durationSeconds: 10 });
    const breakdown = getLanguageBreakdown(testDb.adapter, 'tx-lang5');
    expect(breakdown).toHaveLength(0);
  });
});

// ── Language Profile Tests ───────────────────────────────────────────

describe('Language Profiles', () => {
  it('creates a profile with languages array', () => {
    const p = createLanguageProfile(testDb.adapter, 'lp1', {
      name: 'Home',
      languages: ['en-US', 'es-MX'],
    });
    expect(p.name).toBe('Home');
    expect(p.languages).toEqual(['en-US', 'es-MX']);
    expect(p.isDefault).toBe(false);
  });

  it('returns null for non-existent profile', () => {
    expect(getLanguageProfile(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists profiles ordered by name', () => {
    createLanguageProfile(testDb.adapter, 'lp2', { name: 'Work', languages: ['en-US', 'fr-FR'] });
    createLanguageProfile(testDb.adapter, 'lp3', { name: 'Home', languages: ['en-US', 'es-MX'] });

    const all = getLanguageProfiles(testDb.adapter);
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Home');
    expect(all[1].name).toBe('Work');
  });

  it('sets only one profile as default', () => {
    createLanguageProfile(testDb.adapter, 'lp4', { name: 'First', languages: ['en-US'], isDefault: true });
    createLanguageProfile(testDb.adapter, 'lp5', { name: 'Second', languages: ['es-MX'], isDefault: true });

    const first = getLanguageProfile(testDb.adapter, 'lp4');
    const second = getLanguageProfile(testDb.adapter, 'lp5');
    expect(first!.isDefault).toBe(false);
    expect(second!.isDefault).toBe(true);
  });

  it('setDefaultProfile unsets previous default', () => {
    createLanguageProfile(testDb.adapter, 'lp6', { name: 'A', languages: ['en-US'], isDefault: true });
    createLanguageProfile(testDb.adapter, 'lp7', { name: 'B', languages: ['es-MX'] });

    setDefaultProfile(testDb.adapter, 'lp7');

    expect(getLanguageProfile(testDb.adapter, 'lp6')!.isDefault).toBe(false);
    expect(getLanguageProfile(testDb.adapter, 'lp7')!.isDefault).toBe(true);
  });

  it('deletes a profile without affecting recordings', () => {
    createLanguageProfile(testDb.adapter, 'lp8', { name: 'Delete me', languages: ['en-US'] });
    deleteLanguageProfile(testDb.adapter, 'lp8');
    expect(getLanguageProfile(testDb.adapter, 'lp8')).toBeNull();
  });
});
