import { describe, expect, it, vi } from "vitest";
import { createAsyncCleanupRegistrar } from "../asyncCleanup";

describe("createAsyncCleanupRegistrar", () => {
  it("runs registered cleanups when disposed", () => {
    const registrar = createAsyncCleanupRegistrar();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();

    registrar.add(cleanupA);
    registrar.add(cleanupB);
    registrar.dispose();

    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);
  });

  it("runs late cleanups immediately after disposal", () => {
    const registrar = createAsyncCleanupRegistrar();
    const cleanup = vi.fn();

    registrar.dispose();
    registrar.add(cleanup);

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
