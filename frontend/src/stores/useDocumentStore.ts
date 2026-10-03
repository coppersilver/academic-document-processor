import { create } from "zustand";
import { inspectFiles } from "../services/api";
import { InspectResult } from "../types";

interface DocumentState {
  selectedPaths: string[];
  inspectData: InspectResult | null;
  inspecting: boolean;
  urlInput: string;

  setUrlInput: (url: string) => void;
  runInspect: (paths: string[]) => Promise<void>;
  selectDocuments: () => Promise<void>;
  addDocuments: (paths: string[]) => Promise<void>;
  removeDocument: (pathToRemove: string) => Promise<void>;
  clearAllDocuments: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  selectedPaths: [],
  inspectData: null,
  inspecting: false,
  urlInput: "",

  setUrlInput: (url: string) => set({ urlInput: url }),

  runInspect: async (paths: string[]) => {
    if (paths.length === 0) {
      set({ inspectData: null, inspecting: false });
      return;
    }
    set({ inspecting: true });
    try {
      const result = await inspectFiles(paths);
      set({ inspectData: result });
    } catch (err) {
      console.error("Inspection error:", err);
    } finally {
      set({ inspecting: false });
    }
  },

  selectDocuments: async () => {
    if (window.electronAPI?.selectDocuments) {
      const files = await window.electronAPI.selectDocuments();
      if (files && files.length > 0) {
        await get().addDocuments(files);
      }
    }
  },

  addDocuments: async (paths: string[]) => {
    const current = get().selectedPaths;
    const merged = Array.from(new Set([...current, ...paths]));
    set({ selectedPaths: merged });
    await get().runInspect(merged);
  },

  removeDocument: async (pathToRemove: string) => {
    const updated = get().selectedPaths.filter((p) => p !== pathToRemove);
    set({ selectedPaths: updated });
    await get().runInspect(updated);
  },

  clearAllDocuments: () => {
    set({ selectedPaths: [], inspectData: null, inspecting: false });
  },
}));
