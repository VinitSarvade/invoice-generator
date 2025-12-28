# Elysia API Guide

This guide explains how to use the type-safe Elysia API.

## 🎯 Overview

**All API endpoints are now type-safe** using Elysia.js! This gives you:

- ✅ **Full Type Safety** - Client knows exact API types
- ✅ **Autocomplete** - IDE suggestions for all API calls
- ✅ **Compile-time Errors** - Catch mistakes before runtime
- ✅ **No Manual Types** - Types automatically inferred from server
- ✅ **Same Security** - Authentication & rate limiting included

## 📍 API Endpoints

All endpoints are at `/api/*` and fully type-safe:

```
/api/health
/api/invoices
/api/customers
/api/analytics
/api/settings
/api/saved-items
/api/auth/[...all] (Better Auth)
```

## 🚀 Quick Start

### 1. Import the API Client

```typescript
import { api } from '@/lib/api-client';
```

### 2. Make Type-Safe Calls

```typescript
// List all invoices - FULLY TYPED!
const { data, error } = await api.invoices.get();
//     ^? { success: true; data: InvoiceListItem[] }

if (error) {
  console.error(error.value.message);
  return;
}

console.log(data.data); // InvoiceListItem[]
```

### 3. Get Single Resource

```typescript
// Get invoice by ID
const { data, error } = await api.invoices({ id: 'invoice-123' }).get();
//     ^? { success: true; data: InvoicePayload }

if (data && data.success) {
  console.log(data.data.invoiceNumber); // Fully typed!
}
```

### 4. Create Resource

```typescript
// Create invoice with validation
const { data, error } = await api.invoices.post({
  customerId: 'cust-123',
  issueDate: '2025-01-15',
  currencyCode: 'USD',
  currencySymbol: '$',
  roundOff: 0,
  lineItems: [
    {
      name: 'Consulting',
      quantity: 5,
      unitPrice: 100,
      taxRate: 10
    }
  ]
  // TypeScript will error if you miss required fields!
});
```

### 5. Pagination

```typescript
// Paginated results
const { data, error } = await api.invoices.get({
  query: {
    page: '1',
    pageSize: '10'
  }
});

if (data && data.success) {
  console.log(data.data); // InvoiceListItem[]
  console.log(data.pagination); // { page, pageSize, total, totalPages }
}
```

## 🎯 Usage Examples

### Fetch Data with Full Type Safety

```typescript
// app/components/MyComponent.tsx
'use client';

import { api } from '@/lib/api-client';

const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);

useEffect(() => {
  api.invoices.get().then(({ data, error }) => {
    if (error) {
      console.error(error.value.message);
      return;
    }
    setInvoices(data.data);
    // ✅ Fully typed
    // ✅ Structured error handling
    // ✅ Autocomplete everywhere
  });
}, []);
```

## 🛠️ Available Routes

### Health Check
```typescript
// No auth required
const { data } = await api.health.get();
// { success: true, status: 'healthy', timestamp: '...' }
```

### Invoices

```typescript
// List all invoices
await api.invoices.get();

// List with pagination
await api.invoices.get({ query: { page: '1', pageSize: '10' } });

// Search invoices
await api.invoices.search.get({ query: { status: 'paid', minAmount: '100' } });

// Get single invoice
await api.invoices({ id: 'invoice-id' }).get();

// Create invoice
await api.invoices.post({ ...invoiceData });

// Delete invoice
await api.invoices({ id: 'invoice-id' }).delete();

// Update invoice status
await api.invoices({ id: 'invoice-id' }).patch({ status: 'paid', paidAt: Date.now() });

// Send invoice via email
await api.invoices.email.post({ invoice, to: 'customer@example.com', ... });

// Generate PDF
await api.invoices.pdf.post({ invoice });
```

### Customers

```typescript
// List all customers
await api.customers.get();

// Create customer
await api.customers.post({ name: 'John Doe', email: 'john@example.com' });

// Update customer
await api.customers({ customerId: 'cust-id' }).patch({ name: 'Jane Doe' });

// Delete customer
await api.customers({ customerId: 'cust-id' }).delete();
```

### Analytics

```typescript
// Get analytics data
await api.analytics.get();
```

### Settings

```typescript
// Get company settings
await api.settings.get();

// Update company settings
await api.settings.post({ companyName: 'My Company', ... });
```

### Saved Items

