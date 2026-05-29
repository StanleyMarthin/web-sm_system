declare module "bun:test" {
  export const afterEach: (fn: () => void | Promise<void>) => void;
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
  export const mock: {
    <T extends (...args: any[]) => any>(fn: T): T;
    restore: () => void;
  };
}
