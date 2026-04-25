import { PassiveChip } from "@/components/ui/passive-chip";
import { MetadataTag } from "@/components/ui/metadata-text";
import { formatDate } from "@/lib/utils";
import { Project } from "@/types";
import { AlertCircle, Calendar } from "lucide-react";

interface ProjectMetadataProps {
  project: Project;
  /** Compact mode hides status/dates (used when sidebar is visible) */
  compact?: boolean;
}

export function ProjectMetadata({ project, compact = false }: ProjectMetadataProps) {
  // Determine if the project is archived (done and has a phase indicating archived)
  const isArchived = project.status === "done" && project.phase?.toLowerCase().includes("archived");

  const getStatusLabel = (status: string, subStatus?: string) => {
    if (subStatus) {
      return `${status} (${subStatus.replace(/_/g, " ")})`;
    }
    return status.replace(/_/g, " ");
  };

  return (
    <div
      data-testid="project-metadata"
      className="max-w-full overflow-hidden rounded-lg border border-border/35 bg-card/35 p-3 md:p-5"
    >
      <div className="min-w-0 space-y-5 md:space-y-6">
        {/* Status and Dates Section - Hidden in compact mode */}
        {!compact && (
          <div className="space-y-4">
            {/* Status Badge with Follow-up */}
            {project.status && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <PassiveChip
                  tone="strong"
                  className="border-transparent bg-secondary/75 px-3 py-1 text-sm text-foreground"
                >
                  {getStatusLabel(project.status, project.phase)}
                </PassiveChip>
                {project.requiresFollowUp && (
                  <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 dark:bg-amber-950/20">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-amber-900 dark:text-amber-200">
                      Follow-up needed
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Dates in a grid */}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {project.createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Started</span>
                    <span className="text-sm text-foreground">
                      {formatDate(project.createdAt, { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              )}

              {project.updatedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {isArchived ? "Archived" : "Last Updated"}
                    </span>
                    <span className="text-sm text-foreground">
                      {formatDate(project.updatedAt, { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Array-based metadata */}
        {project.genres && project.genres.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Genres</p>
            <div className="flex flex-wrap gap-1">
              {project.genres.map((genre) => (
                <PassiveChip key={genre} className="text-xs">
                  {genre}
                </PassiveChip>
              ))}
            </div>
          </div>
        )}

        {project.mediums && project.mediums.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Mediums</p>
            <div className="flex flex-wrap gap-1">
              {project.mediums.map((medium) => (
                <PassiveChip key={medium} tone="strong" className="text-xs">
                  {medium}
                </PassiveChip>
              ))}
            </div>
          </div>
        )}

        {project.tags && project.tags.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {project.tags.map((tag) => (
                <MetadataTag key={tag} tag={tag} size="sm" className="text-xs" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
