'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import type { InvoiceListItem } from '@/types/invoice';

/**
 * Example Component: Type-Safe Invoice List using Elysia API
 *
 * This demonstrates:
 * - End-to-end type safety with Eden/Elysia
 * - Automatic type inference
 * - Error handling
 * - Loading states
 */
export default function InvoiceListExample() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Fetch invoices with type safety
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);

    try {
      // Type-safe API call - fully autocompleted!
      const { data, error: apiError } = await api.invoices.get({
        query: {
          page: String(page),
          pageSize: '10'
        }
      });

      if (apiError) {
        setError(apiError.value?.message || 'Failed to fetch invoices');
        return;
      }

      if (data && 'data' in data && Array.isArray(data.data)) {
        // TypeScript knows the exact shape of the response!
        setInvoices(data.data);
      } else if (data && 'data' in data) {
        // Paginated response
        setInvoices(data.data as any);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page]);

  // Example: Get single invoice with full type safety
  const viewInvoice = async (id: string) => {
    const { data, error } = await api.invoices({ id }).get();

    if (error) {
      alert(`Error: ${error.value?.message}`);
      return;
    }

    if (data && data.success) {
      // data.data is fully typed as InvoicePayload!
      console.log('Invoice:', data.data);
      alert(`Viewing invoice: ${data.data.invoiceNumber}`);
    }
  };

  // Example: Create invoice with validation
  const createInvoice = async () => {
    const { data, error } = await api.invoices.post({
      customerId: 'customer-123',
      issueDate: new Date().toISOString().split('T')[0],
      currencyCode: 'USD',
      currencySymbol: '$',
      roundOff: 0,
      lineItems: [
        {
          name: 'Test Item',
          description: 'Example item',
          quantity: 1,
          unitPrice: 100,
          taxRate: 10
        }
      ]
    });

    if (error) {
      alert(`Error: ${error.value?.message}`);
      return;
    }

    if (data && data.success) {
      alert('Invoice created successfully!');
      fetchInvoices(); // Refresh list
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Type-Safe Invoices (Elysia API)
        </h1>
        <button
          onClick={createInvoice}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Test Invoice
        </button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading invoices...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No invoices found. Click "Create Test Invoice" to add one.
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.issueDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.currencySymbol}{invoice.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => viewInvoice(invoice.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
            >
              Previous
            </button>
            <span className="text-gray-600">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={invoices.length < 10}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Type Safety Demo */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">
          ✨ Type Safety Benefits:
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Full autocomplete for API calls</li>
          <li>• Compile-time error checking</li>
          <li>• No manual type definitions needed</li>
          <li>• Response shape is always correct</li>
          <li>• Refactoring is safe and easy</li>
        </ul>
      </div>
    </div>
  );
}
