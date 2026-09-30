import { AppSettings, InspectResult, TaskItem, InstructionPreset } from "../types";

let backendBaseUrl = "http://127.0.0.1:8765";
let sessionToken = "";

declare global {
  interface Window {
    electronAPI?: {
      selectDocuments: () => Promise<string[] | null>;
      selectOutputFolder: () => Promise<string | null>;
      revealFile: (filePath: string) => Promise<boolean>;
      openPreviewWindow: (filePath: string, title?: string) => Promise<boolean>;
      readFileContent: (filePath: string) => Promise<string | null>;
      setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
      isAlwaysOnTop: () => Promise<boolean>;
      storeApiKey: (apiKey: string) => Promise<boolean>;
      getApiKey: () => Promise<string | null>;
      getBackendInfo: () => Promise<{ port: number; token: string }>;
      getFilePath?: (file: File) => string;
      findInPage?: (text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) => Promise<number | null>;
      stopFindInPage?: (action?: "clearSelection" | "keepSelection" | "activateSelection") => Promise<void>;
      onFoundInPage?: (callback: (result: { activeMatchOrdinal: number; numberOfMatches: number; finalUpdate: boolean }) => void) => () => void;
    };
  }
}

export async function initBackendConnection(): Promise<string> {
  if (window.electronAPI) {
    try {
      const info = await window.electronAPI.getBackendInfo();
      if (info && info.port) {
        backendBaseUrl = `http://127.0.0.1:${info.port}`;
        sessionToken = info.token || "";
      }
    } catch (e) {
      console.warn("Could not retrieve backend config from Electron, using default:", e);
    }
  }
  return backendBaseUrl;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }
  return headers;
}

export async function checkBackendHealth(): Promise<{ status: string; has_api_key: boolean; selected_model: string }> {
  const res = await fetch(`${backendBaseUrl}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${backendBaseUrl}/api/settings`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.statusText}`);
  return res.json();
}

export async function saveSettings(data: {
  openrouter_api_key?: string;
  selected_model?: string;
  default_output_dir?: string;
}): Promise<AppSettings> {
  const res = await fetch(`${backendBaseUrl}/api/settings`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update settings: ${res.statusText}`);
  return res.json();
}

export async function inspectFiles(filePaths: string[]): Promise<InspectResult> {
  const res = await fetch(`${backendBaseUrl}/api/documents/inspect`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ file_paths: filePaths }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to inspect documents");
  }
  return res.json();
}

export async function enqueueDocumentTask(
  filenames: string[],
  filePaths: string[],
  actionType: string,
  outputDir?: string,
  customInstructions?: string,
  url?: string
): Promise<TaskItem> {
  const res = await fetch(`${backendBaseUrl}/api/tasks`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      filenames,
      file_paths: filePaths,
      action_type: actionType,
      output_dir: outputDir || null,
      custom_instructions: customInstructions?.trim() || null,
      url: url || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to enqueue task");
  }
  return res.json();
}

export async function fetchTasksHistory(): Promise<TaskItem[]> {
  const res = await fetch(`${backendBaseUrl}/api/tasks?limit=100`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load tasks: ${res.statusText}`);
  const data = await res.json();
  return data.tasks || [];
}

export async function cancelRunningTask(taskId: string): Promise<boolean> {
  const res = await fetch(`${backendBaseUrl}/api/tasks/${taskId}/cancel`, {
    method: "POST",
    headers: getHeaders(),
  });
  return res.ok;
}

export function subscribeToQueueEvents(
  onEvent: (eventType: string, data: any) => void,
  onError?: (err: any) => void
): () => void {
  const sseUrl = `${backendBaseUrl}/api/events${sessionToken ? `?token=${encodeURIComponent(sessionToken)}` : ""}`;
  const eventSource = new EventSource(sseUrl);

  const eventTypes = [
    "task_queued",
    "task_processing",
    "task_stage_changed",
    "task_completed",
    "task_failed",
    "task_cancelled",
  ];

  eventTypes.forEach((evt) => {
    eventSource.addEventListener(evt, (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(evt, parsed);
      } catch (err) {
        console.error(`Failed to parse SSE event [${evt}]:`, err);
      }
    });
  });

  eventSource.onerror = (err) => {
    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}

export async function fetchPresets(): Promise<InstructionPreset[]> {
  const res = await fetch(`${backendBaseUrl}/api/presets`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch presets: ${res.statusText}`);
  return res.json();
}

export async function createPreset(title: string, instructions: string): Promise<InstructionPreset> {
  const res = await fetch(`${backendBaseUrl}/api/presets`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ title, instructions }),
  });
  if (!res.ok) throw new Error(`Failed to create preset: ${res.statusText}`);
  return res.json();
}

export async function updatePreset(id: string, title: string, instructions: string): Promise<InstructionPreset> {
  const res = await fetch(`${backendBaseUrl}/api/presets/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ title, instructions }),
  });
  if (!res.ok) throw new Error(`Failed to update preset: ${res.statusText}`);
  return res.json();
}

export async function deletePreset(id: string): Promise<boolean> {
  const res = await fetch(`${backendBaseUrl}/api/presets/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return res.ok;
}

export async function resetPresets(): Promise<InstructionPreset[]> {
  const res = await fetch(`${backendBaseUrl}/api/presets/reset`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to reset presets: ${res.statusText}`);
  return res.json();
}
