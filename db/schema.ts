import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  address: text('address'),
  shortcode: text('shortcode').notNull(),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const savedItems = sqliteTable('saved_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull().default(0),
  searchKey: text('search_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const invoiceSequences = sqliteTable('invoice_sequences', {
  shortcode: text('shortcode').primaryKey(),
  lastNumber: integer('last_number').notNull().default(0)
});

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date'),
  currencyCode: text('currency_code').notNull(),
  currencySymbol: text('currency_symbol').notNull(),
  notes: text('notes'),
  roundOff: real('round_off').notNull().default(0),
  subtotal: real('subtotal').notNull(),
  taxTotal: real('tax_total').notNull(),
  total: real('total').notNull(),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  position: integer('position').notNull()
});
