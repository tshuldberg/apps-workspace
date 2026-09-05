CREATE INDEX IF NOT EXISTS sl_dreams_type_idx ON sl_dreams(type);
CREATE INDEX IF NOT EXISTS sl_dreams_recurring_group_idx ON sl_dreams(recurring_group_id);

CREATE VIRTUAL TABLE IF NOT EXISTS sl_dreams_fts USING fts5(
  content_md,
  themes,
  people,
  content='sl_dreams',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS sl_dreams_fts_insert AFTER INSERT ON sl_dreams BEGIN
  INSERT INTO sl_dreams_fts(rowid, content_md, themes, people)
  VALUES (NEW.rowid, NEW.content_md, NEW.themes, NEW.people);
END;

CREATE TRIGGER IF NOT EXISTS sl_dreams_fts_delete AFTER DELETE ON sl_dreams BEGIN
  INSERT INTO sl_dreams_fts(sl_dreams_fts, rowid, content_md, themes, people)
  VALUES ('delete', OLD.rowid, OLD.content_md, OLD.themes, OLD.people);
END;

CREATE TRIGGER IF NOT EXISTS sl_dreams_fts_update AFTER UPDATE ON sl_dreams BEGIN
  INSERT INTO sl_dreams_fts(sl_dreams_fts, rowid, content_md, themes, people)
  VALUES ('delete', OLD.rowid, OLD.content_md, OLD.themes, OLD.people);
  INSERT INTO sl_dreams_fts(rowid, content_md, themes, people)
  VALUES (NEW.rowid, NEW.content_md, NEW.themes, NEW.people);
END;

INSERT INTO sl_dreams_fts(sl_dreams_fts) VALUES('rebuild');
