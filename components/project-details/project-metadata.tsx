import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Project } from "@/types";
import { Calendar, AlertCircle, Clock, Archive } from "lucide-react";

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

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case "done":
        return "default";
      case "in_progress":
      case "in progress":
        return "secondary";
      case "idea":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6">
      <div className="space-y-6">
        {/* Status and Dates Section - Hidden in compact mode */}
        {!compact && (
          <div className="space-y-4">
            {/* Status Badge with Follow-up */}
            {project.status && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge
                  variant={getStatusVariant(project.status)}
                  className="text-sm px-3 py-1 pointer-events-none cursor-default"
                >
                  {getStatusLabel(project.status, project.phase)}
                </Badge>
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
            <div className="grid grid-cols-2 gap-4">
              {project.createdAt && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Created</span>
                    <span className="text-sm text-foreground">
                      {formatDate(project.createdAt, { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              )}

              {project.updatedAt && (
                <div className="flex items-center gap-2">
                  {isArchived ? (
                    <Archive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {isArchived ? "Archived" : "Updated"}
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

        {/* Category and Domain Grid */}
        {(project.category || project.domain) && (
          <div className="grid grid-cols-2 gap-4">
            {project.category && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Category</p>
                <Badge variant="secondary" className="text-xs pointer-events-none cursor-default">
                  {project.category}
                </Badge>
              </div>
            )}

            {project.domain && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Domain</p>
                <Badge variant="outline" className="text-xs pointer-events-none cursor-default bg-muted/20">
                  {project.domain}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Array-based metadata */}
        {project.genres && project.genres.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Genres</p>
            <div className="flex flex-wrap gap-1">
              {project.genres.map((genre) => (
                <Badge key={genre} variant="outline" className="text-xs pointer-events-none cursor-default bg-muted/20">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {project.mediums && project.mediums.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Mediums</p>
            <div className="flex flex-wrap gap-1">
              {project.mediums.map((medium) => (
                <Badge key={medium} variant="secondary" className="text-xs pointer-events-none cursor-default">
                  {medium}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {project.tags && project.tags.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs pointer-events-none cursor-default bg-muted/20">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
