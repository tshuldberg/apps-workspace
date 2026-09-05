import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../definition';

// Attachments
import {
  createAttachment,
  getAttachmentsForNote,
  getAttachmentById,
  deleteAttachment,
  getAttachmentCount,
  updateOcrStatus,
  searchAttachmentOcr,
} from '../db/attachments';

// Databases
import {
  createDatabase,
  getDatabases,
  getDatabaseById,
  deleteDatabase,
  createDbColumn,
  getColumnsForDatabase,
  deleteDbColumn,
  createDbRow,
  getRowsForDatabase,
  deleteDbRow,
  setCellValue,
  getCellsForRow,
  getCellValue,
} from '../db/databases';

// Plugins
import {
  installPlugin,
  getPlugins,
  getPluginById,
  enablePlugin,
  disablePlugin,
  uninstallPlugin,
  getEnabledPlugins,
  getPluginSetting,
  setPluginSetting,
  getPluginSettings,
} from '../db/plugins';

// AI History
import {
  createAiHistoryEntry,
  acceptAiResult,
  getAiHistoryForNote,
  deleteAiHistory,
} from '../db/ai-history';

// AI Engine
import {
  summarizeLocal,
  fixGrammarLocal,
  simplifyLocal,
  runLocalAiAction,
} from '../ai/local-engine';

// Graph engine
import {
  filterGraph,
  getLocalGraph,
  findOrphans,
  clusterNotes,
  getGraphStats,
} from '../engine/graph';

// Web clipper engine
import {
  htmlToMarkdown,
  buildClipBody,
  truncateClip,
} from '../engine/web-clipper';

import { createNote } from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Attachments ───────────────────────────────────────────────────────

describe('Attachments CRUD', () => {
  it('creates an attachment for a note', () => {
    createNote(testDb.adapter, 'n1', { title: 'Note' });
    const att = createAttachment(testDb.adapter, 'a1', {
      noteId: 'n1',
      fileName: 'photo.jpg',
      filePath: '/data/nt_attachments/n1/photo.jpg',
      fileSizeBytes: 102400,
      mimeType: 'image/jpeg',
      attachmentType: 'image',
      width: 1024,
      height: 768,
    });
    expect(att.id).toBe('a1');
    expect(att.fileName).toBe('photo.jpg');
    expect(att.width).toBe(1024);
  });

  it('lists attachments for a note', () => {
    createNote(testDb.adapter, 'n2', { title: 'Note 2' });
    createAttachment(testDb.adapter, 'a2', { noteId: 'n2', fileName: 'a.png', filePath: '/a.png', mimeType: 'image/png' });
    createAttachment(testDb.adapter, 'a3', { noteId: 'n2', fileName: 'b.pdf', filePath: '/b.pdf', mimeType: 'application/pdf', attachmentType: 'pdf' });
    const atts = getAttachmentsForNote(testDb.adapter, 'n2');
    expect(atts).toHaveLength(2);
  });

  it('gets attachment by id', () => {
    createNote(testDb.adapter, 'n3', { title: 'Note 3' });
    createAttachment(testDb.adapter, 'a4', { noteId: 'n3', fileName: 'x.png', filePath: '/x.png', mimeType: 'image/png' });
    expect(getAttachmentById(testDb.adapter, 'a4')).not.toBeNull();
    expect(getAttachmentById(testDb.adapter, 'nope')).toBeNull();
  });

  it('deletes an attachment', () => {
    createNote(testDb.adapter, 'n4', { title: 'Note 4' });
    createAttachment(testDb.adapter, 'a5', { noteId: 'n4', fileName: 'y.png', filePath: '/y.png', mimeType: 'image/png' });
    deleteAttachment(testDb.adapter, 'a5');
    expect(getAttachmentById(testDb.adapter, 'a5')).toBeNull();
  });

  it('counts attachments for a note', () => {
    createNote(testDb.adapter, 'n5', { title: 'Note 5' });
    createAttachment(testDb.adapter, 'a6', { noteId: 'n5', fileName: 'a.png', filePath: '/a.png', mimeType: 'image/png' });
    createAttachment(testDb.adapter, 'a7', { noteId: 'n5', fileName: 'b.png', filePath: '/b.png', mimeType: 'image/png' });
    expect(getAttachmentCount(testDb.adapter, 'n5')).toBe(2);
  });

  it('cascades delete when note is deleted', () => {
    createNote(testDb.adapter, 'n6', { title: 'Note 6' });
    createAttachment(testDb.adapter, 'a8', { noteId: 'n6', fileName: 'z.png', filePath: '/z.png', mimeType: 'image/png' });
    testDb.adapter.execute('DELETE FROM nt_notes WHERE id = ?', ['n6']);
    expect(getAttachmentById(testDb.adapter, 'a8')).toBeNull();
  });
});

