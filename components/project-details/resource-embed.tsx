"use client";

import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Resource } from "@/types";

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
  const [loadError, setLoadError] = useState(false);

  const handleOpen = () => {
    window.open(resource.url, "_blank", "noopener,noreferrer");
  };

  if (loadError) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-6 text-center space-y-3">
        <AlertCircle className="size-5 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preview unavailable for this resource.</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleOpen}>
          Open {resource.label}
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    );
  }

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
      <div
        className={`relative overflow-hidden rounded-lg border border-border bg-white transition-all duration-300 ${
          expanded ? "h-[80vh]" : "h-64 md:h-80"
        }`}
      >
        <iframe
          src={resource.url}
          title={`${projectTitle || resource.label} preview`}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
          onError={() => setLoadError(true)}
        />
      </div>
    </div>
  );
}
