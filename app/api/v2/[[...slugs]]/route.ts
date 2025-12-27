import { Elysia, t } from 'elysia';
import { getAllInvoices, getPaginatedInvoices, createOrUpdateInvoice, getInvoiceById } from '@/db/queries';
import { invoiceSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';
import { auth } from '@/lib/auth';

/**
 * Elysia Plugin: Authentication
 * Checks if request has valid session
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
 * In-memory rate limiter (could be enhanced with Redis)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimitPlugin = (maxRequests: number, windowMs: number) =>
  new Elysia({ name: 'rateLimit' })
    .derive(({ request }) => {
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
 * Main Elysia App with Type-Safe Routes
 */
const app = new Elysia({ prefix: '/api/v2', aot: false })
  // Health check (no auth required)
  .get('/health', () => ({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  }))

  // Invoices API with auth and rate limiting
  .group('/invoices', (app) =>
    app
      .use(authPlugin)
      .use(rateLimitPlugin(100, 60000)) // 100 req/min

      // GET /api/v2/invoices - List all invoices
      .get('/', async ({ query }) => {
        const page = query.page ? parseInt(query.page as string) : undefined;
        const pageSize = query.pageSize ? parseInt(query.pageSize as string) : undefined;

        if (page && pageSize) {
          const result = await getPaginatedInvoices({ page, pageSize });
          return {
            success: true,
            ...result
          };
        }

        const invoices = await getAllInvoices();
        return {
          success: true,
          data: invoices
        };
      }, {
        query: t.Optional(t.Object({
          page: t.Optional(t.String()),
          pageSize: t.Optional(t.String())
        }))
      })

      // GET /api/v2/invoices/:id - Get single invoice
      .get('/:id', async ({ params, error }) => {
        const invoice = await getInvoiceById(params.id);

        if (!invoice) {
          return error(HTTP_STATUS.NOT_FOUND, {
            success: false,
            message: ERROR_MESSAGES.NOT_FOUND
          });
        }

        return {
          success: true,
          data: invoice
        };
      }, {
        params: t.Object({
          id: t.String()
        })
      })

      // POST /api/v2/invoices - Create invoice with full validation
      .post('/', async ({ body, error }) => {
        try {
          // Validate with Zod schema
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

          return {
            success: true,
            data: invoice
          };
        } catch (err) {
          if (err instanceof Error) {
            return error(HTTP_STATUS.BAD_REQUEST, {
              success: false,
              message: err.message
            });
          }

          return error(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            success: false,
            message: ERROR_MESSAGES.INTERNAL_ERROR
          });
        }
      }, {
        body: t.Any(), // Use Zod for validation instead of Elysia's t.Object
        type: 'json'
      })
  )

  // Error handling
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
