import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  workspaceSymbolsClear,
  workspaceSymbolsGetStats,
  workspaceSymbolsIndex,
  workspaceSymbolsSearch,
} from "../workspace-symbols";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("workspace symbol SDK wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the workspace path and default maxResults when searching", async () => {
    const expected = [
      {
        name: "UserService",
        kind: "class",
        containerName: null,
        filePath: "/root/cortex-ide/src/services/user.ts",
        line: 5,
        column: 0,
        endLine: 12,
        endColumn: 1,
      },
    ];
    vi.mocked(invoke).mockResolvedValueOnce(expected);

    const result = await workspaceSymbolsSearch("/root/cortex-ide", "user");

    expect(result).toEqual(expected);
    expect(invoke).toHaveBeenCalledWith("workspace_symbols_search", {
      workspacePath: "/root/cortex-ide",
      query: "user",
      maxResults: 100,
    });
  });

  it("rethrows search failures instead of returning an empty list", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("search backend failed"));

    await expect(
      workspaceSymbolsSearch("/root/cortex-ide", "user", 25),
    ).rejects.toThrow("search backend failed");
  });

  it("passes the workspace path when indexing", async () => {
    const expected = {
      totalSymbols: 12,
      totalFiles: 4,
      lastIndexed: 123,
      indexed: true,
    };
    vi.mocked(invoke).mockResolvedValueOnce(expected);

    const result = await workspaceSymbolsIndex("/root/cortex-ide");

    expect(result).toEqual(expected);
    expect(invoke).toHaveBeenCalledWith("workspace_symbols_index", {
      workspacePath: "/root/cortex-ide",
    });
  });

  it("rethrows index failures instead of returning default stats", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("index backend failed"));

    await expect(workspaceSymbolsIndex("/root/cortex-ide")).rejects.toThrow(
      "index backend failed",
    );
  });

  it("passes the workspace path when clearing", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await workspaceSymbolsClear("/root/cortex-ide");

    expect(invoke).toHaveBeenCalledWith("workspace_symbols_clear", {
      workspacePath: "/root/cortex-ide",
    });
  });

  it("rethrows clear failures instead of silently succeeding", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("clear backend failed"));

    await expect(workspaceSymbolsClear("/root/cortex-ide")).rejects.toThrow(
      "clear backend failed",
    );
  });

  it("passes the workspace path when reading stats", async () => {
    const expected = {
      totalSymbols: 3,
      totalFiles: 1,
      lastIndexed: 456,
      indexed: true,
    };
    vi.mocked(invoke).mockResolvedValueOnce(expected);

    const result = await workspaceSymbolsGetStats("/root/cortex-ide");

    expect(result).toEqual(expected);
    expect(invoke).toHaveBeenCalledWith("workspace_symbols_get_stats", {
      workspacePath: "/root/cortex-ide",
    });
  });

  it("rethrows stats failures instead of returning default stats", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("stats backend failed"));

    await expect(workspaceSymbolsGetStats("/root/cortex-ide")).rejects.toThrow(
      "stats backend failed",
    );
  });
});
