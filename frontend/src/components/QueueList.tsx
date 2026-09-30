import React, { useState, useEffect } from "react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  FolderSearch,
  Cpu,
  Sparkles,
  Inbox,
  AlertCircle,
  FileCheck,
  Eye,
} from "lucide-react";
import { TaskItem } from "../types";

interface QueueListProps {
  tasks: TaskItem[];
  onCancelTask: (taskId: string) => void;
  onRevealFile: (outputPath: string) => void;
}

// Live timer component for active tasks
const LiveTimer: React.FC<{ startTimeIso?: string }> = ({ startTimeIso }) => {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const start = startTimeIso ? new Date(startTimeIso).getTime() : Date.now();
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSec(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimeIso]);

  return <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{elapsedSec}s</span>;
};

export const QueueList: React.FC<QueueListProps> = ({
  tasks,
  onCancelTask,
  onRevealFile,
}) => {
  const getStageDisplay = (task: TaskItem) => {
    if (task.status === "PENDING") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3 h-3" />
          <span>In Queue (Waiting)</span>
        </span>
      );
    }

    if (task.status === "PROCESSING") {
      const isUrlTask = task.action_type === "extract_article" || task.action_type === "youtube_transcript";
      if (isUrlTask) {
        const stepLabel = task.action_type === "youtube_transcript" ? "Fetching Transcript" : "Scraping Article";
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{stepLabel}</span>
            <span>(<LiveTimer startTimeIso={task.created_at} />)</span>
          </span>
        );
      }

      const isExtracting = task.stage === "extracting" || task.queue_type === "doc_converter";
      const isWriting = task.stage === "writing_output";

      if (isExtracting) {
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Step 1/2: Extracting Text</span>
            <span>(<LiveTimer startTimeIso={task.created_at} />)</span>
          </span>
        );
      }

      if (isWriting) {
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <FileCheck className="w-3 h-3" />
            <span>Step 2/2: Saving Markdown</span>
          </span>
        );
      }

      // Default AI inferencing / waiting on OpenRouter
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Loader2 className="w-3 h-3 animate-spin text-purple-600 dark:text-purple-400" />
          <span>Step 2/2: Generating via OpenRouter</span>
          <span>(<LiveTimer startTimeIso={task.created_at} />)</span>
        </span>
      );
    }

    if (task.status === "COMPLETED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          <span>Completed</span>
        </span>
      );
    }

    if (task.status === "FAILED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <XCircle className="w-3 h-3" />
          <span>Failed</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        <Ban className="w-3 h-3" />
        <span>Cancelled</span>
      </span>
    );
  };

  const getWorkerBadge = (task: TaskItem) => {
    const isUrlTask = task.action_type === "extract_article" || task.action_type === "youtube_transcript";
    if (isUrlTask) {
      const isYouTube = task.action_type === "youtube_transcript";
      return (
        <span
          className="inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          title={isYouTube ? "Local YouTube Extractor ($0 cloud tokens)" : "Local Web Scraper ($0 cloud tokens)"}
        >
          <Cpu className="w-3 h-3" />
          <span>{isYouTube ? "local_youtube" : "local_scraper"}</span>
        </span>
      );
    }

    const isDocConverter = task.queue_type === "doc_converter" || task.stage === "extracting";
    if (isDocConverter) {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700" title="Local CPU Worker">
          <Cpu className="w-3 h-3" />
          <span>local_converter</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Cloud AI Worker">
        <Sparkles className="w-3 h-3" />
        <span>openrouter_ai</span>
      </span>
    );
  };

  const formatActionTitle = (type: string) => {
    switch (type.toLowerCase()) {
      case "summary":
        return "Document Summary";
      case "deadlines":
        return "Dates & Deadlines";
      case "key_terms":
        return "Key Terms & Concepts";
      case "group_summary":
        return "Group Summary";
      case "calendar_export":
        return "Calendar Deadlines (.ics)";
      case "bibtex":
        return "BibTeX Citations";
      case "practice_exam":
        return "Practice Exam";
      case "anonymize":
        return "Anonymized Notes";
      case "polish":
        return "Polished Notes";
      case "extract_article":
        return "Web Article Extraction";
      case "youtube_transcript":
        return "YouTube Video Transcript";
      default:
        return type;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
          <span>Task Queue & History</span>
          {tasks.length > 0 && (
            <span className="text-xs font-normal text-slate-400 font-mono">
              ({tasks.length})
            </span>
          )}
        </h2>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Queue is empty</p>
          <p className="text-xs">Choose document(s), select an action, and click the Run button above.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[380px] overflow-y-auto">
          {tasks.map((task) => {
            const hasMultipleDocs = task.filenames.length > 1;
            const primaryFilename = task.filenames[0] || "Unknown Document";
            const isWaitingOnLLM =
              task.status === "PROCESSING" &&
              task.stage !== "extracting" &&
              task.stage !== "writing_output" &&
              task.action_type !== "extract_article" &&
              task.action_type !== "youtube_transcript";

            return (
              <div
                key={task.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {formatActionTitle(task.action_type)}
                    </span>
                    {getWorkerBadge(task)}
                    {getStageDisplay(task)}
                    {task.duration_ms ? (
                      <span className="text-slate-400 text-[11px] font-mono">
                        {(task.duration_ms / 1000).toFixed(1)}s total
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                    <span className="font-medium truncate max-w-[280px]" title={task.filenames.join(", ")}>
                      {hasMultipleDocs
                        ? `${primaryFilename} +${task.filenames.length - 1} more`
                        : primaryFilename}
                    </span>
                    {task.token_count ? (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                          {task.token_count.toLocaleString()} tokens
                        </span>
                      </>
                    ) : null}
                  </div>

                  {/* Dynamic Step Status Message */}
                  {task.status === "PROCESSING" && (
                    <div className="space-y-1">
                      <p className="text-purple-700 dark:text-purple-300 text-[11px] font-medium flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping inline-block" />
                        <span>{task.message || "Generating response with OpenRouter..."}</span>
                      </p>

                      {isWaitingOnLLM && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                          Cloud LLMs generate in real time — long academic documents typically take 10–25s.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {task.error_message && task.status === "FAILED" && (
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] flex items-center space-x-1 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-md border border-rose-200 dark:border-rose-900">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[420px]">{task.error_message}</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  {task.status === "COMPLETED" && task.output_path && (
                    <>
                      {task.output_path.toLowerCase().endsWith(".md") && (
                        <button
                          onClick={() => {
                            if (window.electronAPI?.openPreviewWindow) {
                              window.electronAPI.openPreviewWindow(task.output_path!, task.filenames[0]);
                            }
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white rounded-lg font-medium transition-all shadow-sm cursor-pointer"
                          title="Open formatted document preview in a separate native window"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                      )}

                      <button
                        onClick={() => onRevealFile(task.output_path!)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950 dark:hover:bg-brand-900 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-lg font-medium transition-colors cursor-pointer"
                        title="Reveal output file in Finder / File Explorer"
                      >
                        <FolderSearch className="w-3.5 h-3.5" />
                        <span>Open in Folder</span>
                      </button>
                    </>
                  )}

                  {(task.status === "PENDING" || task.status === "PROCESSING") && (
                    <button
                      onClick={() => onCancelTask(task.id)}
                      className="px-2.5 py-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                      title="Cancel this task"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
