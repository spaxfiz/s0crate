from __future__ import annotations
import logging
import os
import litellm
from typing import AsyncGenerator

litellm.suppress_debug_info = True
logger = logging.getLogger(__name__)

# Map provider prefix to the api_key parameter name used by LiteLLM
PROVIDER_KEY_MAP = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GEMINI_API_KEY",
    "azure": "AZURE_API_KEY",
    "bedrock": "AWS_BEARER_TOKEN_BEDROCK",
    "groq": "GROQ_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "cohere": "COHERE_API_KEY",
    "together_ai": "TOGETHERAI_API_KEY",
    "fireworks_ai": "FIREWORKS_API_KEY",
    "perplexity": "PERPLEXITYAI_API_KEY",
    "xai": "XAI_API_KEY",
    "volcengine": "VOLCENGINE_ACCESS_KEY",
    "dashscope": "DASHSCOPE_API_KEY",
    "baidu": "BAIDU_API_KEY",
    "zhipuai": "ZHIPUAI_API_KEY",
    "minimax": "MINIMAX_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "spark": "SPARK_API_KEY",
    "databricks": "DATABRICKS_TOKEN",
    "huggingface": "HUGGINGFACE_API_KEY",
    "deepinfra": "INFERENCE_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
    "replicate": "REPLICATE_API_TOKEN",
    "ollama": None,
}


def _get_provider_from_model(model: str) -> str | None:
    """Extract provider prefix from model string like 'anthropic/claude-sonnet-4-20250514'."""
    if "/" in model:
        return model.split("/")[0]
    return None


class AIEngine:
    def __init__(
        self,
        fast_model: str = "anthropic/claude-sonnet-4-20250514",
        pro_model: str = "",
        api_keys: dict | None = None,
        # backward-compat alias
        model: str | None = None,
    ):
        self.fast_model = model or fast_model
        self.pro_model = pro_model or self.fast_model
        self.api_keys = api_keys or {}

    @property
    def model(self) -> str:
        return self.fast_model

    def get_model(self, tier: str = "fast") -> str:
        if tier == "pro":
            return self.pro_model
        return self.fast_model

    def _get_api_key_for_model(self, model: str) -> str | None:
        provider = _get_provider_from_model(model)
        if provider and provider in self.api_keys:
            return self.api_keys[provider]
        env_key = PROVIDER_KEY_MAP.get(provider or "")
        if env_key:
            return os.getenv(env_key)
        return None

    def _validate_model_key(self, model: str) -> str | None:
        provider = _get_provider_from_model(model)
        env_key = PROVIDER_KEY_MAP.get(provider or "")
        if provider and provider not in PROVIDER_KEY_MAP:
            raise RuntimeError(f"当前模型供应商 {provider} 暂未配置 API Key 映射")
        api_key = self._get_api_key_for_model(model)
        if env_key and not api_key:
            raise RuntimeError(f"当前模型 {model} 缺少 {provider} API Key，请先在设置中配置")
        return api_key

    def update(
        self,
        fast_model: str | None = None,
        pro_model: str | None = None,
        api_keys: dict | None = None,
        # backward-compat alias
        model: str | None = None,
    ):
        if model:
            self.fast_model = model
        if fast_model:
            self.fast_model = fast_model
        if pro_model:
            self.pro_model = pro_model
        elif fast_model:
            self.pro_model = fast_model
        if api_keys is not None:
            self.api_keys = api_keys

    async def stream_chat(
        self,
        system_prompt: str,
        history: list[dict],
        user_message: str,
        temperature: float = 0,
        max_tokens: int = 4096,
        tier: str = "fast",
    ) -> AsyncGenerator[dict, None]:
        model = self.get_model(tier)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        api_key = self._validate_model_key(model)
        logger.info(
            "ai stream start model=%s tier=%s history_messages=%s max_tokens=%s user_chars=%s",
            model,
            tier,
            len(history),
            max_tokens,
            len(user_message),
        )
        kwargs = dict(
            model=model,
            messages=messages,
            stream=True,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if api_key:
            kwargs["api_key"] = api_key

        try:
            response = await litellm.acompletion(**kwargs)
        except Exception:
            logger.exception("ai stream request failed model=%s max_tokens=%s", model, max_tokens)
            raise

        full_content = ""
        async for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            full_content += delta
            yield {"type": "token", "content": delta}

        logger.info("ai stream done model=%s output_chars=%s", model, len(full_content))
        yield {"type": "done", "content": full_content}

    async def complete(
        self,
        system_prompt: str,
        messages: list[dict],
        temperature: float = 0,
        max_tokens: int = 4096,
        tier: str = "fast",
    ) -> str:
        model = self.get_model(tier)
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        api_key = self._validate_model_key(model)
        logger.info(
            "ai complete start model=%s tier=%s messages=%s max_tokens=%s",
            model,
            tier,
            len(messages),
            max_tokens,
        )
        kwargs = dict(
            model=model,
            messages=full_messages,
            stream=False,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if api_key:
            kwargs["api_key"] = api_key

        try:
            response = await litellm.acompletion(**kwargs)
        except Exception:
            logger.exception("ai complete request failed model=%s max_tokens=%s", model, max_tokens)
            raise
        content = response.choices[0].message.content
        logger.info("ai complete done model=%s output_chars=%s", model, len(content or ""))
        return content
