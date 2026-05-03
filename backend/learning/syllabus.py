from __future__ import annotations
from backend.api.models import SyllabusNode, NodeStatus
from backend.memory.filesystem import FilesystemMemory
import uuid


def parse_syllabus_json(items: list[dict], depth: int = 0) -> list[SyllabusNode]:
    nodes = []
    for i, item in enumerate(items):
        node = SyllabusNode(
            id=str(uuid.uuid4())[:8],
            title=item.get("title", ""),
            description=item.get("description", ""),
            num=_to_num(depth, i),
            depth=depth,
            order=i,
            status=NodeStatus.PENDING,
            children=parse_syllabus_json(item.get("children", []), depth + 1),
        )
        nodes.append(node)
    return nodes


def build_syllabus_tree(nodes: list[SyllabusNode]) -> SyllabusNode:
    return SyllabusNode(
        id="root",
        title="学习大纲",
        description="",
        num="",
        depth=-1,
        children=nodes,
    )


def find_node(root: SyllabusNode, node_id: str) -> SyllabusNode | None:
    if root.id == node_id:
        return root
    for child in root.children:
        result = find_node(child, node_id)
        if result:
            return result
    return None


def find_parent(root: SyllabusNode, node_id: str) -> SyllabusNode | None:
    for child in root.children:
        if child.id == node_id:
            return root
        result = find_parent(child, node_id)
        if result:
            return result
    return None


def get_breadcrumb(root: SyllabusNode, node_id: str) -> list[dict]:
    path: list[dict] = []
    _build_path(root, node_id, path)
    return path


def _build_path(root: SyllabusNode, target_id: str, path: list[dict]) -> bool:
    if root.id == target_id:
        path.append({"id": root.id, "title": root.title})
        return True
    for child in root.children:
        if _build_path(child, target_id, path):
            if root.id != "root":
                path.insert(0, {"id": root.id, "title": root.title})
            return True
    return False


def get_all_nodes_flat(root: SyllabusNode) -> list[SyllabusNode]:
    result = []
    if root.id != "root":
        result.append(root)
    for child in root.children:
        result.extend(get_all_nodes_flat(child))
    return result


def count_progress(root: SyllabusNode) -> tuple[int, int]:
    all_nodes = get_all_nodes_flat(root)
    total = len(all_nodes)
    done = sum(1 for n in all_nodes if n.status == NodeStatus.COMPLETED)
    return done, total


def syllabus_to_markdown(root: SyllabusNode, title: str = "学习计划") -> str:
    lines = [f"# {title}\n"]
    for node in root.children:
        _node_to_md(node, lines, depth=1)
    return "\n".join(lines)


def _node_to_md(node: SyllabusNode, lines: list[str], depth: int):
    prefix = "#" * (depth + 1)
    lines.append(f"{prefix} {node.title}")
    if node.description:
        lines.append(f"{node.description}\n")
    for child in node.children:
        _node_to_md(child, lines, depth + 1)


def _to_num(depth: int, index: int) -> str:
    if depth == 0:
        return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][index] if index < 10 else str(index + 1)
    return str(index + 1)
