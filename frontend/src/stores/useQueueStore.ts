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
  triggerAction: (actionType: string, customInstructions?: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  revealFile: (outputPath: string) => Promise<void>;
  cleanupSSE: () => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  tasks: [],
  unsubscribeSSE: null,

  initQueue: async () => {
    try {
      // 1. Fetch initial task history from SQLite
      const history = await fetchTasksHistory();
      set({ tasks: history });

      // 2. Cleanup any prior SSE listener
      get().cleanupSSE();

      // 3. Subscribe to real-time SSE task updates
      const unsub = subscribeToQueueEvents((_eventType, data) => {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === data.id);
          if (idx !== -1) {
            const updated = [...state.tasks];
            updated[idx] = { ...updated[idx], ...data };
            return { tasks: updated };
          } else {
            return { tasks: [data, ...state.tasks] };
          }
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

        set((state) => ({
          tasks: [newTask, ...state.tasks.filter((t) => t.id !== newTask.id)],
        }));
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

      set((state) => ({
        tasks: [newTask, ...state.tasks.filter((t) => t.id !== newTask.id)],
      }));
    } catch (err: any) {
      alert(`Could not start task: ${err.message || String(err)}`);
    }
  },

  cancelTask: async (taskId: string) => {
    try {
      await apiCancelTask(taskId);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: "CANCELLED" as const } : t
        ),
      }));
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
    const unsub = get().unsubscribeSSE;
    if (unsub) {
      unsub();
      set({ unsubscribeSSE: null });
    }
  },
}));
