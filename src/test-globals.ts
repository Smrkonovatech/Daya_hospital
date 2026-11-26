/**
 * Global Test Helper / Shim for Vitest
 * Re-exports Vitest global test runner primitives to prevent dual-module initialization under ViteModuleRunner.
 */
export const describe = (globalThis as any).describe;
export const it = (globalThis as any).it;
export const test = (globalThis as any).test;
export const expect = (globalThis as any).expect;
export const beforeEach = (globalThis as any).beforeEach;
export const afterEach = (globalThis as any).afterEach;
export const beforeAll = (globalThis as any).beforeAll;
export const afterAll = (globalThis as any).afterAll;
export const vi = (globalThis as any).vi;
export default { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi };
