import Database from 'better-sqlite3';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { customers, invoiceItems, invoiceSequences, invoices, savedItems, companySettings } from './schema';

const databasePath = path.join(process.cwd(), 'sqlite.db');
const sqlite = new Database(databasePath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    address TEXT,
    shortcode TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS saved_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    unit_price REAL NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    search_key TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_sequences (
    shortcode TEXT PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    currency_code TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    notes TEXT,
    round_off REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_total REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    paid_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    tax_rate REAL NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    company_email TEXT,
    company_phone TEXT,
    company_address TEXT,
    company_logo TEXT,
    tax_id TEXT,
    website TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
`);

export const db = drizzle(sqlite, {
  schema: { customers, savedItems, invoiceSequences, invoices, invoiceItems, companySettings }
});

export type DbClient = typeof db;
