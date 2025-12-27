import { InvoicePayload, InvoiceTotals, LineItem } from '@/types/invoice';

export const calculateTotalsFromItems = (
  lineItems: LineItem[],
  roundOff: number
): InvoiceTotals => {
  // Validate inputs
  if (!Array.isArray(lineItems)) {
    throw new Error('lineItems must be an array');
  }

  const safeRoundOff = Number(roundOff) || 0;

  const subtotal = lineItems.reduce((acc, item) => {
    // Ensure all values are valid numbers
    const quantity = Number(item?.quantity) || 0;
    const unitPrice = Number(item?.unitPrice) || 0;
    return acc + quantity * unitPrice;
  }, 0);

  const taxTotal = lineItems.reduce((acc, item) => {
    // Ensure all values are valid numbers
    const quantity = Number(item?.quantity) || 0;
    const unitPrice = Number(item?.unitPrice) || 0;
    const taxRate = Number(item?.taxRate) || 0;
    const base = quantity * unitPrice;
    return acc + base * (taxRate / 100);
  }, 0);

  const total = subtotal + taxTotal + safeRoundOff;

  return {
    subtotal,
    taxTotal,
    roundOff: safeRoundOff,
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
