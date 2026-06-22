const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function resolveArticleHref(target: string | null | undefined, slug: string): string {
  const value = (target || "").trim();
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:") || value.startsWith("data:")) {
    return value;
  }
  if (SCHEME_RE.test(value)) {
    return value;
  }

  const [pathPart, fragment = ""] = value.split("#", 2);
  const normalized = normalizeRelativePath(pathPart);
  if (!normalized) {
    return fragment ? `#${fragment}` : "";
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 1 && isMarkdownFile(parts[0])) {
    return `/articles/${slug}${fragment ? `#${fragment}` : ""}`;
  }

  const mdIndex = parts.findIndex((part) => isMarkdownFile(part));
  if (mdIndex === parts.length - 1) {
    const targetSlug = mdIndex > 0 ? parts[mdIndex - 1] : slug;
    return `/articles/${targetSlug}${fragment ? `#${fragment}` : ""}`;
  }

  return `/articles/${slug}/${parts.join("/")}${fragment ? `#${fragment}` : ""}`;
}

function normalizeRelativePath(value: string): string {
  const inputParts = value.split("/").filter((part) => part.length > 0 && part !== ".");
  const outputParts: string[] = [];

  for (const part of inputParts) {
    if (part === "..") {
      outputParts.pop();
      continue;
    }
    outputParts.push(part);
  }

  return outputParts.join("/");
}

function isMarkdownFile(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}
