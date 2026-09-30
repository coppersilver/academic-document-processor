import asyncio
import random
import logging
import httpx
from ..config import OPENROUTER_API_URL, DEFAULT_MODEL
from ..prompts.summary import build_summary_prompt
from ..prompts.deadlines import build_deadlines_prompt
from ..prompts.key_terms import build_key_terms_prompt
from ..prompts.group_summary import build_group_summary_prompt
from ..prompts.calendar_export import build_calendar_export_prompt
from ..prompts.bibtex import build_bibtex_prompt
from ..prompts.practice_exam import build_practice_exam_prompt
from ..prompts.anonymize import build_anonymize_prompt
from ..prompts.polish import build_polish_prompt

logger = logging.getLogger("academic_processor.openrouter")

class OpenRouterError(Exception):
    def __init__(self, message: str, is_terminal: bool = False, status_code: int = 0):
        super().__init__(message)
        self.is_terminal = is_terminal
        self.status_code = status_code

async def call_openrouter(
    messages: list[dict[str, str]],
    api_key: str,
    model: str = DEFAULT_MODEL,
    max_retries: int = 3,
    cancel_event: asyncio.Event | None = None
) -> str:
    """Executes a completion call to OpenRouter with retries, jitter backoff, and cancellation."""
    if not api_key or not api_key.strip():
        raise OpenRouterError(
            "OpenRouter API key is missing. Please configure your API key in Settings.",
            is_terminal=True,
            status_code=401
        )

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "HTTP-Referer": "https://academic-doc-processor.local",
        "X-Title": "Academic Document Processor",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model or DEFAULT_MODEL,
        "messages": messages,
        "temperature": 0.2,
    }

    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        if cancel_event and cancel_event.is_set():
            raise asyncio.CancelledError("Task was cancelled by user.")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                req_task = asyncio.create_task(
                    client.post(OPENROUTER_API_URL, json=payload, headers=headers)
                )

                if cancel_event:
                    # Monitor cancel_event while request runs
                    while not req_task.done():
                        if cancel_event.is_set():
                            req_task.cancel()
                            raise asyncio.CancelledError("Task was cancelled by user.")
                        await asyncio.sleep(0.1)

                response = await req_task

                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "")
                    raise OpenRouterError("Unexpected API response structure with no choices.", is_terminal=True)

                status = response.status_code
                error_body = response.text
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", error_body)
                except Exception:
                    err_msg = error_body

                if status == 401:
                    raise OpenRouterError(
                        f"Authentication failed: Invalid OpenRouter API key ({err_msg}).",
                        is_terminal=True,
                        status_code=401
                    )
                elif status == 402:
                    raise OpenRouterError(
                        f"Insufficient OpenRouter credits: {err_msg}. Please top up your account.",
                        is_terminal=True,
                        status_code=402
                    )
                elif status == 400:
                    raise OpenRouterError(
                        f"Invalid request / context length exceeded: {err_msg}.",
                        is_terminal=True,
                        status_code=400
                    )
                elif status in (429, 502, 503, 504):
                    # Transient error: retry with exponential backoff and jitter
                    delay = (2 ** attempt) + random.uniform(0.5, 1.5)
                    logger.warning(f"OpenRouter HTTP {status}: {err_msg}. Retrying in {delay:.1f}s (attempt {attempt}/{max_retries})...")
                    if attempt == max_retries:
                        raise OpenRouterError(f"OpenRouter rate limit or server error ({status}): {err_msg}", is_terminal=False, status_code=status)
                    await asyncio.sleep(delay)
                else:
                    raise OpenRouterError(f"OpenRouter API error {status}: {err_msg}", is_terminal=True, status_code=status)

        except asyncio.CancelledError:
            raise
        except OpenRouterError as ore:
            if ore.is_terminal or attempt == max_retries:
                raise
            last_error = ore
        except (httpx.TimeoutException, httpx.NetworkError) as net_err:
            delay = (2 ** attempt) + random.uniform(0.5, 1.5)
            logger.warning(f"Network error communicating with OpenRouter: {net_err}. Retrying in {delay:.1f}s...")
            if attempt == max_retries:
                raise OpenRouterError(f"Network error connecting to OpenRouter: {net_err}", is_terminal=False)
            await asyncio.sleep(delay)
            last_error = net_err

    if last_error:
        raise last_error
    raise OpenRouterError("Unknown error occurred during OpenRouter call.")

MATH_FORMATTING_DIRECTIVE = (
    "\n\nMathematical & Scientific Notation:\n"
    "When expressing mathematical equations, formulas, statistical distributions, proofs, or variables, "
    "always format them using standard LaTeX delimiters: `$ ... $` for inline variables/expressions "
    "(e.g., `$F_{q, n-k}$`, `$RSS_R$`, `$\\alpha = 0.05$`) and `$$ ... $$` on separate lines for standalone display equations "
    "(e.g., `$$\\nF = \\frac{(RSS_R - RSS_F)/q}{RSS_F/(n - k_F)}\\n$$`). "
    "For multiline systems or aligned environments, always place opening `$$` and closing `$$` on their own separate lines "
    "and use `\\\\` for line breaks between equations (e.g., `$$\\n\\begin{aligned}\\n... &= ... \\\\\\\\n... &= ...\\n\\end{aligned}\\n$$`)."
)

def get_action_messages(
    action_type: str,
    document_text: str,
    filenames: list[str],
    custom_instructions: str | None = None
) -> list[dict[str, str]]:
    """Builds appropriate messages according to the requested action, injecting custom user instructions if provided."""
    action = action_type.lower()
    if action == "summary":
        messages = build_summary_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "deadlines":
        messages = build_deadlines_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "key_terms":
        messages = build_key_terms_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "group_summary":
        messages = build_group_summary_prompt(document_text, filenames)
    elif action == "calendar_export":
        messages = build_calendar_export_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "bibtex":
        messages = build_bibtex_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "practice_exam":
        messages = build_practice_exam_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "anonymize":
        messages = build_anonymize_prompt(document_text, filenames[0] if filenames else "Document")
    elif action == "polish":
        messages = build_polish_prompt(document_text, filenames[0] if filenames else "Document")
    else:
        raise ValueError(f"Unsupported action type: {action_type}")

    # Inject standard LaTeX math formatting instruction into system message
    if messages and messages[0].get("role") == "system":
        messages[0]["content"] += MATH_FORMATTING_DIRECTIVE

    if custom_instructions and custom_instructions.strip():
        instruction_block = (
            f"\n\n--- ADDITIONAL USER INSTRUCTIONS & FOCUS ---\n"
            f"{custom_instructions.strip()}\n"
            f"Please adhere to the above user instructions while completing the requested task."
        )
        for msg in reversed(messages):
            if msg.get("role") == "user":
                msg["content"] += instruction_block
                break
        else:
            messages.append({"role": "user", "content": instruction_block})

    return messages
