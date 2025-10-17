'use client';

import { formatCurrency } from '@/lib/format';
import { CurrencyOption, Customer, InvoiceTotals, LineItem } from '@/types/invoice';

interface InvoicePreviewProps {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  currency: CurrencyOption;
  customer: Customer | null;
  lineItems: LineItem[];
  notes: string;
  roundOff: number;
  totals: InvoiceTotals;
}

const formatDate = (value: string) => {
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
    <section
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        minHeight: '100%'
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <p className="badge">Preview</p>
          <h1 style={{ fontSize: '2rem', marginTop: '0.4rem' }}>Invoice</h1>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.95rem', color: 'var(--color-muted)' }}>
          <div>
            <strong style={{ color: 'var(--color-text)' }}>Invoice No:</strong> {invoiceNumber || '—'}
          </div>
          <div>
            <strong style={{ color: 'var(--color-text)' }}>Issue Date:</strong> {formatDate(issueDate)}
          </div>
          <div>
            <strong style={{ color: 'var(--color-text)' }}>Due Date:</strong> {formatDate(dueDate ?? '')}
          </div>
        </div>
      </header>

      <div
        style={{
          padding: '1.1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'grid',
          gap: '0.4rem'
        }}
      >
        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-muted)' }}>
          Bill to
        </span>
        <h2 style={{ fontSize: '1.1rem' }}>{customer?.name || 'Add customer name'}</h2>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-muted)', whiteSpace: 'pre-line' }}>
          {customer?.email && <div>{customer.email}</div>}
          {customer?.address ? <div>{customer.address}</div> : <div>No address provided</div>}
        </div>
      </div>

      <div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Item</th>
              <th style={{ width: '30%' }}>Description</th>
              <th style={{ width: '8%' }}>Qty</th>
              <th style={{ width: '14%' }}>Unit price</th>
              <th style={{ width: '10%' }}>Tax %</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
                  Start adding line items to build your invoice.
                </td>
              </tr>
            )}
            {lineItems.map((item) => {
              const base = item.quantity * item.unitPrice;
              const total = base + base * (item.taxRate / 100);
              return (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                    {item.description || '—'}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitPrice, currency)}</td>
                  <td>{item.taxRate}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(total, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ flex: '1 1 260px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>Notes</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', whiteSpace: 'pre-line' }}>
            {notes || 'Add optional notes or payment instructions here.'}
          </p>
        </div>

        <div
          style={{
            flex: '1 1 220px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            padding: '1rem 1.25rem',
            background: 'rgba(37, 99, 235, 0.03)',
            display: 'grid',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tax total</span>
            <span>{formatCurrency(totals.taxTotal, currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Round-off</span>
            <span>{formatCurrency(roundOff, currency)}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(37, 99, 235, 0.2)',
            paddingTop: '0.6rem',
            fontWeight: 600,
            fontSize: '1.05rem'
          }}>
            <span>Total due</span>
            <span>{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
