/**
 * Thin logging facade over `chalk` and `ora`.
 *
 * Centralizing output here keeps the rest of the codebase free of direct
 * console/spinner calls, makes verbosity a first-class concern, and allows the
 * whole UI to be swapped or silenced in tests via dependency injection.
 */
import chalk from "chalk";
import ora, { type Ora } from "ora";

/** Injectable logger contract used across commands and services. */
export interface Logger {
  /** Whether verbose diagnostics are enabled. */
  readonly verbose: boolean;
  /** Primary informational output (stdout). */
  info(message: string): void;
  /** Success/confirmation output. */
  success(message: string): void;
  /** Non-fatal warnings (stderr). */
  warn(message: string): void;
  /** Errors (stderr). */
  error(message: string): void;
  /** Verbose-only diagnostic output; no-op unless {@link verbose}. */
  debug(message: string): void;
  /** Emits a blank line for visual separation. */
  blank(): void;
  /** Prints raw text with no decoration (used for machine-readable output). */
  raw(text: string): void;
  /** Starts a spinner; returns a handle to update/stop it. */
  spinner(text: string): Spinner;
}

/** Minimal spinner handle so callers never touch `ora` directly. */
export interface Spinner {
  update(text: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

const dim = chalk.dim;
const tag = chalk.bold.cyan("hermes");

/** Default console-backed {@link Logger}. */
export class ConsoleLogger implements Logger {
  constructor(readonly verbose: boolean) {}

  info(message: string): void {
    console.log(`${tag} ${message}`);
  }

  success(message: string): void {
    console.log(`${chalk.bold.green("✔")} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${chalk.bold.yellow("⚠")} ${message}`);
  }

  error(message: string): void {
    console.error(`${chalk.bold.red("✖")} ${message}`);
  }

  debug(message: string): void {
    if (this.verbose) console.error(dim(`  · ${message}`));
  }

  blank(): void {
    console.log("");
  }

  raw(text: string): void {
    console.log(text);
  }

  spinner(text: string): Spinner {
    // In verbose mode, spinners obscure interleaved debug output, so fall back
    // to plain lines.
    if (this.verbose) {
      console.error(dim(`  … ${text}`));
      return {
        update: (t) => console.error(dim(`  … ${t}`)),
        succeed: (t) => t !== undefined && this.success(t),
        fail: (t) => t !== undefined && this.error(t),
        stop: () => {},
      };
    }
    const instance: Ora = ora({ text, color: "cyan" }).start();
    return {
      update: (t) => {
        instance.text = t;
      },
      succeed: (t) => instance.succeed(t),
      fail: (t) => instance.fail(t),
      stop: () => instance.stop(),
    };
  }
}
