import type { Project } from "@/types";
import { getStandaloneProjectAssets, hasProjectCollectionItems } from "@/lib/project-collections";
import { getProjectAssetSectionId } from "@/lib/project-section-anchors";
import { cn } from "@/lib/utils";

interface ProjectTableOfContentsItem {
  href: string;
  label: string;
  kind?: "asset" | "section";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getTableOfContentsItems(project: Project): ProjectTableOfContentsItem[] {
  const items: ProjectTableOfContentsItem[] = [];
  const assets = getStandaloneProjectAssets(project);

  if (hasText(project.description)) {
    items.push({ href: "#description", label: "Description" });
  }

  if (hasText(project.story)) {
    items.push({ href: "#story", label: "Story" });
  }

  if (hasText(project.readme?.content)) {
    items.push({ href: "#readme", label: "README" });
  }

  if (hasProjectCollectionItems(project, { excludeAssets: true })) {
    items.push({ href: "#collection", label: "Collection" });
  }

  if (assets.length > 0) {
    assets.forEach((asset, index) => {
      items.push({
        href: `#${getProjectAssetSectionId(asset, index)}`,
        label: asset.label || asset.id || `Asset ${index + 1}`,
        kind: "asset",
      });
    });
  }

  if (project.articles?.length) {
    items.push({ href: "#articles", label: "Articles" });
  }

  if (project.workLogs?.length) {
    items.push({ href: "#work-logs", label: "Work Logs" });
  }

  items.push({ href: "#project-details", label: "Project Details" });

  return items;
}

export function ProjectTableOfContents({ project }: { project: Project }) {
  const items = getTableOfContentsItems(project);

  if (items.length < 2) {
    return null;
  }

  return (
    <nav
      aria-label="Project sections"
      className="max-w-full overflow-x-auto rounded-lg border border-border/35 bg-card/25 px-3 py-3 md:px-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:pt-2">
          On this page
        </p>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <a
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                "inline-flex max-w-full items-center rounded-full border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.kind === "asset" && "bg-muted/30 text-[11px]",
              )}
            >
              <span className="truncate">{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
