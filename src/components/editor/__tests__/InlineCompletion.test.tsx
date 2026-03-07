/**
 * InlineCompletion Tests
 *
 * Tests for the inline AI completion ghost text component.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { InlineCompletion } from "../InlineCompletion";

const inlineCompletionMocks = vi.hoisted(() => ({
  disposeSharedRegistration: vi.fn(),
  disposeKeybinding: vi.fn(),
  registerWithMonaco: vi.fn(),
  registerKeybindings: vi.fn(),
  getEditorOptions: vi.fn(),
  configure: vi.fn(),
}));

vi.mock("@/hooks/useInlineCompletions", () => ({
  useInlineCompletions: () => ({
    status: () => ({ provider: "test", enabled: true }),
    isLoading: () => false,
    isActive: () => false,
    completionCount: () => 0,
    currentIndex: () => 0,
    registerWithMonaco: inlineCompletionMocks.registerWithMonaco,
    registerKeybindings: inlineCompletionMocks.registerKeybindings,
    getEditorOptions: inlineCompletionMocks.getEditorOptions,
    configure: inlineCompletionMocks.configure,
  }),
}));

describe("InlineCompletion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    inlineCompletionMocks.registerWithMonaco.mockReturnValue({
      dispose: inlineCompletionMocks.disposeSharedRegistration,
    });
    inlineCompletionMocks.registerKeybindings.mockReturnValue([
      { dispose: inlineCompletionMocks.disposeKeybinding },
    ]);
    inlineCompletionMocks.getEditorOptions.mockReturnValue({ inlineSuggest: { enabled: true } });
  });

  describe("Component Definition", () => {
    it("should be defined and be a function", () => {
      expect(InlineCompletion).toBeDefined();
      expect(typeof InlineCompletion).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render without crashing with null editor and monaco", () => {
      expect(() => {
        render(() => (
          <InlineCompletion editor={null} monaco={null} />
        ));
      }).not.toThrow();
    });

    it("should render without crashing with enabled prop", () => {
      expect(() => {
        render(() => (
          <InlineCompletion editor={null} monaco={null} enabled={true} />
        ));
      }).not.toThrow();
    });

    it("should render without crashing with disabled prop", () => {
      expect(() => {
        render(() => (
          <InlineCompletion editor={null} monaco={null} enabled={false} />
        ));
      }).not.toThrow();
    });
  });

  describe("Exports", () => {
    it("should export InlineCompletion as a function component", () => {
      expect(typeof InlineCompletion).toBe("function");
      expect(InlineCompletion.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Registration", () => {
    it("registers Monaco once for a mounted editor and disposes on unmount", () => {
      const editor = { updateOptions: vi.fn() } as any;
      const monaco = {} as any;

      inlineCompletionMocks.registerWithMonaco.mockReturnValue({
        dispose: inlineCompletionMocks.disposeSharedRegistration,
      });
      inlineCompletionMocks.registerKeybindings.mockReturnValue([
        { dispose: inlineCompletionMocks.disposeKeybinding },
      ]);
      inlineCompletionMocks.getEditorOptions.mockReturnValue({ inlineSuggest: { enabled: true } });

      const view = render(() => (
        <InlineCompletion editor={editor} monaco={monaco} />
      ));

      expect(inlineCompletionMocks.registerWithMonaco).toHaveBeenCalledTimes(1);
      expect(inlineCompletionMocks.registerWithMonaco).toHaveBeenCalledWith(monaco);
      expect(inlineCompletionMocks.registerKeybindings).toHaveBeenCalledTimes(1);
      expect(inlineCompletionMocks.registerKeybindings).toHaveBeenCalledWith(monaco, editor);
      expect(editor.updateOptions).toHaveBeenCalled();
      expect(inlineCompletionMocks.disposeSharedRegistration).not.toHaveBeenCalled();

      view.unmount();

      expect(inlineCompletionMocks.disposeSharedRegistration).toHaveBeenCalledTimes(1);
      expect(inlineCompletionMocks.disposeKeybinding).toHaveBeenCalledTimes(1);
    });

    it("shares the Monaco provider registration across multiple mounted editors", () => {
      const firstEditor = { updateOptions: vi.fn() } as any;
      const secondEditor = { updateOptions: vi.fn() } as any;
      const monaco = {} as any;

      inlineCompletionMocks.registerWithMonaco.mockReturnValue({
        dispose: inlineCompletionMocks.disposeSharedRegistration,
      });
      inlineCompletionMocks.registerKeybindings.mockReturnValue([
        { dispose: inlineCompletionMocks.disposeKeybinding },
      ]);

      const firstView = render(() => (
        <InlineCompletion editor={firstEditor} monaco={monaco} />
      ));
      const secondView = render(() => (
        <InlineCompletion editor={secondEditor} monaco={monaco} />
      ));

      expect(inlineCompletionMocks.registerWithMonaco).toHaveBeenCalledTimes(1);
      expect(inlineCompletionMocks.registerKeybindings).toHaveBeenCalledTimes(2);

      firstView.unmount();
      expect(inlineCompletionMocks.disposeSharedRegistration).not.toHaveBeenCalled();

      secondView.unmount();
      expect(inlineCompletionMocks.disposeSharedRegistration).toHaveBeenCalledTimes(1);
      expect(inlineCompletionMocks.disposeKeybinding).toHaveBeenCalledTimes(2);
    });
  });
});
