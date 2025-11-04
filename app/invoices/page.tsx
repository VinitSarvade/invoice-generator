import InvoiceHistory from '../components/InvoiceHistory';

export default function InvoicesPage() {
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
        <InvoiceHistory />
      </div>
    </div>
  );
}
