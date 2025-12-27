import { z } from 'zod';
import {
  MIN_TAX_RATE,
  MAX_TAX_RATE,
  MIN_QUANTITY,
  MAX_QUANTITY,
  MIN_UNIT_PRICE,
  MAX_UNIT_PRICE,
  MAX_EMAIL_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
  MAX_EMAIL_MESSAGE_LENGTH,
  MAX_INVOICE_NOTES_LENGTH,
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_MAX_QUERY_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from './constants';

/**
 * Reusable validation schemas with proper constraints
 */

// Email validation - strict and sanitized
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(MAX_EMAIL_LENGTH, `Email must be less than ${MAX_EMAIL_LENGTH} characters`)
  .refine((email) => !email.includes('\n') && !email.includes('\r'), {
    message: 'Email cannot contain line breaks',
  });

// Optional email - allows null but not empty string
export const optionalEmailSchema = z
  .string()
  .trim()
  .transform((val) => val === '' ? null : val)
  .pipe(z.string().email('Invalid email address').max(MAX_EMAIL_LENGTH))
  .nullable()
  .optional();

// Password validation
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Password must be less than ${MAX_PASSWORD_LENGTH} characters`)
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one number',
  });

// Quantity validation - must be positive
export const quantitySchema = z
  .number()
  .or(z.string().transform((val) => parseFloat(val)))
  .pipe(
    z
      .number()
      .positive('Quantity must be greater than 0')
      .min(MIN_QUANTITY, `Quantity must be at least ${MIN_QUANTITY}`)
      .max(MAX_QUANTITY, `Quantity cannot exceed ${MAX_QUANTITY}`)
      .finite('Quantity must be a valid number')
  );

// Unit price validation - non-negative
export const unitPriceSchema = z
  .number()
  .or(z.string().transform((val) => parseFloat(val)))
  .pipe(
    z
      .number()
      .nonnegative('Unit price cannot be negative')
      .min(MIN_UNIT_PRICE, `Unit price must be at least ${MIN_UNIT_PRICE}`)
      .max(MAX_UNIT_PRICE, `Unit price cannot exceed ${MAX_UNIT_PRICE}`)
      .finite('Unit price must be a valid number')
  );

// Tax rate validation - 0-100%
export const taxRateSchema = z
  .number()
  .or(z.string().transform((val) => parseFloat(val)))
  .pipe(
    z
      .number()
      .min(MIN_TAX_RATE, `Tax rate must be at least ${MIN_TAX_RATE}%`)
      .max(MAX_TAX_RATE, `Tax rate cannot exceed ${MAX_TAX_RATE}%`)
      .finite('Tax rate must be a valid number')
  );

// Line item schema - improved version
export const lineItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Item name is required').max(200, 'Item name too long'),
  description: z.string().trim().max(1000, 'Description too long').nullable().optional(),
  quantity: quantitySchema,
  unitPrice: unitPriceSchema,
  taxRate: taxRateSchema,
});

// Invoice schema - improved validation
export const invoiceSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  customerId: z.string().uuid('Invalid customer ID'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .nullable()
    .optional(),
  currencyCode: z.string().length(3, 'Currency code must be 3 characters').toUpperCase(),
  currencySymbol: z.string().min(1, 'Currency symbol is required').max(5, 'Currency symbol too long'),
  notes: z.string().max(MAX_INVOICE_NOTES_LENGTH, `Notes cannot exceed ${MAX_INVOICE_NOTES_LENGTH} characters`).optional(),
  roundOff: z
    .number()
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().finite('Round off must be a valid number')),
  lineItems: z
    .array(lineItemSchema)
    .min(1, 'At least one line item is required')
    .max(500, 'Cannot exceed 500 line items'),
});

// Customer schema - improved validation
export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(200, 'Customer name too long'),
  email: optionalEmailSchema,
  address: z.string().trim().max(500, 'Address too long').nullable().optional(),
});

// Email payload schema - with sanitization
export const emailPayloadSchema = z.object({
  to: emailSchema,
  cc: emailSchema.optional(),
  subject: z.string().trim().min(1, 'Subject is required').max(MAX_EMAIL_SUBJECT_LENGTH, 'Subject too long'),
  message: z.string().trim().min(1, 'Message is required').max(MAX_EMAIL_MESSAGE_LENGTH, 'Message too long'),
  senderEmail: emailSchema,
  invoice: z.object({
    invoiceNumber: z.string().regex(/^[A-Z0-9-]+$/, 'Invalid invoice number format'),
  }).passthrough(), // Allow other invoice fields
});

// Search parameters schema
export const searchParamsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(SEARCH_MIN_QUERY_LENGTH, `Search query must be at least ${SEARCH_MIN_QUERY_LENGTH} characters`)
    .max(SEARCH_MAX_QUERY_LENGTH, `Search query too long`)
    .optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  customerId: z.string().uuid('Invalid customer ID').optional(),
  minAmount: z.coerce.number().nonnegative('Minimum amount cannot be negative').optional(),
  maxAmount: z.coerce.number().nonnegative('Maximum amount cannot be negative').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
});

// Company settings schema
export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(200, 'Company name too long'),
  companyEmail: optionalEmailSchema,
  companyPhone: z.string().trim().max(50, 'Phone number too long').nullable().optional(),
  companyAddress: z.string().trim().max(500, 'Address too long').nullable().optional(),
  companyLogo: z
    .string()
    .trim()
    .max(1000000, 'Logo URL/data too long')
    .refine(
      (val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
      'Logo must be a valid URL or data URI'
    )
    .nullable()
    .optional(),
  taxId: z.string().trim().max(50, 'Tax ID too long').nullable().optional(),
  website: z
    .string()
    .trim()
    .url('Invalid website URL')
    .max(200, 'Website URL too long')
    .nullable()
    .optional()
    .or(z.literal('')),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
});

/**
 * Sanitize filename for safe use in HTTP headers
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 100);
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate environment variables at startup
 */
export function validateEnvironment() {
  const required = {
    NODE_ENV: process.env.NODE_ENV,
  };

  const production = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };

  // Check required vars
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Check production vars in production
  if (process.env.NODE_ENV === 'production') {
    for (const [key, value] of Object.entries(production)) {
      if (!value) {
        console.warn(`⚠️  Warning: Missing production environment variable: ${key}`);
      }
    }
  }

  return true;
}
