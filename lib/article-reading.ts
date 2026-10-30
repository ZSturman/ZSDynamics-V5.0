/** Applied to the parsed Markdown tree for both the contents and rendered headings. */
export type MarkdownNode = { type?: string; value?: string; depth?: number; children?: MarkdownNode[]; data?: { hProperties?: Record<string, unknown> } };
export type ArticleHeading = { id: string; title: string; depth: number };
function text(node: MarkdownNode): string {
  return node.value || (node.children || []).map(text).join("");
}
export function annotateHeadings(tree: MarkdownNode): ArticleHeading[] {
  const counts = new Map<string, number>();
  const headings: ArticleHeading[] = [];
  const walk = (node: MarkdownNode) => {
    if (node.type === "heading") {
      const title = text(node);
      const base = title.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
      const count = counts.get(base) || 0;
      counts.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      if ((node.depth || 0) >= 2 && title) headings.push({ id, title, depth: node.depth! });
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return headings;
}
export function readingMinutes(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 220));
}
