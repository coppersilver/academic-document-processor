export interface DocumentInfo {
  file_name: string;
  file_path: string;
  file_size: number;
  char_count: number;
  token_count: number;
  is_binary: boolean;
}

export interface InspectResult {
  files: DocumentInfo[];
  total_files: number;
  total_tokens: number;
  total_chars: number;
  total_size: number;
  is_large: boolean;
  warning_threshold: number;
}

export type TaskStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface TaskItem {
  id: string;
  filenames: string[];
  file_paths: string[];
  action_type: string;
  status: TaskStatus;
  output_path?: string;
  error_message?: string;
  token_count?: number;
  created_at: string;
  completed_at?: string;
  duration_ms?: number;
  queue_type?: "doc_converter" | "cloud_llm" | string;
  stage?: string;
  message?: string;
}

export interface AppModel {
  id: string;
  name: string;
}

export interface AppSettings {
  has_api_key: boolean;
  selected_model: string;
  default_output_dir: string;
  available_models: AppModel[];
}

export interface InstructionPreset {
  id: string;
  title: string;
  instructions: string;
  is_default?: boolean;
  created_at?: string;
}
