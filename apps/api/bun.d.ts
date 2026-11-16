declare module "bun:test" {
  export const afterEach: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const describe: (name: string, fn: () => void) => void;
  export const it: typeof test;
  export const test: {
    (name: string, fn: () => void | Promise<void>): void;
    skip: (name: string, fn: () => void | Promise<void>) => void;
  };
  export const expect: <T>(value: T) => {
    not: { toBe: (expected: unknown) => void };
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toContain: (expected: unknown) => void;
    toMatchObject: (expected: Record<string, unknown>) => void;
    toThrow: (expected?: RegExp | string) => void;
  };
}

interface ImportMeta { readonly dir: string; }

declare const Bun: {
  spawn: (command: string[], options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    stdin?: "inherit";
    stdout?: "inherit";
    stderr?: "inherit";
  }) => { exited: Promise<number>; kill: (signal?: string) => void };
  serve: (options: {
    fetch: (request: Request) => Response | Promise<Response>;
    hostname?: string;
    port?: number;
    maxRequestBodySize?: number;
    error?: (error: Error) => Response | Promise<Response>;
  }) => {
    hostname: string;
    port: number;
    stop: (closeActiveConnections?: boolean) => Promise<void>;
  };
  password: {
    hash: (
      password: string,
      options?: {
        algorithm?: "bcrypt" | "argon2id" | "argon2i" | "argon2d";
        cost?: number;
        memoryCost?: number;
        timeCost?: number;
      },
    ) => Promise<string>;
    verify: (password: string, hash: string) => Promise<boolean>;
  };
};
