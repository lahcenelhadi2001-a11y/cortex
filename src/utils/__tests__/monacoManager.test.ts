import { beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => {
  const instances: Array<{ kind: string }> = [];

  const createWorker = (kind: string) => {
    const WorkerMock = class {
      kind = kind;
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();

      constructor() {
        instances.push({ kind });
      }
    };

    return vi.fn(WorkerMock);
  };

  return {
    editor: createWorker("editor"),
    json: createWorker("json"),
    css: createWorker("css"),
    html: createWorker("html"),
    ts: createWorker("typescript"),
    defineTheme: vi.fn(),
  };
});

vi.mock("monaco-editor", () => ({
  editor: {
    defineTheme: workerMocks.defineTheme,
  },
}));

vi.mock("monaco-editor/esm/vs/editor/editor.worker.js?worker", () => ({
  default: workerMocks.editor,
}));

vi.mock("monaco-editor/esm/vs/language/json/json.worker.js?worker", () => ({
  default: workerMocks.json,
}));

vi.mock("monaco-editor/esm/vs/language/css/css.worker.js?worker", () => ({
  default: workerMocks.css,
}));

vi.mock("monaco-editor/esm/vs/language/html/html.worker.js?worker", () => ({
  default: workerMocks.html,
}));

vi.mock("monaco-editor/esm/vs/language/typescript/ts.worker.js?worker", () => ({
  default: workerMocks.ts,
}));

describe("MonacoManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment;
  });

  it("configures Monaco workers so Monaco stays off the main thread", async () => {
    const { MonacoManager } = await import("../monacoManager");

    const manager = MonacoManager.getInstance();
    await manager.ensureLoaded();

    const environment = (globalThis as typeof globalThis & {
      MonacoEnvironment?: { getWorker?: (workerId: string, label: string) => { kind: string } };
    }).MonacoEnvironment;

    expect(environment?.getWorker).toBeTypeOf("function");
    expect(environment?.getWorker?.("", "json")).toMatchObject({ kind: "json" });
    expect(environment?.getWorker?.("", "scss")).toMatchObject({ kind: "css" });
    expect(environment?.getWorker?.("", "handlebars")).toMatchObject({ kind: "html" });
    expect(environment?.getWorker?.("", "typescript")).toMatchObject({ kind: "typescript" });
    expect(environment?.getWorker?.("", "unknown")).toMatchObject({ kind: "editor" });

    expect(workerMocks.json).toHaveBeenCalledTimes(1);
    expect(workerMocks.css).toHaveBeenCalledTimes(1);
    expect(workerMocks.html).toHaveBeenCalledTimes(1);
    expect(workerMocks.ts).toHaveBeenCalledTimes(1);
    expect(workerMocks.editor).toHaveBeenCalledTimes(1);
    expect(workerMocks.defineTheme).toHaveBeenCalledWith("cortex-dark", expect.any(Object));

    MonacoManager.reset();
  });
});
