'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
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
  updateFolder,
  deleteFolder,
  createTag,
  getTags,
  deleteTag,
  getTagsForNote,
  getBacklinksForNote,
  getNoteGraph,
  createTemplate,
  getTemplates,
  deleteTemplate,
  seedBuiltInTemplates,
  incrementTemplateUseCount,
  getSetting,
  setSetting,
  getNotesStats,
  getOrCreateDailyNote,
  getDailyNoteDates,
  getDailyNoteByDate,
  htmlToMarkdown,
  buildClipBody,
  truncateClip,
  getDatabases,
  getDatabaseById,
  createDatabase,
  deleteDatabase,
  createDbColumn,
  getColumnsForDatabase,
  deleteDbColumn,
  createDbRow,
  getRowsForDatabase,
  deleteDbRow,
  setCellValue,
  getCellsForRow,
  getPlugins,
  enablePlugin,
  disablePlugin,
  uninstallPlugin,
  getPluginSettings,
  setPluginSetting,
  getCanvases,
  getCanvasById,
  createCanvas,
  deleteCanvas,
  updateCanvas,
  addNode,
  moveNode,
  deleteNode,
  addEdge,
  deleteEdge,
  getNodesForCanvas,
  getEdgesForCanvas,
  BUILT_IN_TEMPLATES,
  type NoteFilter,
  type CreateNoteInput,
  type UpdateNoteInput,
  type CreateFolderInput,
  type UpdateFolderInput,
  type CreateTagInput,
  type CreateTemplateInput,
  type ClipType,
} from '@mylife/notes';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('notes');
  return adapter;
}

// ── Notes CRUD ────────────────────────────────────────────────────

export async function fetchNotes(filters?: NoteFilter) {
  return getNotes(db(), filters);
}

export async function fetchNote(id: string) {
  return getNoteById(db(), id);
}

export async function createNoteAction(input: CreateNoteInput) {
  const id = crypto.randomUUID();
  createNote(db(), id, input);
  return id;
}

export async function updateNoteAction(id: string, input: UpdateNoteInput) {
  updateNote(db(), id, input);
}

export async function deleteNoteAction(id: string) {
  deleteNote(db(), id);
}

export async function searchNotesAction(query: string) {
  return searchNotes(db(), query);
}

export async function fetchNoteCount() {
  return getNoteCount(db());
}

export async function fetchStats() {
  return getNotesStats(db());
}

// ── Folders ───────────────────────────────────────────────────────

export async function fetchFolders() {
  return getFolders(db());
}

export async function createFolderAction(input: CreateFolderInput) {
  const id = crypto.randomUUID();
  createFolder(db(), id, input);
  return id;
}

export async function updateFolderAction(id: string, input: UpdateFolderInput) {
  updateFolder(db(), id, input);
}

export async function deleteFolderAction(id: string) {
  deleteFolder(db(), id);
}

// ── Tags ──────────────────────────────────────────────────────────

export async function fetchTags() {
  return getTags(db());
}

export async function createTagAction(input: CreateTagInput) {
  const id = crypto.randomUUID();
  createTag(db(), id, input);
  return id;
}

export async function deleteTagAction(id: string) {
  deleteTag(db(), id);
}

export async function fetchTagsForNoteAction(noteId: string) {
  return getTagsForNote(db(), noteId);
}

// ── Links / Graph ─────────────────────────────────────────────────

export async function fetchBacklinks(noteId: string) {
  return getBacklinksForNote(db(), noteId);
}

export async function fetchNoteGraph() {
  return getNoteGraph(db());
}

// ── Daily Notes ───────────────────────────────────────────────────

export async function fetchOrCreateDailyNote(date: string) {
  return getOrCreateDailyNote(db(), date);
}

export async function fetchDailyDates() {
  return getDailyNoteDates(db());
}

export async function fetchDailyNoteByDate(date: string) {
  return getDailyNoteByDate(db(), date);
}

// ── Templates ─────────────────────────────────────────────────────

export async function fetchTemplates() {
  return getTemplates(db());
}

export async function createTemplateAction(input: CreateTemplateInput) {
  const id = crypto.randomUUID();
  createTemplate(db(), id, input);
  return id;
}

export async function deleteTemplateAction(id: string) {
  deleteTemplate(db(), id);
}

export async function seedTemplatesAction() {
  seedBuiltInTemplates(db(), BUILT_IN_TEMPLATES);
}

export async function applyTemplateAction(templateId: string) {
  incrementTemplateUseCount(db(), templateId);
}

// ── Settings ──────────────────────────────────────────────────────

export async function fetchSetting(key: string) {
  return getSetting(db(), key);
}

export async function saveSettingAction(key: string, value: string) {
  setSetting(db(), key, value);
}

// ── Web Clipper ───────────────────────────────────────────────────

