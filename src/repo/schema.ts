/** SQL migrations for SqliteRepository. Applied in order by version. */

export type Migration = {
  version: number
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  agent_notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
  product_id TEXT PRIMARY KEY,
  on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL CHECK (reserved >= 0),
  CHECK (on_hand >= reserved)
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('created', 'committed', 'released')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  promotion_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotions (
  code TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  cart_id TEXT NOT NULL,
  status TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  promotion_code TEXT,
  reservation_ids_json TEXT NOT NULL DEFAULT '[]',
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  request_hash TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_stock_product ON stock (product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON reservations (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
`,
  },
]
