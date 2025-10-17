export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  address?: string;
  shortcode: string;
}

export interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface InvoiceDraft {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  currency: CurrencyOption;
  customer: Customer | null;
  lineItems: LineItem[];
  notes: string;
  roundOff: number;
}

export interface InvoicePayload {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  currency: CurrencyOption;
  customer: Customer;
  lineItems: LineItem[];
  notes: string;
  roundOff: number;
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
