/**
 * Anthropic Claude provider (Messages API).
 */
import type { AiCompletionRequest, AiProvider, ProviderConfig } from "../provider.ts";
import { postJson, requireEnv } from "../http.ts";
import { ProviderError } from "../../utils/errors.ts";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

interface ClaudeResponse {
  content?: ReadonlyArray<{ type: string; text?: string }>;
}

export class ClaudeProvider implements AiProvider {
  readonly name = "claude";
  readonly model: string;
  private readonly apiKey: string;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model?.trim() || DEFAULT_MODEL;
    this.apiKey = config.apiKey?.trim() || requireEnv("ANTHROPIC_API_KEY", this.name);
  }

  async complete(request: AiCompletionRequest): Promise<string> {
    const payload = await postJson(
      ENDPOINT,
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      {
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.2,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      },
      this.name,
    );

    const response = payload as ClaudeResponse;
    const text = response.content
      ?.filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      throw new ProviderError("Claude returned an empty response.");
    }
    return text;
  }
}
