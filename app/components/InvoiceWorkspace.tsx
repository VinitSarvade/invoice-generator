'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table';
import clsx from 'clsx';
import { EmailInvoiceModal } from '@/app/components/EmailInvoiceModal';
import { InvoicePreview } from '@/app/components/InvoicePreview';
import { calculateTotalsFromItems } from '@/lib/invoice';
import { formatCurrency } from '@/lib/format';
import { createId } from '@/lib/id';
import type {
  CurrencyOption,
  Customer,
  InvoicePayload,
  InvoiceTotals,
  LineItem,
  SavedLineItem
} from '@/types/invoice';

const today = () => new Date().toISOString().slice(0, 10);
const futureDate = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
};

interface InvoiceFormValues {
  customerId: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  currencySymbol: string;
  notes: string;
  roundOff: number;
}

interface CustomerFormValues {
  name: string;
  email: string;
  address: string;
}

interface LineItemFormValues {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface InvoiceWorkspaceProps {
  customers: Customer[];
  savedItems: SavedLineItem[];
  currencyOptions: CurrencyOption[];
  defaultCurrencyCode: string;
  initialInvoiceNumber?: string;
}

type StatusState = { type: 'success' | 'error'; message: string } | null;

const buildPreviewNumber = (customer: Customer | null) => {
  if (!customer) return '';
  const nextValue = String((customer.lastNumber ?? 0) + 1).padStart(4, '0');
  return `INV-${customer.shortcode}-${nextValue}`;
};

export const InvoiceWorkspace = ({
  customers,
  savedItems,
  currencyOptions,
  defaultCurrencyCode,
  initialInvoiceNumber
}: InvoiceWorkspaceProps) => {
  const [customerList, setCustomerList] = useState(customers);
  const [savedItemList, setSavedItemList] = useState(savedItems);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber ?? '');
  const [persistedInvoice, setPersistedInvoice] = useState<InvoicePayload | null>(null);
  const [status, setStatus] = useState<StatusState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreparingEmail, setIsPreparingEmail] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<InvoicePayload | null>(null);
  const [senderEmail, setSenderEmail] = useState('');
  const [copyEmail, setCopyEmail] = useState('');

  const defaultCurrency = useMemo(() => {
    return (
      currencyOptions.find((option) => option.code === defaultCurrencyCode) ?? currencyOptions[0]
    );
  }, [currencyOptions, defaultCurrencyCode]);

  const invoiceForm = useForm<InvoiceFormValues>({
    defaultValues: {
      customerId: customerList[0]?.id ?? '',
      issueDate: today(),
      dueDate: futureDate(14),
      currencyCode: defaultCurrency.code,
      currencySymbol: defaultCurrency.symbol,
      notes: '',
      roundOff: 0
    }
  });

  const customerDetailsForm = useForm<CustomerFormValues>({
    defaultValues: {
      name: customerList[0]?.name ?? '',
      email: customerList[0]?.email ?? '',
      address: customerList[0]?.address ?? ''
    }
  });

  const quickCreateForm = useForm<CustomerFormValues>({
    defaultValues: {
      name: '',
      email: '',
      address: ''
    }
  });

  const lineItemForm = useForm<LineItemFormValues>({
    defaultValues: {
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 0
    }
  });

  const InvoiceField = invoiceForm.Field;
  const CustomerField = customerDetailsForm.Field;
  const QuickCustomerField = quickCreateForm.Field;
  const LineItemField = lineItemForm.Field;

  const invoiceValues = invoiceForm.useStore((state) => state.values);
  const selectedCustomer = useMemo(() => {
    return customerList.find((customer) => customer.id === invoiceValues.customerId) ?? null;
  }, [customerList, invoiceValues.customerId]);

  const selectedCurrency = useMemo(() => {
    return (
      currencyOptions.find((option) => option.code === invoiceValues.currencyCode) ??
      defaultCurrency
    );
  }, [currencyOptions, defaultCurrency, invoiceValues.currencyCode]);

  const totals = useMemo<InvoiceTotals>(() => {
    return calculateTotalsFromItems(lineItems, invoiceValues.roundOff);
  }, [lineItems, invoiceValues.roundOff]);

  useEffect(() => {
    if (selectedCustomer && !persistedInvoice?.id) {
      setInvoiceNumber(buildPreviewNumber(selectedCustomer));
    }
    if (selectedCustomer) {
      customerDetailsForm.setFieldValue('name', () => selectedCustomer.name);
      customerDetailsForm.setFieldValue('email', () => selectedCustomer.email ?? '');
      customerDetailsForm.setFieldValue('address', () => selectedCustomer.address ?? '');
    } else {
      customerDetailsForm.reset();
    }
  }, [selectedCustomer, persistedInvoice?.id, customerDetailsForm]);

  useEffect(() => {
    if (persistedInvoice && selectedCustomer && persistedInvoice.customer.id !== selectedCustomer.id) {
      setPersistedInvoice(null);
      setCurrentInvoice(null);
    }
  }, [persistedInvoice, selectedCustomer]);

  const lineItemColumns = useMemo<ColumnDef<LineItem>[]>(
    () => [
      {
        header: 'Item',
        accessorKey: 'name',
        cell: ({ row }) => (
          <input
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={row.original.name}
            onChange={(event) => updateLineItem(row.original.id, { name: event.target.value })}
            placeholder="Item name"
          />
        )
      },
      {
        header: 'Description',
        accessorKey: 'description',
        cell: ({ row }) => (
          <input
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={row.original.description ?? ''}
            onChange={(event) =>
              updateLineItem(row.original.id, {
                description: event.target.value ? event.target.value : null
              })
            }
            placeholder="Description"
          />
        )
      },
      {
        header: 'Qty',
        accessorKey: 'quantity',
        cell: ({ row }) => (
          <input
            type="number"
            min={0}
            step={1}
            className="w-20 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={row.original.quantity}
            onChange={(event) =>
              updateLineItem(row.original.id, {
                quantity: Number(event.target.value) || 0
              })
            }
          />
        )
      },
      {
        header: 'Unit price',
        accessorKey: 'unitPrice',
        cell: ({ row }) => (
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={row.original.unitPrice}
            onChange={(event) =>
              updateLineItem(row.original.id, {
                unitPrice: Number(event.target.value) || 0
              })
            }
          />
        )
      },
      {
        header: 'Tax %',
        accessorKey: 'taxRate',
        cell: ({ row }) => (
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={row.original.taxRate}
            onChange={(event) =>
              updateLineItem(row.original.id, {
                taxRate: Number(event.target.value) || 0
              })
            }
          />
        )
      },
      {
        header: 'Amount',
        id: 'amount',
        cell: ({ row }) => {
          const base = row.original.quantity * row.original.unitPrice;
          const total = base + base * (row.original.taxRate / 100);
          return (
            <span className="font-semibold text-slate-700">
              {formatCurrency(total, selectedCurrency)}
            </span>
          );
        }
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm font-semibold text-rose-600 hover:text-rose-700"
            onClick={() => removeLineItem(row.original.id)}
          >
            Remove
          </button>
        )
      }
    ],
    [selectedCurrency]
  );

  const lineItemsTable = useReactTable({
    data: lineItems,
    columns: lineItemColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const resetInvoice = () => {
    setLineItems([]);
    setPersistedInvoice(null);
    setCurrentInvoice(null);
    invoiceForm.reset();
    setStatus(null);
    setInvoiceNumber(buildPreviewNumber(selectedCustomer));
  };

  const updateLineItem = (id: string, patch: Partial<LineItem>) => {
    setLineItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems((previous) => previous.filter((item) => item.id !== id));
  };

  const handleSelectSavedItem = (itemId: string) => {
    if (!itemId) return;
    const saved = savedItemList.find((item) => item.id === itemId);
    if (!saved) return;

    lineItemForm.setFieldValue('name', () => saved.name);
    lineItemForm.setFieldValue('description', () => saved.description ?? '');
    lineItemForm.setFieldValue('unitPrice', () => saved.unitPrice);
    lineItemForm.setFieldValue('taxRate', () => saved.taxRate);
    lineItemForm.setFieldValue('quantity', () => 1);
  };

  const handleAddLineItem = async () => {
    const values = lineItemForm.store.getState().values;

    if (!values.name.trim()) {
      setStatus({ type: 'error', message: 'Line item name is required.' });
      return;
    }
    if (values.quantity <= 0) {
      setStatus({ type: 'error', message: 'Quantity must be greater than zero.' });
      return;
    }

    const newItem: LineItem = {
      id: createId(),
      name: values.name.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      quantity: Number(values.quantity) || 0,
      unitPrice: Number(values.unitPrice) || 0,
      taxRate: Number(values.taxRate) || 0
    };

    setLineItems((previous) => [...previous, newItem]);

    try {
      const response = await fetch('/api/saved-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItem.name,
          description: newItem.description,
          unitPrice: newItem.unitPrice,
          taxRate: newItem.taxRate
        })
      });
      if (response.ok) {
        const data = await response.json();
        setSavedItemList(data.items);
      }
    } catch (error) {
      console.error('Unable to persist saved item', error);
    }

    lineItemForm.reset();
    setStatus(null);
  };

  const handleQuickCreateCustomer = async () => {
    const values = quickCreateForm.store.getState().values;
    if (!values.name.trim()) {
      setStatus({ type: 'error', message: 'Customer name is required.' });
      return;
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to create customer.');
      }

      const payload = await response.json();
      const customer: Customer = { ...payload.customer, lastNumber: 0 };

      setCustomerList((previous) => [...previous, customer]);
      invoiceForm.setFieldValue('customerId', () => customer.id);
      setInvoiceNumber(buildPreviewNumber(customer));
      setStatus({ type: 'success', message: 'Customer created successfully.' });
      quickCreateForm.reset();
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to create customer.'
      });
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) {
      setStatus({ type: 'error', message: 'Select a customer to update.' });
      return;
    }

    const values = customerDetailsForm.store.getState().values;

    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to update customer.');
      }

      const payload = await response.json();
      const updated: Customer = payload.customer;
      setCustomerList((previous) =>
        previous.map((customer) => (customer.id === updated.id ? updated : customer))
      );
      setStatus({ type: 'success', message: 'Customer updated successfully.' });
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to update customer.'
      });
    }
  };

  const persistInvoice = async (): Promise<InvoicePayload> => {
    const formValues = invoiceForm.store.getState().values;

    if (!formValues.customerId) {
      throw new Error('Please select a customer before continuing.');
    }
    if (lineItems.length === 0) {
      throw new Error('Add at least one line item to create the invoice.');
    }
    if (lineItems.some((item) => item.quantity <= 0)) {
      throw new Error('Line item quantity must be greater than zero.');
    }

    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: persistedInvoice?.id,
        customerId: formValues.customerId,
        issueDate: formValues.issueDate,
        dueDate: formValues.dueDate || null,
        currencyCode: formValues.currencyCode,
        currencySymbol: formValues.currencySymbol,
        notes: formValues.notes,
        roundOff: formValues.roundOff,
        lineItems
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'Unable to save invoice.');
    }

    const result = await response.json();
    const invoice: InvoicePayload = result.invoice;

    setPersistedInvoice(invoice);
    setInvoiceNumber(invoice.invoiceNumber);
    setCurrentInvoice(invoice);

    setCustomerList((previous) =>
      previous.map((customer) => {
        if (customer.id !== invoice.customer.id) return customer;
        const assigned = Number(invoice.invoiceNumber.split('-').pop() ?? '0');
        return {
          ...customer,
          lastNumber: assigned
        };
      })
    );

    return invoice;
  };

  const handleDownloadInvoice = async () => {
    try {
      setIsDownloading(true);
      const invoice = await persistInvoice();
      const response = await fetch('/api/invoices/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      });
      if (!response.ok) {
        throw new Error('Unable to generate invoice PDF.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Invoice downloaded successfully.' });
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to download invoice.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const prepareEmailInvoice = async () => {
    try {
      setIsPreparingEmail(true);
      const invoice = await persistInvoice();
      setCurrentInvoice(invoice);
      setEmailModalOpen(true);
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to prepare invoice.'
      });
    } finally {
      setIsPreparingEmail(false);
    }
  };

  const handleEmailSend = async (payload: {
    to: string;
    subject: string;
    message: string;
    copyToSelf: boolean;
  }) => {
    if (!currentInvoice) {
      throw new Error('No invoice available to send.');
    }

    if (payload.copyToSelf && !copyEmail) {
      throw new Error('Add your email address to receive a copy.');
    }

    const response = await fetch('/api/invoices/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.to,
        cc: payload.copyToSelf && copyEmail ? copyEmail : undefined,
        subject: payload.subject,
        message: payload.message,
        senderEmail,
        invoice: currentInvoice
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'Unable to send invoice email.');
    }

    setStatus({ type: 'success', message: 'Invoice email sent successfully.' });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoice Generator</h1>
          <p className="text-slate-500">
            Build professional invoices in any currency, save frequent line items, and send them instantly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={resetInvoice}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            New invoice
          </button>
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={isDownloading}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500',
              isDownloading && 'cursor-not-allowed opacity-70'
            )}
          >
            {isDownloading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={prepareEmailInvoice}
            disabled={isPreparingEmail}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500',
              isPreparingEmail && 'cursor-not-allowed opacity-70'
            )}
          >
            Email invoice
          </button>
        </div>
      </header>

      {status && (
        <div
          className={clsx(
            'rounded-md border px-4 py-3 text-sm',
            status.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-rose-300 bg-rose-50 text-rose-700'
          )}
        >
          {status.message}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Customer</h2>

            <div className="flex flex-col gap-4">
              <InvoiceField name="customerId">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Select customer
                    </label>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    >
                      <option value="">Select customer</option>
                      {customerList.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </InvoiceField>

              {selectedCustomer && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-white px-2 py-1 font-semibold">
                      Shortcode: {selectedCustomer.shortcode}
                    </span>
                    <span>Invoice #: {invoiceNumber || '—'}</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <CustomerField name="name">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase text-slate-500">
                            Name
                          </label>
                          <input
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                        </div>
                      )}
                    </CustomerField>
                    <CustomerField name="email">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase text-slate-500">
                            Email
                          </label>
                          <input
                            type="email"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                        </div>
                      )}
                    </CustomerField>
                    <CustomerField name="address">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase text-slate-500">
                            Address
                          </label>
                          <textarea
                            rows={3}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                        </div>
                      )}
                    </CustomerField>
                    <button
                      type="button"
                      onClick={handleUpdateCustomer}
                      className="inline-flex w-fit items-center gap-2 self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
                    >
                      Save customer
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-dashed border-slate-300 p-4">
                <h3 className="text-sm font-semibold text-slate-700">Quick create customer</h3>
                <div className="mt-3 grid gap-3">
                  <QuickCustomerField name="name">
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Name
                        </label>
                        <input
                          className="rounded-md border border-indigo-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="Acme Corp"
                        />
                      </div>
                    )}
                  </QuickCustomerField>
                  <QuickCustomerField name="email">
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Email
                        </label>
                        <input
                          type="email"
                          className="rounded-md border border-indigo-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="billing@company.com"
                        />
                      </div>
                    )}
                  </QuickCustomerField>
                  <QuickCustomerField name="address">
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Address
                        </label>
                        <textarea
                          rows={2}
                          className="rounded-md border border-indigo-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="Street, City, ZIP"
                        />
                      </div>
                    )}
                  </QuickCustomerField>
                  <button
                    type="button"
                    onClick={handleQuickCreateCustomer}
                    className="inline-flex w-fit items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Save customer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Invoice details</h2>
            <div className="grid gap-4">
              <InvoiceField name="currencyCode">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Currency
                    </label>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(event) => {
                        const nextCode = event.target.value;
                        const match = currencyOptions.find((option) => option.code === nextCode);
                        field.handleChange(nextCode);
                        invoiceForm.setFieldValue('currencySymbol', () => match?.symbol ?? field.state.value);
                      }}
                    >
                      {currencyOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.code} · {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </InvoiceField>

              <div className="grid gap-4 sm:grid-cols-2">
                <InvoiceField name="issueDate">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Issue date
                      </label>
                      <input
                        type="date"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </div>
                  )}
                </InvoiceField>
                <InvoiceField name="dueDate">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Due date
                      </label>
                      <input
                        type="date"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </div>
                  )}
                </InvoiceField>
              </div>

              <InvoiceField name="roundOff">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Round-off / adjustment
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(Number(event.target.value) || 0)}
                    />
                    <span className="text-xs text-slate-400">
                      Use a negative value to apply a discount or rounding adjustment.
                    </span>
                  </div>
                )}
              </InvoiceField>

              <InvoiceField name="notes">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Payment terms, thank-you note, bank details…"
                    />
                  </div>
                )}
              </InvoiceField>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Line items</h2>
                <p className="text-sm text-slate-500">
                  Items added here are saved for future use automatically.
                </p>
              </div>
            </div>

            {savedItemList.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Saved line items
                </label>
                <select
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(event) => handleSelectSavedItem(event.target.value)}
                >
                  <option value="">Select to prefill</option>
                  {savedItemList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4">
              <LineItemField name="name">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Name
                    </label>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Website design"
                    />
                  </div>
                )}
              </LineItemField>
              <LineItemField name="description">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </div>
                )}
              </LineItemField>
              <div className="grid gap-4 sm:grid-cols-3">
                <LineItemField name="quantity">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(Number(event.target.value) || 0)}
                      />
                    </div>
                  )}
                </LineItemField>
                <LineItemField name="unitPrice">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Unit price
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(Number(event.target.value) || 0)}
                      />
                    </div>
                  )}
                </LineItemField>
                <LineItemField name="taxRate">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Tax %
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(Number(event.target.value) || 0)}
                      />
                    </div>
                  )}
                </LineItemField>
              </div>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
              >
                Add line item
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-y-2">
                <thead>
                  {lineItemsTable.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="text-left text-xs font-semibold uppercase text-slate-500"
                    >
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="px-3 py-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {lineItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={lineItemColumns.length}
                        className="px-3 py-4 text-center text-sm text-slate-500"
                      >
                        Added line items will appear here.
                      </td>
                    </tr>
                  )}
                  {lineItemsTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="rounded-lg bg-slate-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2 align-top text-sm text-slate-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <InvoicePreview
          invoiceNumber={invoiceNumber}
          issueDate={invoiceValues.issueDate}
          dueDate={invoiceValues.dueDate}
          currency={selectedCurrency}
          customer={selectedCustomer ?? undefined}
          lineItems={lineItems}
          notes={invoiceValues.notes}
          roundOff={invoiceValues.roundOff}
          totals={totals}
        />
      </div>

      <EmailInvoiceModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        invoice={currentInvoice}
        totals={currentInvoice?.totals ?? totals}
        senderEmail={senderEmail}
        onSenderEmailChange={setSenderEmail}
        copyEmail={copyEmail}
        onCopyEmailChange={setCopyEmail}
        onSend={handleEmailSend}
      />
    </div>
  );
};
