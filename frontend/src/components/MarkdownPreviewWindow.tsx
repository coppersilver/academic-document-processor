import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";
import {
  Copy,
  Check,
  Pin,
  FolderSearch,
  FileText,
  Loader2,
  AlertCircle,
  Search,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

// Configure marked with KaTeX LaTeX math support
marked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true,
  })
);

/**
 * Normalizes math delimiters in Markdown text so that:
 * 1. Multiline display equations and LaTeX bracket notations conform to marked-katex requirements.
 * 2. Inline $$...$$ inside table rows or sentences are converted to $...$ to prevent splitting table cells.
 * 3. Text inside fenced code blocks (```...```) is preserved untouched.
 */
function normalizeMathDelimiters(markdown: string): string {
  // Preserve fenced code blocks completely untouched so delimiters inside code are not corrupted
  const parts = markdown.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part, idx) => {
      // Odd indices are inside fenced code blocks (```...```)
      if (idx % 2 === 1) return part;

      let res = part;

      // 1. Convert \[ ... \] to $$ ... $$ block math
      res = res.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$\n${inner.trim()}\n$$`);

      // 2. Convert \( ... \) to $ ... $ inline math
      res = res.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner.trim()}$`);

      // 3. Convert single-line $$...$$ in table rows (| ... |) or inline in sentences to $...$
      // This prevents KaTeX displayMode block math from splitting table cells or paragraphs
      res = res
        .split("\n")
        .map((line) => {
          if (line.includes("|") && line.includes("$$")) {
            return line.replace(/\$\$([^\n$]+?)\$\$/g, (_, inner) => `$${inner.trim()}$`);
          }
          return line.replace(/(^|[^\n])\$\$([^\n$]+?)\$\$([^\n]|$)/g, (match, prefix, inner, suffix) => {
            if (prefix.trim() || suffix.trim()) {
              return `${prefix}$${inner.trim()}$${suffix}`;
            }
            return match;
          });
        })
        .join("\n");

      // 4. Ensure standalone $$ blocks containing newlines or LaTeX environments have leading/trailing newlines
      res = res.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
        if (inner.includes("\n") || inner.includes("\\begin{") || inner.includes("\\\\")) {
          return `\n\n$$\n${inner.trim()}\n$$\n\n`;
        }
        return match;
      });

      return res;
    })
    .join("");
}

/**
 * Finds all DOM ranges in container matching query.
 * Scoped strictly to the document container, ignoring find input, titlebar, and buttons.
 */
function findRanges(container: HTMLElement, query: string, matchCase: boolean): Range[] {
  if (!query || !container) return [];

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.textContent || node.textContent.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // Ignore hidden MathML or script/style
        if (
          parent.closest(".katex-mathml") ||
          parent.tagName === "SCRIPT" ||
          parent.tagName === "STYLE"
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode as Text);
  }

  if (textNodes.length === 0) return [];

  interface Chunk {
    node: Text;
    start: number;
    end: number;
  }

  const chunks: Chunk[] = [];
  let fullText = "";
  let lastBlockParent: HTMLElement | null = null;

  for (const node of textNodes) {
    const parent = node.parentElement;
    let blockAncestor = parent;
    while (blockAncestor && blockAncestor !== container) {
      const display = window.getComputedStyle(blockAncestor).display;
      if (["block", "list-item", "table-row", "flex", "grid"].includes(display)) {
        break;
      }
      blockAncestor = blockAncestor.parentElement;
    }

    if (lastBlockParent && blockAncestor !== lastBlockParent) {
      fullText += "\n";
    }
    lastBlockParent = blockAncestor;

    const start = fullText.length;
    const text = node.textContent || "";
    fullText += text;
    const end = fullText.length;

    chunks.push({ node, start, end });
  }

  const targetText = matchCase ? fullText : fullText.toLowerCase();
  const searchPattern = matchCase ? query : query.toLowerCase();
  const queryLen = query.length;
  const ranges: Range[] = [];

  let searchIndex = targetText.indexOf(searchPattern);
  while (searchIndex !== -1) {
    const matchStart = searchIndex;
    const matchEnd = matchStart + queryLen;

    const startChunk = chunks.find((c) => matchStart >= c.start && matchStart < c.end);
    const endChunk = chunks.find((c) => matchEnd > c.start && matchEnd <= c.end);

    if (startChunk && endChunk) {
      try {
        const range = new Range();
        range.setStart(startChunk.node, matchStart - startChunk.start);
        range.setEnd(endChunk.node, matchEnd - endChunk.start);
        ranges.push(range);
      } catch (err) {
        console.warn("Failed to create range for match:", err);
      }
    }

    searchIndex = targetText.indexOf(searchPattern, matchStart + Math.max(1, queryLen));
  }

  return ranges;
}

