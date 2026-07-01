/**
 * Filesystem helpers with typed error handling.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { InputError, toMessage } from "./errors.ts";

/** Reads a text file, throwing a friendly {@link InputError} on failure. */
export async function readTextFile(path: string): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  if (!existsSync(absolute)) {
    throw new InputError(`File not found: ${path}`, {
      hint: "Check the path is correct and relative to your current directory.",
    });
  }
  try {
    return await readFile(absolute, "utf8");
  } catch (error) {
    throw new InputError(`Could not read file: ${path}`, { details: toMessage(error) });
  }
}

/** Reads and parses a JSON file into `unknown`. */
export async function readJsonFile(path: string): Promise<unknown> {
  const text = await readTextFile(path);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InputError(`File is not valid JSON: ${path}`, { details: toMessage(error) });
  }
}

/** Writes a text file, creating/overwriting it. */
export async function writeTextFile(path: string, contents: string): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  try {
    await writeFile(absolute, contents, "utf8");
    return absolute;
  } catch (error) {
    throw new InputError(`Could not write file: ${path}`, { details: toMessage(error) });
  }
}
