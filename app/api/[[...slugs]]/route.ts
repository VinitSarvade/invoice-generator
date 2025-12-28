import { Elysia, t } from 'elysia';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import {
  getAllInvoices,
  getPaginatedInvoices,
  createOrUpdateInvoice,
  getInvoiceById,
  deleteInvoice,
  updateInvoiceStatus,
  searchInvoices,
  getCustomers,
  createCustomerRecord,
  updateCustomerRecord,
  deleteCustomer,
  getAnalytics,
  getCompanySettings,
  upsertCompanySettings,
  getSavedLineItems,
  upsertSavedItem,
  deleteSavedItem
} from '@/db/queries';
import {
  invoiceSchema,
  emailPayloadSchema,
  customerSchema,
  companySettingsSchema,
  searchParamsSchema,
  sanitizeFilename
} from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES, FEATURE_FLAGS } from '@/lib/constants';
import { auth } from '@/lib/auth';
import { buildInvoicePdf } from '@/lib/pdf';

/**
 * Elysia Plugin: Authentication
 */
const authPlugin = new Elysia({ name: 'auth' })
  .derive(async ({ request }) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers as any
      });

      if (!session?.user) {
        throw new Error('Unauthorized');
      }

      return {
        user: session.user,
        session
      };
    } catch (error) {
      throw new Error('Unauthorized');
    }
  })
  .onError(({ code, error, set }) => {
    if (error.message === 'Unauthorized') {
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return {
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED
      };
    }
  });

/**
 * Elysia Plugin: Rate Limiting
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimitPlugin = (maxRequests: number, windowMs: number) =>
  new Elysia({ name: 'rateLimit' })
    .derive(({ request }) => {
      if (!FEATURE_FLAGS.ENABLE_RATE_LIMITING) {
        return { rateLimited: false };
      }

      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                 request.headers.get('x-real-ip') ||
                 'unknown';

      const now = Date.now();
      const key = `${ip}`;

      const tracker = rateLimitStore.get(key);

      if (!tracker || tracker.resetTime < now) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return { rateLimited: false };
      }

      if (tracker.count >= maxRequests) {
        return { rateLimited: true, retryAfter: Math.ceil((tracker.resetTime - now) / 1000) };
      }

      tracker.count++;
      return { rateLimited: false };
    })
    .onBeforeHandle(({ rateLimited, retryAfter, set }) => {
      if (rateLimited) {
        set.status = HTTP_STATUS.TOO_MANY_REQUESTS;
        set.headers['Retry-After'] = String(retryAfter);
        return {
          success: false,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          retryAfter
        };
      }
    });

/**
 * SMTP Transporter Helper
 */
const getTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port: port ?? (secure ? 465 : 587),
    secure,
    auth: user && pass ? { user, pass } : undefined
  });
};

/**
 * Main Elysia App - Complete Type-Safe API
 */
