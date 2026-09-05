CREATE TABLE IF NOT EXISTS sh_wishlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  occasion TEXT,
  person_id TEXT,
  is_shareable INTEGER NOT NULL DEFAULT 0,
  share_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sh_wishlist_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES sh_wishlists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description_md TEXT,
  price_cents INTEGER,
  price_range_low INTEGER,
  price_range_high INTEGER,
  priority TEXT NOT NULL,
  url TEXT,
  photo_id TEXT,
  store TEXT,
  brand TEXT,
  occasion_tag TEXT,
  notes_md TEXT,
  size_notes TEXT,
  is_purchased INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT,
  purchase_id TEXT,
  is_gift_for TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sh_photos (
  id TEXT PRIMARY KEY,
  purchase_id TEXT,
  wishlist_item_id TEXT,
  warranty_id TEXT,
  kind TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sh_wishlist_items_list_idx ON sh_wishlist_items(list_id);
CREATE INDEX IF NOT EXISTS sh_wishlist_items_category_idx ON sh_wishlist_items(category);
CREATE INDEX IF NOT EXISTS sh_wishlist_items_priority_idx ON sh_wishlist_items(priority);
CREATE INDEX IF NOT EXISTS sh_wishlist_items_purchased_idx ON sh_wishlist_items(is_purchased);
CREATE UNIQUE INDEX IF NOT EXISTS sh_wishlists_share_token_idx ON sh_wishlists(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS sh_photos_wishlist_item_idx ON sh_photos(wishlist_item_id);
CREATE INDEX IF NOT EXISTS sh_photos_purchase_idx ON sh_photos(purchase_id);
