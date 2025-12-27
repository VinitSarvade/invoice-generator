import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';
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
}, (table) => ({
  shortcodeIdx: index('customers_shortcode_idx').on(table.shortcode),
  nameIdx: index('customers_name_idx').on(table.name)
}));

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
  status: text('status').notNull().default('draft'), // draft, sent, paid, overdue, cancelled
  paidAt: integer('paid_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  customerIdIdx: index('invoices_customer_id_idx').on(table.customerId),
  statusIdx: index('invoices_status_idx').on(table.status),
  createdAtIdx: index('invoices_created_at_idx').on(table.createdAt),
  // Composite index for customer invoice history queries
  customerCreatedIdx: index('invoices_customer_created_idx').on(table.customerId, table.createdAt)
}));

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
}, (table) => ({
  invoiceIdIdx: index('invoice_items_invoice_id_idx').on(table.invoiceId)
}));

export const companySettings = sqliteTable('company_settings', {
  id: text('id').primaryKey(),
  companyName: text('company_name').notNull(),
  companyEmail: text('company_email'),
  companyPhone: text('company_phone'),
  companyAddress: text('company_address'),
  companyLogo: text('company_logo'), // base64 or URL
  taxId: text('tax_id'),
  website: text('website'),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
  expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt)
}));

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: integer('expires_at', { mode: 'number' }),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  userIdIdx: index('accounts_user_id_idx').on(table.userId),
  providerAccountIdx: index('accounts_provider_account_idx').on(table.providerId, table.accountId)
}));

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  identifierIdx: index('verifications_identifier_idx').on(table.identifier),
  expiresAtIdx: index('verifications_expires_at_idx').on(table.expiresAt)
}));
