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
    DEEP_DIVE_PROMPT, SUMMARY_PROMPT, PROFILE_DISTILLATION_PROMPT,
    FORK_CHAT_PROMPT,
)
from backend.config import Settings
from backend.learning.compression import ContextCompressor

METADATA_SEP = "---METADATA---"
logger = logging.getLogger(__name__)

DEFAULT_DEEP_DIVE_OPTIONS = [
    {"label": "理解了，继续", "value": "我理解了，请继续", "type": "default"},
    {"label": "举个例子", "value": "能举一个具体例子吗？", "type": "default"},
    {"label": "还有疑问", "value": "我有一个疑问", "type": "default"},
    {"label": "自定义", "value": "", "type": "custom"},
]

TOPIC_COMPLETE_OPTIONS = [
    {"label": "开始下一个主题", "value": "开始下一个主题", "type": "default"},
    {"label": "继续深入本节", "value": "我想继续深入这个主题", "type": "default"},
    {"label": "自定义", "value": "", "type": "custom"},
]

DEEP_DIVE_NAVIGATE_SIGNALS = ("开始下一个主题", "下一个主题", "下一节", "我理解了，请继续", "理解了，继续")
TOPIC_COMPLETE_TEXT_SIGNALS = ("开始下一个主题", "下一个主题", "下一节", "进入总结与下一个主题")
SUMMARY_NAVIGATE_SIGNALS = ("下一个主题", "继续学习", "开始下一", "下一节")


