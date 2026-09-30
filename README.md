# Academic Document Processor

A cross-platform desktop application for academic document processing built with **Electron + React + TypeScript + Tailwind CSS** on the frontend and **Python (FastAPI)** on the backend.

Select single or multiple academic documents (`.pdf`, `.docx`, `.pptx`, `.txt`, `.md`), choose an action from the responsive grid (**Document Summary**, **Group Summary & Synthesis**, **Dates & Deadlines**, **Key Terms & Concepts**), and let concurrent typed FIFO worker queues process the tasks with OpenRouter cloud inference. Outputs are automatically saved as clean GitHub-flavored Markdown (`.md`) files with native "Open in Folder" support.

---

## Key Features

- **Multi-Format Ingestion**: Ingests `.pdf` (with table extraction), `.docx`, `.pptx` (slides & speaker notes), and plaintext/markdown `.txt`, `.md`.
- **Instant Pre-Flight Token Estimation**: Real-time token counter using local `tiktoken` BPE tokenization ($< 15$ ms) with a large document soft warning badge ($> 25\text{k}$ tokens).
- **Single & Multi-Document Modes**:
  - *Single Document*: Summary, Dates & Deadlines, Key Terms & Concepts.
  - *Multiple Documents*: Group Summary & Synthesis active; single-doc actions cleanly grayed out with tooltips.
- **Typed Concurrent FIFO Queues**:
  - `doc_converter`: Local CPU worker for binary format parsing.
  - `cloud_llm`: FIFO queue for OpenRouter API calls with rate-limit protection.
  - *Plaintext Bypass*: `.txt` and `.md` files bypass the converter queue completely.
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
│   │   ├── config.py              # Configuration, models, and tokens
│   │   ├── watcher.py             # Parent PID heartbeat monitor
│   │   ├── db/                    # SQLite database & repository
│   │   ├── extractors/            # PDF, DOCX, PPTX, TXT extractors & token counter
│   │   ├── prompts/               # Specialized academic prompt generators
│   │   ├── queues/                # Typed FIFO queues (converter & AI) & coordinator
│   │   ├── services/              # OpenRouter client & Markdown writer
│   │   └── main.py                # FastAPI app, SSE stream, Bearer auth middleware
│   ├── tests/                     # Pytest suite
│   ├── requirements.txt
│   └── run.py                     # Dynamic port runner with stdout handshake
├── electron/
│   ├── main.ts                    # Electron main: process management & safeStorage
│   ├── preload.ts                 # Context bridge
│   └── tsconfig.json
├── frontend/                      # React + TypeScript + Tailwind CSS (Vite)
│   ├── src/
│   │   ├── components/            # Header, DocumentPicker, ActionGrid, QueueList, SettingsModal
│   │   ├── services/              # API client and SSE listener
│   │   ├── types/                 # Shared TypeScript models
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
