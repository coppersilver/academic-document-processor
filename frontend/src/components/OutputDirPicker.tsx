import React from "react";
import { Folder, FolderOpen, RotateCcw } from "lucide-react";
import { useSettingsStore } from "../stores";

interface OutputDirPickerProps {
  outputDir?: string;
  onSelectDir?: () => void;
  onResetDir?: () => void;
}

export const OutputDirPicker: React.FC<OutputDirPickerProps> = (props) => {
  const storeOutputDir = useSettingsStore((s) => s.customOutputDir);
  const storeSelectDir = useSettingsStore((s) => s.selectOutputDir);
  const storeResetDir = useSettingsStore((s) => s.resetOutputDir);

  const outputDir = props.outputDir !== undefined ? props.outputDir : storeOutputDir;
  const onSelectDir = props.onSelectDir ?? storeSelectDir;
  const onResetDir = props.onResetDir ?? storeResetDir;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
      <div className="flex items-center space-x-2 min-w-0">
        <Folder className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">Output Folder:</span>
        <span className="font-mono text-slate-500 dark:text-slate-400 truncate" title={outputDir || "~/Documents/AcademicProcessorOutputs"}>
          {outputDir ? outputDir : "Default (~/Documents/AcademicProcessorOutputs)"}
        </span>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={onSelectDir}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Change</span>
        </button>
        {outputDir && (
          <button
            onClick={onResetDir}
            className="flex items-center space-x-1 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset to default output folder"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