export async function clipUrlAction(url: string, clipType: ClipType) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MyNotes Web Clipper' },
  });
  const html = await res.text();
  const markdown = htmlToMarkdown(html);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? url;
  const body = clipType === 'bookmark'
    ? `# ${title}\n\n[${url}](${url})`
    : truncateClip(buildClipBody(markdown, url, title));

  const id = crypto.randomUUID();
  const adapter = db();
  const now = new Date().toISOString();
  createNote(adapter, id, { title, body });
  adapter.execute(
    `UPDATE nt_notes SET source_url = ?, clipped_at = ?, clip_type = ? WHERE id = ?`,
    [url, now, clipType, id],
  );

  return { id, title, body, sourceUrl: url, clipType };
}

// ── Databases ─────────────────────────────────────────────────────

export async function fetchDatabases() {
  return getDatabases(db());
}

export async function createDatabaseAction(input: { title?: string }) {
  const id = crypto.randomUUID();
  createDatabase(db(), id, input);
  return id;
}

export async function deleteDatabaseAction(id: string) {
  deleteDatabase(db(), id);
}

export async function fetchDatabaseDetail(id: string) {
  const adapter = db();
  const database = getDatabaseById(adapter, id);
  if (!database) return null;
  const columns = getColumnsForDatabase(adapter, id);
  const rows = getRowsForDatabase(adapter, id);
  const cellsByRow: Record<string, ReturnType<typeof getCellsForRow>> = {};
  for (const row of rows) {
    cellsByRow[row.id] = getCellsForRow(adapter, row.id);
  }
  return { database, columns, rows, cellsByRow };
}

export async function createDbRowAction(dbId: string) {
  const id = crypto.randomUUID();
  createDbRow(db(), id, dbId);
  return id;
}

export async function createDbColumnAction(dbId: string, input: { name: string; columnType: string }) {
  const id = crypto.randomUUID();
  createDbColumn(db(), id, { databaseId: dbId, name: input.name, columnType: input.columnType });
  return id;
}

export async function setCellValueAction(
  rowId: string,
  columnId: string,
  value: { text?: string | null; number?: number | null; json?: string | null },
) {
  const id = crypto.randomUUID();
  setCellValue(db(), id, rowId, columnId, value);
}

export async function deleteDbRowAction(id: string) {
  deleteDbRow(db(), id);
}

export async function deleteDbColumnAction(id: string) {
  deleteDbColumn(db(), id);
}

// ── Plugins ───────────────────────────────────────────────────────

export async function fetchPlugins() {
  return getPlugins(db());
}

export async function togglePluginAction(id: string, enabled: boolean) {
  if (enabled) {
    enablePlugin(db(), id);
  } else {
    disablePlugin(db(), id);
  }
}

export async function uninstallPluginAction(id: string) {
  uninstallPlugin(db(), id);
}

export async function fetchPluginSettingsAction(id: string) {
  return getPluginSettings(db(), id);
}

export async function savePluginSettingAction(pluginId: string, key: string, value: string) {
  setPluginSetting(db(), pluginId, key, value);
}

// ── Canvas ────────────────────────────────────────────────────────

export async function fetchCanvases() {
  return getCanvases(db());
}

export async function fetchCanvasAction(id: string) {
  const adapter = db();
  const canvas = getCanvasById(adapter, id);
  if (!canvas) return null;
  const nodes = getNodesForCanvas(adapter, id);
  const edges = getEdgesForCanvas(adapter, id);
  return { canvas, nodes, edges };
}

export async function createCanvasAction(input: { title?: string }) {
  const id = crypto.randomUUID();
  createCanvas(db(), id, input);
  return id;
}

export async function deleteCanvasAction(id: string) {
  deleteCanvas(db(), id);
}

export async function updateCanvasAction(id: string, input: { title?: string }) {
  updateCanvas(db(), id, input);
}

export async function addCanvasNodeAction(
  canvasId: string,
  input: { nodeType?: string; label?: string; x?: number; y?: number; w?: number; h?: number },
) {
  const id = crypto.randomUUID();
  addNode(db(), id, canvasId, input);
  return id;
}

export async function moveCanvasNodeAction(nodeId: string, x: number, y: number) {
  moveNode(db(), nodeId, x, y);
}

export async function deleteCanvasNodeAction(nodeId: string, canvasId: string) {
  deleteNode(db(), nodeId, canvasId);
}

export async function addCanvasEdgeAction(
  canvasId: string,
  input: { sourceNodeId: string; targetNodeId: string },
) {
  const id = crypto.randomUUID();
  addEdge(db(), id, canvasId, input);
  return id;
}

export async function deleteCanvasEdgeAction(edgeId: string, canvasId: string) {
  deleteEdge(db(), edgeId, canvasId);
}
