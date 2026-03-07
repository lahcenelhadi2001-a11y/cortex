import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useFileTree } from "../useFileTree";
import type { FileEntry, VirtualizedFileTreeProps } from "../types";

const explorerMocks = vi.hoisted(() => ({
  fileOps: {
    moveWithUndo: vi.fn(),
    copyWithUndo: vi.fn(),
    duplicateWithUndo: vi.fn(),
    deleteWithUndo: vi.fn(),
    createFileWithUndo: vi.fn(),
    createDirectoryWithUndo: vi.fn(),
    renameWithUndo: vi.fn(),
  },
  toast: {
    toasts: [],
    show: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/context/FileOperationsContext", () => ({
  useFileOperations: () => explorerMocks.fileOps,
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => explorerMocks.toast,
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

const ROOT_PATH = "/workspace/project";
const LARGE_FILE: FileEntry = {
  name: "SearchTarget.ts",
  path: `${ROOT_PATH}/src/SearchTarget.ts`,
  isDir: false,
  isHidden: false,
  isSymlink: false,
  extension: "ts",
};

const ROOT_ENTRY: FileEntry = {
  name: "project",
  path: ROOT_PATH,
  isDir: true,
  isHidden: false,
  isSymlink: false,
  children: [LARGE_FILE],
};

let treeApi: ReturnType<typeof useFileTree> | undefined;

function TreeHarness(props: VirtualizedFileTreeProps) {
  treeApi = useFileTree(props);
  return null;
}

const createProps = (
  overrides: Partial<VirtualizedFileTreeProps> = {},
): VirtualizedFileTreeProps => ({
  rootPath: ROOT_PATH,
  onFileSelect: vi.fn(),
  onFilePreview: vi.fn(),
  enablePreview: true,
  selectedPaths: [],
  onSelectPaths: vi.fn(),
  showHidden: true,
  filterQuery: "",
  compactFolders: false,
  fileNestingSettings: { enabled: false, patterns: {} },
  confirmDragAndDrop: false,
  indentGuidesEnabled: false,
  sortOrder: "default",
  gitStatusMap: new Map(),
  gitFolderStatusMap: new Map(),
  confirmDelete: false,
  enableTrash: true,
  maxMemoryForLargeFilesMB: 5,
  ...overrides,
});

describe("useFileTree large file guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    treeApi = undefined;
    vi.mocked(listen).mockResolvedValue(vi.fn());

    vi.mocked(invoke).mockImplementation(async (command) => {
      switch (command) {
        case "fs_get_file_tree":
          return ROOT_ENTRY;
        case "fs_get_metadata":
          return { size: 7 * 1024 * 1024 };
        case "fs_watch_directory":
        case "fs_unwatch_directory":
          return undefined;
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("blocks oversized opens until the warning is explicitly confirmed", async () => {
    const props = createProps();

    render(() => <TreeHarness {...props} />);

    await vi.waitFor(() => {
      expect(treeApi?.rootEntry()?.children?.[0]?.path).toBe(LARGE_FILE.path);
    });

    treeApi?.handleOpen(LARGE_FILE);

    await vi.waitFor(() => {
      expect(treeApi?.largeFileWarning()?.path).toBe(LARGE_FILE.path);
    });

    expect(props.onFileSelect).not.toHaveBeenCalled();

    treeApi?.handleLargeFileCancel();

    expect(treeApi?.largeFileWarning()).toBeNull();
    expect(props.onFileSelect).not.toHaveBeenCalled();
  });

  it("opens oversized preview files exactly once after confirmation", async () => {
    const props = createProps();

    render(() => <TreeHarness {...props} />);

    await vi.waitFor(() => {
      expect(treeApi?.rootEntry()?.children?.[0]?.path).toBe(LARGE_FILE.path);
    });

    treeApi?.handleOpenPreview(LARGE_FILE);

    await vi.waitFor(() => {
      expect(treeApi?.largeFileWarning()).toEqual(
        expect.objectContaining({ path: LARGE_FILE.path, isPreview: true }),
      );
    });

    treeApi?.handleLargeFileConfirm();

    expect(props.onFilePreview).toHaveBeenCalledTimes(1);
    expect(props.onFilePreview).toHaveBeenCalledWith(LARGE_FILE.path);
    expect(props.onFileSelect).not.toHaveBeenCalled();
    expect(treeApi?.largeFileWarning()).toBeNull();
  });
});
