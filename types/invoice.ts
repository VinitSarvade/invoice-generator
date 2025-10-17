export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  shortcode: string;
  createdAt?: number;
  lastNumber?: number | null;
}

export interface SavedLineItem {
  id: string;
  name: string;
  description?: string | null;
  unitPrice: number;
  taxRate: number;
}

export interface LineItem {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface InvoiceDraft {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  currency: CurrencyOption;
  customer: Customer | null;
  lineItems: LineItem[];
  notes: string;
  roundOff: number;
}

export interface InvoicePayload {
  id?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  currency: CurrencyOption;
  customer: Customer;
  lineItems: LineItem[];
  notes: string;
  roundOff: number;
  totals?: InvoiceTotals;
}

export interface InvoiceTotals {
  subtotal: number;
  taxTotal: number;
  roundOff: number;
  total: number;
}

export interface EmailPayload {
  to: string;
  cc?: string;
  subject: string;
  message: string;
  senderEmail: string;
  invoice: InvoicePayload;
}
