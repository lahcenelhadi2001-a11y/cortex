import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { WorkspaceSymbolsProvider, useWorkspaceSymbols } from "../WorkspaceSymbolsContext";

const {
  mockWorkspaceSymbolsGetStats,
  mockGetProjectPath,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockWorkspaceSymbolsGetStats: vi.fn(),
  mockGetProjectPath: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/sdk/workspace-symbols", () => ({
  workspaceSymbolsClear: vi.fn(),
  workspaceSymbolsGetStats: mockWorkspaceSymbolsGetStats,
  workspaceSymbolsIndex: vi.fn(),
  workspaceSymbolsSearch: vi.fn(),
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

  return (
    <div>
      <span data-testid="indexed">{String(workspaceSymbols.state.indexed)}</span>
      <span data-testid="total-symbols">
        {String(workspaceSymbols.state.stats?.totalSymbols ?? 0)}
      </span>
    </div>
  );
}

describe("WorkspaceSymbolsProvider startup integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads startup stats for the current project path", async () => {
    mockGetProjectPath.mockReturnValue("/root/cortex-ide");
    mockWorkspaceSymbolsGetStats.mockResolvedValue({
      totalSymbols: 7,
      totalFiles: 3,
      lastIndexed: 123,
      indexed: true,
    });

    render(() => (
      <WorkspaceSymbolsProvider>
        <StateProbe />
      </WorkspaceSymbolsProvider>
    ));

    await waitFor(() => {
      expect(mockWorkspaceSymbolsGetStats).toHaveBeenCalledWith("/root/cortex-ide");
    });

    await waitFor(() => {
      expect(screen.getByTestId("indexed").textContent).toBe("true");
      expect(screen.getByTestId("total-symbols").textContent).toBe("7");
    });
  });

  it("skips startup stats when no workspace is open", async () => {
    mockGetProjectPath.mockReturnValue("");

    render(() => (
      <WorkspaceSymbolsProvider>
        <StateProbe />
      </WorkspaceSymbolsProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId("indexed").textContent).toBe("false");
    });

    expect(mockWorkspaceSymbolsGetStats).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});