// ── OCR ───────────────────────────────────────────────────────────────

describe('OCR', () => {
  it('updates OCR status and text', () => {
    createNote(testDb.adapter, 'ocr1', { title: 'OCR Note' });
    createAttachment(testDb.adapter, 'oa1', { noteId: 'ocr1', fileName: 'doc.jpg', filePath: '/doc.jpg', mimeType: 'image/jpeg' });
    updateOcrStatus(testDb.adapter, 'oa1', 'complete', 'Hello World from image', 'en');
    const att = getAttachmentById(testDb.adapter, 'oa1');
    expect(att!.ocrStatus).toBe('complete');
    expect(att!.ocrText).toBe('Hello World from image');
    expect(att!.ocrLanguage).toBe('en');
  });

  it('searches OCR text', () => {
    createNote(testDb.adapter, 'ocr2', { title: 'OCR Note 2' });
    createAttachment(testDb.adapter, 'oa2', { noteId: 'ocr2', fileName: 'receipt.jpg', filePath: '/receipt.jpg', mimeType: 'image/jpeg' });
    updateOcrStatus(testDb.adapter, 'oa2', 'complete', 'Total: $42.50 at Trader Joes');
    const results = searchAttachmentOcr(testDb.adapter, 'Trader');
    expect(results).toHaveLength(1);
    expect(results[0].noteId).toBe('ocr2');
  });

  it('returns empty for blank OCR search', () => {
    expect(searchAttachmentOcr(testDb.adapter, '')).toHaveLength(0);
  });
});

// ── Relational Databases ──────────────────────────────────────────────

describe('Databases CRUD', () => {
  it('creates a database', () => {
    const db = createDatabase(testDb.adapter, 'db1', { title: 'Tasks' });
    expect(db.title).toBe('Tasks');
    expect(db.defaultView).toBe('table');
  });

  it('lists databases', () => {
    createDatabase(testDb.adapter, 'db2', { title: 'CRM' });
    createDatabase(testDb.adapter, 'db3', { title: 'Roadmap' });
    expect(getDatabases(testDb.adapter)).toHaveLength(2);
  });

  it('gets database by id', () => {
    createDatabase(testDb.adapter, 'db4', { title: 'Test DB' });
    expect(getDatabaseById(testDb.adapter, 'db4')).not.toBeNull();
    expect(getDatabaseById(testDb.adapter, 'nope')).toBeNull();
  });

  it('deletes a database', () => {
    createDatabase(testDb.adapter, 'db5', { title: 'Temp' });
    deleteDatabase(testDb.adapter, 'db5');
    expect(getDatabaseById(testDb.adapter, 'db5')).toBeNull();
  });

  it('creates columns and rows with cells', () => {
    createDatabase(testDb.adapter, 'db6', { title: 'Project' });
    const col1 = createDbColumn(testDb.adapter, 'c1', { databaseId: 'db6', name: 'Name', isPrimary: true });
    const col2 = createDbColumn(testDb.adapter, 'c2', { databaseId: 'db6', name: 'Status', columnType: 'select' });
    expect(col1.isPrimary).toBe(true);
    expect(col2.columnType).toBe('select');

    const row = createDbRow(testDb.adapter, 'r1', 'db6');
    setCellValue(testDb.adapter, 'cell1', row.id, col1.id, { text: 'Alpha' });
    setCellValue(testDb.adapter, 'cell2', row.id, col2.id, { text: 'In Progress' });

    const cells = getCellsForRow(testDb.adapter, 'r1');
    expect(cells).toHaveLength(2);

    const cell = getCellValue(testDb.adapter, 'r1', 'c1');
    expect(cell!.valueText).toBe('Alpha');
  });

  it('cascades delete on database deletion', () => {
    createDatabase(testDb.adapter, 'db7', { title: 'Cascade' });
    createDbColumn(testDb.adapter, 'c3', { databaseId: 'db7', name: 'Name' });
    createDbRow(testDb.adapter, 'r2', 'db7');
    deleteDatabase(testDb.adapter, 'db7');
    expect(getColumnsForDatabase(testDb.adapter, 'db7')).toHaveLength(0);
    expect(getRowsForDatabase(testDb.adapter, 'db7')).toHaveLength(0);
  });

  it('upserts cell values', () => {
    createDatabase(testDb.adapter, 'db8', { title: 'Upsert' });
    createDbColumn(testDb.adapter, 'c4', { databaseId: 'db8', name: 'Count' });
    createDbRow(testDb.adapter, 'r3', 'db8');
    setCellValue(testDb.adapter, 'cell3', 'r3', 'c4', { number: 10 });
    setCellValue(testDb.adapter, 'cell3b', 'r3', 'c4', { number: 20 });
    const cell = getCellValue(testDb.adapter, 'r3', 'c4');
    expect(cell!.valueNumber).toBe(20);
  });
});

