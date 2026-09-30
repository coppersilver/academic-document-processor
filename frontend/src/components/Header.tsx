import { GraduationCap, Settings as SettingsIcon } from "lucide-react";
import { AppSettings } from "../types";

interface HeaderProps {
  backendConnected: boolean;
  settings: AppSettings | null;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendConnected,
  settings,
  onOpenSettings,
}) => {
  const needsApiKey = settings && !settings.has_api_key;

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3.5 flex items-center justify-between shadow-sm select-none">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold shadow-inner">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            Academic Document Processor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Intelligent extraction, dates & synthesis workflow
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Backend Connection Pill */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              backendConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-slate-600 dark:text-slate-300">
            {backendConnected ? "Backend Ready" : "Connecting..."}
          </span>
        </div>

        {/* Active Model Pill */}
        {settings?.selected_model && (
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <span>Model: {settings.selected_model.split("/")[1] || settings.selected_model}</span>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          title="App Settings"
        >
          <SettingsIcon className="w-5 h-5" />
          {needsApiKey && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-800" />
          )}
        </button>
      </div>
    </header>
  );
};