```typescript
// List all saved items
await api['saved-items'].get();

// Create saved item
await api['saved-items'].post({ name: 'Consulting', unitPrice: 100, taxRate: 10 });

// Delete saved item
await api['saved-items']({ id: 'item-id' }).delete();
```

## 🔒 Authentication

The Elysia API uses the **same authentication** as the REST API:

```typescript
// Requests automatically include credentials
const { data, error } = await api.v2.invoices.get();

if (error && error.status === 401) {
  // User not authenticated
  router.push('/login');
}
```

Authentication is handled by the `authPlugin` in the Elysia app.

## ⚡ Rate Limiting

Rate limiting is **automatically applied**:

```typescript
const { data, error } = await api.v2.invoices.get();

if (error && error.status === 429) {
  // Rate limit exceeded
  console.log('Retry after:', error.value.retryAfter, 'seconds');
}
```

## 📊 Response Format

All Elysia API responses follow this format:

### Success Response
```typescript
{
  success: true,
  data: T // Your data here (fully typed!)
}
```

### Paginated Response
```typescript
{
  success: true,
  data: T[], // Array of items
  pagination: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number
  }
}
```

### Error Response
```typescript
{
  success: false,
  message: string,
  error?: string // Validation details
}
```

## 🎨 React Component Example

See `app/components/InvoiceListExample.tsx` for a complete working example:

```bash
# View the example component
cat app/components/InvoiceListExample.tsx
```

The example shows:
- Fetching data with loading states
- Error handling
- Creating resources
- Pagination
- Full TypeScript types

## 🔧 Adding New Routes

To add more type-safe routes, edit `app/api/v2/[[...slugs]]/route.ts`:

```typescript
const app = new Elysia({ prefix: '/api/v2' })
  // ... existing routes

  // Add new route group
  .group('/customers', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000))

      .get('/', async () => {
        const customers = await getCustomers();
        return { success: true, data: customers };
      })

      .post('/', async ({ body }) => {
        const customer = await createCustomer(body);
        return { success: true, data: customer };
      })
  );
```

The client will automatically know about new routes!

## ⚙️ Configuration

### Base URL

The API client automatically detects the base URL:
- **Client-side**: Uses `window.location.origin`
- **Server-side**: Uses `NEXT_PUBLIC_APP_URL` env var

### Request Options

Customize the client:

```typescript
import { treaty } from '@elysiajs/eden';
import type { App } from '@/app/api/v2/[[...slugs]]/route';

const customApi = treaty<App>('https://api.example.com', {
  fetch: {
    credentials: 'include',
    headers: {
      'X-Custom-Header': 'value'
    }
  }
});
```

## 🚦 Gradual Migration Strategy

You don't need to migrate everything at once:

1. **Phase 1**: Use Elysia API for new features
2. **Phase 2**: Migrate critical/frequently used endpoints
3. **Phase 3**: Eventually migrate all endpoints

**Both APIs work together perfectly!**

## 📝 Best Practices

### ✅ DO:
- Use the Elysia API for new features
- Let TypeScript catch errors at compile-time
- Handle errors explicitly with the `{ data, error }` pattern
- Use the response format consistently

### ❌ DON'T:
- Manually type API responses (they're already typed!)
- Ignore the `error` object
- Use `any` types
- Mix error handling patterns

## 🐛 Troubleshooting

### "Type 'App' does not satisfy..."

Make sure you've imported the App type correctly:

```typescript
import type { App } from '@/app/api/v2/[[...slugs]]/route';
```

### Authentication Errors

Ensure you're logged in:

```typescript
const { data: session } = useSession();

if (!session) {
  router.push('/login');
  return;
}
```

### Rate Limit Errors

Respect the rate limits:
- Most endpoints: 100 req/min
- PDF/Email: 10 req/min

Check the `Retry-After` header in error responses.

## 📚 Further Reading

- [Elysia.js Documentation](https://elysiajs.com)
- [Eden Treaty Docs](https://elysiajs.com/eden/overview.html)
- [Next.js Integration](https://elysiajs.com/integrations/nextjs)

## 🎯 Next Steps

1. Try the example component at `/example-invoices`
2. Explore type safety in your IDE
3. Gradually migrate components
4. Add new routes to the Elysia app
5. Enjoy end-to-end type safety!

---

**Questions?** Check the example component or ask for help in your team chat!
