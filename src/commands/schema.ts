/**
 * `hermes-stack schema` — show the discovered options.
 *
 * By default prints a readable catalog; with `--json` prints the raw engine
 * schema (useful for tooling). All data is discovered live — nothing hardcoded.
 */
import chalk from "chalk";
import type { AppContext, GlobalOptions } from "../cli/context.ts";

export interface SchemaCommandInput {
  /** Emit the raw engine schema JSON instead of the readable catalog. */
  readonly json: boolean;
  /** Also list the mined compatibility rules. */
  readonly rules: boolean;
}

export async function runSchema(
  ctx: AppContext,
  input: SchemaCommandInput,
  _options: GlobalOptions,
): Promise<void> {
  const { logger, adapter } = ctx;

  if (input.json) {
    const raw = await adapter.discoverRawSchema();
    logger.raw(JSON.stringify(raw, null, 2));
    return;
  }

  const spinner = logger.spinner("Discovering options…");
  const catalog = await adapter.discoverCatalog();
  spinner.succeed(`Engine: ${adapter.describeEngine()}`);
  logger.blank();

  const width = Math.max(...Object.keys(catalog).map((k) => k.length));
  for (const [field, values] of Object.entries(catalog)) {
    logger.raw(`  ${chalk.bold(field.padEnd(width))}  ${values.join(chalk.dim(" · "))}`);
  }

  if (input.rules) {
    const rules = await adapter.discoverCompatibilityRules();
    logger.blank();
    logger.raw(chalk.bold(`Compatibility rules (${rules.length})`));
    if (rules.length === 0) {
      logger.raw(chalk.dim("  none discovered"));
    } else {
      for (const rule of rules) logger.raw(`  ${chalk.dim("•")} ${rule}`);
    }
  }
}
