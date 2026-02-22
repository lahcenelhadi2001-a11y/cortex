/**
 * useWindowEvents - Tauri window lifecycle event handlers
 *
 * Handles:
 * - Close requested: prompts to save dirty files before closing
 * - Focus/Blur: dispatches custom events for subsystems (file watchers, etc.)
 *
 * Must be called inside a component wrapped by OptimizedProviders
 * (requires EditorContext and NotificationsContext).
 */

import { onMount, onCleanup } from "solid-js";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEditor } from "@/context/EditorContext";
import { useNotifications } from "@/context/NotificationsContext";

export function useWindowEvents(): void {
  const editor = useEditor();
  const notifications = useNotifications();

  onMount(() => {
    const appWindow = getCurrentWebviewWindow();
    const cleanups: (() => void)[] = [];

    appWindow.onCloseRequested(async (event) => {
      if (!editor.selectors.hasModifiedFiles()) {
        return;
      }

      event.preventDefault();

      const modifiedCount = editor.selectors.modifiedFileIds().length;
      const label = modifiedCount === 1 ? "1 unsaved file" : `${modifiedCount} unsaved files`;

      notifications.notify({
        type: "warning",
        title: "Unsaved Changes",
        message: `You have ${label}. Save before closing?`,
        toast: true,
        duration: 0,
        actions: [
          { id: "save-close", label: "Save All & Close", variant: "primary" },
          { id: "discard", label: "Don't Save", variant: "danger" },
          { id: "cancel", label: "Cancel" },
        ],
      });

      const handler = (e: Event) => {
        const detail = (e as CustomEvent<{ notificationId: string; actionId: string }>).detail;
        if (!detail) return;
        const { actionId } = detail;

        if (actionId === "save-close") {
          window.dispatchEvent(new CustomEvent("file:save-all"));
          setTimeout(() => appWindow.close(), 200);
        } else if (actionId === "discard") {
          appWindow.destroy();
        }
        window.removeEventListener("notification:action", handler);
      };

      window.addEventListener("notification:action", handler);
      cleanups.push(() => window.removeEventListener("notification:action", handler));
    }).then((unlisten) => {
      cleanups.push(unlisten);
    }).catch((err) => {
      console.error("[useWindowEvents] Failed to listen to close-requested:", err);
    });

    const handleFocus = () => {
      window.dispatchEvent(new CustomEvent("window:focus"));
    };
    const handleBlur = () => {
      window.dispatchEvent(new CustomEvent("window:blur"));
    };

    window.addEventListener("focus", handleFocus, { passive: true });
    window.addEventListener("blur", handleBlur, { passive: true });
    cleanups.push(() => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    });

    onCleanup(() => {
      cleanups.forEach((fn) => fn());
    });
  });
}
