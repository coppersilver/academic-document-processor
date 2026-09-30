# Academic Document Processor

A cross-platform desktop application for academic document processing, web research extraction, and study material synthesis built with **Electron + React + TypeScript + Tailwind CSS** on the frontend and **Python (FastAPI)** on the backend.

Select single or multiple academic documents (`.pdf`, `.docx`, `.pptx`, `.txt`, `.md`), scrape online articles, or extract YouTube video transcripts. Choose from a rich suite of specialized academic actions (**Document Summary**, **Group Summary & Synthesis**, **Dates & Deadlines**, **Practice Exam Generator**, **Paper Polish & Critique**, **Key Terms & Concepts**, **BibTeX Citations**, **Calendar Export**), and let concurrent typed FIFO worker queues process the tasks with OpenRouter cloud inference. Outputs are automatically saved as clean GitHub-flavored Markdown (`.md`) files with native "Open in Folder" support and a standalone KaTeX preview window with in-page keyword search.

---

## Key Features

### 1. Multi-Format & Web Ingestion
- **Document Ingestion**: Ingests `.pdf` (with table extraction), `.docx`, `.pptx` (slides & speaker notes), and plaintext/markdown `.txt`, `.md`.
- **Web Article Extraction**: Paste any article or documentation URL to extract clean readability text into markdown via `trafilatura`.
- **YouTube Video Transcript Extraction**: Ingest YouTube lecture or seminar URLs (`youtube.com`, `youtu.be`) to extract video transcripts directly into structured markdown notes.
- **Pre-Flight Token Estimation**: Real-time token counter using local `tiktoken` BPE tokenization ($< 15$ ms) with a large document soft warning badge ($> 25\text{k}$ tokens).

### 2. Specialized Academic Actions
- **Document Summary**: Structured overview highlighting core thesis, methodology, results, and critical conclusions.
- **Group Summary & Synthesis**: Multi-document synthesis extracting shared themes, key differences, and thematic bridges.
- **Dates & Deadlines**: Extracts all critical milestones, submission deadlines, exam dates, and office hours with chronological grouping.
- **Key Terms & Concepts**: Glossary of technical vocabulary, key theorems, and core concepts with concise definitions.
- **Practice Exam Generator**: Generates high-yield study exams with multiple-choice questions, conceptual short answers, and detailed answer keys.
- **Paper Polish & Critique**: Comprehensive manuscript critique evaluating academic tone, methodological rigor, argument coherence, and clarity.
- **BibTeX Citation Generator**: Generates valid BibTeX entries formatted for academic reference managers (`@article`, `@book`, `@inproceedings`).
- **Calendar Export (`.ics`)**: Automatically generates ready-to-import iCalendar files for Google Calendar, Apple Calendar, and Outlook.

### 3. Custom Instruction Presets & Templates
- **Inline Preset Selector**: Compact, dropdown directly aligned beneath the instructions field. Click to apply, click again to deselect.
- **Quick "Save as Preset"**: Type custom instructions and click the inline save icon to store it as a reusable template with an auto-suggested title.
- **Settings Preset Manager**: Dedicated "Instruction Presets" tab in Settings to create, preview, edit, or delete templates.
- **Pre-Seeded Academic Defaults**:
  - *Proofs & Derivations*: Emphasizes mathematical proofs, derivations, and step-by-step logic.
  - *Exam Preparation & High-Yield*: Highlights potential test questions, core definitions, and formula sheets.
  - *Intuitive Conceptual Explanation (ELI5)*: Explains complex theoretical concepts using intuitive analogies.
  - *Clinical & Medical Relevance*: Highlights clinical applications, pathophysiology, and diagnostic criteria.

### 4. Standalone Markdown & LaTeX Preview Window
- **Dedicated Floating Window**: Opens any generated output or local markdown document in an independent desktop window.
- **Always-on-Top Pinning**: Keep the preview pinned on top while cross-referencing lectures, notes, or code editors.
- **KaTeX LaTeX Math Rendering**: Renders inline math (`$...$`, `\(...\)`), display block math (`$$...$$`, `\[...\]`), and multiline environments (`\begin{aligned}...\end{aligned}`).
- **Native Utility Actions**: One-click raw markdown copy with clipboard feedback and direct "Reveal in Finder / File Explorer" integration.

