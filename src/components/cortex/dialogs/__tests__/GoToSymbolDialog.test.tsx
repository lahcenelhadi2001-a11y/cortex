import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import type { DocumentSymbol } from "@/context/OutlineContext";
import { GoToSymbolDialog } from "../GoToSymbolDialog";

const hoisted = vi.hoisted(() => ({
  mockSetShowDocumentSymbolPicker: vi.fn(),
  mockFetchSymbols: vi.fn(),
  mockNavigateToSymbol: vi.fn(),
  mockShowDocumentSymbolPicker: true,
  mockOutlineState: {
    symbols: [] as DocumentSymbol[],
    loading: false,
    error: null as string | null,
  },
  mockEditorState: {
    openFiles: [] as Array<{ id: string; path: string; content: string; language: string }>,
    activeFileId: null as string | null,
  },
}));

const {
  mockSetShowDocumentSymbolPicker,
  mockFetchSymbols,
  mockNavigateToSymbol,
  mockOutlineState,
  mockEditorState,
} = hoisted;

vi.mock("@/context/CommandContext", () => ({
  useCommands: () => ({
    showDocumentSymbolPicker: () => hoisted.mockShowDocumentSymbolPicker,
    setShowDocumentSymbolPicker: mockSetShowDocumentSymbolPicker,
  }),
}));

vi.mock("@/context/OutlineContext", () => ({
  useOutline: () => ({
    state: mockOutlineState,
    fetchSymbols: mockFetchSymbols,
    navigateToSymbol: mockNavigateToSymbol,
  }),
}));

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    state: mockEditorState,
  }),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: () => null,
}));

describe("GoToSymbolDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockShowDocumentSymbolPicker = true;
    mockOutlineState.symbols = [
      {
        id: "latestSymbol",
        name: "latestSymbol",
        kind: "function",
        range: { startLine: 2, startColumn: 0, endLine: 2, endColumn: 12 },
        selectionRange: { startLine: 2, startColumn: 6, endLine: 2, endColumn: 18 },
        children: [],
        depth: 0,
        expanded: false,
      },
    ];
    mockOutlineState.loading = false;
    mockOutlineState.error = null;
    mockEditorState.openFiles = [
      {
        id: "file-1",
        path: "/workspace/project/src/example.js",
        content: "const latestSymbol = () => true;",
        language: "javascript",
      },
    ];
    mockEditorState.activeFileId = "file-1";
  });

  it("refreshes symbols from the active editor content when the dialog opens", async () => {
    render(() => <GoToSymbolDialog />);

    await vi.waitFor(() => {
      expect(mockFetchSymbols).toHaveBeenCalledWith(
        "file-1",
        "const latestSymbol = () => true;",
        "javascript",
      );
    });
  });

  it("shows an explicit error state when symbol loading fails", async () => {
    mockOutlineState.symbols = [];
    mockOutlineState.loading = false;
    mockOutlineState.error = "Language server unavailable";

    render(() => <GoToSymbolDialog />);

    expect(await screen.findByText("Failed to load symbols")).toBeTruthy();
    expect(screen.getByText("Language server unavailable")).toBeTruthy();
  });

  it("navigates to the selected symbol from the refreshed list", async () => {
    render(() => <GoToSymbolDialog />);

    const symbolRow = await screen.findByRole("option", { name: /latestSymbol/i });
    await fireEvent.click(symbolRow);

    expect(mockNavigateToSymbol).toHaveBeenCalledWith(
      expect.objectContaining({ id: "latestSymbol", name: "latestSymbol" }),
    );
    expect(mockSetShowDocumentSymbolPicker).toHaveBeenCalledWith(false);
  });
});
