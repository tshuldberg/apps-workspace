// MyNotes V3 migration schema - Canvas/Whiteboard

export const V3_CANVASES = `
CREATE TABLE IF NOT EXISTS nt_canvases (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Canvas',
  description TEXT DEFAULT '',
  folder_id TEXT REFERENCES nt_folders(id) ON DELETE SET NULL,
  thumbnail_path TEXT,
  canvas_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"groups":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  node_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_CANVAS_NODES = `
CREATE TABLE IF NOT EXISTS nt_canvas_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  canvas_id TEXT NOT NULL REFERENCES nt_canvases(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'text'
    CHECK (node_type IN ('text', 'note', 'image', 'link', 'group', 'shape')),
  label TEXT DEFAULT '',
  content TEXT DEFAULT '',
  ref_note_id TEXT REFERENCES nt_notes(id) ON DELETE SET NULL,
  ref_attachment_id TEXT REFERENCES nt_attachments(id) ON DELETE SET NULL,
  url TEXT,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  w REAL NOT NULL DEFAULT 200,
  h REAL NOT NULL DEFAULT 100,
  color TEXT DEFAULT '',
  shape TEXT DEFAULT 'rectangle'
    CHECK (shape IN ('rectangle', 'rounded', 'ellipse', 'diamond', 'hexagon')),
  group_id TEXT,
  z_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_CANVAS_EDGES = `
CREATE TABLE IF NOT EXISTS nt_canvas_edges (
  id TEXT PRIMARY KEY NOT NULL,
  canvas_id TEXT NOT NULL REFERENCES nt_canvases(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL REFERENCES nt_canvas_nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nt_canvas_nodes(id) ON DELETE CASCADE,
  label TEXT DEFAULT '',
  edge_style TEXT NOT NULL DEFAULT 'straight'
    CHECK (edge_style IN ('straight', 'curved', 'step')),
  arrow_start INTEGER NOT NULL DEFAULT 0,
  arrow_end INTEGER NOT NULL DEFAULT 1,
  color TEXT DEFAULT '',
  stroke_width REAL NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS nt_canvases_folder_idx ON nt_canvases(folder_id)`,
  `CREATE INDEX IF NOT EXISTS nt_canvases_pinned_idx ON nt_canvases(is_pinned)`,
  `CREATE INDEX IF NOT EXISTS nt_canvas_nodes_canvas_idx ON nt_canvas_nodes(canvas_id, z_index)`,
  `CREATE INDEX IF NOT EXISTS nt_canvas_nodes_ref_note_idx ON nt_canvas_nodes(ref_note_id) WHERE ref_note_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS nt_canvas_nodes_group_idx ON nt_canvas_nodes(group_id) WHERE group_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS nt_canvas_edges_canvas_idx ON nt_canvas_edges(canvas_id)`,
  `CREATE INDEX IF NOT EXISTS nt_canvas_edges_source_idx ON nt_canvas_edges(source_node_id)`,
  `CREATE INDEX IF NOT EXISTS nt_canvas_edges_target_idx ON nt_canvas_edges(target_node_id)`,
];

export const NOTES_V3_UP: string[] = [
  V3_CANVASES,
  V3_CANVAS_NODES,
  V3_CANVAS_EDGES,
  ...V3_INDEXES,
];

export const NOTES_V3_DOWN: string[] = [
  'DROP INDEX IF EXISTS nt_canvas_edges_target_idx',
  'DROP INDEX IF EXISTS nt_canvas_edges_source_idx',
  'DROP INDEX IF EXISTS nt_canvas_edges_canvas_idx',
  'DROP INDEX IF EXISTS nt_canvas_nodes_group_idx',
  'DROP INDEX IF EXISTS nt_canvas_nodes_ref_note_idx',
  'DROP INDEX IF EXISTS nt_canvas_nodes_canvas_idx',
  'DROP INDEX IF EXISTS nt_canvases_pinned_idx',
  'DROP INDEX IF EXISTS nt_canvases_folder_idx',
  'DROP TABLE IF EXISTS nt_canvas_edges',
  'DROP TABLE IF EXISTS nt_canvas_nodes',
  'DROP TABLE IF EXISTS nt_canvases',
];
