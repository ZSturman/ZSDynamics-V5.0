import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Project } from "@/types";
import { Calendar, AlertCircle, Clock, Archive } from "lucide-react";

interface ProjectSidebarProps {
  project: Project;
}

export function ProjectSidebar({ project }: ProjectSidebarProps) {
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

  // Check if we have enough metadata to show the sidebar
  const hasMetadata = 
    project.category || 
    project.domain || 
    (project.genres && project.genres.length > 0) || 
    (project.mediums && project.mediums.length > 0) || 
    (project.tags && project.tags.length > 0);

  return (
    <aside className="space-y-6">
      {/* Status Card - Most Prominent */}
      <div className="rounded-lg border border-border bg-card p-4 md:p-6">
        <div className="space-y-4">
          {/* Status Badge - Large and Prominent */}
          {project.status && (
            <div className="flex items-center justify-between">
              <Badge
                variant={getStatusVariant(project.status)}
                className="text-sm px-3 py-1 pointer-events-none cursor-default"
              >
                {getStatusLabel(project.status, project.phase)}
              </Badge>
              {project.requiresFollowUp && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Follow-up needed</span>
                </div>
              )}
            </div>
          )}

          {/* Dates Section */}
          <div className="space-y-3 pt-2 border-t border-border">
            {project.createdAt && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Started</span>
                  <span className="text-sm text-foreground">
                    {formatDate(project.createdAt, { month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            )}

            {project.updatedAt && (
              <div className="flex items-center gap-3">
                {isArchived ? (
                  <Archive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
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
      </div>

      {/* Metadata Card - Grid Layout */}
      {hasMetadata && (
        <div className="rounded-lg border border-border bg-card p-4 md:p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Details</h3>
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

          {/* Full-width sections for arrays */}
          <div className="space-y-4 mt-4">
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
      )}
    </aside>
  );
}
