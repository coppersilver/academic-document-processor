import React, { useState, useEffect, useCallback } from "react";
import {
  initBackendConnection,
  checkBackendHealth,
  fetchSettings,
  saveSettings,
  inspectFiles,
  enqueueDocumentTask,
  fetchTasksHistory,
  cancelRunningTask,
  subscribeToQueueEvents,
} from "./services/api";
import { AppSettings, InspectResult, TaskItem } from "./types";
import { Header } from "./components/Header";
import { DocumentPicker } from "./components/DocumentPicker";
import { OutputDirPicker } from "./components/OutputDirPicker";
import { UrlInputBar } from "./components/UrlInputBar";
import { ActionGrid } from "./components/ActionGrid";
import { QueueList } from "./components/QueueList";
import { SettingsModal } from "./components/SettingsModal";
import { MarkdownPreviewWindow } from "./components/MarkdownPreviewWindow";

export const App: React.FC = () => {
  const [isPreview, setIsPreview] = useState(
    typeof window !== "undefined" && window.location.hash.startsWith("#preview")
  );

  useEffect(() => {
    const handleHashChange = () => {
      setIsPreview(window.location.hash.startsWith("#preview"));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (isPreview) {
    return <MarkdownPreviewWindow />;
  }

  const [backendConnected, setBackendConnected] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [urlInput, setUrlInput] = useState<string>("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [inspectData, setInspectData] = useState<InspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [customOutputDir, setCustomOutputDir] = useState<string>("");

  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Initialize backend connection and load initial state
  useEffect(() => {
    let unsubscribeSSE: (() => void) | null = null;

    async function init() {
      try {
        await initBackendConnection();
        const health = await checkBackendHealth();
        if (health.status === "ok") {
          setBackendConnected(true);

          const appSettings = await fetchSettings();
          setSettings(appSettings);
          setCustomOutputDir(appSettings.default_output_dir || "");

          // Load tasks history from SQLite
          const history = await fetchTasksHistory();
          setTasks(history);

          // Subscribe to real-time SSE task updates
          unsubscribeSSE = subscribeToQueueEvents((eventType, data) => {
            console.log(`[SSE Event] ${eventType}:`, data);
            setTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === data.id);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...data };
                return updated;
              } else {
                return [data, ...prev];
              }
            });
          });
        }
      } catch (err) {
        console.error("Failed to connect to backend:", err);
        setBackendConnected(false);
      }
    }

    init();

    return () => {
      if (unsubscribeSSE) unsubscribeSSE();
    };
  }, []);

  // Re-inspect documents whenever selectedPaths changes
  const runInspect = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      setInspectData(null);
      return;
    }
    setInspecting(true);
    try {
      const result = await inspectFiles(paths);
      setInspectData(result);
    } catch (err) {
      console.error("Inspection error:", err);
    } finally {
      setInspecting(false);
    }
  }, []);

  const handleSelectDocuments = async () => {
    if (window.electronAPI?.selectDocuments) {
      const files = await window.electronAPI.selectDocuments();
      if (files && files.length > 0) {
        const merged = Array.from(new Set([...selectedPaths, ...files]));
        setSelectedPaths(merged);
        runInspect(merged);
      }
    }
  };

  const handleFilesDropped = (paths: string[]) => {
    const merged = Array.from(new Set([...selectedPaths, ...paths]));
    setSelectedPaths(merged);
    runInspect(merged);
  };

  const handleRemoveDocument = (pathToRemove: string) => {
    const updated = selectedPaths.filter((p) => p !== pathToRemove);
    setSelectedPaths(updated);
    runInspect(updated);
  };

  const handleClearAll = () => {
    setSelectedPaths([]);
    setInspectData(null);
  };

  const handleSelectOutputDir = async () => {
    if (window.electronAPI?.selectOutputFolder) {
      const folder = await window.electronAPI.selectOutputFolder();
      if (folder) {
        setCustomOutputDir(folder);
      }
    }
  };

  const handleResetOutputDir = () => {
    setCustomOutputDir("");
  };

  const handleTriggerAction = async (actionType: string, customInstructions?: string) => {
    const isUrlAction = actionType === "extract_article" || Boolean(urlInput && urlInput.trim().length > 0);

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

        setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
      } catch (err: any) {
        alert(`Could not start task: ${err.message || String(err)}`);
      }
      return;
    }

    if (selectedPaths.length === 0) return;

    if (!settings?.has_api_key) {
      setSettingsOpen(true);
      return;
    }

    const filenames = selectedPaths.map((p) => p.split("/").pop() || p.split("\\").pop() || p);

    try {
      const newTask = await enqueueDocumentTask(
        filenames,
        selectedPaths,
        actionType,
        customOutputDir || undefined,
        customInstructions
      );

      setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
    } catch (err: any) {
      alert(`Could not start task: ${err.message || String(err)}`);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    await cancelRunningTask(taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "CANCELLED" as const } : t))
    );
  };

  const handleRevealFile = async (outputPath: string) => {
    if (window.electronAPI?.revealFile) {
      await window.electronAPI.revealFile(outputPath);
    }
  };

  const handleSaveSettings = async (data: {
    apiKey?: string;
    model: string;
    defaultOutputDir: string;
  }) => {
    const updated = await saveSettings({
      openrouter_api_key: data.apiKey,
      selected_model: data.model,
      default_output_dir: data.defaultOutputDir,
    });
    setSettings(updated);
    setCustomOutputDir(data.defaultOutputDir);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100/70 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <Header
        backendConnected={backendConnected}
        settings={settings}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Output Directory Bar */}
        <OutputDirPicker
          outputDir={customOutputDir}
          onSelectDir={handleSelectOutputDir}
          onResetDir={handleResetOutputDir}
        />

        {/* URL Input Bar - placed between Output Folder and Target Documents */}
        <UrlInputBar
          url={urlInput}
          onUrlChange={setUrlInput}
        />

        {/* Document Selection Card */}
        <DocumentPicker
          selectedPaths={selectedPaths}
          inspectData={inspectData}
          inspecting={inspecting}
          onSelectDocuments={handleSelectDocuments}
          onRemoveDocument={handleRemoveDocument}
          onClearAll={handleClearAll}
          onFilesDropped={handleFilesDropped}
        />

        {/* Action Grid */}
        <ActionGrid
          documentCount={selectedPaths.length}
          urlInput={urlInput}
          onTriggerAction={handleTriggerAction}
        />

        {/* Real-time Queue & History */}
        <QueueList
          tasks={tasks}
          onCancelTask={handleCancelTask}
          onRevealFile={handleRevealFile}
        />
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onSelectFolder={async () => {
          if (window.electronAPI?.selectOutputFolder) {
            return await window.electronAPI.selectOutputFolder();
          }
          return null;
        }}
      />
    </div>
  );
};
