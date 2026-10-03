import { create } from "zustand";
import {
  fetchPresets,
  createPreset as apiCreatePreset,
  deletePreset as apiDeletePreset,
  resetPresets as apiResetPresets,
} from "../services/api";
import { InstructionPreset } from "../types";

interface PresetState {
  presets: InstructionPreset[];
  selectedPresetId: string | null;
  loading: boolean;

  loadPresets: () => Promise<void>;
  selectPreset: (id: string | null) => void;
  addPreset: (title: string, instructions: string) => Promise<InstructionPreset>;
  removePreset: (id: string) => Promise<void>;
  resetDefaults: () => Promise<void>;
}

export const usePresetStore = create<PresetState>((set) => ({
  presets: [],
  selectedPresetId: null,
  loading: false,

  loadPresets: async () => {
    set({ loading: true });
    try {
      const data = await fetchPresets();
      set({ presets: data, loading: false });
    } catch (err) {
      console.error("Could not load presets:", err);
      set({ loading: false });
    }
  },

  selectPreset: (id: string | null) => set({ selectedPresetId: id }),

  addPreset: async (title: string, instructions: string) => {
    try {
      const created = await apiCreatePreset(title, instructions);
      set((state) => ({
        presets: [...state.presets, created],
        selectedPresetId: created.id,
      }));
      return created;
    } catch (err) {
      console.error("Could not save preset:", err);
      throw err;
    }
  },

  removePreset: async (id: string) => {
    try {
      await apiDeletePreset(id);
      set((state) => ({
        presets: state.presets.filter((p) => p.id !== id),
        selectedPresetId: state.selectedPresetId === id ? null : state.selectedPresetId,
      }));
    } catch (err) {
      console.error("Could not delete preset:", err);
      throw err;
    }
  },

  resetDefaults: async () => {
    try {
      const restored = await apiResetPresets();
      set({ presets: restored, selectedPresetId: null });
    } catch (err) {
      console.error("Could not reset presets:", err);
      throw err;
    }
  },
}));
