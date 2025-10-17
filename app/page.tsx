import { InvoiceWorkspace } from '@/app/components/InvoiceWorkspace';
import { currencyOptions, defaultCurrency } from '@/lib/currency';
import { getCustomers, getSavedLineItems, previewInvoiceNumber } from '@/db/queries';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [customers, savedItems] = await Promise.all([getCustomers(), getSavedLineItems()]);

  const initialCustomer = customers[0] ?? null;
  const initialInvoiceNumber = initialCustomer
    ? await previewInvoiceNumber(initialCustomer.shortcode)
    : undefined;

  return (
    <InvoiceWorkspace
      customers={customers}
      savedItems={savedItems}
      currencyOptions={currencyOptions}
      defaultCurrencyCode={defaultCurrency.code}
      initialInvoiceNumber={initialInvoiceNumber}
    />
  );
}
