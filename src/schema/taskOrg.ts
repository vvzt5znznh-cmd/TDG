import type { TaskOrgNode } from "./types";

export function walkTaskOrg(node: TaskOrgNode, visit: (node: TaskOrgNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  for (const child of node.children) {
    walkTaskOrg(child, visit, depth + 1);
  }
}

export function flattenTaskOrg(root: TaskOrgNode): { node: TaskOrgNode; depth: number }[] {
  const out: { node: TaskOrgNode; depth: number }[] = [];
  walkTaskOrg(root, (node, depth) => {
    out.push({ node, depth });
  });
  return out;
}

export function findTaskOrgNode(root: TaskOrgNode, id: string): TaskOrgNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findTaskOrgNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function mapTaskOrg(root: TaskOrgNode, fn: (node: TaskOrgNode) => TaskOrgNode): TaskOrgNode {
  const mapped = fn(root);
  return {
    ...mapped,
    children: mapped.children.map((child) => mapTaskOrg(child, fn)),
  };
}

export function modifierMark(modifier: TaskOrgNode["modifier"]): string {
  if (modifier === "reinforced") return " (+)";
  if (modifier === "reduced") return " (−)";
  return "";
}

export function formatDesignation(node: TaskOrgNode): string {
  return `${node.designation}${modifierMark(node.modifier)}`;
}

export function allDesignations(root: TaskOrgNode): string[] {
  return flattenTaskOrg(root).map(({ node }) => node.designation).filter((d) => d.trim().length > 0);
}

export function allTaskOrgIds(root: TaskOrgNode): Set<string> {
  return new Set(flattenTaskOrg(root).map(({ node }) => node.id));
}