### 5. In-Page Keyword Search (`Ctrl+F` / `Cmd+F`)
- **Container-Scoped DOM Search**: Built with the native **CSS Custom Highlight API** (`CSS.highlights`) and DOM Range indexing scoped strictly to the document body, eliminating false matches in inputs or toolbars.
- **Typing Debounce (300ms)**: Keystrokes update the input field instantly while delaying highlights until typing pauses, preventing single-letter highlight flashes.
- **Sequential Navigation**: Real-time match counter (`1 of 14`) with cycling via <kbd>Enter</kbd> / down chevron (next match) and <kbd>Shift+Enter</kbd> / up chevron (previous match).
- **Smooth Auto-Scroll**: Smoothly scrolls the active match into view with high-contrast active styling.
- **Case Sensitivity Toggle**: Clickable `Aa` button to immediately toggle case sensitivity.
- **Zero Focus Loss**: Native highlight overlay ensures the cursor remains in the search box while typing, navigating, or clicking action buttons.

### 6. Performance, Queues & Security
- **Typed Concurrent FIFO Queues**:
  - `doc_converter`: Local CPU worker for binary format parsing and text extraction.
  - `cloud_llm`: FIFO worker for OpenRouter API calls with rate-limit protection.
  - *Plaintext Bypass*: Plaintext and markdown documents bypass conversion completely.
- **Smart Response Caching**: Automatic SHA-256 checksum caching of document content and prompt combinations in SQLite, providing instant responses for repeated actions and saving API costs.
- **Robust IPC & Security**:
  - Dynamic ephemeral port allocation (`port 0`) with structured stdout handshake.
  - Zombie prevention: Python background thread terminates child if Electron exits.
  - Localhost security: Ephemeral session Bearer token enforced via FastAPI middleware.
  - OS Keychain encryption: OpenRouter API key encrypted at rest via Electron's `safeStorage`.
- **Persistent Task History**: SQLite database stores task runs, token counts, and output paths across app restarts.
- **Network Resiliency**: Exponential backoff with jitter on transient 429/503 errors and async cancellation support.

---

## Project Structure

```
academic_document_processor/
├── backend/
│   ├── app/
│   │   ├── config.py              # Configuration, model lists, and tokens
│   │   ├── watcher.py             # Parent PID heartbeat monitor (zombie prevention)
│   │   ├── db/                    # SQLite database, task, preset & cache repositories
│   │   ├── extractors/            # PDF, DOCX, PPTX, TXT extractors & token estimation
│   │   ├── prompts/               # Academic prompt generators (Summary, Exam, Polish, etc.)
│   │   ├── queues/                # Typed FIFO queues (converter & AI) & coordinator
│   │   ├── services/              # OpenRouter client, Scraper, YouTube & Markdown writer
│   │   └── main.py                # FastAPI app, SSE stream, Bearer auth middleware
│   ├── tests/                     # Automated pytest test suite (39 tests)
│   ├── requirements.txt
│   └── run.py                     # Dynamic port runner with stdout handshake
├── electron/
│   ├── main.ts                    # Electron main: window management & safeStorage
│   ├── preload.ts                 # Context bridge API
│   └── tsconfig.json
├── frontend/                      # React + TypeScript + Tailwind CSS (Vite)
│   ├── src/
│   │   ├── components/            # ActionGrid, DocumentPicker, MarkdownPreviewWindow, etc.
│   │   ├── services/              # API client and SSE listener
│   │   ├── types/                 # Shared TypeScript models & Highlight API types
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── package.json                   # Root build and run orchestration
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18+ or v20+)
- **Python** (3.10+)

### Setup

1. **Install backend Python dependencies**:
   ```bash
   python3 -m venv backend/.venv
   backend/.venv/bin/pip install -r backend/requirements.txt
   ```

2. **Install frontend & root Node dependencies**:
   ```bash
   npm install
   ```

### Running the App

```bash
# Run backend, frontend dev server, and Electron app concurrently:
npm run dev
```

### Running Backend Tests

```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

### Building for Production

```bash
npm run build
```
