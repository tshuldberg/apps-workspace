// Definition
export { NOTES_MODULE } from './definition';

// Types and schemas
export type {
  Note,
  NoteFolder,
  NoteTag,
  NoteTagLink,
  NoteLink,
  NoteTemplate,
  NoteSetting,
  CreateNoteInput,
  UpdateNoteInput,
  CreateFolderInput,
  UpdateFolderInput,
  CreateTagInput,
  CreateTemplateInput,
  NoteFilter,
  NoteSearchResult,
  GraphNode,
  GraphEdge,
  NoteGraph,
  NotesStats,
} from './types';

export {
  NoteSchema,
  NoteFolderSchema,
  NoteTagSchema,
  NoteTagLinkSchema,
  NoteLinkSchema,
  NoteTemplateSchema,
  NoteSettingSchema,
  CreateNoteInputSchema,
  UpdateNoteInputSchema,
  CreateFolderInputSchema,
  UpdateFolderInputSchema,
  CreateTagInputSchema,
  CreateTemplateInputSchema,
  NoteFilterSchema,
} from './types';

// CRUD
export {
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
  getTagById,
  deleteTag,
  getTagsForNote,
  getBacklinksForNote,
  getOutgoingLinksForNote,
  getNoteGraph,
  createTemplate,
  getTemplates,
  deleteTemplate,
  updateTemplate,
  incrementTemplateUseCount,
  seedBuiltInTemplates,
  getSetting,
  setSetting,
  getNotesStats,
} from './db/crud';

// Engine
export {
  extractBacklinks,
  countWords,
  extractHeadings,
  countChecklistItems,
  generateSnippet,
} from './engine/markdown';

// Code Blocks engine
export {
  parseCodeBlocks,
  resolveLanguage,
  countCodeBlocks,
  extractCodeContent,
  SUPPORTED_LANGUAGES,
} from './engine/code-highlight';
export type { CodeBlock, SupportedLanguage } from './engine/code-highlight';

// Table engine
export {
  parseTable,
  generateTable,
  addRow,
  addColumn,
  deleteRow,
  deleteColumn,
  updateCell,
  setAlignment,
  escapeCell,
} from './engine/table';
export type { TableData, ColumnAlignment } from './engine/table';

// Daily notes
export {
  formatDailyTitle,
  getTodayIso,
  getOrCreateDailyNote,
  getDailyNoteDates,
  getDailyNoteByDate,
  isDailyNote,
} from './daily';
export type { DailyTitleFormat } from './daily';

// Templates
export { expandVariables, buildVariableMap, BUILT_IN_TEMPLATES } from './templates';
export type { TemplateVariableMap, BuiltInTemplate } from './templates';

// Checklist engine
export {
  toggleChecklistItem,
  isChecklistLine,
  parseChecklistLine,
  insertChecklist,
  handleChecklistEnter,
  indentChecklistItem,
  outdentChecklistItem,
  autoSortChecked,
  getChecklistProgress,
} from './engine/checklist';

// Graph analysis engine
export {
  filterGraph,
  getLocalGraph,
  findOrphans,
  clusterNotes,
  getGraphStats,
} from './engine/graph';

// Web clipper engine
export {
  htmlToMarkdown,
  buildClipBody,
  truncateClip,
} from './engine/web-clipper';
export type { ClipType, ClipResult } from './engine/web-clipper';

// AI writing assistant
export {
  summarizeLocal,
  fixGrammarLocal,
  simplifyLocal,
  getLocalAiActions,
  runLocalAiAction,
} from './ai';

// Attachments CRUD
export {
  createAttachment,
  getAttachmentsForNote,
  getAttachmentById,
  deleteAttachment,
  getAttachmentCount,
  updateOcrStatus,
  searchAttachmentOcr,
} from './db/attachments';

// AI history CRUD
export {
  createAiHistoryEntry,
  acceptAiResult,
  getAiHistoryForNote,
  deleteAiHistory,
} from './db/ai-history';

// Relational databases CRUD
export {
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
} from './db/databases';

// Plugins CRUD
export {
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
} from './db/plugins';

// Additional types
export type {
  NoteAttachment,
  AttachmentType,
  CreateAttachmentInput,
  AiHistoryEntry,
  AiAction,
  AiProvider,
  NoteDatabase,
  NoteDbColumn,
  NoteDbRow,
  NoteDbCell,
  DbView,
  DbColumnType,
  NotePlugin,
  NotePluginSetting,
} from './types';