// ── Plugins ───────────────────────────────────────────────────────────

describe('Plugins CRUD', () => {
  it('installs a plugin', () => {
    const plugin = installPlugin(testDb.adapter, 'p1', { name: 'Word Count', isBuiltIn: true });
    expect(plugin.name).toBe('Word Count');
    expect(plugin.isBuiltIn).toBe(true);
    expect(plugin.isEnabled).toBe(false);
  });

  it('lists plugins', () => {
    installPlugin(testDb.adapter, 'p2', { name: 'Focus Mode' });
    installPlugin(testDb.adapter, 'p3', { name: 'Outline' });
    expect(getPlugins(testDb.adapter)).toHaveLength(2);
  });

  it('enables and disables a plugin', () => {
    installPlugin(testDb.adapter, 'p4', { name: 'TOC' });
    enablePlugin(testDb.adapter, 'p4');
    expect(getPluginById(testDb.adapter, 'p4')!.isEnabled).toBe(true);
    expect(getEnabledPlugins(testDb.adapter)).toHaveLength(1);

    disablePlugin(testDb.adapter, 'p4');
    expect(getPluginById(testDb.adapter, 'p4')!.isEnabled).toBe(false);
    expect(getEnabledPlugins(testDb.adapter)).toHaveLength(0);
  });

  it('does not uninstall built-in plugins', () => {
    installPlugin(testDb.adapter, 'p5', { name: 'Built-in', isBuiltIn: true });
    uninstallPlugin(testDb.adapter, 'p5');
    expect(getPluginById(testDb.adapter, 'p5')).not.toBeNull();
  });

  it('uninstalls custom plugins', () => {
    installPlugin(testDb.adapter, 'p6', { name: 'Custom' });
    uninstallPlugin(testDb.adapter, 'p6');
    expect(getPluginById(testDb.adapter, 'p6')).toBeNull();
  });

  it('manages plugin settings', () => {
    installPlugin(testDb.adapter, 'p7', { name: 'Config' });
    expect(getPluginSetting(testDb.adapter, 'p7', 'theme')).toBeNull();
    setPluginSetting(testDb.adapter, 'p7', 'theme', 'dark');
    expect(getPluginSetting(testDb.adapter, 'p7', 'theme')).toBe('dark');

    const settings = getPluginSettings(testDb.adapter, 'p7');
    expect(settings).toHaveLength(1);
    expect(settings[0].key).toBe('theme');
  });
});

// ── AI History ────────────────────────────────────────────────────────

describe('AI History CRUD', () => {
  it('creates an AI history entry', () => {
    createNote(testDb.adapter, 'ain1', { title: 'AI Note' });
    const entry = createAiHistoryEntry(testDb.adapter, 'ah1', {
      noteId: 'ain1',
      action: 'summarize',
      inputText: 'Long text here...',
      outputText: 'Summary here.',
    });
    expect(entry.action).toBe('summarize');
    expect(entry.provider).toBe('local');
    expect(entry.accepted).toBe(false);
  });

  it('accepts an AI result', () => {
    createNote(testDb.adapter, 'ain2', { title: 'AI Note 2' });
    createAiHistoryEntry(testDb.adapter, 'ah2', {
      noteId: 'ain2',
      action: 'fix_grammar',
      inputText: 'input',
      outputText: 'output',
    });
    acceptAiResult(testDb.adapter, 'ah2');
    const history = getAiHistoryForNote(testDb.adapter, 'ain2');
    expect(history[0].accepted).toBe(true);
  });

  it('deletes AI history for a note', () => {
    createNote(testDb.adapter, 'ain3', { title: 'AI Note 3' });
    createAiHistoryEntry(testDb.adapter, 'ah3', { noteId: 'ain3', action: 'simplify', inputText: 'x', outputText: 'y' });
    deleteAiHistory(testDb.adapter, 'ain3');
    expect(getAiHistoryForNote(testDb.adapter, 'ain3')).toHaveLength(0);
  });
});

