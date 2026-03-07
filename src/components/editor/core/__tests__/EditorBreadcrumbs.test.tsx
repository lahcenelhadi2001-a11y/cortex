import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@solidjs/testing-library";
import { EditorBreadcrumbs } from "../EditorBreadcrumbs";

function createEditorMock() {
  const actionRun = vi.fn();
  const selection = {
    startLineNumber: 4,
    startColumn: 2,
    endLineNumber: 4,
    endColumn: 6,
    isEmpty: () => false,
  };

  const model = {
    getPositionAt: vi.fn((offset: number) => ({
      lineNumber: offset + 1,
      column: offset + 2,
    })),
    getValueInRange: vi.fn(() => "selected text"),
    getLineCount: vi.fn(() => 1),
    getLineContent: vi.fn(() => "selected text"),
    getLineMaxColumn: vi.fn(() => 14),
  };

  return {
    setPosition: vi.fn(),
    revealLineInCenter: vi.fn(),
    focus: vi.fn(),
    setSelection: vi.fn(),
    getSelection: vi.fn(() => selection),
    getModel: vi.fn(() => model),
    getAction: vi.fn(() => ({ run: actionRun })),
    trigger: vi.fn(),
    pushUndoStop: vi.fn(),
    executeEdits: vi.fn(),
    __actionRun: actionRun,
  };
}

const smartSelectManager = {
  expandSelection: vi.fn().mockResolvedValue(undefined),
  shrinkSelection: vi.fn(),
};

describe("EditorBreadcrumbs", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("routes go-to-line and search-jump events only to the active editor instance", () => {
    const activeEditor = createEditorMock();
    const inactiveEditor = createEditorMock();

    render(() => (
      <>
        <EditorBreadcrumbs
          editor={() => activeEditor as any}
          monaco={() => ({}) as any}
          activeFile={() =>
            ({ id: "active", path: "/workspace/project/src/active.ts" }) as any
          }
          isActiveEditor={() => true}
          smartSelectManager={smartSelectManager}
        />
        <EditorBreadcrumbs
          editor={() => inactiveEditor as any}
          monaco={() => ({}) as any}
          activeFile={() =>
            ({ id: "inactive", path: "/workspace/project/src/inactive.ts" }) as any
          }
          isActiveEditor={() => false}
          smartSelectManager={smartSelectManager}
        />
      </>
    ));

    window.dispatchEvent(
      new CustomEvent("editor:goto-line", {
        detail: { line: 12, column: 5 },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("buffer-search:goto", {
        detail: {
          line: 18,
          column: 7,
          start: 0,
          end: 5,
          length: 5,
          relativeToLine: true,
        },
      }),
    );

    expect(activeEditor.setPosition).toHaveBeenCalledWith({
      lineNumber: 12,
      column: 5,
    });
    expect(activeEditor.setSelection).toHaveBeenCalledWith({
      startLineNumber: 18,
      startColumn: 7,
      endLineNumber: 18,
      endColumn: 12,
    });
    expect(inactiveEditor.setPosition).not.toHaveBeenCalled();
    expect(inactiveEditor.setSelection).not.toHaveBeenCalled();
  });

  it("keeps outline navigation scoped to the active split when the same file is mounted twice", () => {
    const activeEditor = createEditorMock();
    const inactiveEditor = createEditorMock();

    render(() => (
      <>
        <EditorBreadcrumbs
          editor={() => activeEditor as any}
          monaco={() => ({}) as any}
          activeFile={() =>
            ({ id: "shared-file", path: "/workspace/project/src/SearchTarget.ts" }) as any
          }
          isActiveEditor={() => true}
          smartSelectManager={smartSelectManager}
        />
        <EditorBreadcrumbs
          editor={() => inactiveEditor as any}
          monaco={() => ({}) as any}
          activeFile={() =>
            ({ id: "shared-file", path: "/workspace/project/src/SearchTarget.ts" }) as any
          }
          isActiveEditor={() => false}
          smartSelectManager={smartSelectManager}
        />
      </>
    ));

    window.dispatchEvent(
      new CustomEvent("outline:navigate", {
        detail: { fileId: "shared-file", line: 33, column: 4 },
      }),
    );

    expect(activeEditor.setPosition).toHaveBeenCalledWith({
      lineNumber: 33,
      column: 4,
    });
    expect(inactiveEditor.setPosition).not.toHaveBeenCalled();
  });
});
