/**
 * Helpers shared across commands: input resolution, provider config assembly,
 * and interactive confirmation.
 */
import enquirer from "enquirer";
import type { GlobalOptions } from "../cli/context.ts";
import type { ProviderConfig } from "../ai/provider.ts";
import { InputError } from "../utils/errors.ts";
import { readTextFile } from "../utils/fs.ts";

/** Extensions treated as requirement documents when passed positionally. */
const DOC_EXTENSIONS = [".md", ".markdown", ".txt"];

/**
 * Resolves natural-language requirements from either a positional argument
 * (inline text or a file path) or an explicit `--file` option.
 */
export async function resolveRequirements(
  positional: string | undefined,
  fileOption: string | undefined,
): Promise<string> {
  if (fileOption) {
    return readTextFile(fileOption);
  }
  if (positional && DOC_EXTENSIONS.some((ext) => positional.toLowerCase().endsWith(ext))) {
    return readTextFile(positional);
  }
  if (positional && positional.trim().length > 0) {
    return positional.trim();
  }
  throw new InputError("No requirements provided.", {
    hint: 'Pass a description ("a CRM with billing"), a path, or use --file requirements.md.',
  });
}

/** Builds provider configuration from global options. */
export function providerConfigFrom(options: GlobalOptions): ProviderConfig {
  return options.model ? { model: options.model } : {};
}

/**
 * Asks the user to confirm an action. Auto-confirms (returns true) when `--yes`
 * is set or when stdin is not an interactive TTY.
 */
export async function confirm(message: string, options: GlobalOptions): Promise<boolean> {
  if (options.yes || !process.stdin.isTTY) return true;
  const response = await enquirer.prompt<{ ok: boolean }>({
    type: "confirm",
    name: "ok",
    message,
    initial: true,
  });
  return response.ok;
}
