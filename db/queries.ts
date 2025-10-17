import { eq, asc, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { db } from './client';
import {
  customers,
  invoiceItems,
  invoiceSequences,
  invoices,
  savedItems
} from './schema';
import { createId } from '@/lib/id';
import { getCustomerShortcode, calculateTotals } from '@/lib/invoice';
import type { Customer, InvoicePayload, LineItem, SavedLineItem } from '@/types/invoice';
import { currencyOptions } from '@/lib/currency';

const nowSql = sql`(strftime('%s','now'))`;

export type CustomerRow = InferSelectModel<typeof customers>;

export const mapCustomer = (
  row: CustomerRow,
  lastNumber: number | null
): Customer => ({
  id: row.id,
  name: row.name,
  email: row.email ?? null,
  address: row.address ?? null,
  shortcode: row.shortcode,
  createdAt: row.createdAt ?? undefined,
  lastNumber
});

export const getCustomers = async (): Promise<Customer[]> => {
  const records = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      address: customers.address,
      shortcode: customers.shortcode,
      createdAt: customers.createdAt,
      lastNumber: invoiceSequences.lastNumber
    })
    .from(customers)
    .leftJoin(invoiceSequences, eq(invoiceSequences.shortcode, customers.shortcode))
    .orderBy(asc(customers.name));

  return records.map((row) =>
    mapCustomer(
      {
        id: row.id,
        name: row.name,
        email: row.email,
        address: row.address,
        shortcode: row.shortcode,
        createdAt: row.createdAt
      },
      row.lastNumber ?? null
    )
  );
};

export const getSavedLineItems = async (): Promise<SavedLineItem[]> => {
  const records = await db.select().from(savedItems).orderBy(asc(savedItems.name));

  return records.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    unitPrice: row.unitPrice,
    taxRate: row.taxRate
  }));
};

interface CustomerInput {
  name: string;
  email?: string | null;
  address?: string | null;
}

export const createCustomerRecord = async (input: CustomerInput): Promise<Customer> => {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Customer name is required');
  }

  const id = createId();
  const shortcode = getCustomerShortcode(trimmedName);

  await db.insert(customers).values({
    id,
    name: trimmedName,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    shortcode
  });

  return mapCustomer(
    {
      id,
      name: trimmedName,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      shortcode,
      createdAt: Math.floor(Date.now() / 1000)
    },
    null
  );
};

export const updateCustomerRecord = async (
  customerId: string,
  input: CustomerInput
): Promise<Customer> => {
  const existing = (
    await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        address: customers.address,
        shortcode: customers.shortcode,
        createdAt: customers.createdAt
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
  )[0];

  if (!existing) {
    throw new Error('Customer not found');
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Customer name is required');
  }

  const nextShortcode = getCustomerShortcode(trimmedName);

  await db.transaction(async (tx) => {
    await tx
      .update(customers)
      .set({
        name: trimmedName,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        shortcode: nextShortcode
      })
      .where(eq(customers.id, customerId));

    if (existing.shortcode !== nextShortcode) {
      const sequence = (
        await tx
          .select({ lastNumber: invoiceSequences.lastNumber })
          .from(invoiceSequences)
          .where(eq(invoiceSequences.shortcode, existing.shortcode))
          .limit(1)
      )[0];

      if (sequence) {
        await tx
          .insert(invoiceSequences)
          .values({ shortcode: nextShortcode, lastNumber: sequence.lastNumber })
          .onConflictDoUpdate({
            target: invoiceSequences.shortcode,
            set: { lastNumber: sequence.lastNumber }
          });

        await tx.delete(invoiceSequences).where(eq(invoiceSequences.shortcode, existing.shortcode));
      }
    }
  });

  const sequenceAfter = (
    await db
      .select({ lastNumber: invoiceSequences.lastNumber })
      .from(invoiceSequences)
      .where(eq(invoiceSequences.shortcode, nextShortcode))
      .limit(1)
  )[0]?.lastNumber ?? null;

  return mapCustomer(
    {
      id: customerId,
      name: trimmedName,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      shortcode: nextShortcode,
      createdAt: existing.createdAt
    },
    sequenceAfter
  );
};

interface SavedItemInput {
  name: string;
  description?: string | null;
  unitPrice: number;
  taxRate: number;
}

export const upsertSavedItem = async (input: SavedItemInput) => {
  const name = input.name.trim();
  if (!name) {
    return;
  }

  const searchKey = name.toLowerCase();

  const existing = (
    await db
      .select({ id: savedItems.id })
      .from(savedItems)
      .where(eq(savedItems.searchKey, searchKey))
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(savedItems)
      .set({
        name,
        description: input.description?.trim() || null,
        unitPrice: input.unitPrice,
        taxRate: input.taxRate,
        updatedAt: nowSql
      })
      .where(eq(savedItems.id, existing.id));
    return existing.id;
  }

  const id = createId();
  await db.insert(savedItems).values({
    id,
    name,
    description: input.description?.trim() || null,
    unitPrice: input.unitPrice,
    taxRate: input.taxRate,
    searchKey
  });
  return id;
};

