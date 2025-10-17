import { InvoicePayload, InvoiceTotals, LineItem } from '@/types/invoice';

export const calculateTotalsFromItems = (
  lineItems: LineItem[],
  roundOff: number
): InvoiceTotals => {
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
};

export const calculateTotals = (invoice: InvoicePayload): InvoiceTotals =>
  calculateTotalsFromItems(invoice.lineItems, invoice.roundOff);

export const getCustomerShortcode = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length >= 4) {
    return cleaned.slice(0, 4);
  }
  if (cleaned.length === 3) {
    return cleaned;
  }
  if (cleaned.length === 2) {
    return `${cleaned}X`;
  }
  if (cleaned.length === 1) {
    return `${cleaned}XX`;
  }
  return 'CUST';
};
