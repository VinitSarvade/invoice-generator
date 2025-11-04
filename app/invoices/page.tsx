import InvoiceHistory from '../components/InvoiceHistory';
import AdvancedInvoiceSearch from '../components/AdvancedInvoiceSearch';
import { getCustomers } from '@/db/queries';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const customers = await getCustomers();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Create Invoice
          </a>
        </div>

        <div className="mb-8">
          <AdvancedInvoiceSearch customers={customers} />
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">All Invoices</h2>
          <InvoiceHistory />
        </div>
      </div>
    </div>
  );
}
