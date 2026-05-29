declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const it: typeof test;
  export const test: {
    (name: string, fn: () => void | Promise<void>): void;
    skip: (name: string, fn: () => void | Promise<void>) => void;
  };
  export const expect: <T>(value: T) => {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toContain: (expected: unknown) => void;
    toMatchObject: (expected: Record<string, unknown>) => void;
    toThrow: (expected?: RegExp | string) => void;
  };
}

declare const Bun: {
  serve: (options: {
    fetch: (request: Request) => Response | Promise<Response>;
    hostname?: string;
    port?: number;
  }) => {
    hostname: string;
    port: number;
    stop: () => void;
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
