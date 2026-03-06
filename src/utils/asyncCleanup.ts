export type AsyncCleanup = (() => void) | undefined | null;

export interface AsyncCleanupRegistrar {
  add: (cleanup: AsyncCleanup) => void;
  dispose: () => void;
  isDisposed: () => boolean;
}

export function createAsyncCleanupRegistrar(): AsyncCleanupRegistrar {
  let disposed = false;
  const cleanups: Array<() => void> = [];

  const add = (cleanup: AsyncCleanup) => {
    if (!cleanup) {
      return;
    }

    if (disposed) {
      cleanup();
      return;
    }

    cleanups.push(cleanup);
  };

  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  };

  return {
    add,
    dispose,
    isDisposed: () => disposed,
  };
}
