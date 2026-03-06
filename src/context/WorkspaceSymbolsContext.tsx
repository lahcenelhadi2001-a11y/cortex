/**
 * Workspace Symbols Context
 *
 * Provides a system for managing workspace symbol indexing and search:
 * - Index workspace files for symbol extraction
 * - Search symbols by query with optional result limits
 * - Track indexing statistics
 * - Clear and refresh the symbol index
 */

import {
  createContext,
  useContext,
  createSignal,
  onMount,
  JSX,
} from "solid-js";
import { createLogger } from "../utils/logger";
import {
  workspaceSymbolsClear,
  workspaceSymbolsGetStats,
  workspaceSymbolsIndex,
  workspaceSymbolsSearch,
  type IndexStats,
  type WorkspaceSymbolEntry,
} from "@/sdk/workspace-symbols";
import { getProjectPath } from "@/utils/workspace";

const symbolsLogger = createLogger("WorkspaceSymbols");

// ============================================================================
// Types
// ============================================================================

export type SymbolKind =
  | "file"
  | "module"
  | "namespace"
  | "package"
  | "class"
  | "method"
  | "property"
  | "field"
  | "constructor"
  | "enum"
  | "interface"
  | "function"
  | "variable"
  | "constant"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "key"
  | "null"
  | "enumMember"
  | "struct"
  | "event"
  | "operator"
  | "typeParameter";

export interface WorkspaceSymbol extends WorkspaceSymbolEntry {}

interface WorkspaceSymbolsState {
  symbols: WorkspaceSymbol[];
  loading: boolean;
  error: string | null;
  stats: IndexStats | null;
  indexed: boolean;
}

interface WorkspaceSymbolsContextValue {
  state: WorkspaceSymbolsState;
  search: (query: string, maxResults?: number) => Promise<WorkspaceSymbol[]>;
  indexWorkspace: (rootPath: string) => Promise<IndexStats>;
  clearIndex: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

const WorkspaceSymbolsContext = createContext<WorkspaceSymbolsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function WorkspaceSymbolsProvider(props: { children: JSX.Element }) {
  const [symbols, setSymbols] = createSignal<WorkspaceSymbol[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [stats, setStats] = createSignal<IndexStats | null>(null);
  const [indexed, setIndexed] = createSignal(false);

  const resolveWorkspacePath = (): string | null => {
    const workspacePath = getProjectPath().trim();
    return workspacePath.length > 0 ? workspacePath : null;
  };

  onMount(async () => {
    await refreshStats();
  });

  const search = async (
    query: string,
    maxResults?: number,
  ): Promise<WorkspaceSymbol[]> => {
    const workspacePath = resolveWorkspacePath();
    if (!workspacePath) {
      setSymbols([]);
      setIndexed(false);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const result = await workspaceSymbolsSearch(
        workspacePath,
        query,
        maxResults,
      );
      setSymbols(result);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      symbolsLogger.error("Failed to search symbols:", message);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const indexWorkspace = async (rootPath: string): Promise<IndexStats> => {
    setLoading(true);
    setError(null);
    try {
      const result = await workspaceSymbolsIndex(rootPath);
      setStats(result);
      setIndexed(result.indexed);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      symbolsLogger.error("Failed to index workspace:", message);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearIndex = async (): Promise<void> => {
    const workspacePath = resolveWorkspacePath();
    if (!workspacePath) {
      setSymbols([]);
      setStats(null);
      setIndexed(false);
      return;
    }

    setError(null);
    try {
      await workspaceSymbolsClear(workspacePath);
      setSymbols([]);
      setStats(null);
      setIndexed(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      symbolsLogger.error("Failed to clear index:", message);
      setError(message);
      throw err;
    }
  };

  const refreshStats = async (): Promise<void> => {
    const workspacePath = resolveWorkspacePath();
    if (!workspacePath) {
      setStats(null);
      setIndexed(false);
      return;
    }

    try {
      const result = await workspaceSymbolsGetStats(workspacePath);
      setStats(result);
      setIndexed(result.indexed);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      symbolsLogger.error("Failed to refresh stats:", message);
    }
  };

  const value: WorkspaceSymbolsContextValue = {
    get state(): WorkspaceSymbolsState {
      return {
        symbols: symbols(),
        loading: loading(),
        error: error(),
        stats: stats(),
        indexed: indexed(),
      };
    },
    search,
    indexWorkspace,
    clearIndex,
    refreshStats,
  };

  return (
    <WorkspaceSymbolsContext.Provider value={value}>
      {props.children}
    </WorkspaceSymbolsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWorkspaceSymbols() {
  const context = useContext(WorkspaceSymbolsContext);
  if (!context) {
    throw new Error(
      "useWorkspaceSymbols must be used within a WorkspaceSymbolsProvider",
    );
  }
  return context;
}
