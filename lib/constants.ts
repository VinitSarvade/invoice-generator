/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers
 */

// Customer configuration
export const CUSTOMER_SHORTCODE_LENGTH = 4;
export const CUSTOMER_SHORTCODE_MAX_LENGTH = 10;

// Invoice configuration
export const INVOICE_NUMBER_PREFIX = 'INV';
export const INVOICE_NUMBER_PADDING = 4;
export const MAX_INVOICE_ITEMS = 500;
export const MAX_INVOICE_NOTES_LENGTH = 5000;

// Authentication
export const SESSION_EXPIRY_DAYS = 7;
export const SESSION_UPDATE_INTERVAL_DAYS = 1;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// API Limits
export const API_REQUEST_SIZE_LIMIT = 1000000; // 1MB
export const API_DEFAULT_PAGE_SIZE = 50;
export const API_MAX_PAGE_SIZE = 500;
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Email configuration
export const MAX_EMAIL_LENGTH = 254; // RFC 5321
export const MAX_EMAIL_SUBJECT_LENGTH = 500;
export const MAX_EMAIL_MESSAGE_LENGTH = 10000;

// Currency configuration
export const DEFAULT_CURRENCY_CODE = 'USD';
export const MAX_CURRENCY_DECIMAL_PLACES = 2;

// File upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// Search configuration
export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_QUERY_LENGTH = 100;

// Analytics
export const ANALYTICS_MONTHS_HISTORY = 12;
export const ANALYTICS_TOP_CUSTOMERS_LIMIT = 10;

// Validation ranges
export const MIN_TAX_RATE = 0;
export const MAX_TAX_RATE = 100;
export const MIN_QUANTITY = 0.001;
export const MAX_QUANTITY = 999999;
export const MIN_UNIT_PRICE = 0;
export const MAX_UNIT_PRICE = 999999999;

// UI Configuration
export const TOAST_DURATION_MS = 5000;
export const DEBOUNCE_DELAY_MS = 300;

// Database
export const DB_QUERY_TIMEOUT_MS = 30000;
export const DB_MAX_RETRIES = 3;

// Feature flags (can be overridden by env vars)
export const FEATURE_FLAGS = {
  ENABLE_EMAIL: process.env.ENABLE_EMAIL !== 'false',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
  ENABLE_SEARCH: process.env.ENABLE_SEARCH !== 'false',
  REQUIRE_AUTH: process.env.REQUIRE_AUTH === 'true', // Default false for backward compatibility
  ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING === 'true',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized. Please log in to access this resource.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_FAILED: 'Validation failed. Please check your input.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  PAYLOAD_TOO_LARGE: 'Request payload is too large.',
  DATABASE_ERROR: 'Database operation failed. Please try again.',
  EMAIL_FAILED: 'Failed to send email. Please check your configuration.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  DUPLICATE_RESOURCE: 'A resource with this identifier already exists.',
} as const;
