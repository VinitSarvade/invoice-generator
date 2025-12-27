/**
 * Structured logging utility
 * Provides consistent logging with different levels and structured data
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
class LoggerConfig {
  private static instance: LoggerConfig;
  private minLevel: LogLevel = LogLevel.INFO;
  private isProd: boolean = process.env.NODE_ENV === 'production';

  private constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    if (envLevel && Object.values(LogLevel).includes(envLevel)) {
      this.minLevel = envLevel;
    }
  }

  static getInstance(): LoggerConfig {
    if (!LoggerConfig.instance) {
      LoggerConfig.instance = new LoggerConfig();
    }
    return LoggerConfig.instance;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  getLevel(): LogLevel {
    return this.minLevel;
  }

  isProduction(): boolean {
    return this.isProd;
  }

  shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const config = LoggerConfig.getInstance();

  if (config.isProduction()) {
    // JSON format for production (easier to parse by log aggregators)
    return JSON.stringify(entry);
  } else {
    // Human-readable format for development
    let output = `[${entry.timestamp}] ${entry.level}: ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return output;
  }
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  const config = LoggerConfig.getInstance();

  if (!config.shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: config.isProduction() ? undefined : error.stack
    };
  }

  const formatted = formatLogEntry(entry);

  // Output to appropriate console method
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      console.error(formatted);
      break;
  }
}

/**
 * Logger class with convenience methods
 */
export class Logger {
  private context?: LogContext;

  constructor(defaultContext?: LogContext) {
    this.context = defaultContext;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    log(LogLevel.DEBUG, message, { ...this.context, ...context });
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    log(LogLevel.INFO, message, { ...this.context, ...context });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    log(LogLevel.WARN, message, { ...this.context, ...context });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    log(LogLevel.ERROR, message, { ...this.context, ...context }, err);
  }

  /**
   * Log fatal error (application-level failures)
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    log(LogLevel.FATAL, message, { ...this.context, ...context }, err);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with specific context
 * Useful for creating loggers for specific modules or features
 *
 * @example
 * ```typescript
 * const invoiceLogger = createLogger({ module: 'invoices' });
 * invoiceLogger.info('Invoice created', { invoiceId: '123' });
 * ```
 */
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

/**
 * Set global log level
 */
export function setLogLevel(level: LogLevel): void {
  LoggerConfig.getInstance().setLevel(level);
}

/**
 * API route logger helper
 * Logs API request/response information
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: LogContext
): void {
  const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

  log(level, `API ${method} ${path} - ${statusCode}`, {
    method,
    path,
    statusCode,
    durationMs,
    ...context
  });
}

/**
 * Database query logger helper
 */
export function logDbQuery(
  operation: string,
  table: string,
  durationMs: number,
  context?: LogContext
): void {
  log(LogLevel.DEBUG, `DB ${operation} on ${table}`, {
    operation,
    table,
    durationMs,
    ...context
  });
}
