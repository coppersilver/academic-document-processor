import os
from pathlib import Path
from pydantic import BaseModel, Field

custom_app_dir = os.environ.get("APP_DATA_DIR")
if custom_app_dir:
    APP_DIR = Path(custom_app_dir)
else:
    try:
        APP_DIR = Path.home() / ".academic_document_processor"
        APP_DIR.mkdir(parents=True, exist_ok=True)
    except (PermissionError, OSError):
        APP_DIR = Path(__file__).resolve().parent.parent / ".app_data"

APP_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = APP_DIR / "app.db"

# Session token for authenticating local requests from Electron
SESSION_TOKEN = os.environ.get("SESSION_TOKEN", "")

# Parent process ID for zombie prevention
PARENT_PID = os.environ.get("PARENT_PID", "")

# OpenRouter configuration
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
TOKEN_WARNING_THRESHOLD = 25000

AVAILABLE_MODELS = [
    {"id": "nvidia/nemotron-3-ultra-550b-a55b:free", "name": "NVIDIA Nemotron 3 Ultra 550B (Free)"},
    {"id": "z-ai/glm-5.3", "name": "Z-AI GLM 5.3"},
    {"id": "google/gemini-3.8-flash", "name": "Google Gemini 3.8 Flash"},
    {"id": "xiaomi/mimo-v2.6-pro", "name": "Xiaomi MiMo v2.6 Pro"},
    {"id": "xiaomi/mimo-v2.6-flash", "name": "Xiaomi MiMo v2.6 Flash"},
    {"id": "openai/gpt-6-luna", "name": "OpenAI GPT-6 Luna"},
    {"id": "deepseek/deepseek-v4.1-flash", "name": "DeepSeek V4.1 Flash"},
]

DEFAULT_OUTPUT_DIR = str(Path.home() / "Documents" / "AcademicProcessorOutputs")
try:
    Path(DEFAULT_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
except (PermissionError, OSError):
    pass

class AppSettings(BaseModel):
    openrouter_api_key: str = Field(default="", description="OpenRouter API Key")
    selected_model: str = Field(default=DEFAULT_MODEL, description="Active OpenRouter Model ID")
    default_output_dir: str = Field(
        default=DEFAULT_OUTPUT_DIR,
        description="Global output directory (defaults to ~/Documents/AcademicProcessorOutputs)"
    )

settings = AppSettings()

