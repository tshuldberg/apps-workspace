import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../definition';
import {
  createNote,
  getNoteById,
  getNotes,
  updateNote,
  deleteNote,
  getNoteCount,
  searchNotes,
  createFolder,
  getFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
  createTag,
  getTags,
  getTagsForNote,
  deleteTag,
  createTemplate,
  getTemplates,
  deleteTemplate,
  getSetting,
  setSetting,
  getNotesStats,
  getBacklinksForNote,
  getNoteGraph,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Notes CRUD', () => {
  it('creates a basic note', () => {
    const note = createNote(testDb.adapter, 'n1', { title: 'Test', body: 'Hello world' });
    expect(note.id).toBe('n1');
    expect(note.title).toBe('Test');
    expect(note.body).toBe('Hello world');
    expect(note.wordCount).toBe(2);
    expect(note.charCount).toBe(11);
    expect(note.isPinned).toBe(false);
  });

  it('creates a note with tags', () => {
    const tag = createTag(testDb.adapter, 't1', { name: 'work' });
    createNote(testDb.adapter, 'n2', { title: 'Meeting Notes', tagIds: [tag.id] });
    const tags = getTagsForNote(testDb.adapter, 'n2');
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('work');
  });

  it('creates a note in a folder', () => {
    const folder = createFolder(testDb.adapter, 'f1', { name: 'Projects' });
    const note = createNote(testDb.adapter, 'n3', { title: 'Project Plan', folderId: folder.id });
    expect(note.folderId).toBe('f1');
  });

  it('gets note by id', () => {
    createNote(testDb.adapter, 'n4', { title: 'Find Me' });
    expect(getNoteById(testDb.adapter, 'n4')).not.toBeNull();
    expect(getNoteById(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists notes with default ordering', () => {
    createNote(testDb.adapter, 'n5', { title: 'First' });
    createNote(testDb.adapter, 'n6', { title: 'Second' });
    const all = getNotes(testDb.adapter);
    expect(all).toHaveLength(2);
  });

  it('filters notes by pinned status', () => {
    createNote(testDb.adapter, 'n7', { title: 'Pinned', isPinned: true });
    createNote(testDb.adapter, 'n8', { title: 'Normal' });
    const pinned = getNotes(testDb.adapter, { isPinned: true });
    expect(pinned).toHaveLength(1);
    expect(pinned[0].title).toBe('Pinned');
  });

  it('filters notes by tag', () => {
    const tag = createTag(testDb.adapter, 't2', { name: 'urgent' });
    createNote(testDb.adapter, 'n9', { title: 'Tagged', tagIds: [tag.id] });
    createNote(testDb.adapter, 'n10', { title: 'Untagged' });
    const tagged = getNotes(testDb.adapter, { tagId: tag.id });
    expect(tagged).toHaveLength(1);
  });

  it('updates a note', () => {
    createNote(testDb.adapter, 'n11', { title: 'Old Title', body: 'Old body' });
    const updated = updateNote(testDb.adapter, 'n11', { title: 'New Title', body: 'New body text here' });
    expect(updated!.title).toBe('New Title');
    expect(updated!.wordCount).toBe(4);
  });

  it('updates note tags via update', () => {
    const t1 = createTag(testDb.adapter, 'ta', { name: 'a' });
    const t2 = createTag(testDb.adapter, 'tb', { name: 'b' });
    createNote(testDb.adapter, 'n12', { title: 'Tagged', tagIds: [t1.id] });
    updateNote(testDb.adapter, 'n12', { tagIds: [t2.id] });
    const tags = getTagsForNote(testDb.adapter, 'n12');
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('b');
  });

  it('deletes a note', () => {
    createNote(testDb.adapter, 'n13', { title: 'Delete Me' });
    deleteNote(testDb.adapter, 'n13');
    expect(getNoteById(testDb.adapter, 'n13')).toBeNull();
  });

  it('counts notes', () => {
    expect(getNoteCount(testDb.adapter)).toBe(0);
    createNote(testDb.adapter, 'c1', {});
    createNote(testDb.adapter, 'c2', {});
    expect(getNoteCount(testDb.adapter)).toBe(2);
  });
});

describe('FTS Search', () => {
  it('finds notes by content', () => {
    createNote(testDb.adapter, 's1', { title: 'Meeting Agenda', body: 'Discuss the quarterly report' });
    createNote(testDb.adapter, 's2', { title: 'Shopping List', body: 'Buy milk and eggs' });

    const results = searchNotes(testDb.adapter, 'quarterly');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Meeting Agenda');
  });

  it('finds notes by title', () => {
    createNote(testDb.adapter, 's3', { title: 'React Hooks Guide', body: 'useState and useEffect' });
    const results = searchNotes(testDb.adapter, 'hooks');
    expect(results).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    createNote(testDb.adapter, 's4', { title: 'Note', body: 'Content' });
    expect(searchNotes(testDb.adapter, 'zzzzunmatchable')).toHaveLength(0);
  });

  it('returns empty for blank query', () => {
    expect(searchNotes(testDb.adapter, '')).toHaveLength(0);
    expect(searchNotes(testDb.adapter, '   ')).toHaveLength(0);
  });
});

describe('Folders', () => {
  it('creates and lists folders', () => {
    createFolder(testDb.adapter, 'f1', { name: 'Work' });
    createFolder(testDb.adapter, 'f2', { name: 'Personal' });
    const all = getFolders(testDb.adapter);
    expect(all).toHaveLength(2);
  });

  it('supports nested folders', () => {
    createFolder(testDb.adapter, 'f3', { name: 'Work' });
    createFolder(testDb.adapter, 'f4', { name: 'Projects', parentId: 'f3' });
    const children = getFolders(testDb.adapter, 'f3');
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('Projects');
  });

  it('updates a folder', () => {
    createFolder(testDb.adapter, 'f5', { name: 'Old' });
    const updated = updateFolder(testDb.adapter, 'f5', { name: 'New' });
    expect(updated!.name).toBe('New');
  });

  it('deletes a folder and nullifies note references', () => {
    createFolder(testDb.adapter, 'f6', { name: 'Temp' });
    createNote(testDb.adapter, 'nf', { title: 'In Folder', folderId: 'f6' });
    deleteFolder(testDb.adapter, 'f6');
    expect(getFolderById(testDb.adapter, 'f6')).toBeNull();
    const note = getNoteById(testDb.adapter, 'nf');
    expect(note!.folderId).toBeNull();
  });
});

describe('Tags', () => {
  it('creates and lists tags', () => {
    createTag(testDb.adapter, 'tg1', { name: 'important', color: '#FF0000' });
    createTag(testDb.adapter, 'tg2', { name: 'draft' });
    const tags = getTags(testDb.adapter);
    expect(tags).toHaveLength(2);
    expect(tags[1].name).toBe('important');
  });

  it('deletes a tag and removes note associations', () => {
    const tag = createTag(testDb.adapter, 'tg3', { name: 'temp' });
    createNote(testDb.adapter, 'nt1', { title: 'Tagged', tagIds: [tag.id] });
    deleteTag(testDb.adapter, tag.id);
    expect(getTagsForNote(testDb.adapter, 'nt1')).toHaveLength(0);
  });
});

describe('Backlinks', () => {
  it('creates links when note body contains [[backlinks]]', () => {
    createNote(testDb.adapter, 'bl1', { title: 'Target Note', body: 'I am the target' });
    createNote(testDb.adapter, 'bl2', { title: 'Source Note', body: 'See [[Target Note]] for more' });
    const backlinks = getBacklinksForNote(testDb.adapter, 'bl1');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].sourceNoteId).toBe('bl2');
  });

  it('builds a note graph', () => {
    createNote(testDb.adapter, 'g1', { title: 'Node A', body: 'Links to [[Node B]]' });
    createNote(testDb.adapter, 'g2', { title: 'Node B', body: 'Links to [[Node A]]' });
    const graph = getNoteGraph(testDb.adapter);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1); // Only g2->g1 since g1 was created before g2 existed
  });
});

