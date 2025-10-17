'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmailInvoiceModal } from '@/app/components/EmailInvoiceModal';
import { InvoicePreview } from '@/app/components/InvoicePreview';
import { currencyOptions, defaultCurrency } from '@/lib/currency';
import { formatCurrency } from '@/lib/format';
import { getCustomerShortcode } from '@/lib/invoice';
import type {
  CurrencyOption,
  Customer,
  InvoicePayload,
  InvoiceTotals,
  LineItem
} from '@/types/invoice';

const STORAGE_KEYS = {
  customers: 'invoice-customers',
  savedItems: 'invoice-saved-line-items',
  sequences: 'invoice-number-sequences',
  senderEmail: 'invoice-sender-email',
  copyEmail: 'invoice-copy-email'
} as const;

const today = () => new Date().toISOString().slice(0, 10);

const futureDate = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // continue to fallback
    }
  }
  return Math.random().toString(36).slice(2, 10);
};

export default function HomePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDraft, setCustomerDraft] = useState({ name: '', email: '', address: '' });

  const [savedLineItems, setSavedLineItems] = useState<LineItem[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemDraft, setLineItemDraft] = useState({
    name: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxRate: 0
  });

  const [currency, setCurrency] = useState<CurrencyOption>(defaultCurrency);
  const [notes, setNotes] = useState('');
  const [roundOff, setRoundOff] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(futureDate(14));

  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEmailModalOpen, setEmailModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [senderEmail, setSenderEmail] = useState('');
  const [copyEmail, setCopyEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedCustomers = window.localStorage.getItem(STORAGE_KEYS.customers);
    if (storedCustomers) {
      try {
        const parsed = JSON.parse(storedCustomers) as Customer[];
        setCustomers(parsed);
        if (parsed.length > 0) {
          setSelectedCustomerId(parsed[0].id);
        }
      } catch (error) {
        console.warn('Unable to parse stored customers');
      }
    }

    const storedItems = window.localStorage.getItem(STORAGE_KEYS.savedItems);
    if (storedItems) {
      try {
        const parsed = JSON.parse(storedItems) as LineItem[];
        setSavedLineItems(parsed);
      } catch (error) {
        console.warn('Unable to parse stored line items');
      }
    }

    const storedSenderEmail = window.localStorage.getItem(STORAGE_KEYS.senderEmail);
    if (storedSenderEmail) {
      setSenderEmail(storedSenderEmail);
    }

    const storedCopyEmail = window.localStorage.getItem(STORAGE_KEYS.copyEmail);
    if (storedCopyEmail) {
      setCopyEmail(storedCopyEmail);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.savedItems, JSON.stringify(savedLineItems));
  }, [savedLineItems]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.senderEmail, senderEmail);
  }, [senderEmail]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.copyEmail, copyEmail);
  }, [copyEmail]);

  const currentCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!currentCustomer) {
      setInvoiceNumber('');
      return;
    }

    const code = currentCustomer.shortcode;
    const sequencesRaw = window.localStorage.getItem(STORAGE_KEYS.sequences);
    let sequences: Record<string, number> = {};

    if (sequencesRaw) {
      try {
        sequences = JSON.parse(sequencesRaw) as Record<string, number>;
      } catch (error) {
        sequences = {};
      }
    }

    if (!invoiceNumber || !invoiceNumber.startsWith(`INV-${code}-`)) {
      const nextValue = (sequences[code] ?? 0) + 1;
      sequences[code] = nextValue;
      window.localStorage.setItem(STORAGE_KEYS.sequences, JSON.stringify(sequences));
      setInvoiceNumber(`INV-${code}-${String(nextValue).padStart(4, '0')}`);
    }
  }, [currentCustomer, invoiceNumber]);

  const totals = useMemo<InvoiceTotals>(() => {
    const subtotal = lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const taxTotal = lineItems.reduce((acc, item) => {
      const base = item.quantity * item.unitPrice;
      return acc + base * (item.taxRate / 100);
    }, 0);
    const total = subtotal + taxTotal + roundOff;
    return {
      subtotal,
      taxTotal,
      roundOff,
      total
    };
  }, [lineItems, roundOff]);

  const canEmailInvoice = Boolean(currentCustomer && invoiceNumber && lineItems.length > 0);

  const persistSavedLineItem = (item: LineItem) => {
    setSavedLineItems((previous) => {
      const existingIndex = previous.findIndex(
        (preserved) => preserved.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );

      if (existingIndex >= 0) {
        const clone = [...previous];
        clone[existingIndex] = {
          ...clone[existingIndex],
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          quantity: 1
        };
        return clone;
      }

      return [
        ...previous,
        {
          id: createId(),
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          quantity: 1
        }
      ];
    });
  };

  const handleCreateCustomer = () => {
    if (!customerDraft.name.trim()) {
      setStatus({ type: 'error', text: 'Customer name is required to create a new customer.' });
      return;
    }

    const newCustomer: Customer = {
      id: createId(),
      name: customerDraft.name.trim(),
      email: customerDraft.email.trim() || undefined,
      address: customerDraft.address.trim() || undefined,
      shortcode: getCustomerShortcode(customerDraft.name)
    };

    setCustomers((previous) => [...previous, newCustomer]);
    setSelectedCustomerId(newCustomer.id);
    setCustomerDraft({ name: '', email: '', address: '' });
    setStatus({ type: 'success', text: 'Customer created successfully.' });
  };

  const updateSelectedCustomer = (field: keyof Customer, value: string) => {
    if (!currentCustomer) {
      return;
    }
    setCustomers((previous) =>
      previous.map((customer) => {
        if (customer.id !== currentCustomer.id) {
          return customer;
        }
        if (field === 'name') {
          return {
            ...customer,
            name: value,
            shortcode: getCustomerShortcode(value)
          };
        }
        return {
          ...customer,
          [field]: value || undefined
        } as Customer;
      })
    );
  };

  const handleAddLineItem = () => {
    if (!lineItemDraft.name.trim()) {
      setStatus({ type: 'error', text: 'Line item name is required.' });
      return;
    }

    const newItem: LineItem = {
      id: createId(),
      name: lineItemDraft.name.trim(),
      description: lineItemDraft.description.trim() || undefined,
      quantity: Number(lineItemDraft.quantity) || 1,
      unitPrice: Number(lineItemDraft.unitPrice) || 0,
      taxRate: Number(lineItemDraft.taxRate) || 0
    };

    setLineItems((previous) => [...previous, newItem]);
    persistSavedLineItem(newItem);
    setLineItemDraft({ name: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0 });
    setStatus(null);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
          return {
            ...item,
            [field]: Number(value) || 0
          };
        }
        return {
          ...item,
          [field]: value
        };
      })
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems((previous) => previous.filter((item) => item.id !== id));
  };

  const handleSelectSavedItem = (savedId: string) => {
    if (!savedId) {
      return;
    }
    const found = savedLineItems.find((item) => item.id === savedId);
    if (!found) {
      return;
    }
    setLineItemDraft({
      name: found.name,
      description: found.description ?? '',
      quantity: 1,
      unitPrice: found.unitPrice,
      taxRate: found.taxRate
    });
  };

  const resetInvoice = () => {
    setLineItems([]);
    setNotes('');
    setRoundOff(0);
    setIssueDate(today());
    setDueDate(futureDate(14));
    setStatus(null);
    setInvoiceNumber('');
  };

  const buildInvoicePayload = (): InvoicePayload | null => {
    if (!currentCustomer) {
      setStatus({ type: 'error', text: 'Please select or create a customer before continuing.' });
      return null;
    }
    if (!invoiceNumber) {
      setStatus({ type: 'error', text: 'Invoice number is missing.' });
      return null;
    }
    if (lineItems.length === 0) {
      setStatus({ type: 'error', text: 'Add at least one line item to generate the invoice.' });
      return null;
    }

    return {
      invoiceNumber,
      issueDate,
      dueDate: dueDate || undefined,
      currency,
      customer: currentCustomer,
      lineItems,
      notes,
      roundOff
    };
  };

  const handleDownloadInvoice = async () => {
    const payload = buildInvoicePayload();
    if (!payload) {
      return;
    }
    setIsDownloading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/invoices/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to download');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${payload.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus({ type: 'success', text: 'Invoice downloaded successfully.' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', text: 'Unable to download invoice. Please try again.' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendInvoice = async ({
    to,
    subject,
    message,
    copyToSelf
  }: {
    to: string;
    subject: string;
    message: string;
    copyToSelf: boolean;
  }) => {
    const payload = buildInvoicePayload();
    if (!payload) {
      throw new Error('Missing invoice data');
    }

    if (copyToSelf && !copyEmail) {
      throw new Error('Copy email address is required');
    }

    if (!senderEmail) {
      throw new Error('Sender email is required');
    }

    const body = {
      to,
      cc: copyToSelf && copyEmail ? copyEmail : undefined,
      subject,
      message,
      senderEmail,
      invoice: payload
    };

    const response = await fetch('/api/invoices/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Email failed');
    }

    setStatus({ type: 'success', text: 'Invoice email has been sent.' });
  };

  const regenerateInvoiceNumber = () => {
    if (typeof window === 'undefined' || !currentCustomer) {
      return;
    }
    const code = currentCustomer.shortcode;
    const sequencesRaw = window.localStorage.getItem(STORAGE_KEYS.sequences);
    let sequences: Record<string, number> = {};

    if (sequencesRaw) {
      try {
        sequences = JSON.parse(sequencesRaw) as Record<string, number>;
      } catch (error) {
        sequences = {};
      }
    }

    const nextValue = (sequences[code] ?? 0) + 1;
    sequences[code] = nextValue;
    window.localStorage.setItem(STORAGE_KEYS.sequences, JSON.stringify(sequences));
    setInvoiceNumber(`INV-${code}-${String(nextValue).padStart(4, '0')}`);
  };

  return (
    <main style={{ padding: '2.5rem 1rem 3rem' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'grid', gap: '2rem' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '2.4rem', fontWeight: 700 }}>Invoice Generator</h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '1.1rem' }}>
                Craft professional invoices in any currency, save frequently used items, and send them instantly.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="secondary" onClick={resetInvoice}>
                New invoice
              </button>
              <button className="primary" onClick={handleDownloadInvoice} disabled={isDownloading}>
                {isDownloading ? 'Preparing…' : 'Download PDF'}
              </button>
              <button
                className="primary"
                onClick={() => setEmailModalOpen(true)}
                disabled={!canEmailInvoice}
              >
                Email invoice
              </button>
            </div>
          </div>
        </header>

        {status && (
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem 1.25rem',
              background:
                status.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: status.type === 'success' ? '#166534' : '#b91c1c'
            }}
          >
            {status.text}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gap: '2rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            alignItems: 'flex-start'
          }}
        >
          <section
            style={{
              display: 'grid',
              gap: '1.5rem',
              background: 'var(--color-surface)',
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label htmlFor="customer-select">Customer</label>
                <select
                  id="customer-select"
                  value={selectedCustomerId ?? ''}
                  onChange={(event) => setSelectedCustomerId(event.target.value || null)}
                  style={{ marginTop: '0.35rem' }}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {currentCustomer && (
                <div
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(15, 23, 42, 0.02)'
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label htmlFor="customer-name">Name</label>
                    <input
                      id="customer-name"
                      value={currentCustomer.name}
                      onChange={(event) => updateSelectedCustomer('name', event.target.value)}
                      placeholder="Customer name"
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label htmlFor="customer-email">Email</label>
                    <input
                      id="customer-email"
                      type="email"
                      value={currentCustomer.email ?? ''}
                      onChange={(event) => updateSelectedCustomer('email', event.target.value)}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label htmlFor="customer-address">Address</label>
                    <textarea
                      id="customer-address"
                      value={currentCustomer.address ?? ''}
                      onChange={(event) => updateSelectedCustomer('address', event.target.value)}
                      rows={3}
                      placeholder="Customer address"
                    />
                  </div>
                  <span className="tag-pill">Shortcode: {currentCustomer.shortcode}</span>
                </div>
              )}

              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '1rem',
                  display: 'grid',
                  gap: '0.75rem'
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Quick create customer</h3>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="new-customer-name">Name *</label>
                  <input
                    id="new-customer-name"
                    value={customerDraft.name}
                    onChange={(event) =>
                      setCustomerDraft((draft) => ({ ...draft, name: event.target.value }))
                    }
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="new-customer-email">Email</label>
                  <input
                    id="new-customer-email"
                    type="email"
                    value={customerDraft.email}
                    onChange={(event) =>
                      setCustomerDraft((draft) => ({ ...draft, email: event.target.value }))
                    }
                    placeholder="billing@company.com"
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="new-customer-address">Address</label>
                  <textarea
                    id="new-customer-address"
                    rows={2}
                    value={customerDraft.address}
                    onChange={(event) =>
                      setCustomerDraft((draft) => ({ ...draft, address: event.target.value }))
                    }
                    placeholder="Street, City, ZIP"
                  />
                </div>
                <button className="secondary" onClick={handleCreateCustomer}>
                  Save customer
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label htmlFor="currency-select">Currency</label>
              <select
                id="currency-select"
                value={currency.code}
                onChange={(event) => {
                  const selected = currencyOptions.find((option) => option.code === event.target.value);
                  if (selected) {
                    setCurrency(selected);
                  }
                }}
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} · {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '0.9rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '1rem'
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Add line item</h3>
              {savedLineItems.length > 0 && (
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="saved-line-items">Saved line items</label>
                  <select
                    id="saved-line-items"
                    onChange={(event) => handleSelectSavedItem(event.target.value)}
                    defaultValue=""
                  >
                    <option value="">Select to prefill</option>
                    {savedLineItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="line-item-name">Name *</label>
                  <input
                    id="line-item-name"
                    value={lineItemDraft.name}
                    onChange={(event) =>
                      setLineItemDraft((draft) => ({ ...draft, name: event.target.value }))
                    }
                    placeholder="e.g. Design consultation"
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="line-item-description">Description</label>
                  <textarea
                    id="line-item-description"
                    rows={2}
                    value={lineItemDraft.description}
                    onChange={(event) =>
                      setLineItemDraft((draft) => ({ ...draft, description: event.target.value }))
                    }
                    placeholder="Optional details"
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: '0.6rem',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label htmlFor="line-item-quantity">Quantity</label>
                    <input
                      id="line-item-quantity"
                      type="number"
                      min={0}
                      step={1}
                      value={lineItemDraft.quantity}
                      onChange={(event) =>
                        setLineItemDraft((draft) => ({ ...draft, quantity: Number(event.target.value) }))
                      }
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label htmlFor="line-item-price">Unit price</label>
                    <input
                      id="line-item-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={lineItemDraft.unitPrice}
                      onChange={(event) =>
                        setLineItemDraft((draft) => ({ ...draft, unitPrice: Number(event.target.value) }))
                      }
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label htmlFor="line-item-tax">Tax %</label>
                    <input
                      id="line-item-tax"
                      type="number"
                      min={0}
                      step="0.01"
                      value={lineItemDraft.taxRate}
                      onChange={(event) =>
                        setLineItemDraft((draft) => ({ ...draft, taxRate: Number(event.target.value) }))
                      }
                    />
                  </div>
                </div>
                <button className="secondary" onClick={handleAddLineItem}>
                  Add to invoice
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Invoice lines</h3>
              {lineItems.length === 0 && (
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)',
                    color: 'var(--color-muted)',
                    fontSize: '0.9rem'
                  }}
                >
                  Added line items will appear here.
                </div>
              )}

              <div style={{ display: 'grid', gap: '1rem' }}>
                {lineItems.map((item) => {
                  const base = item.quantity * item.unitPrice;
                  const total = base + base * (item.taxRate / 100);
                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        display: 'grid',
                        gap: '0.75rem',
                        background: 'rgba(15, 23, 42, 0.015)'
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gap: '0.75rem',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
                        }}
                      >
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <label>Name</label>
                          <input
                            value={item.name}
                            onChange={(event) => updateLineItem(item.id, 'name', event.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <label>Description</label>
                          <input
                            value={item.description ?? ''}
                            onChange={(event) => updateLineItem(item.id, 'description', event.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <label>Quantity</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={item.quantity}
                            onChange={(event) => updateLineItem(item.id, 'quantity', event.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <label>Unit price</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) => updateLineItem(item.id, 'unitPrice', event.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <label>Tax %</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.taxRate}
                            onChange={(event) => updateLineItem(item.id, 'taxRate', event.target.value)}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem'
                        }}
                      >
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                          Amount: <strong>{formatCurrency(total, currency)}</strong>
                        </span>
                        <button
                          className="secondary"
                          onClick={() => removeLineItem(item.id)}
                          style={{ color: '#b91c1c', borderColor: 'rgba(185, 28, 28, 0.3)' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: '1rem'
              }}
            >
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label htmlFor="invoice-number">Invoice number</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input id="invoice-number" value={invoiceNumber} readOnly />
                  <button className="secondary" onClick={regenerateInvoiceNumber}>
                    Regenerate
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gap: '0.6rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
                }}
              >
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="issue-date">Issue date</label>
                  <input
                    id="issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(event) => setIssueDate(event.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label htmlFor="due-date">Due date</label>
                  <input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label htmlFor="round-off">Round-off / adjustment</label>
                <input
                  id="round-off"
                  type="number"
                  step="0.01"
                  value={roundOff}
                  onChange={(event) => setRoundOff(Number(event.target.value))}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                  Use a negative value to apply a discount or rounding adjustment.
                </span>
              </div>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label htmlFor="invoice-notes">Notes</label>
                <textarea
                  id="invoice-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Payment terms, thank-you note, bank details…"
                />
              </div>
            </div>
          </section>

          <InvoicePreview
            invoiceNumber={invoiceNumber}
            issueDate={issueDate}
            dueDate={dueDate}
            currency={currency}
            customer={currentCustomer}
            lineItems={lineItems}
            notes={notes}
            roundOff={roundOff}
            totals={totals}
          />
        </div>
      </div>

      <EmailInvoiceModal
        open={isEmailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        invoice={(() => {
          if (!currentCustomer || !invoiceNumber || lineItems.length === 0) {
            return null;
          }
          return {
            invoiceNumber,
            issueDate,
            dueDate: dueDate || undefined,
            currency,
            customer: currentCustomer,
            lineItems,
            notes,
            roundOff
          } satisfies InvoicePayload;
        })()}
        totals={totals}
        senderEmail={senderEmail}
        onSenderEmailChange={setSenderEmail}
        copyEmail={copyEmail}
        onCopyEmailChange={setCopyEmail}
        onSend={async (payload) => {
          await handleSendInvoice(payload);
        }}
      />
    </main>
  );
}
