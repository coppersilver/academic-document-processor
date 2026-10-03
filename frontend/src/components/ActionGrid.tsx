import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Calendar,
  BookOpen,
  Library,
  Info,
  CheckCircle2,
  Play,
  Sparkles,
  CalendarCheck,
  BookmarkCheck,
  GraduationCap,
  Sliders,
  ShieldCheck,
  Wand2,
  Globe,
  Video,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { isYouTubeUrl } from "./UrlInputBar";
import { InstructionPreset } from "../types";
import { useDocumentStore, usePresetStore, useQueueStore } from "../stores";

interface ActionGridProps {
  documentCount?: number;
  urlInput?: string;
  onTriggerAction?: (actionType: string, customInstructions?: string) => void;
}

interface ActionDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  isMultiDocOnly?: boolean;
  isSingleDocOnly?: boolean;
  requiresCloudLLM?: boolean;
  targetType?: "document" | "link";
}

export const ActionGrid: React.FC<ActionGridProps> = (props) => {
  const storeDocCount = useDocumentStore((s) => s.selectedPaths.length);
  const storeUrlInput = useDocumentStore((s) => s.urlInput);
  const storeTriggerAction = useQueueStore((s) => s.triggerAction);

  const documentCount = props.documentCount !== undefined ? props.documentCount : storeDocCount;
  const urlInput = props.urlInput !== undefined ? props.urlInput : storeUrlInput;
  const onTriggerAction = props.onTriggerAction ?? storeTriggerAction;

  const presets = usePresetStore((s) => s.presets);
  const selectedPresetId = usePresetStore((s) => s.selectedPresetId);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const selectPreset = usePresetStore((s) => s.selectPreset);
  const addPreset = usePresetStore((s) => s.addPreset);
  const removePreset = usePresetStore((s) => s.removePreset);

  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isCooldown, setIsCooldown] = useState<boolean>(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Presets local UI state
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch presets on mount
  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // Handle outside click:
  // - Dropdown only appears when the text field is clicked
  // - Dropdown remains visible if any preset option is selected
  // - Dropdown hides if the user clicks off the instructions text field (when no preset is selected)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (!selectedPresetId) {
          setIsDropdownOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedPresetId]);

  const handleOpenSaveModal = () => {
    const words = customInstructions.trim().split(/\s+/).slice(0, 4).join(" ");
    setSaveTitle(words || "Custom Focus");
    setShowSavePresetModal(true);
  };

  const handleSavePreset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!saveTitle.trim() || !customInstructions.trim()) return;

    try {
      await addPreset(saveTitle.trim(), customInstructions.trim());
      setIsDropdownOpen(true);
      setShowSavePresetModal(false);
    } catch (err: any) {
      alert(`Could not save preset: ${err.message || String(err)}`);
    }
  };

  const handleDeletePreset = async (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this preset?")) return;
    try {
      await removePreset(presetId);
    } catch (err: any) {
      alert(`Could not delete preset: ${err.message || String(err)}`);
    }
  };

  const handleSelectPreset = (preset: InstructionPreset) => {
    if (selectedPresetId === preset.id) {
      selectPreset(null);
      setCustomInstructions("");
    } else {
      setCustomInstructions(preset.instructions);
      selectPreset(preset.id);
      setIsDropdownOpen(true);
    }
  };

  const hasUrl = Boolean(urlInput && urlInput.trim().length > 0);
  const isYouTube = isYouTubeUrl(urlInput || "");

  const actions: ActionDef[] = [
    {
      id: "summary",
      title: "Document Summary",
      description: "Thorough academic synthesis covering thesis, methodology, key findings, and conclusions.",
      icon: <FileText className="w-5 h-5" />,
      accentBg: "bg-blue-500/10 dark:bg-blue-500/20",
      accentText: "text-blue-600 dark:text-blue-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "group_summary",
      title: "Group Summary & Synthesis",
      description: "Comparative multi-paper synthesis with cross-document matrix, common themes, and differences.",
      icon: <Library className="w-5 h-5" />,
      accentBg: "bg-purple-500/10 dark:bg-purple-500/20",
      accentText: "text-purple-600 dark:text-purple-400",
      isMultiDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "deadlines",
      title: "Dates & Deadlines",
      description: "Chronological table of submission cutoffs, exam dates, lecture milestones, and deliverables.",
      icon: <Calendar className="w-5 h-5" />,
      accentBg: "bg-amber-500/10 dark:bg-amber-500/20",
      accentText: "text-amber-600 dark:text-amber-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "key_terms",
      title: "Key Terms & Concepts",
      description: "Authoritative study glossary of core terminology, theoretical frameworks, equations, and definitions.",
      icon: <BookOpen className="w-5 h-5" />,
      accentBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      accentText: "text-emerald-600 dark:text-emerald-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "calendar_export",
      title: "Export Calendar (.ics)",
      description: "Generate an importable .ics file for Apple, Google, or Outlook calendar with all course deadlines.",
      icon: <CalendarCheck className="w-5 h-5" />,
      accentBg: "bg-teal-500/10 dark:bg-teal-500/20",
      accentText: "text-teal-600 dark:text-teal-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "bibtex",
      title: "BibTeX Citations",
      description: "Extract references and bibliographies into clean, standardized BibTeX entries with DOIs and links.",
      icon: <BookmarkCheck className="w-5 h-5" />,
      accentBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      accentText: "text-indigo-600 dark:text-indigo-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "practice_exam",
      title: "Practice Exam",
      description: "Generate a realistic practice exam with multiple choice, short conceptual questions, and an answer key.",
      icon: <GraduationCap className="w-5 h-5" />,
      accentBg: "bg-rose-500/10 dark:bg-rose-500/20",
      accentText: "text-rose-600 dark:text-rose-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "anonymize",
      title: "Anonymize Document",
      description: "Redact student names, IDs, emails, and institutional markers to share notes or drafts anonymously.",
      icon: <ShieldCheck className="w-5 h-5" />,
      accentBg: "bg-slate-500/10 dark:bg-slate-500/20",
      accentText: "text-slate-600 dark:text-slate-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "polish",
      title: "Polish Notes",
      description: "Clean up messy notes, fix typos, organize sections, and add illustrative examples and explanations.",
      icon: <Wand2 className="w-5 h-5" />,
      accentBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
      accentText: "text-cyan-600 dark:text-cyan-400",
      isSingleDocOnly: true,
      requiresCloudLLM: true,
      targetType: "document",
    },
    {
      id: "extract_article",
      title: "Extract Web Article",
      description: "Extract clean article text without ads, headers, navbars, or sidebars, preserving mathematical formulas in LaTeX.",
      icon: <Globe className="w-5 h-5" />,
      accentBg: "bg-sky-500/10 dark:bg-sky-500/20",
      accentText: "text-sky-600 dark:text-sky-400",
      targetType: "link",
      requiresCloudLLM: false,
    },
    {
      id: "youtube_transcript",
      title: "Extract Video Transcript",
      description: "Extract clean, timestamped lecture transcripts from YouTube videos into study-ready Markdown.",
      icon: <Video className="w-5 h-5" />,
      accentBg: "bg-red-500/10 dark:bg-red-500/20",
      accentText: "text-red-600 dark:text-red-400",
      targetType: "link",
      requiresCloudLLM: false,
    },
  ];

  // Auto-switch action selection based on URL mode (YouTube vs Web Article) or document mode
  useEffect(() => {
    if (hasUrl) {
      if (isYouTube) {
        if (selectedAction !== "youtube_transcript") {
          setSelectedAction("youtube_transcript");
        }
      } else {
        if (selectedAction !== "extract_article") {
          setSelectedAction("extract_article");
        }
      }
    } else {
      if (selectedAction === "extract_article" || selectedAction === "youtube_transcript") {
        if (documentCount === 1) {
          setSelectedAction("summary");
        } else if (documentCount > 1) {
          setSelectedAction("group_summary");
        } else {
          setSelectedAction(null);
        }
      } else if (documentCount === 0) {
        setSelectedAction(null);
      } else if (documentCount > 1 && selectedAction && selectedAction !== "group_summary") {
        setSelectedAction("group_summary");
      } else if (documentCount === 1 && selectedAction === "group_summary") {
        setSelectedAction("summary");
      }
    }
  }, [hasUrl, isYouTube, documentCount]);

  // Instantly re-enable button if a different action card is clicked
  useEffect(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setIsCooldown(false);
  }, [selectedAction]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const canRun = hasUrl
    ? Boolean(
        (selectedAction === "youtube_transcript" && isYouTube) ||
        (selectedAction === "extract_article" && !isYouTube)
      )
    : Boolean(selectedAction && documentCount > 0);

  const handleRunAction = () => {
    if (!selectedAction || !canRun || isCooldown) return;

    onTriggerAction(selectedAction, customInstructions);

    // Disable and turn gray for 0.5s (500ms)
    setIsCooldown(true);
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = setTimeout(() => {
      setIsCooldown(false);
      cooldownTimerRef.current = null;
    }, 500);
  };

  const selectedActDef = actions.find((a) => a.id === selectedAction);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          {hasUrl ? "Web Link Actions" : "Document Actions"}
        </h2>
        <span className="text-xs text-slate-400">
          {hasUrl
            ? "Link mode active (local document actions disabled)"
            : documentCount === 0
            ? "Select a document to enable actions"
            : documentCount === 1
            ? "Single-document mode active"
            : `Multi-document mode active (${documentCount} files)`}
        </span>
      </div>

      {/* Grid of Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {actions.map((act) => {
          let disabled = false;
          let disabledReason = "";

          if (hasUrl) {
            if (act.targetType !== "link") {
              disabled = true;
              disabledReason = "Disabled: Clear URL bar above to process local documents";
            } else if (isYouTube && act.id === "extract_article") {
              disabled = true;
              disabledReason = "Use 'Extract Video Transcript' for YouTube links";
            } else if (!isYouTube && act.id === "youtube_transcript") {
              disabled = true;
              disabledReason = "Requires a YouTube video URL (e.g. youtube.com/watch?v=...)";
            }
          } else {
            if (act.targetType === "link") {
              disabled = true;
              disabledReason =
                act.id === "youtube_transcript"
                  ? "Enter a YouTube video URL in the bar above to enable"
                  : "Enter a website or article URL in the bar above to enable";
            } else if (documentCount === 0) {
              disabled = true;
              disabledReason = "Select at least one document first";
            } else if (act.isSingleDocOnly && documentCount > 1) {
              disabled = true;
              disabledReason = "Optimized for a single document (use Group Summary for multiple files)";
            } else if (act.isMultiDocOnly && documentCount < 2) {
              disabled = true;
              disabledReason = "Requires 2 or more documents";
            }
          }

          const isSelected = selectedAction === act.id;

          return (
            <button
              key={act.id}
              disabled={disabled}
              onClick={() => {
                if (!disabled) setSelectedAction(act.id);
              }}
              title={disabled ? disabledReason : `Select ${act.title}`}
              className={`group text-left p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                disabled
                  ? "opacity-45 bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 cursor-not-allowed select-none"
                  : isSelected
                  ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50/20 dark:bg-brand-950/30 shadow-md cursor-pointer"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-600 hover:shadow-sm cursor-pointer"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${act.accentBg} ${act.accentText} flex items-center justify-center font-bold`}>
                    {act.icon}
                  </div>
                  {isSelected && (
                    <span className="flex items-center space-x-1 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-100/60 dark:bg-brand-950 px-2 py-0.5 rounded-full border border-brand-300 dark:border-brand-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Selected</span>
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1 leading-snug">
                  {act.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {act.description}
                </p>
              </div>

              {disabled && disabledReason && (
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-start space-x-1.5 text-[11px] text-slate-400 italic leading-snug">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="break-words leading-tight">{disabledReason}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Activation Card Below the Grid */}
      <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <span>Action Selected:</span>
              {selectedActDef ? (
                <span className="font-bold text-brand-600 dark:text-brand-400 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{selectedActDef.title}</span>
                </span>
              ) : (
                <span className="text-slate-400 font-normal italic">None (click an action card above)</span>
              )}
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {selectedActDef
                ? hasUrl
                  ? isYouTube
                    ? "Ready. Click the button to extract clean lecture transcript with timestamps."
                    : "Ready. Click the button to extract clean article text and format with KaTeX."
                  : selectedActDef.requiresCloudLLM
                  ? "Ready. Add custom focus instructions if desired, then click Run."
                  : "Ready. Click the button to dispatch this action into the queue."
                : "Choose an action from the grid above to activate."}
            </p>
          </div>

          <button
            disabled={!selectedActDef || !canRun || isCooldown}
            onClick={handleRunAction}
            className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm shrink-0 ${
              isCooldown
                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 cursor-not-allowed select-none"
                : canRun
                ? "bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white shadow-brand-500/20 shadow-md cursor-pointer"
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none"
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {hasUrl
                ? isYouTube
                  ? "Extract Video Transcript"
                  : "Extract Web Article"
                : selectedActDef
                ? `Run ${selectedActDef.title}`
                : "Select Action to Activate"}
            </span>
          </button>
        </div>

        {/* Action Customization Field: Single-line input field only available for actions that involve Cloud LLM */}
        {selectedActDef && selectedActDef.requiresCloudLLM && !hasUrl && documentCount > 0 && (
          <div ref={dropdownRef} className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 relative">
            <div className="flex items-start space-x-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0 h-[34px]">
                <Sliders className="w-3.5 h-3.5 text-brand-500" />
                <span>Instructions:</span>
              </div>
              <div className="relative flex-1 min-w-0">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={customInstructions}
                    onClick={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomInstructions(val);
                      const matching = presets.find((p) => p.id === selectedPresetId);
                      if (matching && matching.instructions !== val) {
                        selectPreset(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canRun && !isCooldown) {
                        handleRunAction();
                      }
                    }}
                    placeholder="Optional: Add focus instructions or choose a preset below..."
                    className={`w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-colors ${
                      customInstructions ? "pr-48" : "pr-9"
                    }`}
                  />

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                    {customInstructions && (
                      <>
                        <button
                          type="button"
                          onClick={handleOpenSaveModal}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-brand-50 hover:bg-brand-100 dark:bg-brand-950 dark:hover:bg-brand-900 text-brand-600 dark:text-brand-400 font-medium text-[11px] border border-brand-200 dark:border-brand-800 transition-colors cursor-pointer"
                          title="Save typed instructions as a reusable preset"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          <span>Save as preset</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomInstructions("");
                            selectPreset(null);
                          }}
                          className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 cursor-pointer"
                          title="Clear custom instructions"
                        >
                          Clear
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                      title={isDropdownOpen ? "Hide presets dropdown" : "Show presets dropdown"}
                    >
                      {isDropdownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Presets Dropdown directly beneath the text field, starting where the text field begins */}
                {isDropdownOpen && (
                  <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto z-20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {presets.map((preset) => {
                        const isSelected = selectedPresetId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => handleSelectPreset(preset)}
                            className={`group/item flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-400 dark:border-brand-600 shadow-xs ring-1 ring-brand-400/40"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-600"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-1.5">
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-xs font-bold truncate ${
                                  isSelected ? "text-brand-700 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"
                                }`}>
                                  {preset.title}
                                </span>
                                {preset.is_default && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono">
                                    default
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-tight">
                                {preset.instructions}
                              </p>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                              )}
                              {!preset.is_default && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePreset(e, preset.id)}
                                  className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 transition-opacity cursor-pointer"
                                  title="Delete preset"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Modal to Name and Save Preset */}
            {showSavePresetModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                      <BookmarkPlus className="w-4 h-4 text-brand-500" />
                      <span>Save as Instruction Preset</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowSavePresetModal(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSavePreset} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Preset Title:
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        placeholder="e.g. Focus on Chapter 3 & proofs"
                        className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Instructions:
                      </label>
                      <p className="text-xs p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 italic max-h-24 overflow-y-auto">
                        "{customInstructions}"
                      </p>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowSavePresetModal(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!saveTitle.trim()}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        Save Preset
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
