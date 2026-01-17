// Retry Utility with Exponential Backoff
// Handles transient network errors and rate limiting

import { PlaylistError } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Whether to add jitter to delays (default: true) */
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  let delay = Math.min(exponentialDelay, options.maxDelayMs);

  if (options.jitter) {
    // Add random jitter of +/- 25%
    const jitterFactor = 0.75 + Math.random() * 0.5;
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    ) {
      return true;
    }
  }

  // API errors with specific codes
  const apiError = error as { code?: number; errors?: Array<{ reason?: string }> };

  // 429 Too Many Requests - rate limited
  if (apiError.code === 429) {
    return true;
  }

  // 500, 502, 503, 504 - Server errors
  if (apiError.code && apiError.code >= 500 && apiError.code < 600) {
    return true;
  }

  // Quota exceeded - retryable with longer delay
  if (apiError.errors?.[0]?.reason === 'quotaExceeded') {
    return true;
  }

  // User rate limit exceeded
  if (apiError.errors?.[0]?.reason === 'userRateLimitExceeded') {
    return true;
  }

  // Backend error
  if (apiError.errors?.[0]?.reason === 'backendError') {
    return true;
  }

  return false;
}

/**
 * Get a human-readable description of the retry attempt
 */
function getRetryMessage(attempt: number, maxRetries: number, delayMs: number): string {
  return `Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms delay`;
}

// ============================================================================
// Main Retry Function
// ============================================================================

/**
 * Execute a function with automatic retry on transient failures
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function or throws after all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => youtube.playlists.list({ part: ['snippet'], mine: true }),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Calculate and apply delay
      const delay = calculateDelay(attempt, opts);
      console.warn(getRetryMessage(attempt + 1, opts.maxRetries, delay));
      await sleep(delay);
    }
  }

  // All retries exhausted
  if (lastError instanceof PlaylistError) {
    throw lastError;
  }

  const apiError = lastError as { message?: string };
  throw new PlaylistError(
    `Operation failed after ${opts.maxRetries} retries: ${apiError.message || 'Unknown error'}`,
    'API_ERROR',
    lastError
  );
}

/**
 * Execute a function with retry and return detailed result
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Result object with success status, data/error, and attempt count
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let attempts = 0;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const data = await fn();
      return { success: true, data, attempts };
    } catch (error) {
      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          attempts,
        };
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= opts.maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          attempts,
        };
      }

      // Calculate and apply delay
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: new Error('Unexpected retry loop exit'),
    attempts,
  };
}

/**
 * Create a retry wrapper with preset options
 *
 * @param defaultOptions - Default options for all retry calls
 * @returns A configured retry function
 */
export function createRetryWrapper(
  defaultOptions: Partial<RetryOptions>
): <T>(fn: () => Promise<T>, options?: Partial<RetryOptions>) => Promise<T> {
  return <T>(fn: () => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...options });
  };
}
