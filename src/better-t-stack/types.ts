/**
 * Types describing the raw shape of the Better-T-Stack `schema` command output.
 *
 * This is the *only* module (besides the adapter implementation) that is aware
 * of Better-T-Stack's internal JSON structure. If that structure changes, the
 * fix is contained here and in {@link file://./cli-adapter.ts}.
 */

/** A JSON-Schema-ish node as emitted by `create-better-t-stack schema`. */
export interface JsonSchemaNode {
  readonly type?: string | readonly string[];
  readonly enum?: readonly string[];
  readonly items?: JsonSchemaNode;
  readonly properties?: Readonly<Record<string, JsonSchemaNode>>;
  readonly description?: string;
  readonly [key: string]: unknown;
}

/** Top-level payload returned by `schema --name all`. */
export interface BtsSchema {
  readonly cli: {
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly commands: readonly unknown[];
    readonly [key: string]: unknown;
  };
  readonly schemas: Readonly<Record<string, JsonSchemaNode>>;
}

/** Successful `create-json` dry-run / real-run payload (fields we rely on). */
export interface BtsCreateResult {
  readonly success?: boolean;
  readonly projectConfig?: Readonly<Record<string, unknown>>;
  readonly reproducibleCommand?: string;
  readonly projectDirectory?: string;
  readonly relativePath?: string;
}

/**
 * The `create-json` input payload. Field names here are Better-T-Stack's own
 * (e.g. `dbSetup`, `dryRun`); the adapter is responsible for translating the
 * vendor-neutral domain model into this shape.
 */
export interface BtsCreateInput {
  readonly projectName: string;
  readonly frontend?: readonly string[];
  readonly backend?: string;
  readonly runtime?: string;
  readonly database?: string;
  readonly orm?: string;
  readonly auth?: string;
  readonly api?: string;
  readonly payments?: string;
  readonly packageManager?: string;
  readonly dbSetup?: string;
  readonly webDeploy?: string;
  readonly serverDeploy?: string;
  readonly addons?: readonly string[];
  readonly examples?: readonly string[];
  readonly git?: boolean;
  readonly install?: boolean;
  readonly dryRun?: boolean;
}
