"use client";

import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Resource } from "@/types";
import { LinkPreviewSurface } from "./link-preview-surface";

interface ResourceEmbedProps {
  resource: Resource;
  projectTitle?: string;
}

/** Resource types that are likely embeddable via iframe */
const EMBEDDABLE_TYPES = new Set([
  "website",
  "web",
  "blog",
  "folio",
]);

export function isEmbeddableResource(resource: Resource): boolean {
  const type = (resource.type || "").toLowerCase();
  if (EMBEDDABLE_TYPES.has(type)) return true;
  // Also allow folio/local links
  if (resource.url?.startsWith("/projects/")) return true;
  return false;
}

export function ResourceEmbed({ resource, projectTitle }: ResourceEmbedProps) {
  const [expanded, setExpanded] = useState(false);

  const handleOpen = () => {
    if (resource.url.startsWith("/")) {
      window.location.assign(resource.url);
      return;
    }
    window.open(resource.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Live Preview &mdash; {resource.label}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleOpen}
            title="Open in new tab"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>
      <LinkPreviewSurface
        url={resource.url}
        label={resource.label}
        title={resource.linkPreview?.title || `${projectTitle || resource.label} preview`}
        summary={resource.linkPreview?.description}
        preview={resource.linkPreview}
        surfaceClassName={`transition-all duration-300 ${expanded ? "h-[80vh]" : "h-64 md:h-80"}`}
        previewClassName="h-full w-full"
        iframeClassName="h-full w-full border-0"
        iframeSandbox="allow-scripts allow-same-origin allow-popups"
        openLabel={resource.url.startsWith("/") ? "Open page" : `Open ${resource.label}`}
        onOpen={handleOpen}
      />
    </div>
  );
}