class PhaseOrchestrator:
    def __init__(self, engine: AIEngine, memory: FilesystemMemory, settings: Settings):
        self.engine = engine
        self.memory = memory
        self.settings = settings
        self.compressor = ContextCompressor(engine, memory, settings)

    def update_settings(self, settings: Settings) -> None:
        self.settings = settings
        self.compressor.settings = settings

    def _tier(self, session: LearningSession) -> str:
        return getattr(session, "model_tier", "fast") or "fast"

    def _is_metadata_complete(self, raw: str) -> bool:
        """True once the JSON block after ---METADATA--- is fully parseable.

        Uses strict json.loads (not the fuzzy _parse_json fallback) so that a
        partially-streamed options array whose first element happens to be valid
        JSON does not trigger a premature break.
        """
        if METADATA_SEP not in raw:
            return False
        meta_part = raw.split(METADATA_SEP, 1)[1].strip()
        if not meta_part.startswith("{"):
            return False
        try:
            json.loads(meta_part)
            return True
        except json.JSONDecodeError:
            return False

    async def _stream_with_early_done(
        self,
        system_prompt: str,
        history: list[dict],
        user_message: str,
        max_tokens: int,
        tier: str,
    ) -> AsyncGenerator[dict, None]:
        """Stream tokens to caller; stop as soon as metadata JSON is parseable.

        Yields token chunks (pre-METADATA only) then a single done chunk whose
        `content` is the fully accumulated raw response.
        """
        full_raw = ""
        async for chunk in self.engine.stream_chat(
            system_prompt, history, user_message,
            max_tokens=max_tokens, tier=tier,
        ):
            if chunk["type"] == "token":
                prev_len = len(full_raw)
                full_raw += chunk["content"]
                if METADATA_SEP not in full_raw:
                    yield {"type": "token", "content": chunk["content"]}
                else:
                    # If this chunk introduced the separator, yield the content
                    # that precedes it so the user sees the complete message text.
                    if METADATA_SEP not in full_raw[:prev_len]:
                        sep_idx = full_raw.index(METADATA_SEP)
                        prefix = full_raw[prev_len:sep_idx]
                        if prefix:
                            yield {"type": "token", "content": prefix}
                    if self._is_metadata_complete(full_raw):
                        break
            elif chunk["type"] == "done":
                # The engine's done event carries the complete accumulated text.
                # Use it in case the stream ended before our token loop saw everything.
                full_raw = chunk["content"]
                break
        yield {"type": "done", "content": full_raw}

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
        tier = self._tier(session)
        await self._compress_context(session, current, QUESTIONING_PROMPT, user_message, "questioning", tier=tier)
        history = self._build_history(current, session)
        logger.info("questioning start session=%s history=%s", session.id, len(history))
        self._append_message(
            current,
            session,
            ChatMessage(role="user", content=user_message, node_id=session.current_node_id),
        )

        full_raw = ""
        async for chunk in self._stream_with_early_done(
            QUESTIONING_PROMPT, history, user_message, max_tokens=self.settings.questioning_max_tokens, tier=tier
        ):
            if chunk["type"] == "token":
                yield chunk
            elif chunk["type"] == "done":
                full_raw = chunk["content"]
                full_raw = await self._ensure_metadata(session, full_raw, "questioning", tier)
                self._log_ai(session, "questioning", user_message, full_raw)
                # Parse the complete response
                content, options, action = self._split_response(full_raw)
                msg = ChatMessage(
                    role="assistant",
                    content=content,
                    node_id=session.current_node_id,
                    options=[ChatOption(**o) for o in options],
                )
                self._append_message(current, session, msg)

                should_generate = action == "generate_syllabus"
                # Fallback: AI returned summary without ---METADATA--- separator
                if not should_generate and not action and self._looks_like_questioning_summary(content, options, session):
                    should_generate = True
                    logger.warning("questioning fallback detected no metadata session=%s", session.id)

                if should_generate:
                    logger.info("questioning action generate_syllabus session=%s action=%s", session.id, action)
                    yield {"type": "phase_change", "content": "syllabus"}
                    try:
                        async for event in self._generate_syllabus(session, content):
                            yield event
                        yield {"type": "phase_change", "content": "deep_dive"}
                    except BaseException:
                        session.phase = LearningPhase.QUESTIONING
                        session.syllabus = None
                        session.current_node_id = None
                        self.memory.save_session(session.slug, session.model_dump(mode="json"))
                        logger.warning("syllabus generation interrupted rollback session=%s", session.id, exc_info=True)
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
        tier = self._tier(session)
        user_context = f"用户原始问题：{session.original_question}\n\n对话总结：{context_summary}"
        messages = [{"role": "user", "content": user_context}]
        logger.info("syllabus generation start session=%s context_chars=%s", session.id, len(context_summary))

        raw = ""
        syllabus_data: list[dict] = []
        for attempt in range(2):
            # Generate
            raw = await self.engine.complete(
                SYLLABUS_PROMPT, messages, max_tokens=self.settings.syllabus_max_tokens, tier=tier
            )
            self._log_ai(session, f"syllabus:attempt{attempt+1}", user_context, raw)
            content, options, action = self._split_response(raw)
            syllabus_data = self._extract_syllabus_data(raw, action)
            if syllabus_data:
                break
            logger.warning(
                "syllabus generation invalid response session=%s attempt=%s raw_chars=%s raw_preview=%r",
                session.id,
                attempt + 1,
                len(raw or ""),
                (raw or "")[:500],
            )
            if attempt == 0:
                yield {"type": "syllabus_retry", "content": "大纲生成没有成功，正在重新整理一次…"}
                messages = [{
                    "role": "user",
                    "content": user_context
                    + "\n\n重要：上一次响应没有可解析的 syllabus JSON。请重新生成，并严格在 ---METADATA--- 后输出包含 action.payload.syllabus 的 JSON 对象。",
                }]

        if not syllabus_data:
            logger.error(
                "syllabus generation missing payload session=%s raw_chars=%s raw_preview=%r",
                session.id,
                len(raw or ""),
                (raw or "")[:800],
            )
            raise RuntimeError("大纲生成失败：AI 响应中没有有效 syllabus JSON，请重试。")

        # Build tree first — so user gets syllabus even if review times out
        nodes = parse_syllabus_json(syllabus_data or [])
        session.syllabus = build_syllabus_tree(nodes)
        if not session.syllabus.children:
            logger.error("syllabus generation empty tree session=%s", session.id)
            raise RuntimeError("大纲生成失败：没有可学习的知识点，请重试。")

        # Auto-navigate to first leaf node (depth-first)
        def first_leaf(node: SyllabusNode) -> SyllabusNode:
            if not node.children:
                return node
            return first_leaf(node.children[0])

        first = first_leaf(session.syllabus.children[0])
        first.status = NodeStatus.IN_PROGRESS
        session.current_node_id = first.id

        # Save MD + session immediately
        md = syllabus_to_markdown(session.syllabus, session.name)
        self.memory.save_syllabus_md(session.slug, md)
        # Structure context_summary: mark the Q&A as user background, ready for profile distillation
        session.context_summary = f"【背景对话】\n{context_summary}"
        session.phase = LearningPhase.DEEP_DIVE
        self.memory.save_session(session.slug, session.model_dump(mode="json"))
        logger.info(
            "syllabus generation done session=%s current_node=%s nodes=%s",
            session.id,
            session.current_node_id,
            len(get_all_nodes_flat(session.syllabus)),
        )

        import asyncio
        yield {
            "type": "syllabus_review",
            "content": "大纲已生成，正在快速校验结构、顺序和粒度…",
        }
        try:
            await asyncio.wait_for(
                self._review_generated_syllabus(session, syllabus_data),
                timeout=60,  # covers initial review + one retry generation
            )
        except asyncio.TimeoutError:
            logger.warning("syllabus review timed out session=%s", session.id)
        except Exception:
            logger.error("syllabus review error session=%s", session.id, exc_info=True)
            raise

        yield {
            "type": "syllabus_update",
            "content": session.syllabus.model_dump(mode="json"),
        }

        # Profile distillation updates only context_summary and should not block entry to Deep Dive.
        asyncio.create_task(self._distill_and_update_profile(session, context_summary))

    async def _review_generated_syllabus(
        self, session: LearningSession, syllabus_data: list
    ) -> None:
        """Review the syllabus; on verdict fail regenerate once with issue hints.

        Exceptions propagate to the caller — they are NOT swallowed here.
        """
        tier = self._tier(session)
        review = await self._review_syllabus(session, syllabus_data, tier)
        logger.info(
            "syllabus review session=%s verdict=%s score=%s issues=%s",
            session.id, review.verdict, review.score, len(review.issues),
        )

        if review.verdict == "pass":
            return

        # Verdict failed — regenerate once, injecting reviewer feedback as hints
        logger.warning(
            "syllabus review failed, regenerating session=%s summary=%s",
            session.id, review.summary,
        )
        issue_hints = "\n".join(
            f"- [{i.severity}] {i.description}（建议：{i.suggestion}）"
            for i in review.issues
        )
        retry_messages = [{
            "role": "user",
            "content": (
                f"用户原始问题：{session.original_question}\n\n"
                f"对话总结：{session.context_summary}\n\n"
                f"上一版大纲存在以下问题，请修正后重新生成：\n{issue_hints}"
            ),
        }]
        raw = await self.engine.complete(
            SYLLABUS_PROMPT, retry_messages,
            max_tokens=self.settings.syllabus_max_tokens, tier=tier,
        )
        self._log_ai(session, "syllabus:review_retry", retry_messages[0]["content"], raw)
        _, _, action = self._split_response(raw)
        new_data = self._extract_syllabus_data(raw, action)

        if not new_data:
            logger.warning(
                "syllabus review retry yielded no valid data, keeping original session=%s", session.id
            )
            return

        nodes = parse_syllabus_json(new_data)
        new_syllabus = build_syllabus_tree(nodes)
        if not new_syllabus.children:
            logger.warning(
                "syllabus review retry yielded empty tree, keeping original session=%s", session.id
            )
            return

        def first_leaf(node: SyllabusNode) -> SyllabusNode:
            return node if not node.children else first_leaf(node.children[0])

        first = first_leaf(new_syllabus.children[0])
        first.status = NodeStatus.IN_PROGRESS
        session.syllabus = new_syllabus
        session.current_node_id = first.id

        md = syllabus_to_markdown(session.syllabus, session.name)
        self.memory.save_syllabus_md(session.slug, md)
        self.memory.save_session(session.slug, session.model_dump(mode="json"))
        logger.info(
            "syllabus review retry done session=%s nodes=%s",
            session.id, len(get_all_nodes_flat(session.syllabus)),
        )

    async def _distill_and_update_profile(
        self, session: LearningSession, raw_conversation: str
    ) -> None:
        """Background: distill Q&A into a concise structured user profile and replace the raw transcript."""
        try:
            prompt = PROFILE_DISTILLATION_PROMPT.format(conversation=raw_conversation)
            messages = [{"role": "user", "content": raw_conversation}]
            profile = await self.engine.complete(prompt, messages, max_tokens=256, tier=self._tier(session))
            self._log_ai(session, "profile_distillation", raw_conversation[:500], profile or "")
            if profile and len(profile.strip()) > 20:
                # Replace the raw Q&A block; preserve any progress entries already appended
                progress_marker = "\n\n【已学进度】"
                idx = session.context_summary.find(progress_marker)
                progress_part = session.context_summary[idx:] if idx >= 0 else ""
                session.context_summary = f"【用户档案】\n{profile.strip()}{progress_part}"
                self.memory.save_session(session.slug, session.model_dump(mode="json"))
                logger.info(
                    "profile distillation done session=%s profile_chars=%s",
                    session.id,
                    len(profile.strip()),
                )
        except Exception:
            logger.warning("profile distillation failed session=%s", session.id, exc_info=True)

    async def _review_syllabus(
        self, session: LearningSession, syllabus_data: list, tier: str = "fast"
    ) -> ReviewResult:
        user_context = f"用户原始问题：{session.original_question}"
        review_input = f"用户背景：{user_context}\n\n大纲JSON：\n{json.dumps(syllabus_data, ensure_ascii=False, indent=2)}"
        messages = [{"role": "user", "content": review_input}]

        raw = await self.engine.complete(REVIEW_PROMPT, messages, max_tokens=self.settings.review_max_tokens, tier=tier)
        self._log_ai(session, "review", review_input, raw)
        parsed = self._parse_json(raw)
        try:
            return ReviewResult(
                verdict=parsed.get("verdict", "pass"),
                score=parsed.get("score", 80),
                issues=[ReviewIssue(**i) for i in parsed.get("issues", [])],
                summary=parsed.get("summary", ""),
            )
        except Exception:
            logger.warning("review result schema mismatch session=%s", session.id, exc_info=True)
            return ReviewResult(verdict="pass", score=50, issues=[], summary="审查结果解析失败，默认通过")

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

        if current.status == NodeStatus.COMPLETED and any(signal in user_message for signal in DEEP_DIVE_NAVIGATE_SIGNALS):
            yield {"type": "navigate_to_next"}
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
            topic_path=" > ".join(item["title"] for item in nav.get_breadcrumb()) or current.title,
            parent_context=parent_ctx,
            user_profile=session.context_summary or session.original_question,
            node_id=current.id,
        )

        tier = self._tier(session)
        await self._compress_context(session, current, prompt, user_message, f"deep_dive:{current.id}", tier=tier)
        history = self._build_history(current, session)
        logger.info("deep dive start session=%s node=%s history=%s", session.id, current.id, len(history))
        self._append_message(
            current,
            session,
            ChatMessage(role="user", content=user_message, node_id=session.current_node_id),
        )

        full_raw = ""
        async for chunk in self._stream_with_early_done(
            prompt, history, user_message, max_tokens=self.settings.deep_dive_max_tokens, tier=tier
        ):
            if chunk["type"] == "token":
                yield chunk
            elif chunk["type"] == "done":
                full_raw = chunk["content"]
                full_raw = await self._ensure_metadata(session, full_raw, f"deep_dive:{current.id}", tier)
                self._log_ai(session, f"deep_dive:{current.id}", user_message, full_raw)
                content, options, action = self._split_response(full_raw)
                is_topic_complete = isinstance(action, dict) and action.get("type") == "topic_complete"
                if not is_topic_complete and self._looks_like_topic_complete_text(content, options, action):
                    is_topic_complete = True
                    action = {"type": "topic_complete", "payload": {"node_id": current.id}}
                    options = TOPIC_COMPLETE_OPTIONS
                    logger.warning("deep dive topic_complete inferred from text session=%s node=%s", session.id, current.id)
                if not options and not is_topic_complete:
                    if "？" in content or "?" in content:
                        logger.warning(
                            "deep_dive inquiry turn missing options session=%s node=%s content_tail=%r",
                            session.id, current.id, content[-200:],
                        )
                    options = DEFAULT_DEEP_DIVE_OPTIONS
                msg = ChatMessage(
                    role="assistant",
                    content=content,
                    node_id=session.current_node_id,
                    options=[ChatOption(**o) for o in options],
                )
                self._append_message(current, session, msg)

                if is_topic_complete:
                    self.complete_node(session, current)
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
        if any(signal in user_message for signal in SUMMARY_NAVIGATE_SIGNALS):
            yield {"type": "navigate_to_next"}
            return

        tier = self._tier(session)
        prompt = self._summary_prompt(session)
        await self._compress_context(session, None, prompt, user_message, "summary", tier=tier)
        history = self._build_history(None, session)
        logger.info("summary chat start session=%s history=%s", session.id, len(history))
        self._append_message(
            None,
            session,
            ChatMessage(role="user", content=user_message, node_id=None),
        )
        full_raw = ""
        async for chunk in self._stream_with_early_done(
            prompt, history, user_message, max_tokens=self.settings.summary_max_tokens, tier=tier
        ):
            if chunk["type"] == "token":
                yield chunk
            elif chunk["type"] == "done":
                full_raw = chunk["content"]
                full_raw = await self._ensure_metadata(session, full_raw, "summary", tier)
                self._log_ai(session, "summary", user_message, full_raw)
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
        tier = self._tier(session)
        session.phase = LearningPhase.SUMMARIZATION
        logger.info("summary generation start session=%s", session.id)
        yield {"type": "phase_change", "content": "summarization"}
        prompt = self._summary_prompt(session)
        summary_message = "请根据我已经完成的学习内容生成本次学习总结。"
        await self._compress_context(session, None, prompt, summary_message, "summary_generate", tier=tier)
        full_raw = ""
        async for chunk in self._stream_with_early_done(
            prompt,
            self._build_history(None, session),
            summary_message,
            max_tokens=self.settings.summary_max_tokens,
            tier=tier,
        ):
            if chunk["type"] == "token":
                yield chunk
            elif chunk["type"] == "done":
                full_raw = chunk["content"]
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

    async def handle_fork_chat(
        self,
        session: LearningSession,
        excerpt: str,
        history: list[dict],
        user_message: str,
    ) -> AsyncGenerator[dict, None]:
        """Answer a stateless side conversation grounded in a selected excerpt."""
        topic = session.original_question or session.name
        prompt = FORK_CHAT_PROMPT.format(topic=topic, excerpt=excerpt)
        tier = self._tier(session)
        safe_history = self._sanitize_fork_history(history)
        logger.info(
            "fork chat start session=%s excerpt_chars=%s history=%s message_chars=%s",
            session.id,
            len(excerpt),
            len(safe_history),
            len(user_message),
        )

        full_raw = ""
        async for chunk in self._stream_with_early_done(
            prompt,
            safe_history,
            user_message,
            max_tokens=self.settings.deep_dive_max_tokens,
            tier=tier,
        ):
            if chunk["type"] == "token":
                yield chunk
            elif chunk["type"] == "done":
                full_raw = chunk["content"]
                self._log_ai(session, "fork_chat", user_message, full_raw)
                content, options, action = self._split_response(full_raw)
                if not options:
                    options = DEFAULT_DEEP_DIVE_OPTIONS
                yield {
                    "type": "done",
                    "content": content,
                    "options": options,
                    "action": action,
                }
                logger.info("fork chat done session=%s response_chars=%s", session.id, len(content))

    def _sanitize_fork_history(self, history: list[dict]) -> list[dict]:
        safe: list[dict] = []
        for item in history[-20:]:
            role = item.get("role")
            content = item.get("content")
            if role not in {"user", "assistant"} or not isinstance(content, str):
                continue
            safe.append({"role": role, "content": content[:6000]})
        return safe

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
        tier: str = "fast",
    ) -> None:
        owner = node or session
        result = await self.compressor.compress_if_needed(
            owner,
            session=session,
            scope=scope,
            system_prompt=system_prompt,
            pending_user_message=pending_user_message,
            tier=tier,
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

    def _append_topic_progress(self, session: LearningSession, node: SyllabusNode) -> None:
        """Append a richer topic completion note to context_summary for cross-topic continuity."""
        if "\n\n【已学进度】" not in session.context_summary:
            session.context_summary += "\n\n【已学进度】"
        desc_snippet = node.description[:60].rstrip() if node.description else ""
        entry = f"\n- {node.title}"
        if desc_snippet:
            entry += f"（{desc_snippet}）"
        entry += "：已完成"
        session.context_summary += entry

    def complete_node(self, session: LearningSession, node: SyllabusNode) -> bool:
        """Mark a node complete and persist the same side effects as topic_complete."""
        if node.status == NodeStatus.COMPLETED:
            return False
        node.status = NodeStatus.COMPLETED
        self._save_topic(session, node)
        self._append_topic_progress(session, node)
        self.memory.save_session(session.slug, session.model_dump(mode="json"))
        return True

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

    # Only phrases that strongly indicate a transition to syllabus generation.
    # Avoid common conversational words like "接下来" that appear in normal questions.
    _SUMMARY_SIGNALS = ("我理解了你的需求", "我已经了解", "为你量身定制", "为你制定", "为你生成", "我来为你生成", "已经充分了解")

    def _looks_like_questioning_summary(
        self, content: str, options: list[dict], session: LearningSession
    ) -> bool:
        """Detect AI summary without ---METADATA--- (model omitted structured output)."""
        # Need at least 2 rounds of Q&A
        user_msg_count = sum(1 for m in session.conversation_history if m.role == "user")
        if user_msg_count < 2:
            return False
        no_options = len(options) == 0
        # If AI provided options it is still mid-questioning; never treat as a summary.
        if not no_options:
            return False
        # No metadata + no question mark → almost certainly a plain-text summary.
        no_question = "？" not in content and "?" not in content
        if no_question:
            return True
        # No metadata but content has a question mark → only trigger on very specific
        # phrases that unambiguously signal "I have enough info, generating syllabus now".
        return any(signal in content for signal in self._SUMMARY_SIGNALS)

    def _looks_like_topic_complete_text(self, content: str, options: list[dict], action: any) -> bool:
        """Detect plain-text end-of-topic navigation hints when metadata was omitted."""
        if action or options:
            return False
        tail = content[-700:]
        return any(signal in tail for signal in TOPIC_COMPLETE_TEXT_SIGNALS)

    def _extract_syllabus_data(self, raw: str, action: any) -> list[dict]:
        """Accept the intended metadata shape plus common model output variants."""
        candidates: list[any] = []
        if action is not None:
            candidates.append(action)

        parsed = self._parse_json_value(raw)
        if parsed is not None:
            candidates.append(parsed)
        if METADATA_SEP in raw:
            meta_text = raw.split(METADATA_SEP, 1)[1]
            parsed_meta = self._parse_json_value(meta_text)
            if parsed_meta is not None:
                candidates.append(parsed_meta)

        for candidate in candidates:
            syllabus = self._syllabus_from_candidate(candidate)
            if syllabus:
                return syllabus

        # Fallback: the outer JSON wrapper may be truncated (missing closing braces)
        # but the syllabus array itself is usually complete. Extract it directly.
        return self._extract_syllabus_array_direct(raw)

    def _extract_syllabus_array_direct(self, raw: str) -> list[dict]:
        """Extract syllabus array from text even when outer JSON is malformed/truncated.

        Searches for ``"syllabus": [...]`` and parses the array with raw_decode so
        that a missing outer closing brace does not prevent extraction.
        """
        match = re.search(r'"syllabus"\s*:\s*(\[)', raw)
        if not match:
            return []
        array_start = match.start(1)
        decoder = json.JSONDecoder()
        try:
            value, _ = decoder.raw_decode(raw[array_start:])
        except json.JSONDecodeError:
            return []
        if not isinstance(value, list):
            return []
        if value and all(isinstance(item, dict) and "title" in item for item in value):
            return value
        return []

    def _syllabus_from_candidate(self, value: any) -> list[dict]:
        if isinstance(value, list):
            # Require items to look like syllabus nodes (must have "title" key).
            # Guards against mistakenly treating options arrays as syllabus data.
            if value and all(isinstance(item, dict) and "title" in item for item in value):
                return value
            return []
        if not isinstance(value, dict):
            return []

        action = value.get("action")
        if isinstance(action, dict):
            nested = self._syllabus_from_candidate(action)
            if nested:
                return nested
        elif action == "syllabus_generated":
            payload = value.get("payload")
            if isinstance(payload, dict):
                syllabus = payload.get("syllabus")
                if isinstance(syllabus, list):
                    return syllabus

        payload = value.get("payload")
        if isinstance(payload, dict):
            syllabus = payload.get("syllabus")
            if isinstance(syllabus, list):
                return syllabus

        syllabus = value.get("syllabus")
        if isinstance(syllabus, list):
            return syllabus

        return []

    async def _ensure_metadata(
        self, session: LearningSession, full_raw: str, phase_hint: str, tier: str
    ) -> str:
        """If full_raw has no valid metadata, make a short supplementary call to extract options.

        Returns the augmented full_raw. Falls back to original if extraction fails.
        """
        # Check whether we already have usable metadata
        if METADATA_SEP in full_raw:
            _, options, action = self._split_response(full_raw)
            if options or action:
                return full_raw

        content = full_raw.split(METADATA_SEP, 1)[0].strip() if METADATA_SEP in full_raw else full_raw.strip()
        logger.warning(
            "metadata missing or incomplete, extracting fallback session=%s phase=%s content_tail=%r",
            session.id, phase_hint, content[-100:],
        )

        meta_prompt = (
            "根据以下 AI 回复内容，生成对应的交互选项 JSON。\n\n"
            "规则：\n"
            "- 教学轮（讲解概念、举例说明）→ 标准继续选项\n"
            '  {"options":[{"label":"理解了，继续","value":"我理解了，请继续","type":"default"},'
            '{"label":"举个例子","value":"能再举一个具体的例子吗？","type":"default"},'
            '{"label":"还有疑问","value":"我有一个疑问","type":"default"},'
            '{"label":"自定义","value":"","type":"custom"}],"action":null}\n'
            "- 追问轮（正文列出了具体方案/选项让用户选择）→ options 精确对应正文选项，label≤6字，value为完整回答句\n"
            "- 只输出 JSON 对象本身，不要任何其他文字\n\n"
            f"AI回复（最后1000字）：\n{content[-1000:]}"
        )
        try:
            extra = await self.engine.complete(
                "",
                [{"role": "user", "content": meta_prompt}],
                max_tokens=400,
                tier=tier,
            )
            extra = extra.strip()
            # Strip any accidental ---METADATA--- prefix the model might add
            if METADATA_SEP in extra:
                extra = extra.split(METADATA_SEP, 1)[1].strip()
            parsed = self._parse_json(extra)
            if isinstance(parsed.get("options"), list) and parsed["options"]:
                augmented = content + f"\n\n{METADATA_SEP}\n" + extra
                logger.info(
                    "metadata fallback succeeded session=%s phase=%s options=%s",
                    session.id, phase_hint, len(parsed["options"]),
                )
                return augmented
        except Exception:
            logger.warning(
                "metadata fallback failed session=%s phase=%s", session.id, phase_hint, exc_info=True
            )
        return full_raw

    def _log_ai(self, session: LearningSession, phase: str, user_input: str, raw_response: str) -> None:
        try:
            from datetime import datetime, timezone
            self.memory.append_ai_log(session.slug, {
                "ts": datetime.now(timezone.utc).isoformat(),
                "phase": phase,
                "input": user_input,
                "response": raw_response,
            })
        except Exception:
            pass

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
        value = self._parse_json_value(text)
        return value if isinstance(value, dict) else {}

    def _parse_json_value(self, text: str) -> any:
        """Extract a JSON object or array from text with multiple fallback strategies."""
        text = text.strip()
        if text.startswith(("{", "[")):
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
        decoder = json.JSONDecoder()
        for i, char in enumerate(text):
            if char not in "{[":
                continue
            try:
                value, _ = decoder.raw_decode(text[i:])
                return value
            except json.JSONDecodeError:
                continue
        return None
