/**
 * Typed error hierarchy. Every failure the CLI surfaces to the user should be a
 * {@link HermesError} so the top-level handler can render it cleanly (and, in
 * verbose mode, show its {@link HermesError.details}).
 */

/** Base class for all recoverable, user-facing errors. */
export class HermesError extends Error {
  /** Optional extra context shown only in verbose mode. */
  readonly details?: string;
  /** Suggested next step for the user. */
  readonly hint?: string;

  constructor(message: string, options: { details?: string; hint?: string; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    if (options.details !== undefined) this.details = options.details;
    if (options.hint !== undefined) this.hint = options.hint;
  }
}

/** The Better-T-Stack engine could not be discovered or executed. */
export class EngineError extends HermesError {}

/** An AI provider was misconfigured or returned an unusable response. */
export class ProviderError extends HermesError {}

/** The AI produced output that failed validation and could not be repaired. */
export class ValidationError extends HermesError {}

/** The user supplied invalid input (bad file, missing argument, etc.). */
export class InputError extends HermesError {}

/**
 * Narrows an unknown thrown value to an `Error`-like message string, never
 * throwing itself. Useful in `catch` blocks where the caught value is `unknown`.
 */
export function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
