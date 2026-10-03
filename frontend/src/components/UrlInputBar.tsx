import React from "react";
import { Globe, X, Link as LinkIcon, Video } from "lucide-react";
import { useDocumentStore } from "../stores";

interface UrlInputBarProps {
  url?: string;
  onUrlChange?: (url: string) => void;
}

export const isYouTubeUrl = (url: string): boolean => {
  return /(?:youtube\.com\/(?:watch\?|shorts\/|live\/|embed\/)|youtu\.be\/)/i.test(url.trim());
};

export const UrlInputBar: React.FC<UrlInputBarProps> = (props) => {
  const storeUrl = useDocumentStore((s) => s.urlInput);
  const storeSetUrl = useDocumentStore((s) => s.setUrlInput);

  const url = props.url !== undefined ? props.url : storeUrl;
  const onUrlChange = props.onUrlChange ?? storeSetUrl;

  const hasUrl = url.trim().length > 0;
  const isYouTube = isYouTubeUrl(url);

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border transition-all text-xs ${
        isYouTube
          ? "bg-red-50/70 dark:bg-red-950/20 border-red-300 dark:border-red-800 shadow-sm"
          : hasUrl
          ? "bg-sky-50/70 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800 shadow-sm"
          : "bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
            isYouTube
              ? "bg-red-500/20 text-red-600 dark:text-red-400"
              : hasUrl
              ? "bg-sky-500/20 text-sky-600 dark:text-sky-400"
              : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
        >
          {isYouTube ? <Video className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
        </div>

        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          {isYouTube ? "YouTube Link:" : "Article / Link URL:"}
        </span>

        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Paste website, article, or YouTube video link (e.g., https://www.youtube.com/watch?v=... or https://arxiv.org/abs/...)..."
            className={`w-full text-xs py-1.5 pl-2.5 pr-8 rounded-lg bg-white dark:bg-slate-800 border text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-colors ${
              isYouTube
                ? "border-red-300 dark:border-red-700 focus:ring-1 focus:ring-red-500 focus:border-red-500"
                : "border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            }`}
          />
          {hasUrl && (
            <button
              type="button"
              onClick={() => onUrlChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
              title="Clear URL and re-enable document actions"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isYouTube ? (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800 shrink-0 text-[11px] font-medium">
          <Video className="w-3 h-3 text-red-500" />
          <span>YouTube Video Detected</span>
        </div>
      ) : hasUrl ? (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-md border border-sky-200 dark:border-sky-800 shrink-0 text-[11px] font-medium">
          <LinkIcon className="w-3 h-3 text-sky-500" />
          <span>Link Mode Active</span>
        </div>
      ) : null}
    </div>
  );
};
