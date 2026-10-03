import React, { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Upload,
  X,
  AlertTriangle,
  Sparkles,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { useDocumentStore } from "../stores";
import { InspectResult } from "../types";

interface DocumentPickerProps {
  selectedPaths?: string[];
  inspectData?: InspectResult | null;
  inspecting?: boolean;
  onSelectDocuments?: () => void;
  onRemoveDocument?: (path: string) => void;
  onClearAll?: () => void;
  onFilesDropped?: (paths: string[]) => void;
}

export const DocumentPicker: React.FC<DocumentPickerProps> = (props) => {
  const storeSelectedPaths = useDocumentStore((s) => s.selectedPaths);
  const storeInspectData = useDocumentStore((s) => s.inspectData);
  const storeInspecting = useDocumentStore((s) => s.inspecting);
  const storeSelectDocuments = useDocumentStore((s) => s.selectDocuments);
  const storeRemoveDocument = useDocumentStore((s) => s.removeDocument);
  const storeClearAll = useDocumentStore((s) => s.clearAllDocuments);
  const storeAddDocuments = useDocumentStore((s) => s.addDocuments);

  const selectedPaths = props.selectedPaths !== undefined ? props.selectedPaths : storeSelectedPaths;
  const inspectData = props.inspectData !== undefined ? props.inspectData : storeInspectData;
  const inspecting = props.inspecting !== undefined ? props.inspecting : storeInspecting;
  const onSelectDocuments = props.onSelectDocuments ?? storeSelectDocuments;
  const onRemoveDocument = props.onRemoveDocument ?? storeRemoveDocument;
  const onClearAll = props.onClearAll ?? storeClearAll;
  const onFilesDropped = props.onFilesDropped ?? storeAddDocuments;

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        let fPath = "";
        if (window.electronAPI?.getFilePath) {
          try {
            fPath = window.electronAPI.getFilePath(file);
          } catch {
            fPath = "";
          }
        }
        if (!fPath) {
          fPath = (file as any).path || "";
        }
        if (fPath) paths.push(fPath);
      }
      if (paths.length > 0) {
        onFilesDropped(paths);
      }
    }
  };

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FileText className="w-4 h-4 text-rose-500 shrink-0" />;
      case "docx":
      case "doc":
        return <FileSpreadsheet className="w-4 h-4 text-blue-500 shrink-0" />;
      case "pptx":
      case "ppt":
        return <Presentation className="w-4 h-4 text-amber-500 shrink-0" />;
      case "txt":
      case "md":
      default:
        return <FileCode className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasFiles = selectedPaths.length > 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
      {/* Title Bar with Document Counter, Token Counter, and Total File Size */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1.5">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Target Documents
            </h2>
          </div>

          {hasFiles && (
            <>
              {/* Document Counter */}
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                {selectedPaths.length} {selectedPaths.length === 1 ? "document" : "documents"}
              </span>

              {/* Token Counter next to document counter in title bar */}
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-mono text-xs bg-slate-100 dark:bg-slate-900 text-brand-600 dark:text-brand-400 font-semibold border border-slate-200 dark:border-slate-700">
                <Sparkles className="w-3 h-3 text-brand-500" />
                <span>
                  {inspecting
                    ? "Calculating tokens..."
                    : `~${inspectData?.total_tokens.toLocaleString() ?? 0} tokens`}
                </span>
              </span>

              {/* Total File Size */}
              {inspectData && (
                <span className="text-xs text-slate-400 font-mono">
                  ({formatFileSize(inspectData.total_size)})
                </span>
              )}
            </>
          )}
        </div>

        {hasFiles && (
          <button
            onClick={onSelectDocuments}
            className="flex items-center space-x-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add more</span>
          </button>
        )}
      </div>

      {/* Row under the title bar / token counter: Clear All Button */}
      {hasFiles && (
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            onClick={onClearAll}
            className="flex items-center space-x-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors py-0.5 font-medium cursor-pointer"
            title="Remove all selected documents"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear all</span>
          </button>

          {/* Large Document Soft Warning */}
          {inspectData?.is_large && (
            <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Large document collection (&gt; 25k tokens). May take longer to process.
              </span>
            </div>
          )}
        </div>
      )}

      {!hasFiles ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onSelectDocuments}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOver
              ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 scale-[0.99]"
              : "border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/80"
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Choose or drop academic document(s)
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Supports <span className="font-medium text-slate-600 dark:text-slate-400">PDF, DOCX, PPTX, TXT, Markdown</span> (single or multiple)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Selected File Chips List */}
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
            {selectedPaths.map((fp) => {
              const fileName = fp.split("/").pop() || fp.split("\\").pop() || fp;
              const docInfo = inspectData?.files.find((f) => f.file_path === fp || f.file_name === fileName);

              return (
                <div
                  key={fp}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs group transition-all"
                  title={fp}
                >
                  {getFileIcon(fp)}
                  <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                    {fileName}
                  </span>
                  {docInfo && (
                    <span className="text-slate-400 text-[11px]">
                      ({formatFileSize(docInfo.file_size)})
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveDocument(fp);
                    }}
                    className="text-slate-400 hover:text-rose-500 rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
