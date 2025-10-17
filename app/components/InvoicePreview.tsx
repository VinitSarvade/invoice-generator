'use client';

import { formatCurrency } from '@/lib/format';
import type { CurrencyOption, Customer, InvoiceTotals, LineItem } from '@/types/invoice';

interface InvoicePreviewProps {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  currency: CurrencyOption;
  customer?: Customer;
  lineItems: LineItem[];
  notes: string;
  roundOff: number;
  totals: InvoiceTotals;
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    return value;
  }
};

export const InvoicePreview = ({
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  customer,
  lineItems,
  notes,
  roundOff,
  totals
}: InvoicePreviewProps) => {
  return (
    <section className="flex min-h-full flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
            Preview
          </span>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Invoice</h1>
        </div>
        <div className="text-sm text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Invoice No:</span> {invoiceNumber || '—'}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Issue Date:</span> {formatDate(issueDate)}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Due Date:</span> {formatDate(dueDate)}
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</span>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          {customer?.name || 'Add customer name'}
        </h2>
        <div className="mt-2 text-sm text-slate-600">
          {customer?.email && <div>{customer.email}</div>}
          {customer?.address ? <div className="whitespace-pre-line">{customer.address}</div> : <div>No address provided</div>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Qty</th>
              <th className="px-4 py-3 text-left">Unit price</th>
              <th className="px-4 py-3 text-left">Tax %</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Start adding line items to build your invoice.
                </td>
              </tr>
            ) : (
              lineItems.map((item) => {
                const base = item.quantity * item.unitPrice;
                const total = base + base * (item.taxRate / 100);
                return (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(item.unitPrice, currency)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.taxRate}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(total, currency)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {notes || 'Add optional notes or payment instructions here.'}
          </p>
        </div>

        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(totals.subtotal, currency)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Tax total</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(totals.taxTotal, currency)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Round-off</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(roundOff, currency)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-indigo-200 pt-3 text-base font-semibold text-indigo-700">
              <span>Total due</span>
              <span>{formatCurrency(totals.total, currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