export {
  NoteAttachmentSchema,
  AttachmentTypeEnum,
  CreateAttachmentInputSchema,
  AiHistorySchema,
  AiActionEnum,
  AiProviderEnum,
  NoteDatabaseSchema,
  NoteDbColumnSchema,
  NoteDbRowSchema,
  NoteDbCellSchema,
  DbViewEnum,
  DbColumnTypeEnum,
  NotePluginSchema,
  NotePluginSettingSchema,
} from './types';

// Canvas/Whiteboard
export {
  // Types & schemas
  CanvasSchema,
  CanvasNodeSchema,
  CanvasEdgeSchema,
  CanvasNodeTypeEnum,
  CanvasShapeEnum,
  CanvasEdgeStyleEnum,
  CanvasViewportSchema,
  CanvasJsonSchema,
  CanvasNodeJsonSchema,
  CanvasEdgeJsonSchema,
  CanvasGroupJsonSchema,
  CreateCanvasInputSchema,
  UpdateCanvasInputSchema,
  AddNodeInputSchema,
  AddEdgeInputSchema,
  CanvasFilterSchema,
  // Engine
  viewportCull,
  zoomToFit,
  getMaxZIndex,
  hitTestNode,
  selectNodesInRect,
  computeBoundingBox,
  getGroupChildren,
  computeGroupMove,
  // Layout
  snapToGrid,
  snapPositionToGrid,
  clampZoom,
  screenToCanvas,
  canvasToScreen,
  viewportCenter,
  GRID_SIZES,
  BACKGROUND_PATTERNS,
  // Serializer
  parseCanvasJson,
  stringifyCanvasJson,
  serializeCanvas,
  extractViewport,
} from './canvas';

export type {
  Canvas,
  CanvasNode,
  CanvasEdge,
  CanvasNodeType,
  CanvasShape,
  CanvasEdgeStyle,
  CanvasViewport,
  CanvasJson,
  CanvasNodeJson,
  CanvasEdgeJson,
  CanvasGroupJson,
  CreateCanvasInput,
  UpdateCanvasInput,
  AddNodeInput,
  AddEdgeInput,
  CanvasFilter,
  Rect,
  GridSize,
  BackgroundPattern,
} from './canvas';

// Canvas CRUD
export {
  createCanvas,
  getCanvases,
  getCanvasById,
  updateCanvas,
  deleteCanvas,
  duplicateCanvas,
  addNode,
  moveNode,
  resizeNode,
  updateNode,
  deleteNode,
  bringToFront,
  getNodesForCanvas,
  getNodeById,
  addEdge,
  updateEdge,
  deleteEdge,
  getEdgesForCanvas,
  groupNodes,
  ungroupNodes,
} from './db/canvas';

// Knowledge discovery engine
export {
  computeStalenessScores,
  extractSignificantTerms,
  findSimilarUnlinkedNotes,
  findKnowledgeGaps,
  computeKnowledgeDiscovery,
} from './engine/knowledge-discovery';
export type {
  StalenessScore,
  SimilarNotePair,
  KnowledgeGap,
  KnowledgeDiscoveryInsights,
} from './engine/knowledge-discovery';

// Writing analytics engine
export {
  computeDailyCreationTrend,
  computeWeeklyCreationTrend,
  computeWordCountDistribution,
  computeWritingVelocity,
  computeWritingStreak,
  computeWritingAnalytics,
} from './engine/writing-analytics';
export type {
  CreationTrend,
  WordCountBucket,
  WritingVelocity,
  WritingStreak,
  WritingAnalyticsInsights,
} from './engine/writing-analytics';

// Link intelligence engine
export {
  scoreConnections,
  findHubNotes,
  computeLinkDensity,
  findBridgeNotes,
  computeLinkIntelligence,
} from './engine/link-intelligence';
export type {
  ConnectionStrength,
  HubNote,
  LinkDensityStats,
  BridgeNote,
  LinkIntelligenceInsights,
} from './engine/link-intelligence';

// Tag intelligence engine
export {
  computeTagUsage,
  computeTagCoOccurrence,
  findUnusedTags,
  suggestTags,
  computeTagIntelligence,
} from './engine/tag-intelligence';
export type {
  TagUsageStats,
  TagCoOccurrence,
  TagSuggestion,
  TagIntelligenceInsights,
} from './engine/tag-intelligence';

// Cross-module tag readers (Phase 1c Wave A read-side)
export {
  getNotesWithTagLabel,
  getCrossModuleEntitiesForTagLabel,
} from './shared/tags';
export type { CrossModuleTagEntityCount } from './shared/tags';
