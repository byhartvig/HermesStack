/**
 * Shared HTTP helper for provider implementations.
 *
 * Wraps `fetch` with consistent JSON handling, timeouts, and error translation
 * into {@link ProviderError}, so individual providers stay small.
 */
import { ProviderError, toMessage } from "../utils/errors.ts";

const DEFAULT_TIMEOUT_MS = 60_000;

/** POSTs a JSON body and returns the parsed JSON response. */
export async function postJson(
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
  providerName: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ProviderError(`Network request to the ${providerName} API failed.`, {
      details: toMessage(error),
      hint: "Check connectivity, the base URL, and any proxy settings.",
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new ProviderError(`${providerName} API returned HTTP ${response.status}.`, {
      details: truncate(text, 800),
      hint: response.status === 401 || response.status === 403
        ? "Verify the API key for this provider."
        : undefined,
    });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ProviderError(`${providerName} API returned non-JSON output.`, {
      details: `${toMessage(error)}\n${truncate(text, 400)}`,
    });
  }
}

/** Reads a required environment variable or throws a helpful error. */
export function requireEnv(name: string, providerName: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ProviderError(`Missing ${name} for the ${providerName} provider.`, {
      hint: `Export ${name} in your shell, or pick another provider with --provider.`,
    });
  }
  return value;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
