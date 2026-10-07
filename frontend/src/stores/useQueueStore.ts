import { create } from "zustand";
import {
  fetchTasksHistory,
  cancelRunningTask as apiCancelTask,
  subscribeToQueueEvents,
  enqueueDocumentTask,
} from "../services/api";
import { TaskItem } from "../types";
import { useDocumentStore } from "./useDocumentStore";
import { useSettingsStore } from "./useSettingsStore";

interface QueueState {
  tasks: TaskItem[];
  unsubscribeSSE: (() => void) | null;

  initQueue: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  triggerAction: (actionType: string, customInstructions?: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  revealFile: (outputPath: string) => Promise<void>;
  cleanupSSE: () => void;
}

let activePollingTimer: ReturnType<typeof setInterval> | null = null;

const checkAndManagePolling = (
  tasks: TaskItem[],
  refreshFn: () => Promise<void>
) => {
  const hasActive = tasks.some(
    (t) => t.status === "PENDING" || t.status === "PROCESSING"
  );
  if (hasActive) {
    if (!activePollingTimer) {
      activePollingTimer = setInterval(() => {
        refreshFn();
      }, 2000);
    }
  } else {
    if (activePollingTimer) {
      clearInterval(activePollingTimer);
      activePollingTimer = null;
    }
  }
};

export const useQueueStore = create<QueueState>((set, get) => ({
  tasks: [],
  unsubscribeSSE: null,

  refreshTasks: async () => {
    try {
      const freshTasks = await fetchTasksHistory();
      set({ tasks: freshTasks });
      const hasActive = freshTasks.some(
        (t) => t.status === "PENDING" || t.status === "PROCESSING"
      );
      if (!hasActive && activePollingTimer) {
        clearInterval(activePollingTimer);
        activePollingTimer = null;
      }
    } catch (err) {
      console.warn("Polling task history failed:", err);
    }
  },

  initQueue: async () => {
    try {
      // 1. Fetch initial task history from SQLite
      const history = await fetchTasksHistory();
      set({ tasks: history });
      checkAndManagePolling(history, get().refreshTasks);

      // 2. Cleanup any prior SSE listener
      get().cleanupSSE();

      // 3. Subscribe to real-time SSE task updates
      const unsub = subscribeToQueueEvents((_eventType, data) => {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === data.id);
          let updated: TaskItem[];
          if (idx !== -1) {
            updated = [...state.tasks];
            updated[idx] = { ...updated[idx], ...data };
          } else {
            updated = [data, ...state.tasks];
          }
          checkAndManagePolling(updated, get().refreshTasks);
          return { tasks: updated };
        });
      });

      set({ unsubscribeSSE: unsub });
    } catch (err) {
      console.error("Failed to initialize queue history and SSE stream:", err);
    }
  },

  triggerAction: async (actionType: string, customInstructions?: string) => {
    const { selectedPaths, urlInput } = useDocumentStore.getState();
    const { settings, customOutputDir, openSettings } = useSettingsStore.getState();

    const isUrlAction =
      actionType === "extract_article" ||
      actionType === "youtube_transcript" ||
      Boolean(urlInput && urlInput.trim().length > 0);

    if (isUrlAction) {
      const cleanUrl = urlInput.trim();
      if (!cleanUrl) return;

      try {
        const newTask = await enqueueDocumentTask(
          [cleanUrl],
          [cleanUrl],
          actionType,
          customOutputDir || undefined,
          customInstructions,
          cleanUrl
        );

        set((state) => {
          const nextTasks = [newTask, ...state.tasks.filter((t) => t.id !== newTask.id)];
          checkAndManagePolling(nextTasks, get().refreshTasks);
          return { tasks: nextTasks };
        });
      } catch (err: any) {
        alert(`Could not start task: ${err.message || String(err)}`);
      }
      return;
    }

    if (selectedPaths.length === 0) return;

    if (!settings?.has_api_key) {
      openSettings();
      return;
    }

    const filenames = selectedPaths.map(
      (p) => p.split("/").pop() || p.split("\\").pop() || p
    );

    try {
      const newTask = await enqueueDocumentTask(
        filenames,
        selectedPaths,
        actionType,
        customOutputDir || undefined,
        customInstructions
      );

      set((state) => {
        const nextTasks = [newTask, ...state.tasks.filter((t) => t.id !== newTask.id)];
        checkAndManagePolling(nextTasks, get().refreshTasks);
        return { tasks: nextTasks };
      });
    } catch (err: any) {
      alert(`Could not start task: ${err.message || String(err)}`);
    }
  },

  cancelTask: async (taskId: string) => {
    try {
      await apiCancelTask(taskId);
      set((state) => {
        const updated = state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: "CANCELLED" as const } : t
        );
        checkAndManagePolling(updated, get().refreshTasks);
        return { tasks: updated };
      });
    } catch (err) {
      console.error("Failed to cancel task:", err);
    }
  },

  revealFile: async (outputPath: string) => {
    if (window.electronAPI?.revealFile) {
      await window.electronAPI.revealFile(outputPath);
    }
  },

  cleanupSSE: () => {
    if (activePollingTimer) {
      clearInterval(activePollingTimer);
      activePollingTimer = null;
    }
    const unsub = get().unsubscribeSSE;
    if (unsub) {
      unsub();
      set({ unsubscribeSSE: null });
    }
  },
}));
