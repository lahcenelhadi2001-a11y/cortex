import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@solidjs/testing-library";
import { NavigationHistoryProvider, useNavigationHistory } from "../NavigationHistoryContext";

const mockOpenFile = vi.fn();

let mockEditorState: {
  openFiles: Array<{ id: string; path: string }>;
  activeFileId: string | null;
};

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    openFile: mockOpenFile,
    state: mockEditorState,
  }),
}));

let historyApi: ReturnType<typeof useNavigationHistory> | undefined;

function HistoryHarness() {
  historyApi = useNavigationHistory();
  return null;
}

describe("NavigationHistoryContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    historyApi = undefined;
    mockOpenFile.mockResolvedValue(undefined);
    mockEditorState = {
      openFiles: [
        { id: "a", path: "/workspace/project/src/a.ts" },
        { id: "b", path: "/workspace/project/src/b.ts" },
      ],
      activeFileId: "a",
    };
  });

  const renderHistory = () => {
    render(() => (
      <NavigationHistoryProvider>
        <HistoryHarness />
      </NavigationHistoryProvider>
    ));
  };

  it("records significant go-to-line jumps so Go Back returns to the prior location in the same file", async () => {
    renderHistory();

    await vi.waitFor(() => {
      expect(historyApi).toBeDefined();
    });

    const setCursorPositionHandler = vi.fn();
    window.addEventListener("editor:set-cursor-position", setCursorPositionHandler);

    window.dispatchEvent(new CustomEvent("editor:cursor-changed", {
      detail: { filePath: "/workspace/project/src/a.ts", line: 5, column: 1 },
    }));
    window.dispatchEvent(new CustomEvent("editor:goto-line", {
      detail: { line: 40, column: 3 },
    }));

    await vi.waitFor(() => {
      expect(historyApi?.historyInfo()).toEqual({ current: 2, total: 2 });
      expect(historyApi?.canGoBack()).toBe(true);
    });

    window.dispatchEvent(new CustomEvent("navigation:back"));

    await vi.waitFor(() => {
      expect(mockOpenFile).toHaveBeenCalledWith("/workspace/project/src/a.ts");
      expect(setCursorPositionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            filePath: "/workspace/project/src/a.ts",
            line: 5,
            column: 1,
          },
        }),
      );
    });

    window.removeEventListener("editor:set-cursor-position", setCursorPositionHandler);
  });

  it("replays cross-file search result jumps with back and forward history", async () => {
    renderHistory();

    await vi.waitFor(() => {
      expect(historyApi).toBeDefined();
    });

    const setCursorPositionHandler = vi.fn();
    window.addEventListener("editor:set-cursor-position", setCursorPositionHandler);

    window.dispatchEvent(new CustomEvent("editor:cursor-changed", {
      detail: { filePath: "/workspace/project/src/a.ts", line: 7, column: 2 },
    }));

    mockEditorState.activeFileId = "b";
    window.dispatchEvent(new CustomEvent("buffer-search:goto", {
      detail: { line: 15, column: 9, length: 6, relativeToLine: true },
    }));

    await vi.waitFor(() => {
      expect(historyApi?.historyInfo()).toEqual({ current: 2, total: 2 });
    });

    window.dispatchEvent(new CustomEvent("navigation:back"));

    await vi.waitFor(() => {
      expect(mockOpenFile).toHaveBeenCalledWith("/workspace/project/src/a.ts");
      expect(setCursorPositionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            filePath: "/workspace/project/src/a.ts",
            line: 7,
            column: 2,
          },
        }),
      );
    });

    mockOpenFile.mockClear();
    setCursorPositionHandler.mockClear();

    window.dispatchEvent(new CustomEvent("navigation:forward"));

    await vi.waitFor(() => {
      expect(mockOpenFile).toHaveBeenCalledWith("/workspace/project/src/b.ts");
      expect(setCursorPositionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            filePath: "/workspace/project/src/b.ts",
            line: 15,
            column: 9,
          },
        }),
      );
      expect(historyApi?.canGoForward()).toBe(false);
    });

    window.removeEventListener("editor:set-cursor-position", setCursorPositionHandler);
  });

  it("records outline navigation against the selected editor file", async () => {
    renderHistory();

    await vi.waitFor(() => {
      expect(historyApi).toBeDefined();
    });

    window.dispatchEvent(new CustomEvent("editor:cursor-changed", {
      detail: { filePath: "/workspace/project/src/a.ts", line: 3, column: 1 },
    }));
    window.dispatchEvent(new CustomEvent("outline:navigate", {
      detail: { fileId: "b", line: 21, column: 4 },
    }));

    await vi.waitFor(() => {
      expect(historyApi?.historyInfo()).toEqual({ current: 2, total: 2 });
      expect(historyApi?.canGoBack()).toBe(true);
    });
  });
});
