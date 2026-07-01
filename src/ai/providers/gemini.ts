/**
 * Google Gemini provider (Generative Language API).
 */
import type { AiCompletionRequest, AiProvider, ProviderConfig } from "../provider.ts";
import { postJson, requireEnv } from "../http.ts";
import { ProviderError } from "../../utils/errors.ts";

const DEFAULT_MODEL = "gemini-2.0-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: ReadonlyArray<{
    content?: { parts?: ReadonlyArray<{ text?: string }> };
  }>;
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly apiKey: string;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model?.trim() || DEFAULT_MODEL;
    this.apiKey = config.apiKey?.trim() || requireEnv("GEMINI_API_KEY", this.name);
  }

  async complete(request: AiCompletionRequest): Promise<string> {
    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${this.apiKey}`;
    const payload = (await postJson(
      url,
      {},
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.user }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 4096,
          ...(request.json ? { responseMimeType: "application/json" } : {}),
        },
      },
      this.name,
    )) as GeminiResponse;

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new ProviderError("Gemini returned an empty response.");
    }
    return text;
  }
}