export const MarkdownPreviewWindow: React.FC = () => {
  const [filePath, setFilePath] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("Document Preview");
  const [rawContent, setRawContent] = useState<string>("");
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Search state
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [matchCase, setMatchCase] = useState<boolean>(false);
  const [activeMatchOrdinal, setActiveMatchOrdinal] = useState<number>(0);
  const [numberOfMatches, setNumberOfMatches] = useState<number>(0);

  const articleRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const matchedRangesRef = useRef<Range[]>([]);
  const activeMatchIndexRef = useRef<number>(0);

  const clearHighlights = () => {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete("search-results");
      CSS.highlights.delete("search-active");
    }
    matchedRangesRef.current = [];
    activeMatchIndexRef.current = 0;
    setActiveMatchOrdinal(0);
    setNumberOfMatches(0);
  };

  const performSearch = (query: string, isCaseSensitive: boolean, targetIndex: number = 0) => {
    if (!query || !articleRef.current) {
      clearHighlights();
      return;
    }

    const ranges = findRanges(articleRef.current, query, isCaseSensitive);
    matchedRangesRef.current = ranges;
    setNumberOfMatches(ranges.length);

    if (ranges.length === 0) {
      activeMatchIndexRef.current = 0;
      setActiveMatchOrdinal(0);
      if (typeof CSS !== "undefined" && CSS.highlights) {
        CSS.highlights.delete("search-results");
        CSS.highlights.delete("search-active");
      }
      return;
    }

    const safeIndex = ((targetIndex % ranges.length) + ranges.length) % ranges.length;
    activeMatchIndexRef.current = safeIndex;
    setActiveMatchOrdinal(safeIndex + 1);

    if (typeof CSS !== "undefined" && CSS.highlights) {
      const allHighlight = new Highlight(...ranges);
      CSS.highlights.set("search-results", allHighlight);

      const activeHighlight = new Highlight(ranges[safeIndex]);
      CSS.highlights.set("search-active", activeHighlight);
    }

    const activeRange = ranges[safeIndex];
    const el =
      activeRange.startContainer instanceof HTMLElement
        ? activeRange.startContainer
        : activeRange.startContainer.parentElement;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    // Parse query params from URL hash (e.g. #preview?path=/...&title=...)
    const hash = window.location.hash;
    const queryIndex = hash.indexOf("?");
    const queryPart = queryIndex !== -1 ? hash.substring(queryIndex + 1) : "";
    const params = new URLSearchParams(queryPart);

    const targetPath = params.get("path") || "";
    const title = params.get("title") || targetPath.split("/").pop() || targetPath.split("\\").pop() || "Document Preview";

    setFilePath(targetPath);
    setDocTitle(title);

    if (!targetPath) {
      setError("No document path was specified for preview.");
      setLoading(false);
      return;
    }

    // Load file content
    async function loadContent() {
      setLoading(true);
      setError(null);
      try {
        if (window.electronAPI?.readFileContent) {
          const content = await window.electronAPI.readFileContent(targetPath);
          if (content !== null) {
            setRawContent(content);
            const isDark = document.documentElement.classList.contains("dark");
            const html = await renderMarkdownWithDiagrams(content, isDark);
            setRenderedHtml(html);
          } else {
            setError(`Could not read file at: ${targetPath}`);
          }
        } else {
          // Fallback if accessed directly in web browser without Electron
          setError("File access is only available within the desktop application.");
        }

        // Check if window is currently always on top
        if (window.electronAPI?.isAlwaysOnTop) {
          const pinned = await window.electronAPI.isAlwaysOnTop();
          setIsPinned(pinned);
        }
      } catch (err: any) {
        setError(`Failed to read document: ${err.message || String(err)}`);
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, []);

/**
 * Renders Markdown content with full KaTeX math support and Mermaid diagrams.
 * Pre-processes all ```mermaid ... ``` fenced code blocks directly into SVG markup
 * via mermaid.render before marked parsing, avoiding React DOM race conditions.
 */
async function renderMarkdownWithDiagrams(content: string, isDark: boolean): Promise<string> {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    securityLevel: "loose",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });

  // 1. Identify and extract all ```mermaid ... ``` code blocks
  const mermaidBlocks: { placeholder: string; svgOrHtml: string }[] = [];
  let blockIndex = 0;

  // We look for ```mermaid ... ``` code blocks
  const preprocessedMarkdown = await (async () => {
    // Regex matching fenced mermaid code blocks: ```mermaid\n...\n```
    const mermaidRegex = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g;
    const matches: { fullMatch: string; code: string; index: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = mermaidRegex.exec(content)) !== null) {
      matches.push({
        fullMatch: match[0],
        code: match[1].trim(),
        index: match.index,
      });
    }

    if (matches.length === 0) {
      return content;
    }

    let result = "";
    let lastIndex = 0;

    for (const item of matches) {
      result += content.substring(lastIndex, item.index);
      const placeholder = `<!--MERMAID_DIAGRAM_PLACEHOLDER_${blockIndex++}-->`;
      const uniqueId = `mermaid-${Date.now()}-${blockIndex}-${Math.random().toString(36).substring(2, 7)}`;

      let diagramHtml = "";
      try {
        const { svg } = await mermaid.render(uniqueId, item.code);
        diagramHtml = `<div class="mermaid">${svg}</div>`;
      } catch (err: any) {
        console.warn("Mermaid render error:", err);
        const escapedCode = item.code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        diagramHtml = `
          <div class="mermaid-error my-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs">
            <div class="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-semibold mb-2">
              <span>Mermaid Diagram Syntax Error:</span>
              <span class="font-mono text-[11px] font-normal">${err.message || String(err)}</span>
            </div>
            <pre class="font-mono text-[11px] p-2.5 rounded bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950 text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre">${escapedCode}</pre>
          </div>
        `;
      }

      mermaidBlocks.push({ placeholder, svgOrHtml: diagramHtml });
      result += placeholder;
      lastIndex = item.index + item.fullMatch.length;
    }

    result += content.substring(lastIndex);
    return result;
  })();

  // 2. Normalize math delimiters and parse Markdown via marked + KaTeX
  const normalized = normalizeMathDelimiters(preprocessedMarkdown);
  let parsedHtml = await marked.parse(normalized);

  // 3. Replace diagram placeholders with their rendered SVGs
  for (const block of mermaidBlocks) {
    parsedHtml = parsedHtml.replace(block.placeholder, block.svgOrHtml);
  }

  return parsedHtml;
}

  // Handle keyboard shortcut: Cmd+F or Ctrl+F to open search, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
        if (searchQuery) {
          performSearch(searchQuery, matchCase, activeMatchIndexRef.current);
        }
      }

      if (e.key === "Escape" && showSearch) {
        e.preventDefault();
        handleCloseSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, searchQuery, matchCase]);

  // Re-run search if rendered HTML content changes while search is open
  useEffect(() => {
    if (showSearch && searchQuery) {
      performSearch(searchQuery, matchCase, activeMatchIndexRef.current);
    }
  }, [renderedHtml]);

  // Cleanup highlights and timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearHighlights();
    };
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!val) {
      clearHighlights();
      return;
    }

    // Debounce the search by 300ms to avoid flashing highlights on each keystroke
    debounceTimerRef.current = setTimeout(() => {
      performSearch(val, matchCase, 0);
    }, 300);
  };

  const handleToggleCase = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const nextCase = !matchCase;
    setMatchCase(nextCase);
    if (searchQuery) {
      performSearch(searchQuery, nextCase, 0);
    }
  };

  const handleNextMatch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const total = matchedRangesRef.current.length;
    if (total === 0) {
      if (searchQuery) {
        performSearch(searchQuery, matchCase, 0);
      }
      return;
    }
    const nextIdx = (activeMatchIndexRef.current + 1) % total;
    activeMatchIndexRef.current = nextIdx;
    setActiveMatchOrdinal(nextIdx + 1);

    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.set("search-active", new Highlight(matchedRangesRef.current[nextIdx]));
    }

    const activeRange = matchedRangesRef.current[nextIdx];
    const el =
      activeRange.startContainer instanceof HTMLElement
        ? activeRange.startContainer
        : activeRange.startContainer.parentElement;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handlePrevMatch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const total = matchedRangesRef.current.length;
    if (total === 0) {
      if (searchQuery) {
        performSearch(searchQuery, matchCase, 0);
      }
      return;
    }
    const prevIdx = (activeMatchIndexRef.current - 1 + total) % total;
    activeMatchIndexRef.current = prevIdx;
    setActiveMatchOrdinal(prevIdx + 1);

    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.set("search-active", new Highlight(matchedRangesRef.current[prevIdx]));
    }

    const activeRange = matchedRangesRef.current[prevIdx];
    const el =
      activeRange.startContainer instanceof HTMLElement
        ? activeRange.startContainer
        : activeRange.startContainer.parentElement;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleCloseSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setShowSearch(false);
    setSearchQuery("");
    clearHighlights();
  };

  const handleOpenSearch = () => {
    setShowSearch(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
    if (searchQuery) {
      performSearch(searchQuery, matchCase, activeMatchIndexRef.current);
    }
  };

  const handleTogglePin = async () => {
    if (window.electronAPI?.setAlwaysOnTop) {
      const nextState = !isPinned;
      await window.electronAPI.setAlwaysOnTop(nextState);
      setIsPinned(nextState);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!rawContent) return;
    try {
      await navigator.clipboard.writeText(rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy markdown to clipboard:", err);
    }
  };

  const handleRevealInFolder = async () => {
    if (filePath && window.electronAPI?.revealFile) {
      await window.electronAPI.revealFile(filePath);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 select-none overflow-hidden font-sans relative">
      {/* Native Drag Titlebar & Toolbar */}
      <header
        className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* Left: Window Title & File Indicator */}
        <div className="flex items-center space-x-2.5 pl-16 truncate">
          <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h1 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {docTitle}
            </h1>
            <p className="text-[10px] text-slate-400 truncate max-w-sm" title={filePath}>
              {filePath}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons (Must be no-drag to be clickable) */}
        <div
          className="flex items-center space-x-1.5 shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {/* Find in Document Button */}
          <button
            onClick={showSearch ? handleCloseSearch : handleOpenSearch}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              showSearch
                ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 shadow-xs"
                : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            }`}
            title="Find in document (Ctrl+F / ⌘F)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find</span>
          </button>

          {/* Pin on Top Button */}
          <button
            onClick={handleTogglePin}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isPinned
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
            }`}
            title={isPinned ? "Unpin window (Currently always on top)" : "Pin window always on top"}
          >
            <Pin className={`w-3.5 h-3.5 ${isPinned ? "rotate-45 fill-current" : ""}`} />
            <span>{isPinned ? "Pinned" : "Pin on Top"}</span>
          </button>

          {/* Copy Markdown Button */}
          <button
            onClick={handleCopyMarkdown}
            disabled={!rawContent}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              copied
                ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            } ${!rawContent ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            title="Copy raw Markdown text to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Reveal in Folder Button */}
          <button
            onClick={handleRevealInFolder}
            disabled={!filePath}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Reveal file in Finder / File Explorer"
          >
            <FolderSearch className="w-3.5 h-3.5" />
            <span>Reveal</span>
          </button>
        </div>
      </header>

      {/* Floating In-Page Search Bar */}
      {showSearch && (
        <div
          className="absolute top-14 right-6 z-40 flex items-center space-x-1.5 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 text-xs"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="flex items-center space-x-1 px-1 text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) {
                  handlePrevMatch();
                } else {
                  handleNextMatch();
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleCloseSearch();
              }
            }}
            placeholder="Find in document..."
            className="w-48 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          {/* Match counter */}
          <div className="px-1.5 text-[11px] font-mono text-slate-400 shrink-0 min-w-[48px] text-center select-none">
            {searchQuery ? (
              numberOfMatches > 0 ? (
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  {activeMatchOrdinal} / {numberOfMatches}
                </span>
              ) : (
                <span className="text-rose-500 font-medium">0 / 0</span>
              )
            ) : null}
          </div>

          {/* Previous Match */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handlePrevMatch}
            disabled={!searchQuery || numberOfMatches === 0}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Previous match (Shift+Enter)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Next Match */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleNextMatch}
            disabled={!searchQuery || numberOfMatches === 0}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Next match (Enter)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Case Sensitivity */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleCase}
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${
              matchCase
                ? "bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-300 dark:border-brand-700"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
            title={matchCase ? "Match Case (Enabled)" : "Match Case (Disabled)"}
          >
            Aa
          </button>

          {/* Close Search */}
          <button
            type="button"
            onClick={handleCloseSearch}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
            title="Close search (Escape)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 selectable bg-white dark:bg-slate-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs">Loading document preview...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-3 p-6 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Unable to Load Preview</h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-mono break-all">{error}</p>
          </div>
        ) : (
          <article
            ref={articleRef}
            className="markdown-body max-w-4xl mx-auto pb-16"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </main>
    </div>
  );
};
