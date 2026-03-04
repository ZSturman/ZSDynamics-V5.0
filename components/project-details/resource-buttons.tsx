import { Project } from "@/types";
import ResourceButton from "./resource-button";

export default function ResourceButtons({ project, showMessage = true }: { project: Project, showMessage?: boolean }) {
  return project.resources?.length ? (
    <div className="flex flex-row flex-wrap gap-2">
      {project.resources.map((resource, index) => {
        return <ResourceButton key={`${resource.url}-${index}`} resource={resource} currentProject={project} />;
      })}
    </div>
  ) : showMessage ? (
    <div className="space-y-3">
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {project.status === "idea" && (
          <>
            This is something that&apos;s coming in the future. Email
            zasturman@gmail.com for details.
          </>
        )}
        {project.status === "in_progress" && (
          <>
            This is currently a work in progress. Email zasturman@gmail.com for
            details.
          </>
        )}
        {project.status !== "idea" && project.status !== "in_progress" && (
          <>
            No external resources are published. Email zasturman@gmail.com to
            learn more.
          </>
        )}
      </p>
    </div>
  ) : null;
}
