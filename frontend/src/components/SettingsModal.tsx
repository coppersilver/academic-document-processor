import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Cpu,
  Folder,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  BookmarkCheck,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { AppSettings } from "../types";
import { useSettingsStore, usePresetStore } from "../stores";

interface SettingsModalProps {
  isOpen?: boolean;
  settings?: AppSettings | null;
  onClose?: () => void;
  onSave?: (data: {
    apiKey?: string;
    model: string;
    defaultOutputDir: string;
  }) => Promise<void>;
  onSelectFolder?: () => Promise<string | null>;
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const storeIsOpen = useSettingsStore((s) => s.isSettingsOpen);
  const storeSettings = useSettingsStore((s) => s.settings);
  const storeClose = useSettingsStore((s) => s.closeSettings);
  const storeSave = useSettingsStore((s) => s.saveSettings);

  const presets = usePresetStore((s) => s.presets);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const addPreset = usePresetStore((s) => s.addPreset);
  const removePreset = usePresetStore((s) => s.removePreset);
  const resetDefaults = usePresetStore((s) => s.resetDefaults);

  const isOpen = props.isOpen !== undefined ? props.isOpen : storeIsOpen;
  const settings = props.settings !== undefined ? props.settings : storeSettings;
  const onClose = props.onClose ?? storeClose;
  const onSave = props.onSave ?? storeSave;
  const onSelectFolder = props.onSelectFolder ?? (async () => {
    if (window.electronAPI?.selectOutputFolder) {
      return await window.electronAPI.selectOutputFolder();
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<"general" | "presets">("general");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    settings?.selected_model || "nvidia/nemotron-3-ultra-550b-a55b:free"
  );
  const [outputDir, setOutputDir] = useState(settings?.default_output_dir || "");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preset management form state
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (settings) {
        setSelectedModel(settings.selected_model);
        setOutputDir(settings.default_output_dir);
      }
      // Load API key from secure safeStorage
      if (window.electronAPI?.getApiKey) {
        window.electronAPI.getApiKey().then((storedKey) => {
          if (storedKey) setApiKey(storedKey);
        });
      }
      // Load presets
      loadPresets();
    }
  }, [isOpen, settings, loadPresets]);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    const folder = await onSelectFolder();
    if (folder) setOutputDir(folder);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const activeModel = selectedModel.trim();

      // Store in safeStorage if available
      if (window.electronAPI?.storeApiKey && apiKey.trim()) {
        await window.electronAPI.storeApiKey(apiKey.trim());
      }

      await onSave({
        apiKey: apiKey.trim(),
        model: activeModel,
        defaultOutputDir: outputDir.trim(),
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newInstructions.trim()) return;
    setPresetSaving(true);
    try {
      await addPreset(newTitle.trim(), newInstructions.trim());
      setNewTitle("");
      setNewInstructions("");
      setIsAddingPreset(false);
    } catch (err: any) {
      alert(`Failed to add preset: ${err.message || String(err)}`);
    } finally {
      setPresetSaving(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom preset?")) return;
    try {
      await removePreset(id);
    } catch (err: any) {
      alert(`Failed to delete preset: ${err.message || String(err)}`);
    }
  };

  const handleResetPresets = async () => {
    if (!confirm("Restore default academic presets? This will remove custom presets.")) return;
    try {
      await resetDefaults();
    } catch (err: any) {
      alert(`Failed to reset presets: ${err.message || String(err)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-xl w-full overflow-hidden text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold">Application Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-6 pt-2 bg-slate-50 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "general"
                ? "border-brand-600 text-brand-600 dark:text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            General Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
              activeTab === "presets"
                ? "border-brand-600 text-brand-600 dark:text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Instruction Presets</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              {presets.length}
            </span>
          </button>
        </div>

        {activeTab === "general" ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
            {/* OpenRouter API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>OpenRouter API Key</span>
                </label>
                <span className="flex items-center space-x-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>OS Keychain Encrypted</span>
                </span>
              </div>

              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Get an API key from{" "}
                <span className="font-mono text-brand-600 dark:text-brand-400">openrouter.ai</span>. Encrypted at rest via Electron safeStorage.
              </p>
            </div>

            {/* Model Specification */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>OpenRouter Model ID</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">e.g. nvidia/nemotron-3-ultra-550b-a55b:free</span>
              </div>

              <input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="e.g. nvidia/nemotron-3-ultra-550b-a55b:free"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              {/* Quick selection chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "nvidia/nemotron-3-ultra-550b-a55b:free",
                  "z-ai/glm-5.3",
                  "google/gemini-3.8-flash",
                  "xiaomi/mimo-v2.6-pro",
                  "xiaomi/mimo-v2.6-flash",
                  "openai/gpt-6-luna",
                  "deepseek/deepseek-v4.1-flash",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedModel(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                      selectedModel === preset
                        ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 font-semibold shadow-xs"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Output Directory */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Folder className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>Default Output Folder</span>
              </label>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="Leave blank for outputs/ folder next to source file"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-600 font-medium cursor-pointer"
                >
                  Browse...
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-sm transition-all cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Presets Management Tab */
          <div className="p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Saved Prompt Templates</h3>
                <p className="text-[11px] text-slate-400">Manage presets for custom focus instructions on document actions.</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleResetPresets}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  title="Reset to default academic templates"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingPreset(!isAddingPreset)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-[11px] shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingPreset ? "Close Form" : "New Preset"}</span>
                </button>
              </div>
            </div>

            {/* Add Preset Form */}
            {isAddingPreset && (
              <form onSubmit={handleAddPreset} className="p-3.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-950/20 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                <h4 className="font-bold text-brand-700 dark:text-brand-300 flex items-center space-x-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Create New Instruction Preset</span>
                </h4>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Preset Title:</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Neuroscience & Pathology Focus"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Custom Instructions:</label>
                  <textarea
                    required
                    rows={2}
                    value={newInstructions}
                    onChange={(e) => setNewInstructions(e.target.value)}
                    placeholder="e.g. Focus on neuroanatomy, receptor pathways, and synaptic transmission..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingPreset(false)}
                    className="px-3 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={presetSaving || !newTitle.trim() || !newInstructions.trim()}
                    className="px-3.5 py-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    Save Preset
                  </button>
                </div>
              </form>
            )}

            {/* Presets List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-72 overflow-y-auto pr-1">
              {presets.map((preset) => (
                <div key={preset.id} className="py-2.5 flex items-start justify-between gap-3 group">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{preset.title}</span>
                      {preset.is_default && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono">
                          default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.instructions}
                    </p>
                  </div>
                  {!preset.is_default && (
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer shrink-0 mt-0.5"
                      title="Delete preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
