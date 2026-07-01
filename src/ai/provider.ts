/**
 * Pluggable AI provider abstraction.
 *
 * Every provider (Claude, OpenAI, Gemini, DeepSeek, local OpenAI-compatible
 * servers) implements this single interface. The architect and commands depend
 * only on {@link AiProvider}, never on a concrete SDK, so adding a provider is a
 * matter of implementing one method.
 */

/** A single completion request. */
export interface AiCompletionRequest {
  /** System / instruction prompt establishing role and constraints. */
  readonly system: string;
  /** User prompt carrying the task-specific payload. */
  readonly user: string;
  /** Sampling temperature; lower is more deterministic. */
  readonly temperature?: number;
  /** Hint that the response must be a single JSON object. */
  readonly json?: boolean;
  /** Upper bound on generated tokens. */
  readonly maxTokens?: number;
}

/** Contract shared by all AI providers. */
export interface AiProvider {
  /** Stable provider identifier (e.g. `claude`). */
  readonly name: string;
  /** The concrete model this instance targets. */
  readonly model: string;
  /** Performs a completion and returns the raw text response. */
  complete(request: AiCompletionRequest): Promise<string>;
}

/** Runtime configuration passed to provider constructors. */
export interface ProviderConfig {
  /** API key; resolved from provider-specific env vars when omitted. */
  readonly apiKey?: string;
  /** Model override. */
  readonly model?: string;
  /** Base URL override (used by local / self-hosted providers). */
  readonly baseUrl?: string;
}

/** Identifiers for the built-in providers. */
export type ProviderName = "claude" | "openai" | "gemini" | "deepseek" | "local";
