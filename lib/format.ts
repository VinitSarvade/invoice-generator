import { CurrencyOption, LineItem } from '@/types/invoice';

export const formatCurrency = (value: number, currency: CurrencyOption) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch (error) {
    return `${currency.symbol}${value.toFixed(2)}`;
  }
};

export const calculateLineItemTotal = (item: LineItem) => {
  const base = item.quantity * item.unitPrice;
  const tax = base * (item.taxRate / 100);
  return {
    base,
    tax,
    total: base + tax
  };
};
