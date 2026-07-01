/**
 * Helpers for coaxing valid JSON out of LLM output.
 *
 * Models frequently wrap JSON in Markdown fences or add prose despite being
 * told not to. {@link extractJson} recovers the first well-formed JSON object
 * from such output without executing anything.
 */

/**
 * Extracts and parses the first balanced JSON object found in `text`.
 *
 * @throws {SyntaxError} when no parseable object can be located.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Fast path: the whole payload is already JSON.
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fenced / embedded extraction
  }

  const fenced = stripCodeFence(trimmed);
  if (fenced !== trimmed) {
    try {
      return JSON.parse(fenced);
    } catch {
      // fall through
    }
  }

  const candidate = firstBalancedObject(trimmed);
  if (candidate !== null) {
    return JSON.parse(candidate);
  }

  throw new SyntaxError("No JSON object could be extracted from the model response.");
}

/** Removes a surrounding ```json ... ``` (or bare ``` ... ```) fence, if present. */
function stripCodeFence(text: string): string {
  const match = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(text.trim());
  return match?.[1]?.trim() ?? text;
}

/**
 * Scans for the first top-level `{...}` region with balanced braces, ignoring
 * braces that appear inside string literals.
 */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
