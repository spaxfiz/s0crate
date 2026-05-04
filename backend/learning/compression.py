from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from backend.ai.engine import AIEngine
from backend.ai.prompts import CAVEMAN_COMPRESS_PROMPT
from backend.api.models import ChatMessage, LearningSession
from backend.config import Settings
from backend.memory.filesystem import FilesystemMemory

logger = logging.getLogger(__name__)

_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


class CompressibleContext(Protocol):
    conversation_history: list[ChatMessage]
    compressed_context: str
    compressed_message_count: int
    compression_count: int
    last_compressed_at: datetime | None


@dataclass
class CompressionResult:
    compressed: bool
    estimated_tokens: int
    threshold_tokens: int


class ContextCompressor:
    def __init__(self, engine: AIEngine, memory: FilesystemMemory, settings: Settings):
        self.engine = engine
        self.memory = memory
        self.settings = settings

    async def compress_if_needed(
        self,
        owner: CompressibleContext,
        *,
        session: LearningSession,
        scope: str,
        system_prompt: str,
        pending_user_message: str,
        tier: str = "fast",
    ) -> CompressionResult:
        threshold = int(self.settings.context_window_tokens * self.settings.compression_threshold_ratio)
        current_tokens = self.estimate_context_tokens(owner, system_prompt, pending_user_message)
        if current_tokens < threshold:
            return CompressionResult(False, current_tokens, threshold)

        messages = owner.conversation_history
        start = max(0, owner.compressed_message_count)
        keep = max(1, self.settings.compression_recent_messages)
        compress_upto = max(start, len(messages) - keep)
        if compress_upto <= start:
            logger.warning(
                "context compression skipped scope=%s estimated_tokens=%s threshold=%s reason=no_old_messages",
                scope,
                current_tokens,
                threshold,
            )
            return CompressionResult(False, current_tokens, threshold)

        payload = self._build_compression_payload(
            existing_context=owner.compressed_context,
            messages=messages[start:compress_upto],
        )
        logger.info(
            "context compression start scope=%s estimated_tokens=%s threshold=%s messages=%s start=%s upto=%s",
            scope,
            current_tokens,
            threshold,
            len(messages),
            start,
            compress_upto,
        )
        compressed = await self.engine.complete(
            CAVEMAN_COMPRESS_PROMPT,
            [{"role": "user", "content": f"TEXT:\n{payload}"}],
            max_tokens=self.settings.compression_max_tokens,
            tier=tier,
        )
        compressed = compressed.strip()
        if not compressed:
            raise RuntimeError("上下文压缩失败：AI 返回了空内容")

        owner.compressed_context = compressed
        owner.compressed_message_count = compress_upto
        owner.compression_count += 1
        owner.last_compressed_at = datetime.now()
        self.memory.save_session(session.slug, session.model_dump(mode="json"))

        after_tokens = self.estimate_context_tokens(owner, system_prompt, pending_user_message)
        logger.info(
            "context compression done scope=%s before_tokens=%s after_tokens=%s compressed_messages=%s count=%s",
            scope,
            current_tokens,
            after_tokens,
            compress_upto,
            owner.compression_count,
        )
        return CompressionResult(True, after_tokens, threshold)

    def estimate_context_tokens(
        self,
        owner: CompressibleContext,
        system_prompt: str,
        pending_user_message: str = "",
    ) -> int:
        tokens = estimate_text_tokens(system_prompt) + estimate_text_tokens(pending_user_message)
        if owner.compressed_context:
            tokens += estimate_text_tokens(owner.compressed_context) + 12
        for msg in owner.conversation_history[max(0, owner.compressed_message_count):]:
            tokens += estimate_text_tokens(msg.content) + 8
        return tokens

    def build_history(self, owner: CompressibleContext) -> list[dict]:
        history: list[dict] = []
        if owner.compressed_context:
            history.append({
                "role": "user",
                "content": "[已压缩历史上下文，仅供参考，不需要直接回复]\n" + owner.compressed_context,
            })
        for msg in owner.conversation_history[max(0, owner.compressed_message_count):]:
            history.append({"role": msg.role, "content": msg.content})
        return history

    def _build_compression_payload(self, existing_context: str, messages: list[ChatMessage]) -> str:
        parts: list[str] = []
        if existing_context:
            parts.append("# Existing compressed context\n")
            parts.append(existing_context.strip())
            parts.append("")
        parts.append("# Conversation messages to compress")
        for idx, msg in enumerate(messages, start=1):
            parts.append(f"\n## Message {idx}: {msg.role}")
            parts.append(f"timestamp: {msg.timestamp.isoformat()}")
            if msg.node_id:
                parts.append(f"node_id: {msg.node_id}")
            parts.append("")
            parts.append(msg.content)
        return "\n".join(parts).strip()


def estimate_text_tokens(text: str) -> int:
    if not text:
        return 0
    cjk_chars = len(_CJK_RE.findall(text))
    non_cjk_chars = len(_CJK_RE.sub("", text))
    return cjk_chars + ((non_cjk_chars + 3) // 4)