describe('Templates', () => {
  it('creates and lists templates', () => {
    createTemplate(testDb.adapter, 'tm1', { name: 'Meeting Notes', body: '## Attendees\n\n## Agenda\n\n## Action Items' });
    const templates = getTemplates(testDb.adapter);
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Meeting Notes');
  });

  it('deletes a template', () => {
    createTemplate(testDb.adapter, 'tm2', { name: 'Temp', body: '' });
    deleteTemplate(testDb.adapter, 'tm2');
    expect(getTemplates(testDb.adapter)).toHaveLength(0);
  });
});

describe('Settings', () => {
  it('gets and sets settings', () => {
    expect(getSetting(testDb.adapter, 'font_size')).toBeNull();
    setSetting(testDb.adapter, 'font_size', '16');
    expect(getSetting(testDb.adapter, 'font_size')).toBe('16');
  });
});

describe('Stats', () => {
  it('returns aggregate stats', () => {
    createFolder(testDb.adapter, 'sf', { name: 'Work' });
    createTag(testDb.adapter, 'st', { name: 'urgent' });
    createNote(testDb.adapter, 'sn1', { title: 'Note One', body: 'Hello world', isPinned: true, isFavorite: true });
    createNote(testDb.adapter, 'sn2', { title: 'Note Two', body: 'More content here today' });

    const stats = getNotesStats(testDb.adapter);
    expect(stats.totalNotes).toBe(2);
    expect(stats.totalFolders).toBe(1);
    expect(stats.totalTags).toBe(1);
    expect(stats.totalWords).toBe(6); // 2 + 4
    expect(stats.pinnedCount).toBe(1);
    expect(stats.favoriteCount).toBe(1);
  });
});
