from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional
import uuid


class LearningPhase(str, Enum):
    QUESTIONING = "questioning"
    SYLLABUS = "syllabus"
    DEEP_DIVE = "deep_dive"
    SUMMARIZATION = "summarization"


class NodeStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ChatOption(BaseModel):
    label: str
    value: str
    type: str = "default"


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    node_id: Optional[str] = None
    options: Optional[list[ChatOption]] = None


class SyllabusNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str
    description: str = ""
    num: str = ""
    depth: int = 0
    order: int = 0
    status: NodeStatus = NodeStatus.PENDING
    children: list[SyllabusNode] = Field(default_factory=list)
    file_path: Optional[str] = None
    conversation_history: list[ChatMessage] = Field(default_factory=list)
    compressed_context: str = ""
    compressed_message_count: int = 0
    compression_count: int = 0
    last_compressed_at: Optional[datetime] = None


class LearningSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    slug: str
    original_question: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    phase: LearningPhase = LearningPhase.QUESTIONING
    model_tier: str = "fast"
    syllabus: Optional[SyllabusNode] = None
    current_node_id: Optional[str] = None
    context_summary: str = ""
    conversation_history: list[ChatMessage] = Field(default_factory=list)
    compressed_context: str = ""
    compressed_message_count: int = 0
    compression_count: int = 0
    last_compressed_at: Optional[datetime] = None


class ReviewIssue(BaseModel):
    type: str
    severity: str
    location: str
    description: str
    suggestion: str


class ReviewResult(BaseModel):
    verdict: str
    score: int
    issues: list[ReviewIssue] = Field(default_factory=list)
    summary: str


# --- API request/response models ---

class CreateSessionRequest(BaseModel):
    question: str
    model_tier: str = "fast"


class ChatRequest(BaseModel):
    message: str


class ForkChatRequest(BaseModel):
    excerpt: str
    message: str
    history: list[dict] = Field(default_factory=list)


class NavigateRequest(BaseModel):
    node_id: str


class SaveSettingsRequest(BaseModel):
    fast_model: Optional[str] = None
    pro_model: Optional[str] = None
    api_keys: Optional[dict[str, str]] = None