// ── AI Local Engine ───────────────────────────────────────────────────

describe('AI Local Engine', () => {
  it('summarizes text by picking key sentences', () => {
    const text = 'First sentence. Second one is short. Third sentence provides more detail and context. Last sentence.';
    const summary = summarizeLocal(text, 2);
    expect(summary.length).toBeLessThan(text.length);
  });

  it('returns short text unchanged when under sentence limit', () => {
    expect(summarizeLocal('One sentence.')).toBe('One sentence.');
  });

  it('fixes grammar issues', () => {
    expect(fixGrammarLocal('hello world. this is  a test')).toBe('Hello world. This is a test');
  });

  it('fixes common contractions', () => {
    const result = fixGrammarLocal('i dont know why i cant do it');
    expect(result).toContain("don't");
    expect(result).toContain("can't");
    expect(result).toContain('I');
  });

  it('simplifies complex words', () => {
    const result = simplifyLocal('We need to utilize this tool to facilitate the process');
    expect(result).toContain('use');
    expect(result).toContain('help');
  });

  it('dispatches actions via runLocalAiAction', () => {
    expect(runLocalAiAction('fix_grammar', 'hello. this is test.')).toBe('Hello. This is test.');
    expect(runLocalAiAction('unknown', 'text')).toBe('text');
  });
});

// ── Graph Engine ──────────────────────────────────────────────────────

describe('Graph Engine', () => {
  const graph = {
    nodes: [
      { id: 'a', title: 'A', linkCount: 2 },
      { id: 'b', title: 'B', linkCount: 1 },
      { id: 'c', title: 'C', linkCount: 1 },
      { id: 'd', title: 'D', linkCount: 0 },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
    ],
  };

  it('filters graph by predicate', () => {
    const filtered = filterGraph(graph, (n) => n.linkCount > 0);
    expect(filtered.nodes).toHaveLength(3);
    expect(filtered.edges).toHaveLength(2);
  });

  it('gets local graph for a node', () => {
    const local = getLocalGraph(graph, 'a');
    expect(local.nodes).toHaveLength(3); // a, b, c
    expect(local.edges).toHaveLength(2);
  });

  it('finds orphan nodes', () => {
    const orphans = findOrphans(graph);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].id).toBe('d');
  });

  it('clusters connected nodes', () => {
    const clusters = clusterNotes(graph);
    expect(clusters.length).toBeGreaterThanOrEqual(2); // {a,b,c} and {d}
  });

  it('computes graph statistics', () => {
    const stats = getGraphStats(graph);
    expect(stats.nodeCount).toBe(4);
    expect(stats.edgeCount).toBe(2);
    expect(stats.orphanCount).toBe(1);
    expect(stats.clusterCount).toBe(2);
  });
});

// ── Web Clipper Engine ────────────────────────────────────────────────

describe('Web Clipper Engine', () => {
  it('converts HTML headings to markdown', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toContain('# Title');
    expect(htmlToMarkdown('<h2>Section</h2>')).toContain('## Section');
  });

  it('converts links and images', () => {
    expect(htmlToMarkdown('<a href="http://example.com">click</a>')).toContain('[click](http://example.com)');
  });

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toContain('**bold**');
    expect(htmlToMarkdown('<em>italic</em>')).toContain('*italic*');
  });

  it('strips script and style tags', () => {
    const html = '<p>Hello</p><script>alert(1)</script><style>.foo{}</style>';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('alert');
    expect(md).not.toContain('.foo');
    expect(md).toContain('Hello');
  });

  it('decodes HTML entities', () => {
    expect(htmlToMarkdown('A &amp; B &lt; C')).toContain('A & B < C');
  });

  it('builds clip body with metadata', () => {
    const body = buildClipBody('Content here', 'https://example.com', 'Test Article', 'Author');
    expect(body).toContain('# Test Article');
    expect(body).toContain('Clipped from');
    expect(body).toContain('Author: Author');
    expect(body).toContain('Content here');
  });

  it('truncates long content', () => {
    const long = 'x'.repeat(600000);
    const truncated = truncateClip(long, 500000);
    expect(truncated.length).toBeLessThan(long.length);
    expect(truncated).toContain('[Content truncated]');
  });

  it('does not truncate short content', () => {
    expect(truncateClip('short')).toBe('short');
  });
});