const app = new Elysia({ prefix: '/api', aot: false })
  // ===================
  // Health Check
  // ===================
  .get('/health', async () => {
    const startTime = Date.now();

    try {
      // Check database
      await getCustomers();
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        checks: {
          database: 'healthy',
          environment: 'configured'
        }
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  // ===================
  // Invoices API
  // ===================
  .group('/invoices', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000))

      // GET /api/invoices - List all invoices
      .get('/', async ({ query }) => {
        const page = query.page ? parseInt(query.page as string) : undefined;
        const pageSize = query.pageSize ? parseInt(query.pageSize as string) : undefined;

        if (page && pageSize) {
          const result = await getPaginatedInvoices({ page, pageSize });
          return { success: true, ...result };
        }

        const invoices = await getAllInvoices();
        return { success: true, data: invoices };
      }, {
        query: t.Optional(t.Object({
          page: t.Optional(t.String()),
          pageSize: t.Optional(t.String())
        }))
      })

      // GET /api/invoices/search - Search invoices
      .get('/search', async ({ query, error }) => {
        try {
          const validated = searchParamsSchema.parse(query);
          const invoices = await searchInvoices(validated);
          return { success: true, data: invoices };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        query: t.Any()
      })

      // POST /api/invoices/email - Send invoice via email
      .post('/email', async ({ body, error }) => {
        if (!FEATURE_FLAGS.ENABLE_EMAIL) {
          return error(HTTP_STATUS.SERVICE_UNAVAILABLE, {
            success: false,
            message: 'Email functionality is currently disabled.'
          });
        }

        try {
          const payload = emailPayloadSchema.parse(body);
          const pdfBuffer = await buildInvoicePdf(payload.invoice);
          const transporter = await getTransporter();

          const fromAddress = process.env.SMTP_FROM || payload.senderEmail;
          if (process.env.NODE_ENV === 'production' && !process.env.SMTP_FROM) {
            return error(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
              success: false,
              message: 'Email configuration error. Please contact support.'
            });
          }

          const safeFilename = sanitizeFilename(payload.invoice.invoiceNumber) + '.pdf';

          const message = {
            from: fromAddress,
            to: payload.to,
            cc: payload.cc,
            subject: payload.subject,
            text: payload.message,
            attachments: [
              {
                filename: safeFilename,
                content: pdfBuffer,
                contentType: 'application/pdf'
              }
            ]
          };

          const info = await transporter.sendMail(message);

          return {
            success: true,
            message: 'Invoice email sent successfully',
            transportInfo: info
          };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        body: t.Any(),
        type: 'json'
      })

      // POST /api/invoices/pdf - Generate PDF
      .post('/pdf', async ({ body, error }) => {
        try {
          const payload = body as any;

          if (!payload?.invoiceNumber || !payload?.customer?.name) {
            return error(HTTP_STATUS.BAD_REQUEST, {
              success: false,
              message: 'Invoice number and customer details are required.'
            });
          }

          const pdfBuffer = await buildInvoicePdf(payload);
          const safeFilename = sanitizeFilename(payload.invoiceNumber) + '.pdf';

          return new Response(pdfBuffer, {
            status: HTTP_STATUS.OK,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${safeFilename}"`,
              'Content-Length': pdfBuffer.length.toString(),
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
        } catch (err) {
          return error(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            success: false,
            message: 'Unable to generate invoice PDF.'
          });
        }
      }, {
        body: t.Any(),
        type: 'json'
      })

      // GET /api/invoices/:id - Get single invoice
      .get('/:id', async ({ params, error }) => {
        const invoice = await getInvoiceById(params.id);

        if (!invoice) {
          return error(HTTP_STATUS.NOT_FOUND, {
            success: false,
            message: ERROR_MESSAGES.NOT_FOUND
          });
        }

        return { success: true, data: invoice };
      }, {
        params: t.Object({ id: t.String() })
      })

      // DELETE /api/invoices/:id - Delete invoice
      .delete('/:id', async ({ params, error }) => {
        try {
          await deleteInvoice(params.id);
          return { success: true, message: 'Invoice deleted successfully.' };
        } catch (err) {
          return error(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            success: false,
            message: ERROR_MESSAGES.DATABASE_ERROR
          });
        }
      }, {
        params: t.Object({ id: t.String() })
      })

      // PATCH /api/invoices/:id - Update invoice status
      .patch('/:id', async ({ params, body, error }) => {
        try {
          const statusData = body as { status: string; paidAt?: number | null };

          if (!statusData.status) {
            return error(HTTP_STATUS.BAD_REQUEST, {
              success: false,
              message: 'Status is required'
            });
          }

          await updateInvoiceStatus(params.id, statusData.status as any, statusData.paidAt);
          return { success: true, message: 'Invoice status updated successfully.' };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR
          });
        }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Any(),
        type: 'json'
      })

      // POST /api/invoices - Create invoice
      .post('/', async ({ body, error }) => {
        try {
          const validated = invoiceSchema.parse(body);

          const invoice = await createOrUpdateInvoice({
            invoiceId: validated.invoiceId,
            customerId: validated.customerId,
            issueDate: validated.issueDate,
            dueDate: validated.dueDate ?? null,
            currencyCode: validated.currencyCode,
            currencySymbol: validated.currencySymbol,
            notes: validated.notes ?? '',
            roundOff: validated.roundOff,
            lineItems: validated.lineItems
          });

          return { success: true, data: invoice };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        body: t.Any(),
        type: 'json'
      })
  )

  // ===================
  // Customers API
  // ===================
  .group('/customers', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000))

      // GET /api/customers - List all customers
      .get('/', async () => {
        const customers = await getCustomers();
        return { success: true, data: customers };
      })

      // POST /api/customers - Create customer
      .post('/', async ({ body, error }) => {
        try {
          const validated = customerSchema.parse(body);
          const customer = await createCustomerRecord({
            name: validated.name,
            email: validated.email || null,
            address: validated.address || null
          });

          return { success: true, data: customer };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        body: t.Any(),
        type: 'json'
      })

      // PATCH /api/customers/:customerId - Update customer
      .patch('/:customerId', async ({ params, body, error }) => {
        try {
          const validated = customerSchema.parse(body);
          const customer = await updateCustomerRecord(params.customerId, {
            name: validated.name,
            email: validated.email || null,
            address: validated.address || null
          });

          return { success: true, data: customer };
        } catch (err) {
          if (err instanceof Error && err.message === 'Customer not found') {
            return error(HTTP_STATUS.NOT_FOUND, {
              success: false,
              message: ERROR_MESSAGES.NOT_FOUND
            });
          }

          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        params: t.Object({ customerId: t.String() }),
        body: t.Any(),
        type: 'json'
      })

      // DELETE /api/customers/:customerId - Delete customer
      .delete('/:customerId', async ({ params, error }) => {
        try {
          await deleteCustomer(params.customerId);
          return { success: true, message: 'Customer deleted successfully.' };
        } catch (err) {
          return error(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            success: false,
            message: ERROR_MESSAGES.DATABASE_ERROR
          });
        }
      }, {
        params: t.Object({ customerId: t.String() })
      })
  )

  // ===================
  // Analytics API
  // ===================
  .group('/analytics', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000))

      // GET /api/analytics - Get analytics data
      .get('/', async () => {
        const analytics = await getAnalytics();
        return { success: true, data: analytics };
      })
  )

  // ===================
  // Settings API
  // ===================
  .group('/settings', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000))

      // GET /api/settings - Get company settings
      .get('/', async () => {
        const settings = await getCompanySettings();
        return { success: true, data: settings };
      })

      // POST /api/settings - Update company settings
      .post('/', async ({ body, error }) => {
        try {
          const validated = companySettingsSchema.parse(body);
          const settings = await upsertCompanySettings({
            companyName: validated.companyName,
            companyEmail: validated.companyEmail || null,
            companyPhone: validated.companyPhone || null,
            companyAddress: validated.companyAddress || null,
            companyLogo: validated.companyLogo || null,
            taxId: validated.taxId || null,
            website: validated.website || null
          });

          return { success: true, data: settings };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        body: t.Any(),
        type: 'json'
      })
  )

  // ===================
  // Saved Items API
  // ===================
  .group('/saved-items', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000))

      // GET /api/saved-items - List all saved items
      .get('/', async () => {
        const items = await getSavedLineItems();
        return { success: true, data: items };
      })

      // POST /api/saved-items - Create/update saved item
      .post('/', async ({ body, error }) => {
        try {
          const data = body as any;

          if (!data.name || !data.unitPrice || data.taxRate === undefined) {
            return error(HTTP_STATUS.BAD_REQUEST, {
              success: false,
              message: 'Name, unit price, and tax rate are required'
            });
          }

          await upsertSavedItem({
            name: data.name,
            description: data.description || null,
            unitPrice: data.unitPrice,
            taxRate: data.taxRate
          });

          const items = await getSavedLineItems();
          return { success: true, data: items };
        } catch (err) {
          return error(HTTP_STATUS.BAD_REQUEST, {
            success: false,
            message: err instanceof Error ? err.message : ERROR_MESSAGES.VALIDATION_FAILED
          });
        }
      }, {
        body: t.Any(),
        type: 'json'
      })

      // DELETE /api/saved-items/:id - Delete saved item
      .delete('/:id', async ({ params, error }) => {
        try {
          await deleteSavedItem(params.id);
          return { success: true, message: 'Saved item deleted successfully.' };
        } catch (err) {
          return error(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            success: false,
            message: ERROR_MESSAGES.DATABASE_ERROR
          });
        }
      }, {
        params: t.Object({ id: t.String() })
      })
  )

  // Global error handling
  .onError(({ code, error, set }) => {
    console.error('Elysia error:', code, error);

    if (code === 'VALIDATION') {
      set.status = HTTP_STATUS.BAD_REQUEST;
      return {
        success: false,
        message: ERROR_MESSAGES.VALIDATION_FAILED,
        error: error.message
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = HTTP_STATUS.NOT_FOUND;
      return {
        success: false,
        message: ERROR_MESSAGES.NOT_FOUND
      };
    }

    set.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return {
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR
    };
  });

// Export type for client
export type App = typeof app;

// Next.js Route Handlers
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
