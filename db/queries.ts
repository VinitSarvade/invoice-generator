import { eq, asc, desc, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { db } from './client';
import {
  customers,
  invoiceItems,
  invoiceSequences,
  invoices,
  savedItems,
  companySettings
} from './schema';
import { createId } from '@/lib/id';
import { getCustomerShortcode, calculateTotals } from '@/lib/invoice';
import type { Customer, InvoicePayload, LineItem, SavedLineItem, CompanySettings, InvoiceListItem } from '@/types/invoice';
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

// Get all invoices with customer info
export const getAllInvoices = async (): Promise<InvoiceListItem[]> => {
  const records = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      customerName: customers.name,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      currencyCode: invoices.currencyCode,
      currencySymbol: invoices.currencySymbol,
      status: invoices.status,
      createdAt: invoices.createdAt
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .orderBy(desc(invoices.createdAt));

  return records.map(row => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    customerName: row.customerName,
    issueDate: row.issueDate,
    dueDate: row.dueDate ?? null,
    total: row.total,
    currencyCode: row.currencyCode,
    currencySymbol: row.currencySymbol,
    status: row.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
    createdAt: row.createdAt
  }));
};

// Get single invoice by ID with all details
export const getInvoiceById = async (invoiceId: string): Promise<InvoicePayload | null> => {
  const invoiceRecord = (
    await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
  )[0];

  if (!invoiceRecord) {
    return null;
  }

  const customerRecord = (
    await db
      .select()
      .from(customers)
      .where(eq(customers.id, invoiceRecord.customerId))
      .limit(1)
  )[0];

  if (!customerRecord) {
    return null;
  }

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.position));

  const lineItems: LineItem[] = items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate
  }));

  const currencyMeta = currencyOptions.find(c => c.code === invoiceRecord.currencyCode) ?? {
    code: invoiceRecord.currencyCode,
    symbol: invoiceRecord.currencySymbol,
    name: invoiceRecord.currencyCode
  };

  const payload: InvoicePayload = {
    id: invoiceRecord.id,
    invoiceNumber: invoiceRecord.invoiceNumber,
    issueDate: invoiceRecord.issueDate,
    dueDate: invoiceRecord.dueDate ?? null,
    currency: currencyMeta,
    customer: mapCustomer(customerRecord, null),
    lineItems,
    notes: invoiceRecord.notes ?? '',
    roundOff: invoiceRecord.roundOff,
    status: invoiceRecord.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
    paidAt: invoiceRecord.paidAt ?? null,
    createdAt: invoiceRecord.createdAt,
    totals: {
      subtotal: invoiceRecord.subtotal,
      taxTotal: invoiceRecord.taxTotal,
      roundOff: invoiceRecord.roundOff,
      total: invoiceRecord.total
    }
  };

  return payload;
};

// Delete invoice
export const deleteInvoice = async (invoiceId: string): Promise<void> => {
  await db.delete(invoices).where(eq(invoices.id, invoiceId));
};

// Delete customer
export const deleteCustomer = async (customerId: string): Promise<void> => {
  await db.delete(customers).where(eq(customers.id, customerId));
};

// Delete saved item
export const deleteSavedItem = async (itemId: string): Promise<void> => {
  await db.delete(savedItems).where(eq(savedItems.id, itemId));
};

// Update invoice status
export const updateInvoiceStatus = async (
  invoiceId: string,
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
  paidAt?: number | null
): Promise<void> => {
  const updateData: any = { status };

  if (status === 'paid' && paidAt) {
    updateData.paidAt = paidAt;
  }

  await db.update(invoices).set(updateData).where(eq(invoices.id, invoiceId));
};

// Get company settings
export const getCompanySettings = async (): Promise<CompanySettings | null> => {
  const records = await db.select().from(companySettings).limit(1);

  if (records.length === 0) {
    return null;
  }

  const record = records[0];
  return {
    id: record.id,
    companyName: record.companyName,
    companyEmail: record.companyEmail ?? null,
    companyPhone: record.companyPhone ?? null,
    companyAddress: record.companyAddress ?? null,
    companyLogo: record.companyLogo ?? null,
    taxId: record.taxId ?? null,
    website: record.website ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
};

// Create or update company settings
export const upsertCompanySettings = async (
  input: Omit<CompanySettings, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CompanySettings> => {
  const existing = await getCompanySettings();
  const id = existing?.id ?? createId();

  if (existing) {
    await db
      .update(companySettings)
      .set({
        companyName: input.companyName,
        companyEmail: input.companyEmail ?? null,
        companyPhone: input.companyPhone ?? null,
        companyAddress: input.companyAddress ?? null,
        companyLogo: input.companyLogo ?? null,
        taxId: input.taxId ?? null,
        website: input.website ?? null,
        updatedAt: nowSql
      })
      .where(eq(companySettings.id, id));
  } else {
    await db.insert(companySettings).values({
      id,
      companyName: input.companyName,
      companyEmail: input.companyEmail ?? null,
      companyPhone: input.companyPhone ?? null,
      companyAddress: input.companyAddress ?? null,
      companyLogo: input.companyLogo ?? null,
      taxId: input.taxId ?? null,
      website: input.website ?? null
    });
  }

  return (await getCompanySettings())!;
};
