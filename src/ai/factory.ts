/**
 * Provider factory / registry.
 *
 * Maps a {@link ProviderName} plus optional overrides to a concrete
 * {@link AiProvider}. This is the single place that knows the set of built-in
 * providers and their defaults; commands ask for a provider by name.
 */
import { ProviderError } from "../utils/errors.ts";
import type { AiProvider, ProviderConfig, ProviderName } from "./provider.ts";
import { ClaudeProvider } from "./providers/claude.ts";
import { GeminiProvider } from "./providers/gemini.ts";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible.ts";

/** All provider identifiers the CLI understands. */
export const PROVIDER_NAMES: readonly ProviderName[] = [
  "claude",
  "openai",
  "gemini",
  "deepseek",
  "local",
];

/** Narrows an arbitrary string to a known {@link ProviderName}. */
export function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value);
}

/** Reads an optional environment variable. */
function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Builds a configured {@link AiProvider}. */
export function createProvider(name: ProviderName, config: ProviderConfig = {}): AiProvider {
  switch (name) {
    case "claude":
      return new ClaudeProvider(config);

    case "gemini":
      return new GeminiProvider(config);

    case "openai":
      return new OpenAiCompatibleProvider({
        name: "openai",
        model: config.model?.trim() || "gpt-4o",
        baseUrl: config.baseUrl?.trim() || "https://api.openai.com/v1",
        apiKey: config.apiKey?.trim() || requireKey("OPENAI_API_KEY", "openai"),
        supportsJsonMode: true,
      });

    case "deepseek":
      return new OpenAiCompatibleProvider({
        name: "deepseek",
        model: config.model?.trim() || "deepseek-chat",
        baseUrl: config.baseUrl?.trim() || "https://api.deepseek.com/v1",
        apiKey: config.apiKey?.trim() || requireKey("DEEPSEEK_API_KEY", "deepseek"),
        supportsJsonMode: true,
      });

    case "local":
      return new OpenAiCompatibleProvider({
        name: "local",
        model: config.model?.trim() || env("LOCAL_AI_MODEL") || "local-model",
        baseUrl:
          config.baseUrl?.trim() || env("LOCAL_AI_BASE_URL") || "http://localhost:11434/v1",
        // Local servers are frequently keyless; only send one if present.
        apiKey: config.apiKey?.trim() || env("LOCAL_AI_API_KEY"),
        supportsJsonMode: env("LOCAL_AI_JSON_MODE") !== "false",
      });

    default: {
      // Exhaustiveness guard.
      const exhaustive: never = name;
      throw new ProviderError(`Unknown provider: ${String(exhaustive)}`);
    }
  }
}

function requireKey(envName: string, provider: string): string {
  const value = env(envName);
  if (!value) {
    throw new ProviderError(`Missing ${envName} for the ${provider} provider.`, {
      hint: `Export ${envName}, or choose another provider with --provider.`,
    });
  }
  return value;
}
