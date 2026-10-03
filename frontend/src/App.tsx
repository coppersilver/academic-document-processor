import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { DocumentPicker } from "./components/DocumentPicker";
import { OutputDirPicker } from "./components/OutputDirPicker";
import { UrlInputBar } from "./components/UrlInputBar";
import { ActionGrid } from "./components/ActionGrid";
import { QueueList } from "./components/QueueList";
import { SettingsModal } from "./components/SettingsModal";
import { MarkdownPreviewWindow } from "./components/MarkdownPreviewWindow";
import { useSettingsStore, useQueueStore } from "./stores";

export const App: React.FC = () => {
  const [isPreview, setIsPreview] = useState(
    typeof window !== "undefined" && window.location.hash.startsWith("#preview")
  );

  const initBackend = useSettingsStore((s) => s.initBackend);
  const initQueue = useQueueStore((s) => s.initQueue);
  const cleanupSSE = useQueueStore((s) => s.cleanupSSE);

  useEffect(() => {
    const handleHashChange = () => {
      setIsPreview(window.location.hash.startsWith("#preview"));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!isPreview) {
      initBackend();
      initQueue();
    }
    return () => {
      cleanupSSE();
    };
  }, [isPreview, initBackend, initQueue, cleanupSSE]);

  if (isPreview) {
    return <MarkdownPreviewWindow />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100/70 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Output Directory Bar */}
        <OutputDirPicker />

        {/* URL Input Bar - placed between Output Folder and Target Documents */}
        <UrlInputBar />

        {/* Document Selection Card */}
        <DocumentPicker />

        {/* Action Grid */}
        <ActionGrid />

        {/* Real-time Queue & History */}
        <QueueList />
      </main>

      {/* Settings Modal */}
      <SettingsModal />
    </div>
  );
};
