/**
 * Workspace Store — Zustand-based state management for workspace layout and files
 *
 * Manages the active project, open files, sidebar/panel visibility and sizing,
 * activity bar selection, and active panel tab. Uses solid-zustand for SolidJS
 * reactivity and zustand/immer for immutable state updates.
 *
 * @module store/workspace
 */

import { create } from "solid-zustand";
import { immer } from "zustand/middleware/immer";
import type { CursorPosition, Selection } from "@/types/editor";

// ============================================================================
// Types
// ============================================================================

/** State for a single open file in the editor */
export interface FileState {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
  modified: boolean;
  cursorPosition?: CursorPosition;
  cursors?: CursorPosition[];
  selections?: Selection[];
}

/** Active panel tab identifiers */
export type PanelId =
  | "terminal"
  | "output"
  | "problems"
  | "debug-console"
  | "ports"
  | "comments"
  | "gitlens";

/** Activity bar item identifiers */
export type ActivityBarItem =
  | "explorer"
  | "search"
  | "git"
  | "debug"
  | "extensions"
  | "testing"
  | "remote"
  | "accounts"
  | "settings";

/** Workspace store state */
export interface WorkspaceState {
  activeProject: string | null;
  openFiles: Record<string, FileState>;
  activeFileId: string | null;
  sidebarWidth: number;
  sidebarVisible: boolean;
  panelHeight: number;
  panelVisible: boolean;
  activePanel: PanelId;
  activityBarSelection: ActivityBarItem;
}

/** Workspace store actions */
export interface WorkspaceActions {
  setActiveProject: (path: string | null) => void;
  openFile: (file: FileState) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string | null) => void;
  updateFileContent: (fileId: string, content: string) => void;
  setFileModified: (fileId: string, modified: boolean) => void;
  updateFileCursor: (fileId: string, position: CursorPosition) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setPanelHeight: (height: number) => void;
  togglePanel: () => void;
  setPanelVisible: (visible: boolean) => void;
  setActivePanel: (panel: PanelId) => void;
  setActivityBarSelection: (item: ActivityBarItem) => void;
}

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_SIDEBAR_WIDTH = 260;
const DEFAULT_PANEL_HEIGHT = 200;

// ============================================================================
// Store
// ============================================================================

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  immer((set) => ({
    activeProject: null,
    openFiles: {},
    activeFileId: null,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    sidebarVisible: true,
    panelHeight: DEFAULT_PANEL_HEIGHT,
    panelVisible: false,
    activePanel: "terminal",
    activityBarSelection: "explorer",

    setActiveProject: (path) =>
      set((state) => {
        state.activeProject = path;
      }),

    openFile: (file) =>
      set((state) => {
        state.openFiles[file.id] = file;
        state.activeFileId = file.id;
      }),

    closeFile: (fileId) =>
      set((state) => {
        delete state.openFiles[fileId];
        if (state.activeFileId === fileId) {
          const remaining = Object.keys(state.openFiles);
          state.activeFileId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
      }),

    setActiveFile: (fileId) =>
      set((state) => {
        state.activeFileId = fileId;
      }),

    updateFileContent: (fileId, content) =>
      set((state) => {
        const file = state.openFiles[fileId];
        if (file) {
          file.content = content;
          file.modified = true;
        }
      }),

    setFileModified: (fileId, modified) =>
      set((state) => {
        const file = state.openFiles[fileId];
        if (file) {
          file.modified = modified;
        }
      }),

    updateFileCursor: (fileId, position) =>
      set((state) => {
        const file = state.openFiles[fileId];
        if (file) {
          file.cursorPosition = position;
        }
      }),

    setSidebarWidth: (width) =>
      set((state) => {
        state.sidebarWidth = Math.max(150, Math.min(600, width));
      }),

    toggleSidebar: () =>
      set((state) => {
        state.sidebarVisible = !state.sidebarVisible;
      }),

    setSidebarVisible: (visible) =>
      set((state) => {
        state.sidebarVisible = visible;
      }),

    setPanelHeight: (height) =>
      set((state) => {
        state.panelHeight = Math.max(100, Math.min(800, height));
      }),

    togglePanel: () =>
      set((state) => {
        state.panelVisible = !state.panelVisible;
      }),

    setPanelVisible: (visible) =>
      set((state) => {
        state.panelVisible = visible;
      }),

    setActivePanel: (panel) =>
      set((state) => {
        state.activePanel = panel;
        if (!state.panelVisible) {
          state.panelVisible = true;
        }
      }),

    setActivityBarSelection: (item) =>
      set((state) => {
        state.activityBarSelection = item;
        if (!state.sidebarVisible) {
          state.sidebarVisible = true;
        }
      }),
  }))
);
