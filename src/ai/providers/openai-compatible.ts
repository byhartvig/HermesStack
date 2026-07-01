/**
 * OpenAI-compatible chat-completions provider.
 *
 * Backs the OpenAI, DeepSeek, and local providers, which all speak the same
 * `/chat/completions` protocol and differ only in base URL, default model, and
 * how the API key is resolved.
 */
import type { AiCompletionRequest, AiProvider } from "../provider.ts";
import { postJson } from "../http.ts";
import { ProviderError } from "../../utils/errors.ts";

interface ChatResponse {
  choices?: ReadonlyArray<{ message?: { content?: string } }>;
}

/** Construction parameters for an OpenAI-compatible endpoint. */
export interface OpenAiCompatibleParams {
  readonly name: string;
  readonly model: string;
  readonly baseUrl: string;
  /** API key; may be empty for keyless local servers. */
  readonly apiKey: string;
  /** Whether the endpoint honors `response_format: { type: "json_object" }`. */
  readonly supportsJsonMode: boolean;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  readonly model: string;

  constructor(private readonly params: OpenAiCompatibleParams) {
    this.name = params.name;
    this.model = params.model;
  }

  async complete(request: AiCompletionRequest): Promise<string> {
    const url = `${this.params.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers: Record<string, string> = {};
    if (this.params.apiKey) headers.authorization = `Bearer ${this.params.apiKey}`;

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 4096,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    };
    if (request.json && this.params.supportsJsonMode) {
      body.response_format = { type: "json_object" };
    }

    const payload = (await postJson(url, headers, body, this.name)) as ChatResponse;
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new ProviderError(`${this.name} returned an empty response.`);
    }
    return text;
  }
}
