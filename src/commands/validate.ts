/**
 * `hermes-stack validate <stack.json>` — validate a stored decision against the
 * live schema (Zod) and the engine's compatibility oracle, without any AI call.
 */
import chalk from "chalk";
import type { AppContext, GlobalOptions } from "../cli/context.ts";
import { ValidationError } from "../utils/errors.ts";
import { readJsonFile } from "../utils/fs.ts";
import { renderCommand } from "../utils/present.ts";
import { validateDecision } from "../validators/stack-decision.ts";

export async function runValidate(
  ctx: AppContext,
  file: string,
  _options: GlobalOptions,
): Promise<void> {
  const { logger, adapter } = ctx;

  const raw = await readJsonFile(file);

  const spinner = logger.spinner("Validating against the live schema…");
  const catalog = await adapter.discoverCatalog();
  const schemaResult = validateDecision(catalog, raw);

  if (!schemaResult.ok) {
    spinner.fail("Schema validation failed.");
    throw new ValidationError(`${file} is not a valid stack decision.`, {
      details: schemaResult.issues.join("\n"),
    });
  }
  spinner.update("Checking compatibility with the engine…");

  const compat = await adapter.validate(schemaResult.decision);
  if (!compat.ok) {
    spinner.fail("Compatibility check failed.");
    throw new ValidationError(`${file} describes an incompatible stack.`, {
      details: compat.errors.join("\n"),
      hint: "Fix the reported combination, or run `hermes-stack recommend` for a valid one.",
    });
  }

  spinner.succeed("Stack is valid.");
  logger.blank();
  logger.raw(`${chalk.bold("Resolved config")}`);
  logger.raw(chalk.dim(JSON.stringify(compat.resolvedConfig, null, 2)));
  logger.blank();
  logger.raw(renderCommand(compat.reproducibleCommand));
}
