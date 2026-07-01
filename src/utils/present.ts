/**
 * Presentation helpers: render domain objects as readable terminal output.
 * Kept separate from the {@link Logger} so formatting logic is testable and the
 * logger stays a thin transport.
 */
import chalk from "chalk";
import type { StackDecision } from "../domain/types.ts";

/** The ordered fields shown in the decision summary. */
const SUMMARY_FIELDS: ReadonlyArray<readonly [label: string, key: keyof StackDecision]> = [
  ["Project", "projectName"],
  ["Frontend", "frontend"],
  ["Backend", "backend"],
  ["Runtime", "runtime"],
  ["Database", "database"],
  ["DB provider", "databaseProvider"],
  ["ORM", "orm"],
  ["Auth", "auth"],
  ["API", "api"],
  ["Payments", "payments"],
  ["Pkg manager", "packageManager"],
  ["Web deploy", "webDeploy"],
  ["Server deploy", "serverDeploy"],
  ["Addons", "addons"],
  ["Examples", "examples"],
];

/** Formats a scalar or array field value for display. */
function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : chalk.dim("—");
  if (value === "none" || value === "" || value === undefined) return chalk.dim("none");
  return String(value);
}

/** Renders the decision as an aligned key/value block. */
export function renderDecision(decision: StackDecision): string {
  const width = Math.max(...SUMMARY_FIELDS.map(([label]) => label.length));
  const rows = SUMMARY_FIELDS.map(([label, key]) => {
    const padded = label.padEnd(width);
    return `  ${chalk.dim(padded)}  ${formatValue(decision[key])}`;
  });

  const confidencePct = Math.round(decision.confidence * 100);
  const confColor =
    confidencePct >= 80 ? chalk.green : confidencePct >= 50 ? chalk.yellow : chalk.red;

  return [
    chalk.bold("Recommended stack"),
    ...rows,
    "",
    `  ${chalk.dim("Confidence".padEnd(width))}  ${confColor(`${confidencePct}%`)}`,
  ].join("\n");
}

/** Renders the reasoning paragraph. */
export function renderReasoning(decision: StackDecision): string {
  return `${chalk.bold("Reasoning")}\n  ${decision.reasoning.replace(/\n/g, "\n  ")}`;
}

/** Renders a reproducible command inside a visual block. */
export function renderCommand(command: string): string {
  if (!command) return "";
  return `${chalk.bold("Reproducible command")}\n${chalk.cyan(`  ${command}`)}`;
}
