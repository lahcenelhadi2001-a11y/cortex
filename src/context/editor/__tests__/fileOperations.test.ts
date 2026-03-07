import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "solid-js/store";
import { createFileOperations } from "../fileOperations";
import type { EditorState } from "../editorTypes";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../../utils/tauri-api", () => ({
  fsWriteFile: vi.fn(),
}));

function createEditorState(overrides: Partial<EditorState> = {}) {
  return createStore<EditorState>({
    openFiles: [],
    activeFileId: null,
    activeGroupId: "group-default",
    groups: [
      {
        id: "group-default",
        fileIds: [],
        activeFileId: null,
        splitRatio: 1,
      },
    ],
    splits: [],
    cursorCount: 1,
    selectionCount: 0,
    isOpening: false,
    pinnedTabs: [],
    previewTab: null,
    gridState: null,
    useGridLayout: false,
    minimapSettings: {
      enabled: true,
      side: "right",
      showSlider: "mouseover",
      renderCharacters: false,
      maxColumn: 80,
      scale: 1,
      sizeMode: "proportional",
    },
    breadcrumbSymbolPath: [],
    groupLockState: {},
    groupNames: {},
    recentlyClosedStack: [],
    ...overrides,
  });
}

describe("createFileOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes an existing preview tab to a permanent open without duplicating the tab entry", async () => {
    const previewFile = {
      id: "file-preview",
      path: "/workspace/project/src/SearchTarget.ts",
      name: "SearchTarget.ts",
      content: "export const preview = true;",
      language: "typescript",
      modified: false,
      cursors: [{ line: 1, column: 1 }],
      selections: [],
    };

    const [state, setState] = createEditorState({
      openFiles: [previewFile],
      activeFileId: previewFile.id,
      previewTab: previewFile.id,
      groups: [
        {
          id: "group-default",
          fileIds: [previewFile.id],
          activeFileId: previewFile.id,
          splitRatio: 1,
        },
      ],
    });

    const operations = createFileOperations(state, setState);

    await operations.openFile(previewFile.path);

    expect(state.previewTab).toBeNull();
    expect(state.openFiles).toHaveLength(1);
    expect(state.openFiles[0].id).toBe(previewFile.id);
    expect(state.groups[0].fileIds).toEqual([previewFile.id]);
  });
});
