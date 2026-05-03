from __future__ import annotations
from backend.api.models import LearningSession, SyllabusNode, NodeStatus
from backend.learning.syllabus import find_node, find_parent, get_breadcrumb, get_all_nodes_flat


class Navigator:
    def __init__(self, session: LearningSession):
        self.session = session

    def get_current_node(self) -> SyllabusNode | None:
        if not self.session.syllabus or not self.session.current_node_id:
            return None
        return find_node(self.session.syllabus, self.session.current_node_id)

    def get_breadcrumb(self) -> list[dict]:
        if not self.session.syllabus or not self.session.current_node_id:
            return []
        return get_breadcrumb(self.session.syllabus, self.session.current_node_id)

    def navigate_to(self, node_id: str) -> SyllabusNode:
        if not self.session.syllabus:
            raise ValueError("No syllabus")
        node = find_node(self.session.syllabus, node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found")
        if node.status == NodeStatus.PENDING:
            node.status = NodeStatus.IN_PROGRESS
        self.session.current_node_id = node_id
        return node

    def navigate_back(self) -> SyllabusNode | None:
        if not self.session.syllabus or not self.session.current_node_id:
            return None
        parent = find_parent(self.session.syllabus, self.session.current_node_id)
        if parent and parent.id != "root":
            self.session.current_node_id = parent.id
            return parent
        return None

    def navigate_next(self) -> SyllabusNode | None:
        if not self.session.syllabus or not self.session.current_node_id:
            return None
        parent = find_parent(self.session.syllabus, self.session.current_node_id)
        if not parent:
            return None
        children = parent.children
        for i, child in enumerate(children):
            if child.id == self.session.current_node_id and i + 1 < len(children):
                next_node = children[i + 1]
                self.session.current_node_id = next_node.id
                if next_node.status == NodeStatus.PENDING:
                    next_node.status = NodeStatus.IN_PROGRESS
                return next_node
        return None

    def has_next(self) -> bool:
        if not self.session.syllabus or not self.session.current_node_id:
            return False
        parent = find_parent(self.session.syllabus, self.session.current_node_id)
        if not parent:
            return False
        children = parent.children
        for i, child in enumerate(children):
            if child.id == self.session.current_node_id:
                return i + 1 < len(children)
        return False

    def navigate_overview(self) -> SyllabusNode:
        if not self.session.syllabus:
            raise ValueError("No syllabus")
        self.session.current_node_id = self.session.syllabus.id
        return self.session.syllabus
