from __future__ import annotations
import json
import logging
import re
from typing import AsyncGenerator
from backend.api.models import (
    LearningSession, LearningPhase, ChatMessage, ChatOption,
    SyllabusNode, NodeStatus, ReviewResult, ReviewIssue,
)
from backend.learning.syllabus import (
    parse_syllabus_json, build_syllabus_tree, find_parent,
    syllabus_to_markdown, get_all_nodes_flat,
)
from backend.learning.navigator import Navigator
from backend.memory.filesystem import FilesystemMemory
from backend.ai.engine import AIEngine
from backend.ai.prompts import (
    QUESTIONING_PROMPT, SYLLABUS_PROMPT, REVIEW_PROMPT,
    DEEP_DIVE_PROMPT, SUMMARY_PROMPT,
)
from backend.config import Settings
from backend.learning.compression import ContextCompressor

METADATA_SEP = "---METADATA---"
logger = logging.getLogger(__name__)


class PhaseOrchestrator:
    def __init__(self, engine: AIEngine, memory: FilesystemMemory, settings: Settings):
        self.engine = engine
        self.memory = memory
        self.settings = settings
        self.compressor = ContextCompressor(engine, memory, settings)

    def update_settings(self, settings: Settings) -> None:
        self.settings = settings
        self.compressor.settings = settings

    async def handle_message(
        self, session: LearningSession, user_message: str
    ) -> AsyncGenerator[dict, None]:
        phase = session.phase
        logger.info("handle message session=%s phase=%s user_chars=%s", session.id, phase.value, len(user_message))

        if phase == LearningPhase.QUESTIONING:
            async for event in self._handle_questioning(session, user_message):
                yield event
        elif phase == LearningPhase.SYLLABUS:
            async for event in self._generate_syllabus(
                session,
                self._questioning_summary(session, user_message),
            ):
                yield event
            yield {"type": "phase_change", "content": "deep_dive"}
        elif phase == LearningPhase.DEEP_DIVE:
            async for event in self._handle_deep_dive(session, user_message):
                yield event
        elif phase == LearningPhase.SUMMARIZATION:
            async for event in self._handle_summary(session, user_message):
                yield event

    async def handle_initial_question(
        self, session: LearningSession
    ) -> AsyncGenerator[dict, None]:
        """Send the first AI question when a session is created (no user message needed)."""
        logger.info("initial question session=%s", session.id)
        async for event in self._handle_questioning(session, session.original_question):
            yield event

    async def _handle_questioning(
        self, session: LearningSession, user_message: str
    ) -> AsyncGenerator[dict, None]:
        nav = Navigator(session)
        current = nav.get_current_node()
        await self._compress_context(session, current, QUESTIONING_PROMPT, user_message, "questioning")
        history = self._build_history(current, session)
        logger.info("questioning start session=%s history=%s", session.id, len(history))
        self._append_message(
            current,
            session,
            ChatMessage(role="user", content=user_message, node_id=session.current_node_id),
        )

        # Buffer tokens for parsing
        full_raw = ""
        text_before_metadata = ""

        async for chunk in self.engine.stream_chat(
            QUESTIONING_PROMPT, history, user_message, max_tokens=self.settings.questioning_max_tokens
        ):
            if chunk["type"] == "token":
                full_raw += chunk["content"]
                # Stream only the text portion (before ---METADATA---)
                if METADATA_SEP not in full_raw:
                    yield {"type": "token", "content": chunk["content"]}
                elif not text_before_metadata:
                    # Just crossed the separator — send only the trailing text before it
                    text_before_metadata = full_raw.split(METADATA_SEP, 1)[0]
                    # Don't send anything for the separator line itself
            elif chunk["type"] == "done":
                # Parse the complete response
                content, options, action = self._split_response(full_raw)
                msg = ChatMessage(
                    role="assistant",
                    content=content,
                    node_id=session.current_node_id,
                    options=[ChatOption(**o) for o in options],
                )
                self._append_message(current, session, msg)

                if action == "generate_syllabus":
                    logger.info("questioning action generate_syllabus session=%s", session.id)
                    yield {"type": "phase_change", "content": "syllabus"}
                    try:
                        async for event in self._generate_syllabus(session, content):
                            yield event
                        yield {"type": "phase_change", "content": "deep_dive"}
                    except Exception:
                        session.phase = LearningPhase.QUESTIONING
                        self.memory.save_session(session.slug, session.model_dump(mode="json"))
                        logger.exception("syllabus generation failed rollback session=%s", session.id)
                        raise

                yield {
                    "type": "done",
                    "content": content,
                    "options": options,
                    "action": action,
                }

    async def _generate_syllabus(
        self, session: LearningSession, context_summary: str
    ) -> AsyncGenerator[dict, None]:
        user_context = f"用户原始问题：{session.original_question}\n\n对话总结：{context_summary}"
        messages = [{"role": "user", "content": user_context}]
        logger.info("syllabus generation start session=%s context_chars=%s", session.id, len(context_summary))

        # Generate
        raw = await self.engine.complete(
            SYLLABUS_PROMPT, messages, max_tokens=self.settings.syllabus_max_tokens
        )
        content, options, action = self._split_response(raw)

        syllabus_data = None
        if isinstance(action, dict) and action.get("type") == "syllabus_generated":
            syllabus_data = action.get("payload", {}).get("syllabus", [])

        if not syllabus_data:
            logger.error("syllabus generation missing payload session=%s raw_chars=%s", session.id, len(raw or ""))
            raise RuntimeError("大纲生成失败：AI 响应中没有有效 syllabus JSON，请重试。")

        # Review loop (max 3 attempts)
        for attempt in range(3):
            review = await self._review_syllabus(session, syllabus_data)
            logger.info(
                "syllabus review session=%s attempt=%s verdict=%s score=%s issues=%s",
                session.id,
                attempt + 1,
                review.verdict,
                review.score,
                len(review.issues),
            )
            if review.verdict == "pass":
                break
            # Re-generate with feedback
            feedback = "\n".join(
                f"- [{i.severity}] {i.location}: {i.suggestion}"
                for i in review.issues
            )
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": f"[审查反馈] 上一次生成的大纲有以下问题，请修正：\n{feedback}",
            })
            raw = await self.engine.complete(
                SYLLABUS_PROMPT, messages, max_tokens=self.settings.syllabus_max_tokens
            )
            content, options, action = self._split_response(raw)
            if isinstance(action, dict):
                syllabus_data = action.get("payload", {}).get("syllabus", [])
            if not syllabus_data:
                logger.error("syllabus regeneration missing payload session=%s attempt=%s", session.id, attempt + 1)
                raise RuntimeError("大纲重生成失败：AI 响应中没有有效 syllabus JSON，请重试。")

        # Build tree
        nodes = parse_syllabus_json(syllabus_data or [])
        session.syllabus = build_syllabus_tree(nodes)
        if not session.syllabus.children:
            logger.error("syllabus generation empty tree session=%s", session.id)
            raise RuntimeError("大纲生成失败：没有可学习的知识点，请重试。")

        # Auto-navigate to first child
        first = session.syllabus.children[0]
        first.status = NodeStatus.IN_PROGRESS
        session.current_node_id = first.id

        # Save MD
        md = syllabus_to_markdown(session.syllabus, session.name)
        self.memory.save_syllabus_md(session.slug, md)

        session.context_summary = context_summary
        session.phase = LearningPhase.DEEP_DIVE
        self.memory.save_session(session.slug, session.model_dump(mode="json"))
        logger.info(
            "syllabus generation done session=%s current_node=%s nodes=%s",
            session.id,
            session.current_node_id,
            len(get_all_nodes_flat(session.syllabus)),
        )

        yield {
            "type": "syllabus_update",
            "content": session.syllabus.model_dump(mode="json"),
        }

    async def _review_syllabus(
        self, session: LearningSession, syllabus_data: list
    ) -> ReviewResult:
        user_context = f"用户原始问题：{session.original_question}"
        review_input = f"用户背景：{user_context}\n\n大纲JSON：\n{json.dumps(syllabus_data, ensure_ascii=False, indent=2)}"
        messages = [{"role": "user", "content": review_input}]

        try:
            raw = await self.engine.complete(REVIEW_PROMPT, messages, max_tokens=self.settings.review_max_tokens)
            parsed = self._parse_json(raw)
            return ReviewResult(
                verdict=parsed.get("verdict", "pass"),
                score=parsed.get("score", 80),
                issues=[ReviewIssue(**i) for i in parsed.get("issues", [])],
                summary=parsed.get("summary", ""),
            )
        except Exception:
            return ReviewResult(verdict="pass", score=50, summary="审查失败，默认通过")

    async def _handle_deep_dive(
        self, session: LearningSession, user_message: str
    ) -> AsyncGenerator[dict, None]:
        nav = Navigator(session)
        current = nav.get_current_node()

        if not current:
            logger.warning(
                "deep dive without node session=%s phase=%s current_node=%s has_syllabus=%s",
                session.id,
                session.phase.value,
                session.current_node_id,
                bool(session.syllabus),
            )
            yield {"type": "error", "content": "未选择知识点"}
            return

        # Build context
        parent_ctx = ""
        if session.syllabus:
            p = find_parent(session.syllabus, current.id)
            if p and p.id != "root":
                parent_ctx = p.title

        prompt = DEEP_DIVE_PROMPT.format(
            topic_title=current.title,
            topic_description=current.description,
            parent_context=parent_ctx,
            user_context=session.original_question,
            context_summary=session.context_summary,
            node_id=current.id,
        )

        await self._compress_context(session, current, prompt, user_message, f"deep_dive:{current.id}")
        history = self._build_history(current, session)
        logger.info("deep dive start session=%s node=%s history=%s", session.id, current.id, len(history))
        self._append_message(
            current,
            session,
            ChatMessage(role="user", content=user_message, node_id=session.current_node_id),
        )

        full_raw = ""

        async for chunk in self.engine.stream_chat(
            prompt, history, user_message, max_tokens=self.settings.deep_dive_max_tokens
        ):
            if chunk["type"] == "token":
                full_raw += chunk["content"]
                # Stream only the text portion (before ---METADATA---)
                if METADATA_SEP not in full_raw:
                    yield {"type": "token", "content": chunk["content"]}
            elif chunk["type"] == "done":
                content, options, action = self._split_response(full_raw)
                msg = ChatMessage(
                    role="assistant",
                    content=content,
                    node_id=session.current_node_id,
                    options=[ChatOption(**o) for o in options],
                )
                self._append_message(current, session, msg)

                if isinstance(action, dict) and action.get("type") == "topic_complete":
                    current.status = NodeStatus.COMPLETED
                    self._save_topic(session, current)
                    session.context_summary += f"\n- {current.title}: 已学习完成"
                    self.memory.save_session(session.slug, session.model_dump(mode="json"))
                    logger.info("topic complete session=%s node=%s", session.id, current.id)

                yield {
                    "type": "done",
                    "content": content,
                    "options": options,
                    "action": action,
                }

    async def _handle_summary(
        self, session: LearningSession, user_message: str
    ) -> AsyncGenerator[dict, None]:
        prompt = self._summary_prompt(session)
        await self._compress_context(session, None, prompt, user_message, "summary")
        history = self._build_history(None, session)
        logger.info("summary chat start session=%s history=%s", session.id, len(history))
        self._append_message(
            None,
            session,
            ChatMessage(role="user", content=user_message, node_id=None),
        )
        full_raw = ""

        async for chunk in self.engine.stream_chat(
            prompt, history, user_message, max_tokens=self.settings.summary_max_tokens
        ):
            if chunk["type"] == "token":
                full_raw += chunk["content"]
                if METADATA_SEP not in full_raw:
                    yield {"type": "token", "content": chunk["content"]}
            elif chunk["type"] == "done":
                content, options, action = self._split_response(full_raw)
                msg = ChatMessage(
                    role="assistant",
                    content=content,
                    node_id=None,
                    options=[ChatOption(**o) for o in options],
                )
                self._append_message(None, session, msg)

                if isinstance(action, dict) and action.get("type") == "save_summary":
                    self.memory.save_summary_md(session.slug, content)
                    logger.info("summary saved session=%s chars=%s", session.id, len(content))

                yield {
                    "type": "done",
                    "content": content,
                    "options": options,
                    "action": action,
                }

    async def generate_summary(self, session: LearningSession) -> AsyncGenerator[dict, None]:
        session.phase = LearningPhase.SUMMARIZATION
        logger.info("summary generation start session=%s", session.id)
        yield {"type": "phase_change", "content": "summarization"}
        prompt = self._summary_prompt(session)
        summary_message = "请根据我已经完成的学习内容生成本次学习总结。"
        await self._compress_context(session, None, prompt, summary_message, "summary_generate")
        full_raw = ""

        async for chunk in self.engine.stream_chat(
            prompt,
            self._build_history(None, session),
            summary_message,
            max_tokens=self.settings.summary_max_tokens,
        ):
            if chunk["type"] == "token":
                full_raw += chunk["content"]
                if METADATA_SEP not in full_raw:
                    yield {"type": "token", "content": chunk["content"]}
            elif chunk["type"] == "done":
                content, options, action = self._split_response(full_raw)
                msg = ChatMessage(
                    role="assistant",
                    content=content,
                    node_id=None,
                    options=[ChatOption(**o) for o in options],
                )
                self._append_message(None, session, msg)
                self.memory.save_summary_md(session.slug, content)
                logger.info("summary generation done session=%s chars=%s", session.id, len(content))
                yield {
                    "type": "done",
                    "content": content,
                    "options": options,
                    "action": action or {"type": "save_summary", "payload": {}},
                }

    def _build_history(self, node: SyllabusNode | None, session: LearningSession) -> list[dict]:
        if node:
            return self.compressor.build_history(node)
        return self.compressor.build_history(session)

    async def _compress_context(
        self,
        session: LearningSession,
        node: SyllabusNode | None,
        system_prompt: str,
        pending_user_message: str,
        scope: str,
    ) -> None:
        owner = node or session
        result = await self.compressor.compress_if_needed(
            owner,
            session=session,
            scope=scope,
            system_prompt=system_prompt,
            pending_user_message=pending_user_message,
        )
        if result.compressed:
            logger.info(
                "context compressed session=%s scope=%s estimated_tokens=%s threshold=%s",
                session.id,
                scope,
                result.estimated_tokens,
                result.threshold_tokens,
            )

    def _append_message(self, node: SyllabusNode | None, session: LearningSession, msg: ChatMessage):
        if node:
            node.conversation_history.append(msg)
        else:
            session.conversation_history.append(msg)
        self.memory.save_session(session.slug, session.model_dump(mode="json"))

    def _save_topic(self, session: LearningSession, node: SyllabusNode):
        content_parts = [f"# {node.title}\n"]
        content_parts.append(f"> {node.description}\n")
        content_parts.append("## 学习内容\n")
        for msg in node.conversation_history:
            if msg.role == "assistant":
                content_parts.append(msg.content + "\n")
        content = "\n".join(content_parts)
        path = self.memory.save_topic_md(session.slug, node.title, content)
        node.file_path = path

    def _summary_prompt(self, session: LearningSession) -> str:
        covered = []
        if session.syllabus:
            covered = [
                f"{node.title}: {node.description}"
                for node in get_all_nodes_flat(session.syllabus)
                if node.status == NodeStatus.COMPLETED
            ]
        return SUMMARY_PROMPT.format(
            topics_covered="\n".join(covered) or "暂无已完成节点，请基于当前会话内容总结。",
            history_highlights=session.context_summary or "暂无额外摘要。",
        )

    def _questioning_summary(self, session: LearningSession, latest_user_message: str) -> str:
        lines = []
        for msg in session.conversation_history[-12:]:
            speaker = "用户" if msg.role == "user" else "Socrate"
            lines.append(f"{speaker}: {msg.content}")
        lines.append(f"用户确认: {latest_user_message}")
        return "\n".join(lines)

    def _split_response(self, raw: str) -> tuple[str, list[dict], any]:
        """Split response into (content, options, action) using ---METADATA--- separator.

        If no separator found, fall back to JSON parsing or treat as plain text.
        """
        if METADATA_SEP in raw:
            parts = raw.split(METADATA_SEP, 1)
            content = parts[0].strip()
            meta_text = parts[1].strip()
            parsed = self._parse_json(meta_text)
            return (
                content,
                parsed.get("options", []),
                parsed.get("action"),
            )

        # Fallback: try to parse entire response as JSON (backward compat)
        parsed = self._parse_json(raw)
        if "content" in parsed:
            return (
                parsed["content"],
                parsed.get("options", []),
                parsed.get("action"),
            )

        # Last resort: plain text, no options
        return (raw, [], None)

    def _parse_json(self, text: str) -> dict:
        """Extract JSON from text with multiple fallback strategies."""
        text = text.strip()
        if text.startswith("{"):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass
        match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {}
