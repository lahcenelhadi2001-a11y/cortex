import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { WorkspaceSymbolsProvider, useWorkspaceSymbols } from "../WorkspaceSymbolsContext";

const {
  mockWorkspaceSymbolsClear,
  mockWorkspaceSymbolsGetStats,
  mockWorkspaceSymbolsIndex,
  mockWorkspaceSymbolsSearch,
  mockGetProjectPath,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockWorkspaceSymbolsClear: vi.fn(),
  mockWorkspaceSymbolsGetStats: vi.fn(),
  mockWorkspaceSymbolsIndex: vi.fn(),
  mockWorkspaceSymbolsSearch: vi.fn(),
  mockGetProjectPath: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/sdk/workspace-symbols", () => ({
  workspaceSymbolsClear: mockWorkspaceSymbolsClear,
  workspaceSymbolsGetStats: mockWorkspaceSymbolsGetStats,
  workspaceSymbolsIndex: mockWorkspaceSymbolsIndex,
  workspaceSymbolsSearch: mockWorkspaceSymbolsSearch,
}));

vi.mock("@/utils/workspace", () => ({
  getProjectPath: mockGetProjectPath,
}));

vi.mock("../../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

function StateProbe() {
  const workspaceSymbols = useWorkspaceSymbols();
  capturedContext = workspaceSymbols;

  return (
    <div>
      <span data-testid="error">{workspaceSymbols.state.error ?? ""}</span>
      <span data-testid="indexed">{String(workspaceSymbols.state.indexed)}</span>
      <span data-testid="total-symbols">
        {String(workspaceSymbols.state.stats?.totalSymbols ?? 0)}
      </span>
    </div>
  );
}

type WorkspaceSymbolsContextValue = ReturnType<typeof useWorkspaceSymbols>;

let capturedContext: WorkspaceSymbolsContextValue | undefined;

const DEFAULT_STATS = {
  totalSymbols: 7,
  totalFiles: 3,
  lastIndexed: 123,
  indexed: true,
};

async function renderProvider() {
  render(() => (
    <WorkspaceSymbolsProvider>
      <StateProbe />
    </WorkspaceSymbolsProvider>
  ));

  await waitFor(() => {
    expect(capturedContext).toBeDefined();
  });

  return capturedContext!;
}

describe("WorkspaceSymbolsProvider startup integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    capturedContext = undefined;
    mockGetProjectPath.mockReturnValue("/root/cortex-ide");
    mockWorkspaceSymbolsGetStats.mockResolvedValue(DEFAULT_STATS);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads startup stats for the current project path", async () => {
    await renderProvider();

    await waitFor(() => {
      expect(mockWorkspaceSymbolsGetStats).toHaveBeenCalledWith("/root/cortex-ide");
    });

    await waitFor(() => {
      expect(screen.getByTestId("indexed").textContent).toBe("true");
      expect(screen.getByTestId("total-symbols").textContent).toBe("7");
      expect(screen.getByTestId("error").textContent).toBe("");
    });
  });

  it("skips startup stats when no workspace is open", async () => {
    mockGetProjectPath.mockReturnValue("");

    await renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("indexed").textContent).toBe("false");
    });

    expect(mockWorkspaceSymbolsGetStats).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("suppresses startup command-unavailable noise while leaving the provider unindexed", async () => {
    mockWorkspaceSymbolsGetStats.mockRejectedValueOnce(
      new Error("Command workspace_symbols_get_stats not found"),
    );

    await renderProvider();

    await waitFor(() => {
      expect(mockWorkspaceSymbolsGetStats).toHaveBeenCalledWith("/root/cortex-ide");
      expect(screen.getByTestId("indexed").textContent).toBe("false");
      expect(screen.getByTestId("total-symbols").textContent).toBe("0");
      expect(screen.getByTestId("error").textContent).toBe("");
    });

    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("surfaces startup stats failures without defaulting to a successful indexed state", async () => {
    mockWorkspaceSymbolsGetStats.mockRejectedValueOnce(new Error("Stats unavailable"));

    await renderProvider();

    await waitFor(() => {
      expect(mockWorkspaceSymbolsGetStats).toHaveBeenCalledWith("/root/cortex-ide");
      expect(screen.getByTestId("indexed").textContent).toBe("false");
      expect(screen.getByTestId("total-symbols").textContent).toBe("0");
      expect(screen.getByTestId("error").textContent).toBe("Stats unavailable");
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to refresh stats:",
      "Stats unavailable",
    );
  });

  it("rethrows search failures and records the error state", async () => {
    const context = await renderProvider();
    mockWorkspaceSymbolsSearch.mockRejectedValueOnce(new Error("Search failed"));

    await expect(context.search("needle")).rejects.toThrow("Search failed");

    await waitFor(() => {
      expect(mockWorkspaceSymbolsSearch).toHaveBeenCalledWith(
        "/root/cortex-ide",
        "needle",
        undefined,
      );
      expect(screen.getByTestId("error").textContent).toBe("Search failed");
    });
  });

  it("rethrows index failures and records the error state", async () => {
    const context = await renderProvider();
    mockWorkspaceSymbolsIndex.mockRejectedValueOnce(new Error("Index failed"));

    await expect(context.indexWorkspace("/root/cortex-ide")).rejects.toThrow("Index failed");

    await waitFor(() => {
      expect(mockWorkspaceSymbolsIndex).toHaveBeenCalledWith("/root/cortex-ide");
      expect(screen.getByTestId("error").textContent).toBe("Index failed");
    });
  });

  it("rethrows clear failures and records the error state", async () => {
    const context = await renderProvider();
    mockWorkspaceSymbolsClear.mockRejectedValueOnce(new Error("Clear failed"));

    await expect(context.clearIndex()).rejects.toThrow("Clear failed");

    await waitFor(() => {
      expect(mockWorkspaceSymbolsClear).toHaveBeenCalledWith("/root/cortex-ide");
      expect(screen.getByTestId("error").textContent).toBe("Clear failed");
    });
  });

  it("rethrows refresh failures and records the error state", async () => {
    const context = await renderProvider();
    mockWorkspaceSymbolsGetStats.mockRejectedValueOnce(new Error("Refresh failed"));

    await expect(context.refreshStats()).rejects.toThrow("Refresh failed");

    await waitFor(() => {
      expect(mockWorkspaceSymbolsGetStats).toHaveBeenLastCalledWith("/root/cortex-ide");
      expect(screen.getByTestId("indexed").textContent).toBe("false");
      expect(screen.getByTestId("total-symbols").textContent).toBe("0");
      expect(screen.getByTestId("error").textContent).toBe("Refresh failed");
    });
  });
});