interface CreateInvoiceInput {
  invoiceId?: string;
  customerId: string;
  issueDate: string;
  dueDate?: string | null;
  currencyCode: string;
  currencySymbol: string;
  notes?: string;
  roundOff: number;
  lineItems: Array<{
    id?: string;
    name: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const createOrUpdateInvoice = async (
  input: CreateInvoiceInput
): Promise<InvoicePayload> => {
  if (!input.lineItems || input.lineItems.length === 0) {
    throw new Error('At least one line item is required.');
  }

  const customerRecord = (
    await db
      .select()
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1)
  )[0];

  if (!customerRecord) {
    throw new Error('Customer not found.');
  }

  const sanitizedItems = input.lineItems.map((item) => ({
    id: item.id || createId(),
    name: item.name.trim(),
    description: item.description?.trim() || null,
    quantity: Number(item.quantity) || 0,
    unitPrice: roundCurrency(Number(item.unitPrice) || 0),
    taxRate: roundCurrency(Number(item.taxRate) || 0)
  }));

  if (sanitizedItems.some((item) => !item.name)) {
    throw new Error('Each line item requires a name.');
  }

  if (sanitizedItems.some((item) => item.quantity <= 0)) {
    throw new Error('Line item quantity must be greater than zero.');
  }

  const currencyMeta =
    currencyOptions.find((option) => option.code === input.currencyCode) ?? (
      input.currencySymbol
        ? { code: input.currencyCode, symbol: input.currencySymbol, name: input.currencyCode }
        : { code: input.currencyCode, symbol: '$', name: input.currencyCode }
    );

  return db.transaction(async (tx) => {
    const existingInvoice = input.invoiceId
      ? (
          await tx
            .select({
              id: invoices.id,
              invoiceNumber: invoices.invoiceNumber,
              customerId: invoices.customerId
            })
            .from(invoices)
            .where(eq(invoices.id, input.invoiceId))
            .limit(1)
        )[0]
      : undefined;

    if (existingInvoice && existingInvoice.customerId !== customerRecord.id) {
      throw new Error('Cannot change the customer for an existing invoice.');
    }

    const invoiceId = existingInvoice?.id ?? input.invoiceId ?? createId();

    let invoiceNumber = existingInvoice?.invoiceNumber;

    if (!invoiceNumber) {
      const sequence = (
        await tx
          .select({ lastNumber: invoiceSequences.lastNumber })
          .from(invoiceSequences)
          .where(eq(invoiceSequences.shortcode, customerRecord.shortcode))
          .limit(1)
      )[0];

      const nextNumber = (sequence?.lastNumber ?? 0) + 1;

      await tx
        .insert(invoiceSequences)
        .values({ shortcode: customerRecord.shortcode, lastNumber: nextNumber })
        .onConflictDoUpdate({
          target: invoiceSequences.shortcode,
          set: { lastNumber: nextNumber }
        });

      invoiceNumber = `INV-${customerRecord.shortcode}-${String(nextNumber).padStart(4, '0')}`;
    }

    const invoiceLineItems = sanitizedItems.map((item, index) => ({
      id: createId(),
      invoiceId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      position: index
    }));

    const payloadLineItems: LineItem[] = sanitizedItems.map((item, index) => ({
      id: invoiceLineItems[index].id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate
    }));

    const invoicePayload: InvoicePayload = {
      id: invoiceId,
      invoiceNumber,
      issueDate: input.issueDate,
      dueDate: input.dueDate || null,
      currency: {
        code: currencyMeta.code,
        symbol: currencyMeta.symbol,
        name: currencyMeta.name
      },
      customer: mapCustomer(customerRecord, null),
      lineItems: payloadLineItems,
      notes: input.notes?.trim() || '',
      roundOff: roundCurrency(input.roundOff)
    };

    const totals = calculateTotals(invoicePayload);
    invoicePayload.totals = totals;

    await tx
      .insert(invoices)
      .values({
        id: invoiceId,
        invoiceNumber,
        customerId: customerRecord.id,
        issueDate: input.issueDate,
        dueDate: input.dueDate || null,
        currencyCode: invoicePayload.currency.code,
        currencySymbol: invoicePayload.currency.symbol,
        notes: invoicePayload.notes,
        roundOff: invoicePayload.roundOff,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total
      })
      .onConflictDoUpdate({
        target: invoices.id,
        set: {
          issueDate: input.issueDate,
          dueDate: input.dueDate || null,
          currencyCode: invoicePayload.currency.code,
          currencySymbol: invoicePayload.currency.symbol,
          notes: invoicePayload.notes,
          roundOff: invoicePayload.roundOff,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total
        }
      });

    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    if (invoiceLineItems.length > 0) {
      await tx.insert(invoiceItems).values(invoiceLineItems);
    }

    for (const item of sanitizedItems) {
      await tx
        .insert(savedItems)
        .values({
          id: createId(),
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          searchKey: item.name.toLowerCase()
        })
        .onConflictDoUpdate({
          target: savedItems.searchKey,
          set: {
            name: item.name,
            description: item.description,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            updatedAt: nowSql
          }
        });
    }

    return invoicePayload;
  });
};

export const previewInvoiceNumber = async (shortcode: string) => {
  const sequence = (
    await db
      .select({ lastNumber: invoiceSequences.lastNumber })
      .from(invoiceSequences)
      .where(eq(invoiceSequences.shortcode, shortcode))
      .limit(1)
  )[0];

  const nextValue = (sequence?.lastNumber ?? 0) + 1;
  return `INV-${shortcode}-${String(nextValue).padStart(4, '0')}`;
};
