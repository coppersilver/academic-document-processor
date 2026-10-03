import { create } from "zustand";
import {
  initBackendConnection,
  checkBackendHealth,
  fetchSettings,
  saveSettings as apiSaveSettings,
} from "../services/api";
import { AppSettings } from "../types";

interface SettingsState {
  backendConnected: boolean;
  settings: AppSettings | null;
  isSettingsOpen: boolean;
  customOutputDir: string;

  initBackend: () => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
  saveSettings: (data: {
    apiKey?: string;
    model: string;
    defaultOutputDir: string;
  }) => Promise<void>;
  setCustomOutputDir: (dir: string) => void;
  selectOutputDir: () => Promise<void>;
  resetOutputDir: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  backendConnected: false,
  settings: null,
  isSettingsOpen: false,
  customOutputDir: "",

  initBackend: async () => {
    try {
      await initBackendConnection();
      const health = await checkBackendHealth();
      if (health.status === "ok") {
        const appSettings = await fetchSettings();
        set({
          backendConnected: true,
          settings: appSettings,
          customOutputDir: appSettings.default_output_dir || "",
        });
      }
    } catch (err) {
      console.error("Failed to connect to backend:", err);
      set({ backendConnected: false });
    }
  },

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  saveSettings: async (data) => {
    try {
      const updated = await apiSaveSettings({
        openrouter_api_key: data.apiKey,
        selected_model: data.model,
        default_output_dir: data.defaultOutputDir,
      });
      set({
        settings: updated,
        customOutputDir: data.defaultOutputDir,
      });
    } catch (err) {
      console.error("Failed to save settings:", err);
      throw err;
    }
  },

  setCustomOutputDir: (dir) => set({ customOutputDir: dir }),

  selectOutputDir: async () => {
    if (window.electronAPI?.selectOutputFolder) {
      const folder = await window.electronAPI.selectOutputFolder();
      if (folder) {
        set({ customOutputDir: folder });
      }
    }
  },

  resetOutputDir: () => set({ customOutputDir: "" }),
}));
