import {
  sqliteTable,
  integer,
  text,
  real,
} from 'drizzle-orm/sqlite-core';

// ── 1. fishermen ──────────────────────────────────────────────
export const fishermen = sqliteTable('fishermen', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  boatName:  text('boat_name').notNull(),
  phone:     text('phone'),
  createdAt: text('created_at').notNull().default(''),
});

// ── 2. purchase_entries ───────────────────────────────────────
export const purchaseEntries = sqliteTable('purchase_entries', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  fishermenId: integer('fishermen_id').notNull().references(() => fishermen.id),
  date:        text('date').notNull(),       // YYYY-MM-DD
  notes:       text('notes'),
  totalAmount: real('total_amount').notNull().default(0),
  createdAt:   text('created_at').notNull().default(''),
});

// ── 3. purchase_items ─────────────────────────────────────────
export const purchaseItems = sqliteTable('purchase_items', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  entryId:      integer('entry_id').notNull().references(() => purchaseEntries.id),
  fishName:     text('fish_name').notNull(),
  quantity:     real('quantity').notNull(),
  unit:         text('unit', { enum: ['kg', 'lbs', 'pcs', 'crate'] }).notNull().default('kg'),
  pricePerUnit: real('price_per_unit').notNull(),
  totalPrice:   real('total_price').notNull(),
});

// ── 4. buyers ─────────────────────────────────────────────────
export const buyers = sqliteTable('buyers', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  type:      text('type', { enum: ['supplier', 'company', 'other'] }).notNull().default('other'),
  phone:     text('phone'),
  createdAt: text('created_at').notNull().default(''),
});

// ── 5. sales_orders ───────────────────────────────────────────
export const salesOrders = sqliteTable('sales_orders', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  buyerId:     integer('buyer_id').notNull().references(() => buyers.id),
  date:        text('date').notNull(),       // YYYY-MM-DD
  status:      text('status', { enum: ['pending', 'partial', 'complete'] }).notNull().default('pending'),
  totalAmount: real('total_amount').notNull().default(0),
  createdAt:   text('created_at').notNull().default(''),
});

// ── 6. sales_items ────────────────────────────────────────────
export const salesItems = sqliteTable('sales_items', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  orderId:       integer('order_id').notNull().references(() => salesOrders.id),
  fishName:      text('fish_name').notNull(),
  quantity:      real('quantity').notNull(),
  unit:          text('unit', { enum: ['kg', 'lbs', 'pcs', 'crate'] }).notNull().default('kg'),
  pricePerUnit:  real('price_per_unit').notNull(),
  totalPrice:    real('total_price').notNull(),
  sourceEntryId: integer('source_entry_id'),
});

// ── 7. payments ───────────────────────────────────────────────
export const payments = sqliteTable('payments', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  referenceType: text('reference_type', { enum: ['purchase', 'sale'] }).notNull(),
  referenceId:   integer('reference_id').notNull(),
  amount:        real('amount').notNull(),
  mode:          text('mode', { enum: ['cash', 'bank', 'upi', 'cheque', 'other'] }).notNull().default('cash'),
  paymentDate:   text('payment_date').notNull(),  // YYYY-MM-DD
  notes:         text('notes'),
});

// ── 8. fish_names ─────────────────────────────────────────────
export const fishNames = sqliteTable('fish_names', {
  id:   integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

// ── Inferred Types (Drizzle select/insert) ────────────────────
export type Fisherman       = typeof fishermen.$inferSelect;
export type NewFisherman    = typeof fishermen.$inferInsert;

export type PurchaseEntry   = typeof purchaseEntries.$inferSelect;
export type NewPurchaseEntry = typeof purchaseEntries.$inferInsert;

export type PurchaseItem    = typeof purchaseItems.$inferSelect;
export type NewPurchaseItem = typeof purchaseItems.$inferInsert;

export type Buyer           = typeof buyers.$inferSelect;
export type NewBuyer        = typeof buyers.$inferInsert;

export type SalesOrder      = typeof salesOrders.$inferSelect;
export type NewSalesOrder   = typeof salesOrders.$inferInsert;

export type SalesItem       = typeof salesItems.$inferSelect;
export type NewSalesItem    = typeof salesItems.$inferInsert;

export type Payment         = typeof payments.$inferSelect;
export type NewPayment      = typeof payments.$inferInsert;

export type FishName        = typeof fishNames.$inferSelect;
export type NewFishName     = typeof fishNames.$inferInsert;